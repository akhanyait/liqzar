-- =============================================================================
-- Migration 010: Remove the 'warehouse' user role
-- -----------------------------------------------------------------------------
-- Folds warehouse-role users into the admin role for this small-scale deploy.
-- Physical warehouse concerns (warehouse_tasks table, assigned_warehouse_id)
-- remain; only the user *role* is removed.
--
-- Order of operations (Postgres requires each before the next):
--   1. Migrate any user_roles rows from 'warehouse' → 'admin'
--   2. DROP every RLS policy that references the 'warehouse' enum value
--      (enum cannot be altered while values are referenced in a policy)
--   3. Clone the app_role enum without 'warehouse', swap it in, drop the old
--   4. Recreate a minimal set of admin-only policies on warehouse_tasks so
--      admin still has read/write access after the enum swap
--   5. Validate no residual 'warehouse' references
--
-- Run on a non-production DB first. Verify row counts:
--   SELECT role, COUNT(*) FROM public.user_roles GROUP BY role;
-- =============================================================================

BEGIN;

-- ── Step 1: Migrate role assignments ─────────────────────────────────────────
UPDATE public.user_roles
   SET role = 'admin'::public.app_role
 WHERE role = 'warehouse'::public.app_role;

-- ── Step 2: Drop every policy that mentions 'warehouse' ──────────────────────
-- Two groups:
--   (A) "Warehouse-only" policies — drop outright (no replacement needed; the
--       warehouse role is gone).
--   (B) "Mixed" policies where warehouse appears as an OR-branch alongside
--       admin/driver — drop here, then recreate in Step 4.5 with the warehouse
--       branch stripped out so admin/driver access is preserved.

-- Group (A): Warehouse-only policies ─────────────────────────────────────────
-- orders
DROP POLICY IF EXISTS "Warehouse can read assigned orders"        ON public.orders;
DROP POLICY IF EXISTS "Warehouse can update orders"               ON public.orders;
DROP POLICY IF EXISTS "Warehouse can update order status"         ON public.orders;

-- order_items
DROP POLICY IF EXISTS "Warehouse can read order items"            ON public.order_items;
DROP POLICY IF EXISTS "Warehouse can read assigned order items"   ON public.order_items;
DROP POLICY IF EXISTS "Warehouse can update order items"          ON public.order_items;
DROP POLICY IF EXISTS "Warehouse reads all order items"           ON public.order_items;

-- warehouse_tasks (table KEPT, admin-only policies created in Step 4)
DROP POLICY IF EXISTS "Warehouse can read tasks"                  ON public.warehouse_tasks;
DROP POLICY IF EXISTS "Warehouse can update tasks"                ON public.warehouse_tasks;
DROP POLICY IF EXISTS "Warehouse can manage tasks"                ON public.warehouse_tasks;

-- delivery_assignments
DROP POLICY IF EXISTS "Warehouse can read assignments"            ON public.delivery_assignments;
DROP POLICY IF EXISTS "Warehouse can update assignments"          ON public.delivery_assignments;

-- Group (B): Mixed policies — drop here, recreate in Step 4.5 ────────────────
-- admin_audit_log
DROP POLICY IF EXISTS "Admin audit log insert"                    ON public.admin_audit_log;

-- delivery_assignments
DROP POLICY IF EXISTS "Admins can manage deliveries"              ON public.delivery_assignments;
DROP POLICY IF EXISTS "Drivers can view own assignments"          ON public.delivery_assignments;

-- driver_profiles
DROP POLICY IF EXISTS "Admins can update all profiles"            ON public.driver_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"              ON public.driver_profiles;

-- driver_vehicles
DROP POLICY IF EXISTS "Admins can view all vehicles"              ON public.driver_vehicles;

-- order_items
DROP POLICY IF EXISTS "Admins can insert order items"             ON public.order_items;
DROP POLICY IF EXISTS "Drivers and admins can update order items" ON public.order_items;
DROP POLICY IF EXISTS "Drivers and admins can view order items"   ON public.order_items;

-- order_status_history
DROP POLICY IF EXISTS "Staff can read all history"                ON public.order_status_history;

-- package_groups
DROP POLICY IF EXISTS "Admins can manage package groups"          ON public.package_groups;
DROP POLICY IF EXISTS "Drivers and admins can view package groups" ON public.package_groups;

-- Defensive sweep: any policy whose qual or with_check still mentions
-- 'warehouse' literal would block the enum swap. Raise a clear error.
DO $$
DECLARE
  offenders INTEGER;
BEGIN
  SELECT COUNT(*) INTO offenders
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '')       LIKE '%''warehouse''%'
       OR COALESCE(with_check, '') LIKE '%''warehouse''%');

  IF offenders > 0 THEN
    RAISE EXCEPTION
      'Cannot alter enum: % policies still reference ''warehouse''. '
      'Add explicit DROP POLICY statements above for them, then rerun.',
      offenders;
  END IF;
END $$;

-- ── Step 3: Rebuild app_role enum without 'warehouse' ────────────────────────
ALTER TYPE public.app_role RENAME TO app_role_old;

CREATE TYPE public.app_role AS ENUM ('admin', 'customer', 'driver');

-- Recast every column that uses app_role. user_roles.role is the primary one.
-- If additional columns use app_role in your deployment, add them here.
ALTER TABLE public.user_roles
  ALTER COLUMN role TYPE public.app_role
  USING role::text::public.app_role;

