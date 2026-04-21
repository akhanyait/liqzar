-- ============================================================
-- Migration 004: Enum values, RLS fixes, column name fixes
-- ============================================================

-- ── Bug 2: Add missing order_status enum values ─────────────
-- The workflow engine uses statuses not in the DB enum.
-- Add them safely (IF NOT EXISTS equivalent using a DO block).
DO $$
BEGIN
  -- awaiting_payment
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'awaiting_payment'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'awaiting_payment' AFTER 'pending';
  END IF;

  -- payment_failed
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'payment_failed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'payment_failed' AFTER 'awaiting_payment';
  END IF;

  -- driver_assigned
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'driver_assigned'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'driver_assigned' AFTER 'ready';
  END IF;

  -- completed
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'completed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'completed' AFTER 'delivered';
  END IF;

  -- refunded
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'refunded'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'refunded' AFTER 'completed';
  END IF;

  -- delivery_failed
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'delivery_failed'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'delivery_failed' AFTER 'en_route';
  END IF;

  -- return_to_store
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'return_to_store'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'return_to_store' AFTER 'delivery_failed';
  END IF;

  -- return_received
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'return_received'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'return_received' AFTER 'return_to_store';
  END IF;

  -- rescheduled
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'order_status' AND e.enumlabel = 'rescheduled'
  ) THEN
    ALTER TYPE order_status ADD VALUE 'rescheduled' AFTER 'return_received';
  END IF;
END;
$$;


-- ── Bug 5: Customer UPDATE policy for cancellations ─────────
-- Customers must be able to cancel their own orders (within 10-min window
-- enforced at app level). Without this, all cancellations silently fail.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Customers can cancel own orders'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers can cancel own orders"
        ON orders FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
    $policy$;
  END IF;
END;
$$;


-- ── Bug 3: Fix auto_reassign_timed_out_assignments function ──
-- Drop first to allow return type change, then recreate correctly
DROP FUNCTION IF EXISTS auto_reassign_timed_out_assignments();
CREATE OR REPLACE FUNCTION auto_reassign_timed_out_assignments()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  FOR v_assignment IN
    SELECT da.id AS assignment_id, da.order_id, da.driver_id
    FROM delivery_assignments da
    WHERE da.status = 'pending'
      AND da.assigned_at < NOW() - INTERVAL '10 minutes'
  LOOP
    -- Mark current assignment as timed_out
    UPDATE delivery_assignments
    SET status = 'timed_out', updated_at = NOW()
    WHERE id = v_assignment.assignment_id;

    -- Revert order back to ready for re-dispatch
    UPDATE orders
    SET status = 'ready',
        assigned_driver_id = NULL,
        updated_at = NOW()
    WHERE id = v_assignment.order_id
      AND status = 'driver_assigned';

    -- Audit log with correct column names
    INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
    VALUES (
      v_assignment.order_id,
      'driver_assigned',
      'ready',
      NULL,
      'Auto-reassigned: driver assignment timed out after 10 minutes'
    );
  END LOOP;
END;
$$;


-- ── Bug 3b: Fix depot_release stored procedure ──────────────
DROP FUNCTION IF EXISTS depot_release(UUID, UUID);
CREATE OR REPLACE FUNCTION depot_release(p_order_id UUID, p_user_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.status NOT IN ('confirmed', 'preparing', 'ready') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not in releasable state: ' || v_order.status);
  END IF;

  UPDATE orders
  SET status = 'ready',
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_status_history (order_id, from_status, to_status, changed_by, notes)
  VALUES (
    p_order_id,
    v_order.status,
    'ready',
    p_user_id,
    'Released from depot'
  );

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'ready');
END;
$$;
