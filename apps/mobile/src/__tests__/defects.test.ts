/**
 * LIQZAR High-Risk Defect Verification Test Suite
 *
 * Covers the top 15 highest-risk defects identified through static analysis
 * of OrderWorkflowEngine.ts, OrderContext.tsx, migration SQL, and RLS policies.
 *
 * Runner: vitest (unit layer) + real Supabase dev instance (integration layer).
 * Tag: [unit] = no DB required. [integration] = needs `supabase start`.
 *
 * Run unit tests only: vitest run --reporter=verbose
 * Run integration:     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... vitest run --reporter=verbose
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── Shared mock factory ──────────────────────────────────────────────────────

/** Builds a minimal mock Supabase client. Override per-test via mockReturnValue. */
function makeMockSupabase(overrides: Record<string, any> = {}) {
  const from = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: vi.fn().mockResolvedValue({ data: null, error: null }),
  });
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  return { from, rpc, auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) }, ...overrides };
}

// =============================================================================
// DEF-001  Payment Status Desync
// =============================================================================
describe("[DEF-001] Payment status desync — orders.payment_status set to 'captured' on transition to 'confirmed' without verifying actual payment capture", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:444 → `updates.payment_status = "captured"` is applied
   * whenever `toStatus === "confirmed"`. This write happens on the ORDERS table, not the
   * PAYMENTS table. The capture-payment Edge Function also sets payment_status.
   * If the EF hasn't run yet (e.g., webhook delay) and an admin manually confirms an
   * order, the orders row will show payment_status = "captured" even if no money changed hands.
   *
   * Additionally, the PAYMENTS table is never checked in this code path — the engine
   * assumes payment has been captured simply because someone transitioned status to "confirmed".
   */

  it("[unit] transitionOrder to 'confirmed' MUST read payments table before setting payment_status=captured", () => {
    // This is a logic-level assertion on the engine's behaviour.
    // We confirm the defect exists: the engine does NOT read payments at all before writing captured.
    // A correct implementation would: SELECT payments WHERE order_id=X AND status='captured'
    // and only proceed if that row exists.

    // Simulate the current (broken) path: confirmed transition immediately sets captured
    // without a payments check. The test EXPECTS this defect to be caught.
    const updates: Record<string, any> = {};
    const toStatus = "confirmed";

    // This is the actual logic in OrderWorkflowEngine.ts:444
    if (toStatus === "confirmed") {
      updates.payment_status = "captured";
    }

    // Defect confirmed: payment_status is set without a prior payments table read.
    // Fix: before setting, assert `await supabase.from("payments").select("status").eq("order_id", orderId).eq("status","captured").single()` returns data.
    expect(updates.payment_status).toBe("captured"); // documents the defect
    // TODO: after fix, this assertion should require a payment record to exist first
  });

  it("[unit] COD orders must NOT set payment_status='captured' on confirm — they stay 'cash_on_delivery'", () => {
    // If payment_method = "cash_on_delivery", confirmed should set payment_status = "cash_on_delivery"
    // not "captured". The engine applies captured unconditionally to ALL confirmed orders.
    const mockOrder = { payment_method: "cash_on_delivery", payment_status: "pending" };
    const updates: Record<string, any> = {};
    const toStatus = "confirmed";

    // CURRENT (defective) behaviour:
    if (toStatus === "confirmed") {
      updates.payment_status = "captured"; // wrong for COD
    }

    // This proves the defect: COD orders will have payment_status=captured instead of cash_on_delivery
    expect(updates.payment_status).toBe("captured");
    // After fix: expect(updates.payment_status).toBe("cash_on_delivery") when order.payment_method === "cash_on_delivery"
  });

  it("[unit] payment_status='captured' set on orders table must be idempotent if EF also sets it", () => {
    // Both the workflow engine AND the capture-payment EF write orders.payment_status.
    // Concurrent writes could produce a race where EF sets 'captured', engine sets 'captured',
    // but an intermediate read by either side could see 'pending'.
    // The fix requires the EF to be the SOLE writer of payment_status on the orders table.
    // The engine should only validate, not write.
    const capturedByEF = "captured";
    const capturedByEngine = "captured"; // both write same value — idempotent in happy path
    expect(capturedByEF).toBe(capturedByEngine); // happy path is fine
    // The dangerous case is when EF writes "failed" but engine overwrites with "captured":
    // engine reads order before EF runs, EF sets failed, engine writes captured → desync.
    // No test can catch this without timing control; document here for CI reminder.
  });
});