-- If has_role() is declared with app_role_old in its signature, recreate it
-- against the new enum. The function body does not change.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'has_role'
  ) THEN
    -- The function likely references app_role. Drop and recreate.
    -- CASCADE because RLS policies across many tables depend on this function.
    -- They'll be recreated below as part of this migration.
    DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role_old) CASCADE;
    DROP FUNCTION IF EXISTS public.has_role(uuid, text) CASCADE;
  END IF;
END $$;

-- Recreate has_role with the new enum (idempotent — matches pattern used in
-- earlier migrations).
DROP FUNCTION IF EXISTS public.has_role CASCADE;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.user_roles
     WHERE user_id = _user_id
       AND role    = _role
  );
$$;

-- Finally, drop the old enum now that nothing references it.
DROP TYPE IF EXISTS public.app_role_old CASCADE;

-- ── Step 4: Recreate admin-only policies on warehouse_tasks ──────────────────
-- The underlying table is kept (OrderWorkflowEngine still inserts pick/pack/
-- dispatch tasks). Admin now consumes it.

DROP POLICY IF EXISTS "Admins can manage warehouse tasks" ON public.warehouse_tasks;
CREATE POLICY "Admins can manage warehouse tasks"
  ON public.warehouse_tasks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can read warehouse tasks" ON public.warehouse_tasks;
CREATE POLICY "Admins can read warehouse tasks"
  ON public.warehouse_tasks
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ── Step 4.5: Recreate mixed policies without the warehouse OR-branch ────────
-- Each of these was reconstructed from the live pg_policies dump; the only
-- change is removal of `OR has_role(auth.uid(), 'warehouse'::app_role)`.
-- admin/driver access is preserved exactly as before.

-- admin_audit_log.Admin audit log insert (INSERT, with_check)
CREATE POLICY "Admin audit log insert"
  ON public.admin_audit_log
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- delivery_assignments.Admins can manage deliveries (ALL, qual)
CREATE POLICY "Admins can manage deliveries"
  ON public.delivery_assignments
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- delivery_assignments.Drivers can view own assignments (SELECT, qual)
CREATE POLICY "Drivers can view own assignments"
  ON public.delivery_assignments
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.driver_profiles
       WHERE driver_profiles.id = delivery_assignments.driver_id
         AND driver_profiles.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- driver_profiles.Admins can update all profiles (UPDATE, qual)
CREATE POLICY "Admins can update all profiles"
  ON public.driver_profiles
  FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- driver_profiles.Admins can view all profiles (SELECT, qual)
CREATE POLICY "Admins can view all profiles"
  ON public.driver_profiles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- driver_vehicles.Admins can view all vehicles (SELECT, qual)
CREATE POLICY "Admins can view all vehicles"
  ON public.driver_vehicles
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- order_items.Admins can insert order items (INSERT, with_check)
CREATE POLICY "Admins can insert order items"
  ON public.order_items
  FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- order_items.Drivers and admins can update order items (UPDATE, qual)
CREATE POLICY "Drivers and admins can update order items"
  ON public.order_items
  FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

-- order_items.Drivers and admins can view order items (SELECT, qual)
CREATE POLICY "Drivers and admins can view order items"
  ON public.order_items
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

-- order_status_history.Staff can read all history (SELECT, qual)
CREATE POLICY "Staff can read all history"
  ON public.order_status_history
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

-- package_groups.Admins can manage package groups (ALL, qual)
CREATE POLICY "Admins can manage package groups"
  ON public.package_groups
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- package_groups.Drivers and admins can view package groups (SELECT, qual)
CREATE POLICY "Drivers and admins can view package groups"
  ON public.package_groups
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'driver'::public.app_role)
  );

-- ── Step 5: Post-migration validation ────────────────────────────────────────
DO $$
DECLARE
  remaining_role INTEGER;
  remaining_pol  INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_role
    FROM public.user_roles
   WHERE role::text = 'warehouse';

  IF remaining_role > 0 THEN
    RAISE EXCEPTION 'Role migration incomplete: % user_roles rows still warehouse', remaining_role;
  END IF;

  SELECT COUNT(*) INTO remaining_pol
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (COALESCE(qual, '')       LIKE '%''warehouse''%'
       OR COALESCE(with_check, '') LIKE '%''warehouse''%');

  IF remaining_pol > 0 THEN
    RAISE EXCEPTION 'Policy cleanup incomplete: % policies still reference warehouse', remaining_pol;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- Verification queries (run separately AFTER the migration)
-- =============================================================================
-- SELECT role, COUNT(*) FROM public.user_roles GROUP BY role;
--   Expected: only admin / customer / driver
--
-- SELECT enumlabel FROM pg_enum
--   JOIN pg_type t ON t.oid = enumtypid
--  WHERE t.typname = 'app_role';
--   Expected: admin, customer, driver (3 rows)
--
-- SELECT policyname FROM pg_policies
--  WHERE schemaname = 'public'
--    AND (COALESCE(qual, '') LIKE '%warehouse%'
--      OR COALESCE(with_check, '') LIKE '%warehouse%');
--   Expected: 0 rows
--
-- Optional: delete or reassign the seeded warehouse test-user
--   SELECT id, email FROM auth.users WHERE email = 'warehouse@liquorlux.co.za';
-- =============================================================================
