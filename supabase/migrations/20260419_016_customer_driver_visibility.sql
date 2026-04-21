-- ─────────────────────────────────────────────────────────────────────────────
-- Customer visibility for assigned driver's profile + vehicle
--
-- Problem: Once an admin assigns a driver to an order, the customer needs to see
-- the driver's name, phone, rating, profile photo and vehicle details in the
-- live order tracking UI. Prior RLS only granted SELECT on driver_profiles /
-- driver_vehicles to the driver themselves or an admin, so the customer query
-- returned no rows and the UI stayed stuck on "Waiting for driver assignment".
--
-- Fix: Add narrowly-scoped SELECT policies that expose a driver's profile +
-- vehicle to any user who has an active order assigned to that driver. Once the
-- order is delivered / cancelled / refunded the visibility goes away.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── driver_profiles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Customers can view their assigned driver profile"
    ON public.driver_profiles;

CREATE POLICY "Customers can view their assigned driver profile"
    ON public.driver_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.user_id = auth.uid()
              AND o.assigned_driver_id = public.driver_profiles.user_id
              AND o.status IN (
                  'driver_assigned',
                  'picked_up',
                  'en_route',
                  'delivered',
                  'completed'
              )
        )
    );

-- ── driver_vehicles ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Customers can view their assigned driver vehicle"
    ON public.driver_vehicles;

CREATE POLICY "Customers can view their assigned driver vehicle"
    ON public.driver_vehicles FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            JOIN public.driver_profiles dp
                 ON dp.user_id = o.assigned_driver_id
            WHERE o.user_id = auth.uid()
              AND dp.id = public.driver_vehicles.driver_id
              AND o.status IN (
                  'driver_assigned',
                  'picked_up',
                  'en_route',
                  'delivered',
                  'completed'
              )
        )
    );

-- ── driver_assignments ──────────────────────────────────────────────────────
-- Customer needs eta_minutes + current_location snapshot for their own order.
DROP POLICY IF EXISTS "Customers can view assignments for their orders"
    ON public.driver_assignments;

CREATE POLICY "Customers can view assignments for their orders"
    ON public.driver_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.orders o
            WHERE o.id = public.driver_assignments.order_id
              AND o.user_id = auth.uid()
        )
    );