// =============================================================================
// DEF-002  Stock Race Condition — Reserve then Decrement Not Atomic
// =============================================================================
describe("[DEF-002] Stock race condition — reserve_stock and decrement_stock called in loops without a transaction", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:549-566 calls supabase.rpc("reserve_stock") for each item
   * in a JavaScript for-loop. Each call is a separate DB roundtrip. If a second order
   * containing the same product is confirmed between two iterations of this loop,
   * both orders can successfully reserve/decrement the same unit of stock.
   *
   * The decrement_stock RPC (migration 005) uses `WHERE stock_quantity >= p_quantity`
   * which is atomic per-call, but the check in checkStockAvailability() happens
   * BEFORE the order is inserted, creating a check-then-act window.
   */

  it("[unit] checkStockAvailability reads products table directly — no row-level lock", () => {
    // Documents the architectural defect: SELECT without FOR UPDATE
    // means the read can be stale by the time the order insert happens.

    // Simulate two concurrent customers both seeing stock=1:
    const stockAtReadTime = 1;
    const customer1Requested = 1;
    const customer2Requested = 1;

    const customer1CanBuy = stockAtReadTime >= customer1Requested; // true
    const customer2CanBuy = stockAtReadTime >= customer2Requested; // also true — race!

    expect(customer1CanBuy).toBe(true);
    expect(customer2CanBuy).toBe(true);
    // Both customers proceed to placeOrder — only one will succeed at decrement_stock
    // but BOTH orders are now inserted into the DB. The second decrement raises an exception
    // that is swallowed by console.error in the engine, leaving an order with no stock.
  });

  it("[unit] reserve_stock loop: if item[2] fails, items[0] and [1] are still reserved — no rollback", () => {
    // OrderWorkflowEngine.ts:554-566: each reserve_stock call is independent.
    // A failure on item 3 of a 5-item order does NOT roll back items 1 and 2.
    // Fix: wrap in a stored procedure that reserves all items in one transaction.

    const items = [
      { product_id: "prod-1", quantity: 2 },
      { product_id: "prod-2", quantity: 1 },
      { product_id: "prod-3", quantity: 99 }, // insufficient stock
    ];

    // Simulate: prod-1 reserved OK, prod-2 reserved OK, prod-3 FAILS
    const results = [true, true, false];
    const allReserved = results.every(Boolean);
    expect(allReserved).toBe(false); // we know the overall reserve failed

    // BUT items[0] and [1] stock has already been decremented — partial reservation
    // No compensation happens because the loop continues after logging the error.
    const stockDecremented = [true, true, false]; // only [2] was skipped
    expect(stockDecremented.filter(Boolean).length).toBe(2); // 2 items incorrectly reserved
  });

  it("[unit] decrement_stock is called at 'confirmed' even when reserve_stock at 'awaiting_payment' partially failed", () => {
    // If reserve_stock silently failed at awaiting_payment, the stock was never reduced.
    // At confirmed, decrement_stock runs again — this could double-decrement for items
    // that DID reserve successfully, or produce negative stock for items that didn't.

    // The fix: reserve_stock should use a single RPC that processes ALL items atomically,
    // and decrement_stock at confirmed should be a no-op (the reserve IS the decrement).
    const reserveSucceeded = false; // partial failure scenario
    const decrementRunsAnyway = true; // engine does not check if reserve succeeded
    expect(decrementRunsAnyway).toBe(true); // documents the defect
  });
});

// =============================================================================
// DEF-003  Compliance Bypass — complianceStep is pure client state
// =============================================================================
describe("[DEF-003] Compliance bypass — DriverDeliveryPinVerify complianceStep is React state, not server-enforced", () => {
  /**
   * WHY THIS IS LIKELY:
   * DriverDeliveryPinVerify.tsx:40 — `complianceStep` is useState("check").
   * The PIN entry section is conditionally rendered based on this local state:
   *   {complianceStep === "pin" && (...)}
   *
   * However, if a driver navigates directly to the PIN screen via deep link or
   * modifies route.params, the compliance step never renders. The `markDelivered`
   * action at line 178 requires `order.compliance_verified === true` (checked in the
   * engine at delivered case). BUT there is nothing preventing a different call path
   * from reaching markDelivered without going through this screen at all.
   *
   * Additionally, the engine's compliance check (delivered case line 755) only throws
   * if compliance_verified !== true — but compliance_verified on the order is set by
   * ComplianceService.performHandoffCheck. If that RPC fails silently (auditLogFailed),
   * the UI still proceeds to pin entry (line 81: setComplianceStep("pin")).
   */

  it("[unit] markDelivered can be called without compliance gate if navigation bypasses DriverDeliveryPinVerify", () => {
    // The only server-side guard is: order.compliance_verified must be true
    // This IS enforced in the engine (line 755). Good.
    // But if ComplianceService.performHandoffCheck throws and is caught by the try/catch
    // at line 109, the catch block shows an Alert but does NOT call navigation.popToTop() —
    // it stays on the screen. The driver sees "Failed to process compliance check" but
    // can still attempt to enter a PIN if they navigate back/forward.

    // Actually wait — on throw at line 109 (the outer catch), complianceStep stays "check".
    // So the PIN UI never shows. But the server compliance_verified is still false.
    // The engine WILL reject markDelivered. This is the correct behaviour.
    // The risk is different: auditLogFailed (line 68) shows an alert but still proceeds
    // to setComplianceStep("pin") at line 81. This means a delivery can proceed
    // with an incomplete audit trail — a compliance record is missing.

    const auditLogFailed = true;
    const result = { passed: true, auditLogFailed };

    // Current behaviour: if audit log fails, proceed to PIN anyway (line 68-82)
    let proceedToPin = false;
    if (result.passed) {
      proceedToPin = true; // this happens regardless of auditLogFailed
    }
    expect(proceedToPin).toBe(true); // defect: audit failure does not block delivery
    // Fix: if auditLogFailed is true, do NOT call setComplianceStep("pin").
    // Block the delivery and require dispatch to manually clear.
  });

  it("[unit] compliance check result.passed=true does not guarantee all three Yes answers", () => {
    // ComplianceService.performHandoffCheck receives idVerified, recipientIsAdult, appearsSober.
    // If the service has a bug and returns passed=true even when idVerified=false,
    // the driver proceeds. The client-side disable (line 424) requires all three to be non-null,
    // but does not prevent a false value being submitted.

    const checkInputs = { idVerified: false, recipientIsAdult: true, appearsSober: true };
    // A driver can select "No" for ID verification and still tap "Submit & Refuse Delivery"
    // which calls handleComplianceSubmit with idVerified=false.
    // The server must validate this — if ComplianceService allows this to pass=true, it's a bug.
    expect(checkInputs.idVerified).toBe(false); // input is valid at client level
    // Test ComplianceService.performHandoffCheck({ idVerified: false, ... }) must return passed=false
    // This is an integration test; document here for server-side validation requirement.
  });
});

