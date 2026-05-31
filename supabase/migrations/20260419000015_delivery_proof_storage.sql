-- ────────────────────────────────────────────────────────────────────────────
-- Migration 015 — Delivery Proof Storage Bucket
--
-- Creates the `delivery-proofs` Storage bucket with object-level RLS:
--   - Drivers can INSERT into their own `{driverId}/{orderId}/...` path.
--   - Customers/drivers can SELECT their related objects.
--   - Admins have full access.
-- ────────────────────────────────────────────────────────────────────────────

-- Bucket (idempotent)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'delivery-proofs',
  'delivery-proofs',
  false,
  8388608, -- 8 MB per photo
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Drop any pre-existing policies for a clean re-run
DROP POLICY IF EXISTS "Driver uploads proof to own path" ON storage.objects;
DROP POLICY IF EXISTS "Driver reads own proof objects" ON storage.objects;
DROP POLICY IF EXISTS "Customer reads proof for own order" ON storage.objects;
DROP POLICY IF EXISTS "Admin full access to proof bucket" ON storage.objects;

-- Path convention: {driverId}/{orderId}/{filename}
CREATE POLICY "Driver uploads proof to own path" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Driver reads own proof objects" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Customer can read an object if they own the order referenced in segment 2.
CREATE POLICY "Customer reads proof for own order" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND o.user_id = auth.uid()
    )
  );

CREATE POLICY "Admin full access to proof bucket" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'delivery-proofs'
    AND public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    bucket_id = 'delivery-proofs'
    AND public.has_role(auth.uid(), 'admin')
  );

