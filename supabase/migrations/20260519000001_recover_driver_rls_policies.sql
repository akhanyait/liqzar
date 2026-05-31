-- 20260519_001 — Recover driver-side RLS policies dropped via CASCADE.
--
-- The warehouse_role migration (20260418000010) dropped has_role() CASCADE
-- which removed many policies. We recovered admin policies in 20260517_002
-- but driver-specific SELECT policies were also lost. Without them, signed-in
-- drivers see "All caught up!" on their dashboard because the SELECT queries
-- on driver_profiles / delivery_assignments / orders return zero rows.
--
-- This migration restores read access for the driver role.
-- Idempotent.

BEGIN;

-- driver_profiles — driver can read their own row
DROP POLICY IF EXISTS "Driver can read own profile" ON public.driver_profiles;
CREATE POLICY "Driver can read own profile" ON public.driver_profiles
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Driver can update own profile" ON public.driver_profiles;
CREATE POLICY "Driver can update own profile" ON public.driver_profiles
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- driver_vehicles — driver can read their own vehicle
DROP POLICY IF EXISTS "Driver can read own vehicle" ON public.driver_vehicles;
CREATE POLICY "Driver can read own vehicle" ON public.driver_vehicles
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
    )
  );

-- delivery_assignments — driver can read their own assignments
DROP POLICY IF EXISTS "Driver can read own assignments" ON public.delivery_assignments;
CREATE POLICY "Driver can read own assignments" ON public.delivery_assignments
  FOR SELECT
  USING (
    driver_id IN (
      SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Driver can update own assignments" ON public.delivery_assignments;
CREATE POLICY "Driver can update own assignments" ON public.delivery_assignments
  FOR UPDATE
  USING (
    driver_id IN (
      SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    driver_id IN (
      SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
    )
  );

-- orders — driver can read orders assigned to them
DROP POLICY IF EXISTS "Driver can read assigned orders" ON public.orders;
CREATE POLICY "Driver can read assigned orders" ON public.orders
  FOR SELECT
  USING (
    id IN (
      SELECT order_id FROM public.delivery_assignments
      WHERE driver_id IN (
        SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Driver can update assigned order status" ON public.orders;
CREATE POLICY "Driver can update assigned order status" ON public.orders
  FOR UPDATE
  USING (
    id IN (
      SELECT order_id FROM public.delivery_assignments
      WHERE driver_id IN (
        SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    id IN (
      SELECT order_id FROM public.delivery_assignments
      WHERE driver_id IN (
        SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
      )
    )
  );

-- order_items — driver can read items of orders assigned to them
DROP POLICY IF EXISTS "Driver can read items of assigned orders" ON public.order_items;
CREATE POLICY "Driver can read items of assigned orders" ON public.order_items
  FOR SELECT
  USING (
    order_id IN (
      SELECT id FROM public.orders
      WHERE id IN (
        SELECT order_id FROM public.delivery_assignments
        WHERE driver_id IN (
          SELECT id FROM public.driver_profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- profiles — driver can read/update own profile (for push_token writes)
DROP POLICY IF EXISTS "Profile owner can read own profile" ON public.profiles;
CREATE POLICY "Profile owner can read own profile" ON public.profiles
  FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Profile owner can update own profile" ON public.profiles;
CREATE POLICY "Profile owner can update own profile" ON public.profiles
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

NOTIFY pgrst, 'reload schema';

COMMIT;