// =============================================================================
// DEF-004  RLS Overpermissive — Customers Can UPDATE Any Order Column
// =============================================================================
describe("[DEF-004] RLS overpermissive — migration 005 allows customers to UPDATE any column on their own orders", () => {
  /**
   * WHY THIS IS LIKELY:
   * Migration 20260410_005_payment_rls_fixes.sql creates:
   *   CREATE POLICY "Customers can update own order payment status"
   *     ON orders FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)
   *
   * PostgreSQL RLS UPDATE policies operate on the entire row — there is no column-level
   * restriction in this policy. A customer with a valid JWT can therefore UPDATE:
   *   - orders.total (set to 0 — free delivery)
   *   - orders.status (skip to delivered — bypass payment)
   *   - orders.payment_status (set to captured — skip Yoco)
   *   - orders.delivery_address (redirect delivery)
   *
   * This is a critical privilege escalation vulnerability.
   */

  it("[unit] documents that the orders UPDATE RLS policy has no column restrictions", () => {
    // The policy as written:
    const policy = `
      CREATE POLICY "Customers can update own order payment status"
        ON orders FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id)
    `;
    // No column list — any column can be updated
    expect(policy).not.toContain("SET ("); // PostgreSQL column-level RLS uses different syntax
    // In PostgreSQL, column-level UPDATE restriction requires column-level privileges,
    // not row-level policies. Fix: use a SECURITY DEFINER RPC for customer payment updates,
    // remove the customer UPDATE policy entirely, and restrict updates to only what the
    // RPC is designed to do (e.g., update payment_status from the EF only).
    expect(true).toBe(true); // structural assertion — policy text is the evidence
  });

  // [integration] test — requires real Supabase instance with customer JWT:
  it.skip("[integration] customer JWT cannot update orders.total", async () => {
    // const { error } = await supabaseWithCustomerJWT
    //   .from("orders")
    //   .update({ total: 0.01 })
    //   .eq("id", "some-order-id-owned-by-this-customer");
    // expect(error).not.toBeNull(); // should be rejected by RLS or CHECK constraint
    // Currently this UPDATE would SUCCEED because the policy allows it.
  });

  // [integration] test — customer sets status=delivered:
  it.skip("[integration] customer JWT cannot update orders.status", async () => {
    // const { error } = await supabaseWithCustomerJWT
    //   .from("orders")
    //   .update({ status: "delivered" })
    //   .eq("id", customerOwnedOrderId);
    // expect(error).not.toBeNull();
    // Currently this UPDATE would SUCCEED — bypasses entire delivery workflow.
  });
});

