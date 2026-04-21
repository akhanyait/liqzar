-- ============================================================================
-- Migration 008: RLS hardening, schema columns, and security RPCs
-- Covers: DEF-004, DEF-006, DEF-011, DEF-012, DEF-015
-- ============================================================================


-- ============================================================================
-- DEF-004: Drop the overpermissive customer UPDATE policy on orders
-- ============================================================================
-- The policy "Customers can update own order payment status" was created with
-- FOR UPDATE USING (auth.uid() = user_id) which grants customers the ability
-- to update ANY column — including total, status, payment_status, delivery_address.
-- All customer-initiated order mutations must go through SECURITY DEFINER RPCs.
-- The Edge Function (service role) is the sole writer of payment_status.
DROP POLICY IF EXISTS "Customers can update own order payment status" ON orders;

-- Also drop the equivalent payments policy added in the same migration.
-- Customers should not directly UPDATE payments rows either; the EF owns that table.
DROP POLICY IF EXISTS "Customers can update own payments" ON payments;


-- ============================================================================
-- DEF-015: Add driver_assigned_at to orders
-- ============================================================================
-- orders.updated_at resets on EVERY column write (including EF payment updates).
-- driver_assigned_at is set once at assignment and never changed, making it a
-- reliable anchor for the driver's acceptance countdown timer.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS driver_assigned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_orders_driver_assigned_at
  ON orders(driver_assigned_at) WHERE driver_assigned_at IS NOT NULL;


-- ============================================================================
-- DEF-006: get_pin_status RPC — sync lockout state to client on component mount
-- ============================================================================
-- React component state resets on unmount. Without this RPC the PIN screen
-- always initialises to "3 attempts remaining / locked=false" even if the DB
-- already has pin_attempts >= 3. This RPC lets the component hydrate from truth.
CREATE OR REPLACE FUNCTION get_pin_status(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_assignment RECORD;
  v_max        INTEGER := 3;
BEGIN
  SELECT pin_attempts
  INTO v_assignment
  FROM driver_assignments
  WHERE order_id = p_order_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'attempts_remaining', v_max,
      'locked',             false
    );
  END IF;

  RETURN jsonb_build_object(
    'attempts_remaining', GREATEST(0, v_max - COALESCE(v_assignment.pin_attempts, 0)),
    'locked',             COALESCE(v_assignment.pin_attempts, 0) >= v_max
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- DEF-011: get_my_delivery_pin — time-gated RPC replacing direct column read
-- ============================================================================
-- The orders table SELECT RLS allows customers to read ALL columns, including
-- delivery_pin. A customer can retrieve their PIN hours before delivery via a
-- direct PostgREST call, bypassing app-level timing controls.
-- This RPC enforces: caller owns the order AND order is in an active delivery state.
CREATE OR REPLACE FUNCTION get_my_delivery_pin(p_order_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT user_id, status, delivery_pin
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Ownership check
  IF v_order.user_id != auth.uid() THEN
    RETURN NULL;
  END IF;

  -- Timing gate: only reveal PIN when driver is physically in the delivery flow
  IF v_order.status NOT IN ('driver_assigned', 'picked_up', 'en_route') THEN
    RETURN NULL;
  END IF;

  RETURN v_order.delivery_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- DEF-012: Partial unique index on delivery_assignments
-- ============================================================================
-- Prevents duplicate active assignments for the same order.
-- Allows multiple historical rows (cancelled/delivered) per order — needed
-- for rescheduled deliveries where a new assignment must be created after
-- the previous one was cancelled.
--
-- Before deploying, verify no duplicate active rows exist:
--   SELECT order_id, COUNT(*) FROM delivery_assignments
--   WHERE status NOT IN ('cancelled','delivered')
--   GROUP BY order_id HAVING COUNT(*) > 1;
--
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_active_assignment
  ON delivery_assignments (order_id)
  WHERE status NOT IN ('cancelled', 'delivered');


-- ============================================================================
-- DEF-001: Payment status write guard trigger
-- ============================================================================
-- Prevents any non-service-role actor from writing payment_status='captured'
-- directly to the orders table. The capture-payment Edge Function (service role)
-- is the only authoritative writer.
CREATE OR REPLACE FUNCTION guard_order_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only block the 'captured' value — other transitions (pending, failed, etc.)
  -- may legitimately come from the engine.
  IF NEW.payment_status = 'captured'
     AND OLD.payment_status IS DISTINCT FROM 'captured'
     AND current_setting('request.jwt.claims', true)::jsonb->>'role' = 'authenticated'
  THEN
    RAISE EXCEPTION
      'payment_status=captured may only be set by the capture-payment Edge Function (service role). '
      'Remove the payment_status write from client-side code. [DEF-001]';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS guard_payment_status_write ON orders;
CREATE TRIGGER guard_payment_status_write
  BEFORE UPDATE OF payment_status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION guard_order_payment_status();
