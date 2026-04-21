# LIQZAR — Top 15 Defect Fix Recommendations

Generated: 2026-04-12 | Based on static analysis of OrderWorkflowEngine.ts,
OrderContext.tsx, DriverDeliveryPinVerify.tsx, migration SQL, and RLS policies.

---

## DEF-001 — Payment Status Desync

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:444`

**Current code:**
```ts
if (toStatus === "confirmed") {
  updates.payment_status = "captured";
}
```

**Problem:** Sets `payment_status = "captured"` on ALL confirmed orders regardless of whether a payment record actually exists. COD orders will incorrectly show `captured`. Card orders where the EF hasn't run yet will show `captured` before money has moved.

**Fix — diff:**
```ts
// Replace lines 443-445 with:
if (toStatus === "confirmed") {
  if (order.payment_method === "cash_on_delivery") {
    updates.payment_status = "cash_on_delivery";
  } else {
    // Verify actual capture before stamping. The EF is the authoritative writer.
    // Only set if currently still pending/awaiting — do not overwrite EF-set values.
    if (["pending", "awaiting_payment"].includes(order.payment_status)) {
      // Do NOT set here — wait for the capture-payment EF webhook to update it.
      // Remove this block entirely; EF is sole writer of payment_status.
    }
  }
}
```

**Migration fix:** Ensure only the `capture-payment` Edge Function writes `orders.payment_status`. Remove the customer UPDATE RLS policy that allows arbitrary `orders` column writes (see DEF-004).

---

## DEF-002 — Stock Race Condition

**Files:**
- `apps/mobile/src/services/OrderWorkflowEngine.ts:549–566` (reserve loop)
- `supabase/migrations/20260405000002_stock_management.sql` (decrement RPC)

**Problem:** `reserve_stock` and `decrement_stock` are called in JavaScript for-loops, one roundtrip per item. Failures on item N leave items 0..N-1 incorrectly reserved with no rollback. Two concurrent customers can both pass the pre-order stock check.

**Fix — new migration:**
```sql
-- New RPC: reserve all items atomically in one transaction
CREATE OR REPLACE FUNCTION reserve_order_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT product_id, quantity FROM order_items WHERE order_id = p_order_id
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity - v_item.quantity,
        reserved_quantity = COALESCE(reserved_quantity, 0) + v_item.quantity
    WHERE id = v_item.product_id
      AND stock_quantity >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Insufficient stock for product %', v_item.product_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Fix — engine change:**
```ts
// Replace the for-loop at lines 549-566 with a single RPC call:
case "awaiting_payment": {
  const { error: reserveErr } = await supabase.rpc("reserve_order_stock", {
    p_order_id: orderId,
  });
  if (reserveErr) {
    throw new Error(`Stock reservation failed: ${reserveErr.message}`);
    // This causes transitionOrder to return success=false, blocking the transition
  }
  break;
}
```

---

## DEF-003 — Compliance Bypass

**File:** `apps/mobile/src/screens/driver/DriverDeliveryPinVerify.tsx:68–82`

**Problem:** `auditLogFailed = true` shows an alert but still calls `setComplianceStep("pin")`, allowing delivery to proceed with an incomplete audit trail.

**Fix:**
```ts
// Replace lines 68-83:
if (result.auditLogFailed) {
  console.error(`[DriverDeliveryPinVerify] Compliance audit log failed for order ${orderId}`);
  Alert.alert(
    "Audit Log Error",
    "Compliance event could not be recorded. Delivery cannot proceed. Please report to dispatch.",
    [{ text: "OK", onPress: () => navigation.popToTop() }], // block the delivery
  );
  return; // <-- ADD THIS: do not proceed to PIN entry
}

if (result.passed) {
  setComplianceStep("pin");
  return;
}
```

---

## DEF-004 — RLS Overpermissive Customer UPDATE

**File:** `supabase/migrations/20260410_005_payment_rls_fixes.sql`

**Problem:** The UPDATE policy `USING (auth.uid() = user_id)` allows customers to update ANY column on their own orders — including `total`, `status`, `payment_status`.

**Fix — new migration:**
```sql
-- Drop the overpermissive policy
DROP POLICY IF EXISTS "Customers can update own order payment status" ON orders;

-- Do NOT replace with another UPDATE policy for customers.
-- All order updates must go through SECURITY DEFINER RPCs:
--   - cancel_order(order_id) — enforces 10-min window + status check
--   - The payment_status column is ONLY written by Edge Functions (service role)

-- If customers need to update any field, create a specific RPC for it.
```

---

