-- 20260517_001 — Catch-up migration for columns referenced by code
-- but never created by any prior migration. Three columns:
--   orders.metadata (jsonb)               — used by OrderWorkflowEngine to
--                                           store driver_name, driver_id,
--                                           driver_auth_user_id, dispatch_score
--   delivery_assignments.accepted_at      — driver acceptance timestamp
--   delivery_assignments.cancelled_at     — assignment cancellation timestamp
--
-- Idempotent (IF NOT EXISTS).

BEGIN;

-- orders.metadata
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS orders_metadata_gin_idx
  ON public.orders USING GIN (metadata);

-- delivery_assignments.accepted_at + cancelled_at
ALTER TABLE public.delivery_assignments
  ADD COLUMN IF NOT EXISTS accepted_at  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

-- Useful index for the dashboard query that filters by active assignments
CREATE INDEX IF NOT EXISTS delivery_assignments_active_idx
  ON public.delivery_assignments (driver_id)
  WHERE cancelled_at IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
