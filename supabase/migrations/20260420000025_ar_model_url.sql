-- 025 — AR bottle preview
-- Adds ar_model_url for USDZ (iOS Quick Look) and GLB (Android Scene Viewer).
-- Idempotent.

BEGIN;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS ar_model_url_ios text,      -- .usdz
  ADD COLUMN IF NOT EXISTS ar_model_url_android text;  -- .glb

COMMIT;
