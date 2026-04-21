import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Regression suite for the "Pay Now" / resumePayment flow.
 *
 * Contract this pins:
 *   1. resumePayment short-circuits when a confirmed payment already exists.
 *   2. Stuck pending/awaiting_payment rows are marked `failed` before a new
 *      payment record is created (matches mobile's idempotency guard).
 *   3. A fresh pending payment is created and the Edge Function is invoked
 *      with MODE A args (paymentId, orderId, amount, paymentMethod).
 *   4. The order's payment_status is flipped back to awaiting_payment before
 *      the gateway call (so the UI reflects the retry state).
 *   5. COD orders are rejected — they shouldn't hit the online gateway.
 */

interface ChainMock {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  not: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
}

const makeChain = (): ChainMock => {
  const chain = {} as ChainMock;
  chain.select = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.not = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.maybeSingle = vi.fn();
  chain.single = vi.fn();
  return chain;
};

interface MockSupabase {
  from: ReturnType<typeof vi.fn>;
  functions: { invoke: ReturnType<typeof vi.fn> };
  auth: { getSession: ReturnType<typeof vi.fn> };
  __chainsByTable: Record<string, ChainMock[]>;
  __getLastChain: (table: string) => ChainMock | undefined;
}

const makeSupabase = (): MockSupabase => {
  const chainsByTable: Record<string, ChainMock[]> = {};
  const sb: MockSupabase = {
    from: vi.fn((table: string) => {
      const chain = makeChain();
      chainsByTable[table] = chainsByTable[table] ?? [];
      chainsByTable[table].push(chain);
      return chain;
    }),
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "u-1" } } },
        error: null,
      }),
    },
    __chainsByTable: chainsByTable,
    __getLastChain: (table: string) => {
      const arr = chainsByTable[table];
      return arr?.[arr.length - 1];
    },
  };
  return sb;
};

let mockSupabase: MockSupabase;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return mockSupabase;
  },
}));

let resumePayment: typeof import("./payment-gateway").resumePayment;