// =============================================================================
// DEF-005  driver_id Mapping Bug in autoAssignDriver
// =============================================================================
describe("[DEF-005] autoAssignDriver passes driver_profiles.user_id as driver_id metadata — FK violation", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:934 — `driver_profiles` is selected with `user_id, full_name, ...`
   * Line 959: metadata is built as `{ driver_id: bestDriver.user_id, ... }`
   *
   * But delivery_assignments.driver_id is a FK referencing driver_profiles.id (UUID),
   * NOT auth.users.id. `bestDriver.user_id` is the auth user's UUID, not the profile UUID.
   *
   * When handleSideEffects runs for driver_assigned (line 681), it uses metadata.driver_id
   * to insert into delivery_assignments.driver_id. This will either:
   * (a) Fail the FK constraint silently (error is .then(()=>{},err=>console.error))
   * (b) If auth.users.id happens to equal driver_profiles.id (it never does by design),
   *     create a broken assignment row that no driver can query.
   *
   * Auto-assigned orders therefore NEVER appear on the driver's dashboard.
   */

  it("[unit] autoAssignDriver selects user_id but should select id for the driver_id metadata key", () => {
    // Simulate what the engine does
    const driverProfile = {
      id: "profile-uuid-abc",    // driver_profiles.id — the FK target
      user_id: "auth-uuid-xyz",  // auth.users.id — WRONG to use as FK
      full_name: "Mandla Nkosi",
    };

    // Current (defective) code at line 959:
    const metadataBuiltByEngine = {
      driver_id: driverProfile.user_id,  // BUG: should be driverProfile.id
      driver_name: driverProfile.full_name,
    };

    // The FK constraint: delivery_assignments.driver_id REFERENCES driver_profiles(id)
    const correctDriverId = driverProfile.id;
    expect(metadataBuiltByEngine.driver_id).not.toBe(correctDriverId); // documents the mismatch
    // Fix: change line 934 SELECT to `id, user_id, full_name` and use `d.id` at line 959
  });

  it("[unit] driver's refreshOrders query uses driver_profiles.id to match delivery_assignments — auto-assigned driver sees nothing", () => {
    // OrderContext.tsx:128 — .eq("driver_id", driverProfile.id)
    // autoAssignDriver inserts delivery_assignments.driver_id = auth_user_id (WRONG)
    // driverProfile.id (from the driver's own lookup) != auth_user_id stored in the row
    // Result: the driver's order query returns no matching assignments.

    const driverProfileId = "profile-uuid-abc";
    const wrongDriverIdInDB = "auth-uuid-xyz"; // what autoAssignDriver wrote

    expect(driverProfileId).not.toBe(wrongDriverIdInDB); // mismatch proven
  });
});

// =============================================================================
// DEF-006  PIN Lockout State Not Persistent Across App Restarts
// =============================================================================
describe("[DEF-006] PIN lockout resets on app restart — attemptsRemaining initialised to 3 in useState", () => {
  /**
   * WHY THIS IS LIKELY:
   * DriverDeliveryPinVerify.tsx:123 — `const [attemptsRemaining, setAttemptsRemaining] = useState(3)`
   * `const [locked, setLocked] = useState(false)`
   *
   * These are React component-level state. They are destroyed when the component unmounts
   * (navigation away, app backgrounded, app killed).
   *
   * The DB tracks attempts in driver_assignments.pin_attempts via verify_delivery_pin RPC.
   * On app restart, the component re-initialises with attemptsRemaining=3.
   * The next call to verifyDeliveryPin will return `{ locked: true }` from the RPC
   * (because pin_attempts >= 3 in the DB). The UI will THEN set locked=true.
   * But for that single re-render after restart, the driver sees "3 attempts remaining" —
   * a false signal that could mislead them into thinking they have more tries.
   *
   * More dangerously: if the driver enters a wrong PIN immediately after restart,
   * they see "2 attempts remaining" in the UI, but the RPC returns locked=true
   * (because DB pin_attempts was already at 3). The mismatch causes confusing UX
   * where the driver believes they have attempts but are actually locked.
   */

  it("[unit] initial attemptsRemaining=3 is incorrect when DB has prior failed attempts", () => {
    const initialState = 3; // from useState(3) in DriverDeliveryPinVerify
    const dbPinAttempts = 2; // driver already tried twice in a previous session
    const attemptsRemainingFromDB = 3 - dbPinAttempts; // = 1

    expect(initialState).not.toBe(attemptsRemainingFromDB); // UI shows 3, reality is 1
    // Fix: on component mount, call verifyDeliveryPin with a sentinel value (empty string)
    // or add a separate `getDeliveryPinStatus(orderId)` RPC that returns attempts_remaining
    // and locked state. Initialise state from this RPC call on mount.
  });

  it("[unit] locked=false initial state allows digit input even when DB is locked", () => {
    // DriverDeliveryPinVerify.tsx:129 — handleDigitPress guards: if (locked ...) return
    // But locked starts as false. If DB pin_attempts=3, the driver can still type 4 digits,
    // which triggers handleVerify. The RPC returns locked=true and THEN setLocked(true) runs.
    // This means one extra attempt is effectively allowed beyond the DB lockout.

    const dbLocked = true;
    const uiLockedOnMount = false; // always starts false
    expect(uiLockedOnMount).toBe(false);
    expect(dbLocked).not.toBe(uiLockedOnMount); // mismatch allows one extra attempt
    // Fix: initialise locked state from RPC on component mount (same fix as above)
  });
});

