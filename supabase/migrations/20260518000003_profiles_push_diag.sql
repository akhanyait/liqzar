-- 20260518_003 — Add push_registration_status to profiles for in-DB diagnostics.
-- v9 NotificationService writes the registration result here so we can query
-- it without needing device-level logs.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_registration_status text,
  ADD COLUMN IF NOT EXISTS push_registration_at     timestamptz;

NOTIFY pgrst, 'reload schema';

COMMIT;
