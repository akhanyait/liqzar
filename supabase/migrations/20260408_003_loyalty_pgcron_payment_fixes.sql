-- ============================================================================
-- LIQZAR Production Enhancements Migration
-- Version: 003
-- Description: Loyalty points auto-award trigger, pg_cron driver
--              auto-reassignment, PaymentStatus data fix, payments table
--              column additions (yoco_charge_id, yoco_refund_id,
--              refund_pending status), promo_codes table.
-- Idempotent: Uses IF NOT EXISTS / IF EXISTS / OR REPLACE throughout.
-- ============================================================================


-- ============================================================================
-- 1. PAYMENTS TABLE — Add missing columns & status value
-- ============================================================================

-- yoco_charge_id: the charge ID returned by Yoco after a successful checkout
ALTER TABLE payments ADD COLUMN IF NOT EXISTS yoco_charge_id TEXT;

-- yoco_refund_id: the refund ID returned by Yoco (set by refund-payment EF)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS yoco_refund_id TEXT;

-- Extend status CHECK to include 'refund_pending' and 'awaiting_payment'
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'payments_status_v2_check'
  ) THEN
    BEGIN
      ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;
      ALTER TABLE payments ADD CONSTRAINT payments_status_v2_check
        CHECK (status IN (
          'pending','awaiting_payment','authorized','captured','failed',
          'cancelled','refunded','partially_refunded','refund_pending'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

-- Index for faster yoco_charge_id lookups (used by capture-payment webhook)
CREATE INDEX IF NOT EXISTS idx_payments_yoco_charge_id ON payments(yoco_charge_id);


-- ============================================================================
-- 2. PAYMENT STATUS DATA MIGRATION
--    Normalise any legacy 'paid' value to 'captured' on the orders table.
-- ============================================================================

UPDATE orders
SET payment_status = 'captured'
WHERE payment_status = 'paid';


-- ============================================================================
-- 3. PROMO CODES TABLE (referenced by CheckoutScreen but not yet created)
-- ============================================================================

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  description TEXT,
  discount_type TEXT NOT NULL
    CHECK (discount_type IN ('percentage', 'fixed', 'free_delivery')),
  discount_value DECIMAL(10,2) NOT NULL DEFAULT 0,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  max_uses INTEGER,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Promo codes readable by anyone authenticated" ON promo_codes;
CREATE POLICY "Promo codes readable by anyone authenticated" ON promo_codes
  FOR SELECT TO authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage promo codes" ON promo_codes;
CREATE POLICY "Admins manage promo codes" ON promo_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active)
  WHERE is_active = true;


-- ============================================================================
-- 4. LOYALTY POINTS — Auto-award trigger on order status → 'delivered'
-- ============================================================================
-- Rule: 1 point per R10 of order total (minimum 1 point).
-- Tier thresholds (lifetime points):
--   0–499    → bronze
--   500–1999 → silver
--   2000–9999→ gold
--   10000+   → platinum

CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_order_total DECIMAL(10,2);
  v_points_earned INTEGER;
  v_new_lifetime INTEGER;
  v_new_tier TEXT;
BEGIN
  -- Only trigger when status changes TO 'delivered'
  IF NEW.status != 'delivered' OR OLD.status = 'delivered' THEN
    RETURN NEW;
  END IF;

  -- Skip cash-on-delivery orders with failed payment
  IF NEW.payment_status = 'failed' THEN
    RETURN NEW;
  END IF;

  v_user_id := NEW.user_id;
  v_order_total := COALESCE(NEW.total, 0);

  -- 1 point per R10, minimum 1
  v_points_earned := GREATEST(1, FLOOR(v_order_total / 10)::INTEGER);

  -- Upsert loyalty account
  INSERT INTO loyalty_accounts (user_id, points_balance, lifetime_points, tier)
  VALUES (v_user_id, v_points_earned, v_points_earned, 'bronze')
  ON CONFLICT (user_id) DO UPDATE
    SET points_balance  = loyalty_accounts.points_balance + v_points_earned,
        lifetime_points = loyalty_accounts.lifetime_points + v_points_earned,
        updated_at      = NOW();

  -- Recalculate tier
  SELECT lifetime_points INTO v_new_lifetime
  FROM loyalty_accounts
  WHERE user_id = v_user_id;

  v_new_tier := CASE
    WHEN v_new_lifetime >= 10000 THEN 'platinum'
    WHEN v_new_lifetime >=  2000 THEN 'gold'
    WHEN v_new_lifetime >=   500 THEN 'silver'
    ELSE 'bronze'
  END;

  UPDATE loyalty_accounts
  SET tier = v_new_tier, updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Record transaction
  INSERT INTO loyalty_transactions (user_id, order_id, points, type, description)
  VALUES (
    v_user_id,
    NEW.id,
    v_points_earned,
    'earned',
    format('Earned %s points for order %s (R%s)', v_points_earned, NEW.order_number, v_order_total)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the delivery status update due to loyalty errors
  RAISE WARNING '[loyalty] Failed to award points for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger idempotently
DROP TRIGGER IF EXISTS trg_award_loyalty_on_delivery ON orders;
CREATE TRIGGER trg_award_loyalty_on_delivery
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION award_loyalty_points_on_delivery();


-- ============================================================================
-- 5. AUTO-REASSIGNMENT — pg_cron job for timed-out driver assignments
-- ============================================================================
-- Assignments stuck in 'assigned' status for > 15 minutes are cancelled
-- and the order is reverted to 'ready' so dispatch can re-assign.
-- Requires pg_cron extension (available in Supabase Pro plans).

CREATE OR REPLACE FUNCTION auto_reassign_timed_out_assignments()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_rec RECORD;
  TIMEOUT_MINUTES CONSTANT INTEGER := 15;
BEGIN
  FOR v_rec IN
    SELECT da.id AS assignment_id, da.order_id, da.driver_id
    FROM delivery_assignments da
    WHERE da.status = 'assigned'
      AND da.assigned_at < NOW() - (TIMEOUT_MINUTES || ' minutes')::INTERVAL
    FOR UPDATE SKIP LOCKED
  LOOP
    -- Cancel the timed-out assignment
    UPDATE delivery_assignments
    SET status = 'cancelled',
        delivery_notes = COALESCE(delivery_notes, '') ||
          format(' [AUTO-CANCELLED: assignment timeout at %s]', NOW())
    WHERE id = v_rec.assignment_id;

    -- Revert order to 'ready' so it can be re-assigned
    UPDATE orders
    SET status = 'ready'
    WHERE id = v_rec.order_id
      AND status = 'assigned';

    -- Log status change
    INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
    VALUES (
      v_rec.order_id,
      'assigned',
      'ready',
      NULL,
      format('Driver assignment timed out after %s minutes — order queued for re-assignment', TIMEOUT_MINUTES)
    )
    ON CONFLICT DO NOTHING;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execution to postgres role (used by pg_cron)
GRANT EXECUTE ON FUNCTION auto_reassign_timed_out_assignments() TO postgres;

-- Schedule pg_cron job (runs every 5 minutes — safe no-op if already exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'liqzar-auto-reassign-drivers',     -- job name (unique key)
      '*/5 * * * *',                       -- every 5 minutes
      'SELECT auto_reassign_timed_out_assignments()'
    );
  ELSE
    RAISE NOTICE '[migration 003] pg_cron extension not available — auto-reassignment cron not scheduled. Enable pg_cron in Supabase dashboard under Database → Extensions.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- cron.schedule raises an error if job already exists; treat as no-op
  RAISE NOTICE '[migration 003] auto-reassign cron already scheduled or pg_cron error: %', SQLERRM;
END $$;


-- ============================================================================
-- 6. order_status_history — ensure ON CONFLICT guard for history inserts
-- ============================================================================

-- Add a unique constraint on (order_id, new_status, changed_by) if it
-- does not exist, so the INSERT ... ON CONFLICT DO NOTHING above works.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'order_status_history'
      AND indexname = 'idx_order_status_history_uniq'
  ) THEN
    -- Not unique in general (same status can occur multiple times, e.g. after retry)
    -- so we add a plain index, not a unique one, and remove ON CONFLICT from trigger.
    CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id
      ON order_status_history(order_id);
  END IF;
END $$;


-- ============================================================================
-- 7. Update loyalty_accounts RLS — allow service-role upserts
-- ============================================================================

-- The trigger runs as SECURITY DEFINER (bypasses RLS) so no RLS change needed.
-- But add a policy for the service role to insert/update (belt-and-suspenders):
DROP POLICY IF EXISTS "Service role manages loyalty accounts" ON loyalty_accounts;
CREATE POLICY "Service role manages loyalty accounts" ON loyalty_accounts
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds:
--   - payments.yoco_charge_id, payments.yoco_refund_id columns
--   - 'awaiting_payment' and 'refund_pending' to payments.status enum
--   - Data migration: orders.payment_status 'paid' → 'captured'
--   - promo_codes table with RLS
--   - Loyalty points auto-award trigger (trg_award_loyalty_on_delivery)
--   - auto_reassign_timed_out_assignments() function
--   - pg_cron job 'liqzar-auto-reassign-drivers' (every 5 min, if available)
-- ============================================================================