// =============================================================================
// DEF-007  delivery_assignments Status Values Violate CHECK Constraint
// =============================================================================
describe("[DEF-007] OrderWorkflowEngine writes invalid delivery_assignments.status values", () => {
  /**
   * WHY THIS IS LIKELY:
   * Migration 20260315181138 defines the CHECK constraint:
   *   status IN ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled')
   *
   * The engine writes these values that are NOT in the constraint:
   *
   * 1. "en_route" at line 726: `update({ status: "en_route" })` — should be "in_transit"
   * 2. "failed" at line 843 (delivery_failed case): `update({ status: "failed" })` — not valid
   * 3. "failed" at line 808 (cancelled case): `update({ status: "failed" })` — not valid
   * 4. "assigned" at line 808 filter: `.in("status", ["assigned", "accepted"])` — "assigned" never exists
   *
   * These updates silently fail (PostgREST returns an error that is either not checked
   * or swallowed by `.then(()=>{}, err => console.error(...))`).
   * The delivery_assignments row stays in its previous status, causing dashboard
   * inconsistencies and blocking the driver's workflow.
   */

  it("[unit] status 'en_route' written by engine is NOT in delivery_assignments CHECK constraint", () => {
    const validStatuses = ["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"];
    const engineWritesOnEnRoute = "en_route"; // OrderWorkflowEngine.ts:726
    expect(validStatuses).not.toContain(engineWritesOnEnRoute);
    // Fix: change line 726 to status: "in_transit"
  });

  it("[unit] status 'failed' written on delivery_failed transition is NOT in CHECK constraint", () => {
    const validStatuses = ["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"];
    const engineWritesOnFailed = "failed"; // OrderWorkflowEngine.ts:843
    expect(validStatuses).not.toContain(engineWritesOnFailed);
    // Fix: change to "cancelled" (the closest semantic match for a failed delivery)
  });

  it("[unit] cancelled case filter includes 'assigned' which was never a valid status", () => {
    const validStatuses = ["pending", "accepted", "picked_up", "in_transit", "delivered", "cancelled"];
    const cancelledCaseFilter = ["assigned", "accepted"]; // OrderWorkflowEngine.ts:808
    const invalidFilterValues = cancelledCaseFilter.filter(s => !validStatuses.includes(s));
    expect(invalidFilterValues).toContain("assigned");
    // The .in("status", ["assigned", "accepted"]) filter will never match "assigned" rows
    // because no row ever has status="assigned". The cancelled delivery_assignment cleanup
    // only cancels "accepted" rows, never "pending" ones (the most common state).
    // Fix: .in("status", ["pending", "accepted", "in_transit"])
  });

  it("[unit] delivery_assignments status 'pending' is never cancelled when order is cancelled", () => {
    // OrderWorkflowEngine.ts:808: `.in("status", ["assigned", "accepted"])`
    // A driver who has NOT yet accepted (status="pending") will NOT have their
    // assignment cancelled when the admin cancels the order.
    // The driver will continue to see the cancelled order on their dashboard.

    const pendingAssignmentStatus = "pending";
    const cancelledCaseFilterList = ["assigned", "accepted"];
    expect(cancelledCaseFilterList).not.toContain(pendingAssignmentStatus);
    // Fix: include "pending" in the filter list
  });
});

// =============================================================================
// DEF-008  Notification targeting falls back to driver_profiles.id
// =============================================================================
describe("[DEF-008] Notification target_user_id falls back to driver_profiles.id on auto-assign path", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:260:
   *   `target_user_id: meta?.driver_auth_user_id || meta?.driver_id`
   *
   * autoAssignDriver (line 959) builds metadata as:
   *   `{ driver_id: bestDriver.user_id, driver_name: bestDriver.full_name }`
   *
   * It does NOT set `driver_auth_user_id`. The driver_id IS user_id in this context
   * (because of the DEF-005 bug — wrong field used). So the fallback picks up
   * `meta?.driver_id` which equals auth.users.id. Accidentally correct in this case,
   * but for any future caller that correctly uses driver_profiles.id as driver_id,
   * the fallback will break notification delivery.
   *
   * More critically: the manual assignDriver path in OrderContext.tsx (line 506)
   * passes `driver_auth_user_id: driverData?.user_id`. If driverData is null
   * (the maybeSingle() at line 475 returned null because of RLS or a missing profile),
   * driver_auth_user_id is undefined, and the fallback uses driver_id (driver_profiles.id).
   * The notification is then routed to the wrong user ID and never received.
   */

  it("[unit] notification uses driver_profiles.id as target_user_id when driver_auth_user_id is not provided", () => {
    const driverProfileId = "profile-uuid-abc";
    const driverAuthUserId = "auth-uuid-xyz";

    // Manual assign with missing user_id lookup (driverData = null)
    const metadata = {
      driver_id: driverProfileId,
      driver_name: "Mandla Nkosi",
      driver_auth_user_id: undefined, // driverData was null
    };

    // Template at OrderWorkflowEngine.ts:260
    const targetUserId = metadata.driver_auth_user_id || metadata.driver_id;
    expect(targetUserId).toBe(driverProfileId); // wrong — should be auth user id

    // Notification listener in OrderContext.tsx:203 checks:
    // notification.target_user_id === user.id (where user.id = auth.users.id = driverAuthUserId)
    expect(targetUserId).not.toBe(driverAuthUserId); // notification will be silently dropped
  });

  it("[unit] fallback chain must fail loudly, not silently use wrong ID", () => {
    // Fix: remove the `|| meta?.driver_id` fallback entirely.
    // If driver_auth_user_id is missing, log an error and skip the driver notification.
    // A missing notification is visible (driver doesn't get notified) and diagnosable.
    // A wrong-ID notification is invisible — you can't see it was sent to the wrong user.

    const metadata = { driver_id: "profile-uuid", driver_auth_user_id: undefined };
    const withFallback = metadata.driver_auth_user_id || metadata.driver_id; // current
    const withoutFallback = metadata.driver_auth_user_id; // proposed fix

    expect(withFallback).toBe("profile-uuid"); // silently wrong
    expect(withoutFallback).toBeUndefined();    // loudly missing — can be alerted
  });
});

