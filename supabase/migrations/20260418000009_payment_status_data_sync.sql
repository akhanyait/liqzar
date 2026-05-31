-- 20260418_009_payment_status_data_sync.sql
--
-- Align `payments.status` row values with the canonical 8-value PaymentStatus
-- spec. Earlier code (pre-v3.1) wrote "paid" for successful captures; v3.1
-- switched the canonical value to "captured" but existing rows were never
-- migrated. This migration reconciles the data.
--
-- Canonical values (packages/types/src/index.ts -> PaymentStatus):
--   pending, authorized, captured, failed,
--   refund_pending, refund_requested, refunded, cancelled
--
-- Idempotent: re-running is a no-op once rows are reconciled.

BEGIN;

-- 1. Snapshot rows that will change (for audit)
DO $$
DECLARE
  affected_count integer;
BEGIN
  SELECT COUNT(*) INTO affected_count
  FROM payments
  WHERE status = 'paid';

  RAISE NOTICE 'payment_status data-sync: % rows with status=paid will be migrated to captured', affected_count;
END $$;

-- 2. Migrate legacy "paid" -> "captured"
UPDATE payments
SET status = 'captured',
    updated_at = NOW()
WHERE status = 'paid';

-- 2b. Migrate legacy "awaiting_payment" -> "pending" (semantically equivalent).
--     Existed in pre-v3.1 builds during the Yoco hosted-checkout redirect window.
UPDATE payments
SET status = 'pending',
    updated_at = NOW()
WHERE status = 'awaiting_payment';

-- 3. Verify no unexpected legacy values remain (warn only; do not fail)
DO $$
DECLARE
  unexpected record;
BEGIN
  FOR unexpected IN
    SELECT DISTINCT status, COUNT(*) AS n
    FROM payments
    WHERE status NOT IN (
      'pending', 'authorized', 'captured', 'failed',
      'refund_pending', 'refund_requested', 'refunded', 'cancelled'
    )
    GROUP BY status
  LOOP
    RAISE WARNING 'payment_status data-sync: % rows with non-canonical status "%"', unexpected.n, unexpected.status;
  END LOOP;
END $$;

-- 4. Tighten the CHECK constraint to the canonical union going forward.
--    If a constraint with this name already exists, drop + recreate to ensure
--    it matches the current canonical list exactly.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_status_check;

ALTER TABLE payments
ADD CONSTRAINT payments_status_check CHECK (
  status IN (
    'pending', 'authorized', 'captured', 'failed',
    'refund_pending', 'refund_requested', 'refunded', 'cancelled'
  )
);

COMMIT;
