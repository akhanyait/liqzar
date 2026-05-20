-- ============================================================================
-- Migration 006: Fix RLS policies that illegally query auth.users directly
-- ============================================================================
--
-- The driver_system_and_logistics migration created several RLS policies that
-- use `SELECT 1 FROM auth.users WHERE ...` to check roles. This fails with
-- "permission denied for table users" (42501) for all authenticated clients
-- because auth.users is only accessible via the service role.
--
-- Additionally, those policies referenced 'warehouse_manager' which is not a
-- valid app_role enum value (the correct value is 'warehouse').
--
-- All affected policies are replaced here using public.has_role() which is a
-- SECURITY DEFINER function that safely queries public.user_roles instead.
-- ============================================================================

-- ── driver_profiles ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all profiles"   ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.driver_profiles;

CREATE POLICY "Admins can view all profiles"
    ON public.driver_profiles FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );

CREATE POLICY "Admins can update all profiles"
    ON public.driver_profiles FOR UPDATE
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );

-- ── driver_vehicles ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all vehicles" ON public.driver_vehicles;

CREATE POLICY "Admins can view all vehicles"
    ON public.driver_vehicles FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );

-- ── order_items ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Drivers and admins can view order items"   ON public.order_items;
DROP POLICY IF EXISTS "Drivers and admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can insert order items"             ON public.order_items;

CREATE POLICY "Drivers and admins can view order items"
    ON public.order_items FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'driver') OR
        public.has_role(auth.uid(), 'warehouse')
    );

CREATE POLICY "Drivers and admins can update order items"
    ON public.order_items FOR UPDATE
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'driver') OR
        public.has_role(auth.uid(), 'warehouse')
    );

CREATE POLICY "Admins can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );

-- ── package_groups ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Drivers and admins can view package groups" ON public.package_groups;
DROP POLICY IF EXISTS "Admins can manage package groups"           ON public.package_groups;

CREATE POLICY "Drivers and admins can view package groups"
    ON public.package_groups FOR SELECT
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'driver') OR
        public.has_role(auth.uid(), 'warehouse')
    );

CREATE POLICY "Admins can manage package groups"
    ON public.package_groups FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );

-- ── delivery_assignments ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Drivers can view own assignments" ON public.delivery_assignments;
DROP POLICY IF EXISTS "Admins can manage deliveries"     ON public.delivery_assignments;

CREATE POLICY "Drivers can view own assignments"
    ON public.delivery_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.driver_profiles
            WHERE driver_profiles.id = delivery_assignments.driver_id
            AND driver_profiles.user_id = auth.uid()
        )
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'warehouse')
    );

CREATE POLICY "Admins can manage deliveries"
    ON public.delivery_assignments FOR ALL
    USING (
        public.has_role(auth.uid(), 'admin') OR
        public.has_role(auth.uid(), 'warehouse')
    );
