-- ============================================================================
-- LIQZAR — Migration 20260419_001 : Ozow payment gateway
-- ============================================================================
-- Purpose: replace Yoco with Ozow as the card / instant-EFT payment gateway.
--          - Broaden payments.gateway CHECK constraint to accept 'ozow'.
--          - Change payments.gateway default to 'ozow'.
--          - Add payments.ozow_transaction_id (returned by Ozow webhook).
--          - Index for fast webhook reconciliation.
-- Safe:    existing yoco_* columns and historical 'yoco' rows are left in place
--          for audit + refund-portal cross-reference. No data is deleted.
-- Date:    2026-04-19
-- ============================================================================

BEGIN;

-- 1. Broaden the CHECK constraint so 'ozow' is valid.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_gateway_check;
ALTER TABLE payments
  ADD CONSTRAINT payments_gateway_check
  CHECK (gateway IN ('yoco','payfast','manual','ozow'));

-- 2. New default for fresh rows.
ALTER TABLE payments ALTER COLUMN gateway SET DEFAULT 'ozow';

-- 3. Ozow transaction id (unique per Ozow PaymentRequestId / TransactionId).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ozow_transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS ozow_payment_request_id TEXT;

-- 4. Index supports capture-payment webhook lookup by TransactionReference or
--    TransactionId without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_payments_ozow_transaction_id
  ON payments(ozow_transaction_id);
CREATE INDEX IF NOT EXISTS idx_payments_ozow_payment_request_id
  ON payments(ozow_payment_request_id);

-- 5. webhook_events.source whitelist must include 'ozow' so the capture-payment
--    EF can log inbound Ozow webhooks for audit/replay.
ALTER TABLE webhook_events DROP CONSTRAINT IF EXISTS webhook_events_source_check;
ALTER TABLE webhook_events
  ADD CONSTRAINT webhook_events_source_check
  CHECK (source IN ('yoco','payfast','system','ozow'));

COMMIT;

-- ============================================================================
-- ROLLBACK:
--   ALTER TABLE payments DROP CONSTRAINT payments_gateway_check;
--   ALTER TABLE payments ADD CONSTRAINT payments_gateway_check
--     CHECK (gateway IN ('yoco','payfast','manual'));
--   ALTER TABLE payments ALTER COLUMN gateway SET DEFAULT 'yoco';
--   DROP INDEX IF EXISTS idx_payments_ozow_transaction_id;
--   DROP INDEX IF EXISTS idx_payments_ozow_payment_request_id;
--   ALTER TABLE payments DROP COLUMN IF EXISTS ozow_transaction_id;
--   ALTER TABLE payments DROP COLUMN IF EXISTS ozow_payment_request_id;
-- ============================================================================