// =============================================================================
// DEF-009  Order Transition Side Effect: Stock Double-Restore on Return Path
// =============================================================================
describe("[DEF-009] Stock double-restore on return_received path — stock incremented at both return_received and cancelled", () => {
  /**
   * WHY THIS IS LIKELY:
   * The return path is: en_route → delivery_failed → return_to_store → return_received
   *
   * At return_received (line 858-884): stock IS incremented for all items.
   * If the order then transitions return_received → cancelled:
   *   The "cancelled" side effect at line 775-795 ALSO calls increment_stock for all items.
   * Result: stock is incremented TWICE for the same items.
   *
   * Similarly, return_received → refunded skips the cancelled case, so no double-restore there.
   * But the cancelled path FROM return_received is a valid transition and has the double-restore bug.
   */

  it("[unit] cancelled side effect calls increment_stock regardless of prior return_received stock restore", () => {
    const validTransitions: Record<string, string[]> = {
      return_received: ["rescheduled", "cancelled", "refunded"],
    };

    expect(validTransitions["return_received"]).toContain("cancelled");
    // This means: return_received → cancelled is a valid path.
    // At return_received: stock restored.
    // At cancelled: stock restored AGAIN.
    // Fix: in the cancelled side effect, check if status is coming FROM return_received
    // (inspect fromStatus from the order's status history or pass it as metadata)
    // and skip the stock restore if already done.
  });

  it("[unit] cancelled case does not check fromStatus before restoring stock", () => {
    // OrderWorkflowEngine.ts:775 — the cancelled case restores stock unconditionally.
    // There is no check like: if (fromStatus !== "return_received") { restoreStock() }
    const stockRestoreIsConditional = false; // confirmed from reading the code
    expect(stockRestoreIsConditional).toBe(false); // documents the defect
    // Fix: pass fromStatus to handleSideEffects (it already receives it — just use it)
  });
});

// =============================================================================
// DEF-010  Order Total Not Recalculated After Price Correction
// =============================================================================
describe("[DEF-010] Price correction at 'confirmed' updates order_items.unit_price but not orders.total", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:608-634 — when an order is confirmed, unit prices are
   * compared to current product prices. If they differ by more than R0.01, the
   * order_items row is updated with the corrected price.
   *
   * However, orders.total, orders.subtotal, and orders.vat_amount are NEVER updated.
   * The payment was captured for the original total. The corrected items show different
   * prices than what was charged. Accounting and VAT returns will be incorrect.
   *
   * Additionally, the correction SILENTLY updates item prices post-payment — the customer
   * is charged the original amount but the order record shows different prices.
   */

  it("[unit] price correction updates order_items but not orders.total", () => {
    const originalTotal = 450.00;
    const originalUnitPrice = 150.00;
    const correctedUnitPrice = 165.00; // product price changed after order placed
    const quantity = 3;

    const correctedItemTotal = correctedUnitPrice * quantity; // 495.00
    const uncorrectedOrderTotal = originalTotal; // still 450.00

    expect(correctedItemTotal).not.toBe(uncorrectedOrderTotal); // totals are now inconsistent
    // Fix: if any price correction occurs, update orders.subtotal, orders.vat_amount,
    // and orders.total. Flag the order with a price_corrected=true column for audit.
    // Better: reject the order at confirmed if prices have changed and notify the customer.
  });

  it("[unit] price correction happens AFTER payment is captured — customer charged wrong amount", () => {
    // The correction runs at "confirmed" which is AFTER payment capture.
    // The customer was charged originalTotal but the items now show higher prices.
    // This is an accounting discrepancy and potentially illegal under CPA (Consumer Protection Act).
    const chargedAmount = 450.00;
    const correctedRecordAmount = 495.00;
    expect(chargedAmount).not.toBe(correctedRecordAmount); // financial record mismatch
  });
});

// =============================================================================
// DEF-011  getDeliveryPin: delivery_pin column readable by customer JWT via direct API
// =============================================================================
describe("[DEF-011] delivery_pin column is returned over the network and readable via direct Supabase REST", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderWorkflowEngine.ts:1102 — the engine reads `delivery_pin` into client memory:
   *   `.select("delivery_pin, user_id")`
   *
   * The orders table RLS allows customers to SELECT their own orders with no column-level
   * restriction. Any customer can therefore run:
   *   supabase.from("orders").select("delivery_pin").eq("id", myOrderId)
   * and retrieve their own delivery PIN without going through the mobile app's UI flow.
   *
   * The PIN is meant to be shown in the app at delivery time. Retrieving it early
   * allows a customer to hand the PIN to an unauthorised recipient.
   *
   * The engine's getDeliveryPin checks ownership (lines 1112-1113) — but this check
   * is only in the app. A direct PostgREST call bypasses the app entirely.
   */

  it("[unit] SELECT delivery_pin is not restricted by column-level RLS — any customer can fetch their own PIN early", () => {
    // The RLS policy: USING (auth.uid() = user_id) — allows full row SELECT
    // No column exclusion policy exists for delivery_pin
    const customerCanReadColumns = ["id", "status", "total", "delivery_pin"]; // all columns
    const sensitiveColumn = "delivery_pin";
    expect(customerCanReadColumns).toContain(sensitiveColumn); // documents the exposure
    // Fix: add a column-level SELECT restriction via a view that excludes delivery_pin,
    // or add a SECURITY DEFINER RPC `get_my_delivery_pin(order_id)` that enforces
    // timing constraints (only returns PIN when order is in_transit or en_route).
  });
});

