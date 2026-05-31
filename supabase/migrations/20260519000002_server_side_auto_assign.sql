-- 20260519_002 — Server-side auto-assignment when orders hit 'ready'
--
-- The previous workflow ran autoAssignDriver() client-side in the mobile app.
-- This meant direct DB updates (e.g., admin SQL or admin UI) wouldn't create
-- delivery_assignments rows, so drivers never got pushed and dashboards stayed
-- empty.
--
-- This BEFORE UPDATE trigger fires when an order transitions to 'ready':
--   1. Skips if an active assignment already exists (idempotent)
--   2. Picks the least-busy verified driver (basic load balancing)
--   3. INSERTs into delivery_assignments (which fires the existing push trigger)
--   4. Stamps order.metadata with driver info
--   5. Transitions order status to 'driver_assigned' immediately
--
-- If no verified drivers are available, the order stays at 'ready' and
-- can be picked up manually by an admin via assignDriver().

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_auto_assign_driver_on_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_driver_id        uuid;
  v_driver_user_id   uuid;
  v_driver_name      text;
BEGIN
  -- Only act on status transitions INTO 'ready' from something else
  IF NEW.status = 'ready'
     AND (OLD.status IS DISTINCT FROM 'ready')
  THEN
    -- Idempotency: skip if there's already an active assignment for this order
    IF EXISTS (
      SELECT 1
      FROM delivery_assignments
      WHERE order_id = NEW.id
        AND status NOT IN ('cancelled')
    ) THEN
      RETURN NEW;
    END IF;

    -- Pick verified driver with fewest active assignments (random tie-break)
    SELECT dp.id, dp.user_id, dp.full_name
    INTO v_driver_id, v_driver_user_id, v_driver_name
    FROM driver_profiles dp
    LEFT JOIN delivery_assignments da
      ON da.driver_id = dp.id
      AND da.status IN ('pending', 'accepted', 'picked_up', 'en_route')
    WHERE dp.is_verified = TRUE
    GROUP BY dp.id, dp.user_id, dp.full_name
    ORDER BY COUNT(da.id) ASC, random()
    LIMIT 1;

    -- No drivers available — leave order at 'ready' for admin to assign manually
    IF v_driver_id IS NULL THEN
      RAISE NOTICE 'No verified drivers available for auto-assign on order %', NEW.id;
      RETURN NEW;
    END IF;

    -- Insert assignment (this fires trg_notify_driver_on_assignment for push)
    INSERT INTO delivery_assignments (order_id, driver_id, status)
    VALUES (NEW.id, v_driver_id, 'pending');

    -- Stamp metadata so the mobile app and notifications can read driver info
    NEW.metadata := COALESCE(NEW.metadata, '{}'::jsonb) || jsonb_build_object(
      'driver_id',           v_driver_id::text,
      'driver_auth_user_id', v_driver_user_id::text,
      'driver_name',         v_driver_name,
      'auto_assigned_at',    now()::text
    );

    -- Advance status to driver_assigned
    NEW.status := 'driver_assigned';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_assign_driver_on_ready ON orders;
CREATE TRIGGER trg_auto_assign_driver_on_ready
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_auto_assign_driver_on_ready();

NOTIFY pgrst, 'reload schema';

COMMIT;
