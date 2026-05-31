-- WhatsApp notifications (22 May 2026):
--   1. Add `whatsapp_optin` boolean to profiles. Default FALSE per WhatsApp
--      Business Policy — explicit customer opt-in is REQUIRED before any
--      business-initiated message. Sending without opt-in violates Meta's
--      messaging policy and can suspend the sender.
--   2. Add optional `whatsapp_number` so customers can use a different
--      number for WhatsApp than their account phone (common case: account
--      uses a SIM that isn't on WhatsApp).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS whatsapp_optin BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

COMMENT ON COLUMN public.profiles.whatsapp_optin IS
  'Customer opted in to receive order updates via WhatsApp. Required by Meta policy before any business-initiated message.';
COMMENT ON COLUMN public.profiles.whatsapp_number IS
  'Optional override — number used for WhatsApp delivery if different from auth.users.phone. Stored E.164 (e.g. +27621234567).';

-- Partial index for the order-status fan-out — fast lookup of opted-in
-- customers when the status-change trigger fires.
CREATE INDEX IF NOT EXISTS profiles_whatsapp_optin_idx
  ON public.profiles (id)
  WHERE whatsapp_optin = TRUE;