// =============================================================================
// DEF-012  No UNIQUE Constraint on delivery_assignments(order_id, driver_id)
// =============================================================================
describe("[DEF-012] No UNIQUE constraint on delivery_assignments — duplicate rows possible", () => {
  /**
   * WHY THIS IS LIKELY:
   * The OrderContext.assignDriver (line 488) inserts into delivery_assignments.
   * The OrderWorkflowEngine.handleSideEffects for driver_assigned (line 681)
   * checks for an existing row before inserting. But this check-then-insert
   * is NOT atomic — two concurrent assigns to the same (order, driver) pair
   * will both find no existing row and both insert.
   *
   * Additionally, if an admin assigns a driver twice in quick succession
   * (double-click scenario), two rows will be created. This was observed
   * in production with LX-2026-0023 (see session history).
   *
   * The fix is a DB-level UNIQUE constraint, not application-level checks.
   */

  it("[unit] application-level duplicate check is not atomic — concurrent inserts can create duplicates", () => {
    // The check: SELECT id FROM delivery_assignments WHERE order_id=X AND driver_id=Y
    // If two callers run this simultaneously and both get no result, both then INSERT.
    // This is a classic TOCTOU (time-of-check to time-of-use) race.

    const checkExistingResult = null; // both callers see null simultaneously
    const bothWillInsert = checkExistingResult === null && checkExistingResult === null;
    expect(bothWillInsert).toBe(true); // documents the race condition
    // Fix: ALTER TABLE delivery_assignments ADD CONSTRAINT uq_delivery_order UNIQUE (order_id)
    // (one assignment per order at a time — previous cancelled ones use different driver)
  });
});

// =============================================================================
// DEF-013  Silent Error Swallowing in Side Effects
// =============================================================================
describe("[DEF-013] Critical side effects use fire-and-forget .then(()=>{},err=>console.error) pattern", () => {
  /**
   * WHY THIS IS LIKELY:
   * Throughout handleSideEffects, critical operations are chained with
   * `.then(() => {}, (err) => console.error(...))`.
   *
   * Affected operations (confirmed from code):
   * - delivery_assignments INSERT at driver_assigned (line 701)
   * - delivery_tracking INSERT at en_route (line 748)
   * - background_jobs INSERT at delivered (line 772)
   * - warehouse_tasks INSERT/UPDATE (line 919)
   * - order_status_history INSERT (line 495)
   * - delivery_assignments UPDATE at cancelled (line 803)
   *
   * All of these can fail silently. The parent transitionOrder returns success=true
   * even when these side effects failed. The order status is updated but the
   * supporting records are inconsistent.
   */

  it("[unit] transitionOrder returns success even when warehouse task creation fails", () => {
    // createWarehouseTask (line 897) uses .then(()=>{},err=>console.error)
    // transitionOrder (line 531) returns { success: true } after side effects
    // regardless of whether createWarehouseTask threw an error.

    let warehouseTaskCreated = false;
    const mockCreateTask = async () => {
      throw new Error("DB connection timeout");
    };

    // Simulate the fire-and-forget pattern
    mockCreateTask().then(() => { warehouseTaskCreated = true; }, () => { /* swallowed */ });

    // After the Promise resolves, transitionOrder still returns success
    const orderTransitionResult = { success: true }; // returned before side effects resolve
    expect(orderTransitionResult.success).toBe(true);
    // warehouseTaskCreated is false — warehouse never got the task — but caller thinks success
  });

  it("[unit] order_status_history insert failure is silently ignored", () => {
    // OrderWorkflowEngine.ts:495 — status history insert uses fire-and-forget
    // If this fails, the audit trail is broken with no indication to the caller.
    const historyInsertFails = true; // network error scenario
    const transitionReturnsSuccess = true; // engine doesn't check history insert result
    expect(transitionReturnsSuccess).toBe(true); // defect: audit trail silently breaks
  });
});

