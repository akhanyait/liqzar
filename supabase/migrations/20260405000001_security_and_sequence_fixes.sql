-- ============================================================================
-- SECURITY & INTEGRITY FIXES
-- 1. Make driver-documents storage bucket private
-- 2. Replace race-prone order number generation with a proper sequence
-- 3. Add RLS policies that were missing
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Make driver-documents bucket PRIVATE
--    (IDs, driver's licences must NOT be publicly accessible)
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET public = false
WHERE id = 'driver-documents';

-- Allow drivers to upload their own documents
DROP POLICY IF EXISTS "Drivers can upload own documents" ON storage.objects;
CREATE POLICY "Drivers can upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow drivers to read their own documents
DROP POLICY IF EXISTS "Drivers can read own documents" ON storage.objects;
CREATE POLICY "Drivers can read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow admins to read all driver documents
DROP POLICY IF EXISTS "Admins can read driver documents" ON storage.objects;
CREATE POLICY "Admins can read driver documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'driver-documents'
    AND public.has_role(auth.uid(), 'admin')
  );

-- ---------------------------------------------------------------------------
-- 2. Replace race-prone sequence with PostgreSQL SEQUENCE
--    The old approach (SELECT MAX + 1) has a race condition under concurrent
--    inserts; a dedicated sequence is atomic and gap-safe.
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT;
  seq_num   BIGINT;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  seq_num   := nextval('public.order_number_seq');
  RETURN 'LX-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Ensure order_items INSERT policy also validates stock positivity
--    (belt-and-suspenders alongside the application-level check)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_order_item_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (SELECT COALESCE(stock_quantity, 0) FROM public.products WHERE id = NEW.product_id)
     < NEW.quantity THEN
    RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_stock_before_order_item ON public.order_items;
CREATE TRIGGER validate_stock_before_order_item
  BEFORE INSERT ON public.order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_order_item_stock();

-- ---------------------------------------------------------------------------
-- 4. Missing policy: warehouse can update order status to 'preparing'/'ready'
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'Warehouse can update order status'
  ) THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "Warehouse can update order status" ON public.orders;
CREATE POLICY "Warehouse can update order status" ON public.orders
        FOR UPDATE TO authenticated
        USING (
          public.has_role(auth.uid(), 'warehouse')
          AND (assigned_warehouse_id = auth.uid() OR assigned_warehouse_id IS NULL)
        )
        WITH CHECK (
          status IN ('preparing', 'ready')
        )
    $policy$;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. Drivers must only update their own assignment columns (not others)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'driver_assignments'
      AND policyname = 'Drivers can update limited columns'
  ) THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "Drivers can update limited columns" ON public.driver_assignments;
CREATE POLICY "Drivers can update limited columns" ON public.driver_assignments
        FOR UPDATE TO authenticated
        USING (driver_id = auth.uid())
        WITH CHECK (driver_id = auth.uid())
    $policy$;
  END IF;
END $$;