beforeEach(async () => {
  mockSupabase = makeSupabase();
  const mod = await import("./payment-gateway");
  resumePayment = mod.resumePayment;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("resumePayment", () => {
  it("refuses when there is no Supabase auth session (test-mode fallback)", async () => {
    mockSupabase.auth.getSession.mockResolvedValueOnce({ data: { session: null }, error: null });
    const res = await resumePayment("ord-0");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/sign in|session/i);
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("short-circuits when the order is already captured", async () => {
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({
      data: {
        id: "ord-1",
        total: 100,
        payment_method: "card",
        payment_status: "captured",
        status: "confirmed",
        user_id: "u-1",
      },
      error: null,
    });
    mockSupabase.from.mockImplementationOnce(() => orderChain);

    const res = await resumePayment("ord-1");

    expect(res.success).toBe(true);
    expect(res.orderId).toBe("ord-1");
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("rejects cash on delivery orders", async () => {
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({
      data: {
        id: "ord-cod",
        total: 100,
        payment_method: "cash_on_delivery",
        payment_status: "awaiting_payment",
        status: "pending",
        user_id: "u-1",
      },
      error: null,
    });
    mockSupabase.from.mockImplementationOnce(() => orderChain);

    const res = await resumePayment("ord-cod");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/COD/);
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("returns early if a previous payment is already authorized", async () => {
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({
      data: {
        id: "ord-2",
        total: 100,
        payment_method: "card",
        payment_status: "awaiting_payment",
        status: "pending",
        user_id: "u-1",
      },
      error: null,
    });

    const paymentsChain = makeChain();
    // The service awaits the chain directly after .order(); it resolves like a Promise.
    const promise = Promise.resolve({
      data: [{ id: "p-authed", status: "authorized", gateway_reference: "yoco-xxx" }],
      error: null,
    });
    paymentsChain.order.mockReturnValue(promise);

    const profileChain = makeChain();
    profileChain.maybeSingle.mockResolvedValue({ data: { email: "c@test.za", phone: "0790000000" }, error: null });

    mockSupabase.from.mockImplementationOnce(() => orderChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsChain);
    mockSupabase.from.mockImplementationOnce(() => profileChain);

    const res = await resumePayment("ord-2");
    expect(res.success).toBe(true);
    expect(res.paymentReference).toBe("yoco-xxx");
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("marks stuck payments failed, creates fresh payment, invokes EF", async () => {
    // 1. orders (fetch)
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({
      data: {
        id: "ord-3",
        total: 250,
        payment_method: "card",
        payment_status: "awaiting_payment",
        status: "pending",
        user_id: "u-3",
      },
      error: null,
    });

    // 2. payments (select stuck)
    const paymentsSelectChain = makeChain();
    paymentsSelectChain.order.mockReturnValue(
      Promise.resolve({
        data: [
          { id: "p-stuck-1", status: "pending", gateway_reference: null },
          { id: "p-stuck-2", status: "awaiting_payment", gateway_reference: null },
        ],
        error: null,
      }),
    );

    // 3. payments (mark stuck failed)
    const paymentsUpdateChain = makeChain();
    paymentsUpdateChain.in.mockResolvedValue({ data: null, error: null });

    // 4. profiles (email/phone)
    const profileChain = makeChain();
    profileChain.maybeSingle.mockResolvedValue({
      data: { email: "c@test.za", phone: "0790000000" },
      error: null,
    });

    // 5. payments (insert fresh)
    const paymentsInsertChain = makeChain();
    paymentsInsertChain.single.mockResolvedValue({
      data: { id: "p-fresh", status: "pending" },
      error: null,
    });

    // 6. orders (update payment_status)
    const ordersUpdateChain = makeChain();
    ordersUpdateChain.eq.mockResolvedValue({ data: null, error: null });

    mockSupabase.from.mockImplementationOnce(() => orderChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsSelectChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsUpdateChain);
    mockSupabase.from.mockImplementationOnce(() => profileChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsInsertChain);
    mockSupabase.from.mockImplementationOnce(() => ordersUpdateChain);

    mockSupabase.functions.invoke.mockResolvedValue({
      data: {
        success: true,
        redirectUrl: "https://pay.yoco.com/checkout/abc",
        gatewayReference: "yoco-ref-123",
      },
      error: null,
    });

    const res = await resumePayment("ord-3");

    // Stuck rows marked failed
    expect(paymentsUpdateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", failure_reason: expect.any(String) }),
    );
    expect(paymentsUpdateChain.in).toHaveBeenCalledWith("id", ["p-stuck-1", "p-stuck-2"]);

    // Fresh payment created
    expect(paymentsInsertChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        order_id: "ord-3",
        amount: 250,
        status: "pending",
        payment_method: "card",
        gateway: "ozow",
      }),
    );

    // Order flipped back to awaiting_payment
    expect(ordersUpdateChain.update).toHaveBeenCalledWith({ payment_status: "awaiting_payment" });

    // EF called with MODE A args
    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith(
      "initiate-payment",
      expect.objectContaining({
        body: expect.objectContaining({
          paymentId: "p-fresh",
          orderId: "ord-3",
          amount: 250,
          currency: "ZAR",
          paymentMethod: "card",
          customerEmail: "c@test.za",
          customerPhone: "0790000000",
        }),
      }),
    );

    expect(res.success).toBe(true);
    expect(res.redirectUrl).toBe("https://pay.yoco.com/checkout/abc");
    expect(res.paymentReference).toBe("yoco-ref-123");
  });

  it("returns an error when the order does not exist", async () => {
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({ data: null, error: null });
    mockSupabase.from.mockImplementationOnce(() => orderChain);

    const res = await resumePayment("missing");
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
    expect(mockSupabase.functions.invoke).not.toHaveBeenCalled();
  });

  it("surfaces EF failure cleanly", async () => {
    const orderChain = makeChain();
    orderChain.maybeSingle.mockResolvedValue({
      data: {
        id: "ord-4",
        total: 100,
        payment_method: "card",
        payment_status: "awaiting_payment",
        status: "pending",
        user_id: "u-4",
      },
      error: null,
    });

    const paymentsSelectChain = makeChain();
    paymentsSelectChain.order.mockReturnValue(Promise.resolve({ data: [], error: null }));

    const profileChain = makeChain();
    profileChain.maybeSingle.mockResolvedValue({ data: null, error: null });

    const paymentsInsertChain = makeChain();
    paymentsInsertChain.single.mockResolvedValue({ data: { id: "p-new" }, error: null });

    const ordersUpdateChain = makeChain();
    ordersUpdateChain.eq.mockResolvedValue({ data: null, error: null });

    mockSupabase.from.mockImplementationOnce(() => orderChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsSelectChain);
    mockSupabase.from.mockImplementationOnce(() => profileChain);
    mockSupabase.from.mockImplementationOnce(() => paymentsInsertChain);
    mockSupabase.from.mockImplementationOnce(() => ordersUpdateChain);

    mockSupabase.functions.invoke.mockResolvedValue({
      data: { success: false, error: "Gateway down" },
      error: null,
    });

    const res = await resumePayment("ord-4");
    expect(res.success).toBe(false);
    expect(res.error).toBe("Gateway down");
  });
});