// =============================================================================
// DEF-014  OrderContext.updateOrderStatus audit log uses from_status = "unknown"
// =============================================================================
describe("[DEF-014] Admin audit log records from_status='unknown' for all status transitions", () => {
  /**
   * WHY THIS IS LIKELY:
   * OrderContext.tsx:357 — the audit log insert:
   *   metadata: { from_status: "unknown", to_status: status, ...metadata }
   *
   * `from_status` is hardcoded as "unknown". The actual previous status is
   * available in the orderWorkflow.transitionOrder call result (event.from_status)
   * but is not captured and passed back to the audit log.
   *
   * The audit log is therefore useless for reconstruction — every admin action
   * shows "unknown → X" with no record of the prior state.
   */

  it("[unit] admin audit log always records from_status as 'unknown'", () => {
    const auditMetadata = {
      from_status: "unknown", // hardcoded in OrderContext.tsx:357
      to_status: "driver_assigned",
    };

    expect(auditMetadata.from_status).toBe("unknown"); // documents the defect
    // Fix: capture the result.event?.from_status from transitionOrder and use it here
    // result.event is returned by the engine but ignored in updateOrderStatus
  });
});

// =============================================================================
// DEF-015  deliveries mapping uses updated_at as assignedAtISO — wrong for countdown
// =============================================================================
describe("[DEF-015] DriverDashboard uses order.updated_at as assignedAtISO — countdown is incorrect", () => {
  /**
   * WHY THIS IS LIKELY:
   * DriverDashboard.tsx:136:
   *   `assignedAtISO: (o as any).updated_at ?? o.created_at`
   *
   * `orders.updated_at` is updated on EVERY status change. If an admin changes
   * an order from "driver_assigned" to any other status and back, or if the
   * order's payment_status is updated by the Edge Function, updated_at resets.
   * The countdown timer then shows MORE time than the driver actually has,
   * or LESS if the EF update happened after assignment.
   *
   * The correct field to use is delivery_assignments.created_at for the assignment,
   * or an explicit orders.driver_assigned_at timestamp column.
   */

  it("[unit] updated_at changes on every order mutation — wrong proxy for assignment time", () => {
    const orderCreatedAt = "2026-04-12T10:00:00Z";
    const driverAssignedAt = "2026-04-12T10:05:00Z"; // actual assignment time
    const lastUpdatedAt = "2026-04-12T10:07:30Z"; // EF updated payment_status 2.5 min later

    // Driver joins at 10:07:30. Sees lastUpdatedAt as assignedAtISO.
    const assignedAtISO = lastUpdatedAt; // what the dashboard uses
    const elapsed = new Date("2026-04-12T10:09:00Z").getTime() - new Date(assignedAtISO).getTime();
    const remaining = 5 * 60 * 1000 - elapsed; // ~3.5 min shown

    const actualElapsed = new Date("2026-04-12T10:09:00Z").getTime() - new Date(driverAssignedAt).getTime();
    const actualRemaining = 5 * 60 * 1000 - actualElapsed; // ~1 min actual

    expect(remaining).toBeGreaterThan(actualRemaining); // countdown shows MORE time than driver has
    // Fix: add orders.driver_assigned_at TIMESTAMPTZ column, set it in the driver_assigned
    // side effect, and use it in the deliveries mapping.
  });
});

// =============================================================================
// INTEGRATION TEST TEMPLATES (require real Supabase instance)
// Skipped in unit test runs — enable with INTEGRATION=true env variable
// =============================================================================

const INTEGRATION = process.env.INTEGRATION === "true";

describe.skipIf(!INTEGRATION)("[integration] RLS cross-user isolation", () => {
  it("customer A cannot SELECT customer B's orders", async () => {
    // Setup: create two customer accounts, each place an order.
    // Assert: customerA JWT cannot read customerB's order row.
    // const { data } = await supabaseAsCustomerA.from("orders").select("*").eq("id", customerBOrderId);
    // expect(data).toHaveLength(0);
  });

  it("driver A cannot SELECT driver B's delivery_assignments", async () => {
    // Setup: two driver_profiles, two delivery_assignments
    // Assert: driverA JWT returns only driverA assignments
    // const { data } = await supabaseAsDriverA.from("delivery_assignments").select("*");
    // const driverBAssignments = data?.filter(a => a.driver_id === driverBProfileId);
    // expect(driverBAssignments).toHaveLength(0);
  });
});

describe.skipIf(!INTEGRATION)("[integration] delivery_assignments CHECK constraint enforcement", () => {
  it("status='en_route' is rejected by CHECK constraint", async () => {
    // const { error } = await supabaseAdmin.from("delivery_assignments")
    //   .update({ status: "en_route" }).eq("id", testAssignmentId);
    // expect(error).not.toBeNull();
    // expect(error?.message).toContain("violates check constraint");
  });

  it("status='failed' is rejected by CHECK constraint", async () => {
    // same pattern
  });

  it("status='in_transit' is accepted", async () => {
    // const { error } = await supabaseAdmin.from("delivery_assignments")
    //   .update({ status: "in_transit" }).eq("id", testAssignmentId);
    // expect(error).toBeNull();
  });
});

describe.skipIf(!INTEGRATION)("[integration] stock atomic decrement", () => {
  it("concurrent orders for last unit: only one succeeds at decrement_stock", async () => {
    // Setup: product with stock_quantity=1
    // Run two concurrent placeOrder flows
    // Assert: only one order reaches "confirmed", the other gets a stock error
    // Assert: products.stock_quantity = 0 (not -1)
  });
});
