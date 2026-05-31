-- 20260518_002 — Add push_token column to profiles
--
-- The mobile NotificationService writes to profiles.push_token after
-- registering for push notifications, but no prior migration creates the
-- column. Without it, the write fails silently and the edge function
-- has no token to deliver to.
--
-- Idempotent.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS push_token text;

-- Partial index for fast lookups when sending push (only non-null tokens)
CREATE INDEX IF NOT EXISTS profiles_push_token_idx
  ON public.profiles (push_token)
  WHERE push_token IS NOT NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
