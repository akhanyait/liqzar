import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import React from "react";

/**
 * Regression suite for the auth deadlock + stuck-login bug.
 *
 * The "Signing in…" button got stuck because the previous onAuthStateChange
 * callback was `async` and awaited a supabase.from(...) query, which held
 * the GoTrue internal lock and deadlocked the outer signInWithPassword.
 *
 * These tests pin the contract:
 *   1. devAutoLogin resolves within reasonable time even when the listener
 *      fires synchronously during signInWithPassword.
 *   2. devAutoLogin syncs user+role *before* returning (so the navigate
 *      effect can fire immediately on the UI).
 *   3. signOut clears all local state and scrubs Supabase token keys.
 *   4. SIGNED_OUT events clear state.
 *   5. The onAuthStateChange callback itself is not async (the whole root
 *      cause of the deadlock) — we assert its return value is NOT a Promise.
 */

type AuthStateChangeCallback = (
  event: string,
  session: { user: { id: string; phone?: string; email?: string } } | null,
) => void | Promise<void>;

interface MockSupabase {
  auth: {
    getSession: ReturnType<typeof vi.fn>;
    onAuthStateChange: ReturnType<typeof vi.fn>;
    signInWithPassword: ReturnType<typeof vi.fn>;
    signOut: ReturnType<typeof vi.fn>;
    getUser: ReturnType<typeof vi.fn>;
  };
  from: ReturnType<typeof vi.fn>;
  functions: { invoke: ReturnType<typeof vi.fn> };
  __listener: AuthStateChangeCallback | null;
  __emitAuthEvent: (
    event: string,
    session: { user: { id: string; phone?: string } } | null,
  ) => unknown;
}

const makeMockSupabase = (): MockSupabase => {
  const state: MockSupabase = {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    },
    from: vi.fn(),
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    __listener: null,
    __emitAuthEvent: () => undefined,
  };

  state.auth.onAuthStateChange.mockImplementation((cb: AuthStateChangeCallback) => {
    state.__listener = cb;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });

  state.__emitAuthEvent = (event, session) => {
    if (!state.__listener) return undefined;
    return state.__listener(event, session);
  };

  // Default: user_roles returns 'customer'
  state.from.mockImplementation((table: string) => {
    if (table === "user_roles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: { role: "customer" }, error: null }),
          }),
        }),
      };
    }
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null, error: null }),
          }),
        }),
      };
    }
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
  });

  return state;
};

let mockSupabase: MockSupabase;

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() {
    return mockSupabase;
  },
}));

// Import AFTER the mock is registered.
let AuthProvider: typeof import("./AuthContext").AuthProvider;
let useAuth: typeof import("./AuthContext").useAuth;