## DEF-005 — autoAssignDriver driver_id Mapping Bug

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:934,959`

**Problem:** `autoAssignDriver` selects `driver_profiles.user_id` but uses it as `driver_id` in metadata. `delivery_assignments.driver_id` references `driver_profiles.id`, not `auth.users.id`. Auto-assigned drivers can never see their orders.

**Fix:**
```ts
// Line 934: add 'id' to the SELECT
const { data: drivers } = await supabase
  .from("driver_profiles")
  .select("id, user_id, full_name, status, is_verified")  // add 'id'
  .eq("status", "active")
  .eq("is_verified", true);

// Lines 956-963: use d.id for driver_id, d.user_id for auth routing
await this.transitionOrder(
  orderId,
  "driver_assigned",
  "system",
  undefined,
  {
    driver_id: bestDriver.id,              // was: bestDriver.user_id — WRONG
    driver_name: bestDriver.full_name,
    driver_auth_user_id: bestDriver.user_id, // ADD: for notification routing
    dispatch_score: bestDriver.score,
  },
);
```

---

## DEF-006 — PIN Lockout Not Persistent

**File:** `apps/mobile/src/screens/driver/DriverDeliveryPinVerify.tsx:123–124`

**Problem:** `attemptsRemaining` and `locked` are component state — reset to defaults on unmount. DB tracks real count but UI shows stale "3 attempts remaining".

**Fix — add a new RPC + mount effect:**

New RPC (migration):
```sql
CREATE OR REPLACE FUNCTION get_pin_status(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  SELECT pin_attempts INTO v_assignment
  FROM driver_assignments WHERE order_id = p_order_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('attempts_used', 0, 'locked', false, 'max_attempts', 3);
  END IF;

  RETURN jsonb_build_object(
    'attempts_used', COALESCE(v_assignment.pin_attempts, 0),
    'locked', COALESCE(v_assignment.pin_attempts, 0) >= 3,
    'max_attempts', 3,
    'attempts_remaining', GREATEST(0, 3 - COALESCE(v_assignment.pin_attempts, 0))
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

Component fix:
```ts
// After the existing useState declarations, add:
useEffect(() => {
  if (!orderId || complianceStep !== "pin") return;
  supabase.rpc("get_pin_status", { p_order_id: orderId }).then(({ data }) => {
    if (data) {
      setAttemptsRemaining(data.attempts_remaining ?? 3);
      setLocked(data.locked ?? false);
    }
  });
}, [orderId, complianceStep]);
```

---

## DEF-007 — delivery_assignments Invalid Status Values

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts` (multiple lines)

**Problem:** Engine writes `"en_route"`, `"failed"` to `delivery_assignments.status` which violates the CHECK constraint `('pending','accepted','picked_up','in_transit','delivered','cancelled')`. Updates silently fail.

**Fix — three-line changes:**

```ts
// Line 726: en_route case
.update({ status: "in_transit" })  // was: "en_route"

// Line 808: cancelled case filter
.in("status", ["pending", "accepted", "in_transit"])  // was: ["assigned", "accepted"]

// Line 808: cancelled case update
.update({ status: "cancelled" })  // was: "failed" — "cancelled" is the valid value

// Line 843: delivery_failed case
.update({ status: "cancelled", ... })  // was: "failed"
// Note: delivery_failed delivery_assignment should be "cancelled" (assignment cancelled, not failed)
```

---

## DEF-008 — Notification Fallback to Wrong ID

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:260`

**Problem:** `target_user_id: meta?.driver_auth_user_id || meta?.driver_id` falls back to `driver_profiles.id` when auth user ID is not provided. Notifications are silently routed to the wrong user.

**Fix:**
```ts
// Line 260: remove the fallback
target_user_id: meta?.driver_auth_user_id,
// If undefined, notification is skipped — a diagnosable miss, not a silent misdirection.

// Add a warning when the auth user ID is missing:
// In handleSideEffects driver_assigned case, before building the notification:
if (metadata?.driver_id && !metadata?.driver_auth_user_id) {
  console.error(`[Workflow] driver_auth_user_id missing for order ${orderId} — driver notification will not be sent`);
}
```

---

## DEF-009 — Stock Double-Restore on return_received → cancelled

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:541, 775`

**Problem:** `return_received` restores stock AND `cancelled` also restores stock. `return_received → cancelled` is a valid transition, causing double-restore.

**Fix:**
```ts
// In handleSideEffects, cancelled case — add fromStatus guard:
case "cancelled": {
  // Only restore stock if coming from a status where stock was NOT already returned
  const stockAlreadyRestored = ["return_received", "delivery_failed", "return_to_store"].includes(fromStatus);
  if (!stockAlreadyRestored && cancelledItems) {
    for (const item of cancelledItems) { /* existing restore loop */ }
  }
  // rest of cancelled side effects...
}
```

Note: `handleSideEffects` already receives `fromStatus` as a parameter — just use it.

---

## DEF-010 — Order Total Not Recalculated After Price Correction

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:608–634`

**Problem:** `order_items.unit_price` corrected but `orders.total/subtotal/vat_amount` not updated.

**Fix:**
```ts
// After the price correction loop, add:
let totalCorrected = false;
let correctedSubtotal = 0;

if (fullItems) {
  for (const item of fullItems) {
    const realPrice = priceMap.get(item.product_id);
    const qty = orderItems?.find(o => o.product_id === item.product_id)?.quantity || 1;
    if (realPrice && Math.abs(item.unit_price - realPrice) > 0.01) {
      totalCorrected = true;
    }
    correctedSubtotal += (realPrice || item.unit_price) * qty;
  }
}

if (totalCorrected) {
  const vat = correctedSubtotal * 0.15;
  const deliveryFee = order.delivery_fee || 0;
  await supabase.from("orders").update({
    subtotal: correctedSubtotal,
    vat_amount: vat,
    total: correctedSubtotal + vat + deliveryFee,
    price_correction_applied: true, // add this column via migration
  }).eq("id", orderId);
}
```

---

## DEF-011 — delivery_pin Readable via Direct REST

**Fix — new migration:**
```sql
-- Create a view that excludes delivery_pin from customer-visible columns
CREATE OR REPLACE VIEW orders_customer_view AS
SELECT
  id, order_number, user_id, status, subtotal, delivery_fee, vat_amount, total,
  delivery_address, delivery_method, payment_method, payment_status,
  customer_notes, discount_amount, created_at, updated_at, eta_minutes,
  driver_name, assigned_driver_id, compliance_verified
  -- delivery_pin intentionally excluded
FROM orders;

-- Update RLS: restrict direct orders table SELECT for customers to use the view
-- (Or use column-level security via a SECURITY DEFINER function)
```

Alternatively, only expose PIN via a time-gated RPC:
```sql
CREATE OR REPLACE FUNCTION get_my_delivery_pin(p_order_id UUID)
RETURNS TEXT AS $$
DECLARE v_order RECORD;
BEGIN
  SELECT status, delivery_pin, user_id INTO v_order FROM orders WHERE id = p_order_id;
  IF v_order.user_id != auth.uid() THEN RETURN NULL; END IF;
  -- Only return PIN when driver is actually at the door
  IF v_order.status NOT IN ('driver_assigned', 'picked_up', 'en_route') THEN RETURN NULL; END IF;
  RETURN v_order.delivery_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## DEF-012 — No UNIQUE Constraint on delivery_assignments

**Fix — new migration:**
```sql
-- One active assignment per order at a time
-- Use a partial unique index so historical cancelled rows don't block new assignments
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_active_assignment
  ON delivery_assignments (order_id)
  WHERE status NOT IN ('cancelled', 'delivered');
```

---

## DEF-013 — Silent Side Effect Failures

**File:** `apps/mobile/src/services/OrderWorkflowEngine.ts:495, 701, 748, 772, 919`

**Recommended pattern change:** For critical operations (status history, warehouse tasks), collect errors and return them in the result:

```ts
// Replace fire-and-forget with collected errors
const sideEffectErrors: string[] = [];

await supabase.from("order_status_history").insert({...})
  .then(() => {}, (err) => {
    sideEffectErrors.push(`status_history: ${err.message}`);
    console.error("[Workflow] status history failed:", err);
  });

// At the end of transitionOrder:
return {
  success: true,
  event,
  warnings: sideEffectErrors.length > 0 ? sideEffectErrors : undefined,
};
```

Callers can then log warnings to a monitoring service without blocking the user flow.

---

## DEF-014 — Audit Log from_status = "unknown"

**File:** `apps/mobile/src/contexts/OrderContext.tsx:357`

**Fix:**
```ts
// updateOrderStatus: capture the event from the result
const result = await orderWorkflow.transitionOrder(orderId, status, triggerRole, user?.id, metadata);

if (role === "admin" && result.event) {  // result.event contains from_status
  supabase.from("admin_audit_log").insert({
    admin_id: user?.id,
    action: `status_change_${status}`,
    target_type: "order",
    target_id: orderId,
    metadata: {
      from_status: result.event.from_status,  // was: "unknown"
      to_status: status,
      ...metadata
    },
  }).then(() => {}, (err) => console.error("[Audit] Failed:", err));
}
```

---

## DEF-015 — assignedAtISO Uses updated_at Instead of Assignment Time

**File:** `apps/mobile/src/screens/driver/DriverDashboard.tsx:136`

**Short-term fix:**
```ts
// Add driver_assigned_at to the orders table (via migration):
// ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;
// Set it in the driver_assigned side effect of the engine.

// In the deliveries mapping:
assignedAtISO: (o as any).driver_assigned_at ?? (o as any).updated_at ?? o.created_at,
```

**Migration:**
```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;
```

**Engine side effect (driver_assigned case):**
```ts
await supabase.from("orders")
  .update({ driver_assigned_at: new Date().toISOString() })
  .eq("id", orderId);
```