beforeEach(async () => {
  mockSupabase = makeMockSupabase();
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  localStorage.clear();
  // Re-import the module so it picks up the fresh mock (vi.resetModules is a no-op with ESM modules like this one).
  const mod = await import("./AuthContext");
  AuthProvider = mod.AuthProvider;
  useAuth = mod.useAuth;
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

// Helpers -------------------------------------------------------------------

type Captured = ReturnType<typeof import("./AuthContext").useAuth>;

const Harness: React.FC<{ onReady: (ctx: Captured) => void }> = ({ onReady }) => {
  const ctx = useAuth();
  React.useEffect(() => {
    onReady(ctx);
  });
  return null;
};

const renderAuth = async () => {
  let captured: Captured | null = null;
  const handle = render(
    <AuthProvider>
      <Harness onReady={(ctx) => (captured = ctx)} />
    </AuthProvider>,
  );
  // Flush init effect (supabase.auth.getSession resolves → setLoading(false)).
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  return { handle, get: () => captured! };
};

// Tests ---------------------------------------------------------------------

describe("AuthContext — onAuthStateChange callback is synchronous (root cause of deadlock)", () => {
  it("the listener callback must NOT return a Promise", async () => {
    await renderAuth();
    expect(mockSupabase.auth.onAuthStateChange).toHaveBeenCalledTimes(1);
    const ret = mockSupabase.__emitAuthEvent("INITIAL_SESSION", null);
    // A Promise here would mean Supabase's lock awaits this callback — the deadlock bug.
    expect(ret).toBeUndefined();
  });

  it("SIGNED_IN defers the sync to a macrotask (not inline await)", async () => {
    const { get } = await renderAuth();

    const session = {
      user: { id: "uuid-1", phone: "", email: "customer@liqzar.co.za" },
    };

    // Synchronously dispatch the event — the callback must return immediately.
    const t0 = performance.now();
    const ret = mockSupabase.__emitAuthEvent("SIGNED_IN", session);
    const elapsed = performance.now() - t0;
    expect(ret).toBeUndefined();
    expect(elapsed).toBeLessThan(20); // synchronous

    // Role is NOT yet set (deferred to setTimeout).
    expect(get().role).toBeNull();

    // Advance the macrotask queue → deferred sync runs → role set.
    await act(async () => {
      vi.runAllTimers();
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(get().role).toBe("customer");
  });
});

describe("AuthContext — devAutoLogin (the Customer/Driver/Admin test buttons)", () => {
  it("resolves and sets user+role when signInWithPassword succeeds", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: "uuid-customer", email: "customer@liqzar.co.za", phone: "" } },
        user: { id: "uuid-customer" },
      },
      error: null,
    });

    const { get } = await renderAuth();

    await act(async () => {
      const res = await get().devAutoLogin("0790771591");
      expect(res.error).toBeNull();
    });

    expect(get().user?.id).toBe("uuid-customer");
    expect(get().role).toBe("customer");
    expect(localStorage.getItem("liqzar-last-phone")).toBe("0790771591");
  });

  it(
    "does NOT hang even when the auth listener fires synchronously during sign-in (deadlock regression)",
    { timeout: 2000 },
    async () => {
      // Simulate Supabase firing the listener mid-signIn. Previously this
      // deadlocked because the listener was async and awaited a DB query
      // while the outer signInWithPassword held the GoTrue lock.
      mockSupabase.auth.signInWithPassword.mockImplementation(async () => {
        const session = { user: { id: "uuid-driver", email: "driver@liqzar.co.za", phone: "" } };
        mockSupabase.__emitAuthEvent("SIGNED_IN", session);
        return { data: { session, user: session.user }, error: null };
      });

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === "user_roles") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { role: "driver" }, error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        };
      });

      const { get } = await renderAuth();

      // If the old deadlock regressed, vitest's 2s test timeout trips.
      await act(async () => {
        const res = await get().devAutoLogin("0621532030");
        expect(res.error).toBeNull();
      });

      // Drain the deferred-sync macrotask scheduled by the listener.
      await act(async () => {
        vi.runAllTimers();
        await Promise.resolve();
      });

      expect(get().user?.id).toBe("uuid-driver");
      expect(get().role).toBe("driver");
    },
  );

  it("falls back to loginLocal when signInWithPassword fails twice", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: "invalid_credentials", name: "AuthError", status: 400 },
    });
    mockSupabase.from.mockImplementation((table: string) => {
      if (table === "profiles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: "fallback-uuid" }, error: null }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) };
    });

    const { get } = await renderAuth();

    await act(async () => {
      const res = await get().devAutoLogin("0790771567");
      expect(res.error).toBeNull();
    });

    expect(mockSupabase.functions.invoke).toHaveBeenCalledWith("seed-test-users");
    expect(get().user?.id).toBe("fallback-uuid");
    expect(get().role).toBe("admin");
  });

  it("rejects unknown phone numbers cleanly (no hang, clear error)", async () => {
    const { get } = await renderAuth();

    let result: { error: Error | null } = { error: null };
    await act(async () => {
      result = await get().devAutoLogin("9999999999");
    });

    expect(result.error).not.toBeNull();
    expect(result.error?.message).toContain("No test credentials");
    expect(get().user).toBeNull();
  });
});

describe("AuthContext — signOut", () => {
  it("clears user/role state and wipes supabase token keys from localStorage", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: "uuid-x", email: "customer@liqzar.co.za", phone: "" } },
        user: { id: "uuid-x" },
      },
      error: null,
    });

    const { get } = await renderAuth();
    await act(async () => {
      await get().devAutoLogin("0790771591");
    });

    // Seed leftover tokens to prove signOut scrubs them.
    localStorage.setItem("sb-abc-auth-token", "leftover");
    localStorage.setItem("liqzar_test_auth", JSON.stringify({ phone: "0790771591" }));
    expect(get().user).not.toBeNull();

    await act(async () => {
      await get().signOut();
    });

    expect(get().user).toBeNull();
    expect(get().role).toBeNull();
    expect(localStorage.getItem("sb-abc-auth-token")).toBeNull();
    expect(localStorage.getItem("liqzar_test_auth")).toBeNull();
    expect(localStorage.getItem("liqzar-last-phone")).toBeNull();
    expect(mockSupabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("SIGNED_OUT event from Supabase clears state even without explicit signOut call", async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: {
        session: { user: { id: "uuid-y", email: "customer@liqzar.co.za", phone: "" } },
        user: { id: "uuid-y" },
      },
      error: null,
    });

    const { get } = await renderAuth();
    await act(async () => {
      await get().devAutoLogin("0790771591");
    });
    expect(get().user?.id).toBe("uuid-y");

    // Simulate Supabase invalidating the token (e.g. refresh-token failure).
    await act(async () => {
      mockSupabase.__emitAuthEvent("SIGNED_OUT", null);
      await Promise.resolve();
    });

    expect(get().user).toBeNull();
    expect(get().role).toBeNull();
  });
});
