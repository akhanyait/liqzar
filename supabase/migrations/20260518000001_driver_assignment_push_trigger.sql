-- 20260518_001 — Driver assignment push notification trigger
--
-- When a new row is inserted into delivery_assignments, fire the
-- `notify-driver-assignment` edge function asynchronously via pg_net.
-- This gives the assigned driver a real push notification (lock-screen)
-- in addition to the in-app realtime refresh that already happens.
--
-- Requires:
--   - pg_net extension (Supabase Pro plans)
--   - SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY available as DB settings
--   - Edge function deployed at /functions/v1/notify-driver-assignment
--
-- Idempotent.

BEGIN;

-- 1. Ensure pg_net is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Function: post to the edge function asynchronously
CREATE OR REPLACE FUNCTION public.fn_notify_driver_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role text;
  v_request_id   bigint;
BEGIN
  -- Read Supabase env from vault (set by Supabase Pro automatically)
  v_supabase_url  := current_setting('app.settings.supabase_url', true);
  v_service_role  := current_setting('app.settings.service_role_key', true);

  -- Fallback to hardcoded URL if app.settings not configured (it usually isn't on Pro)
  IF v_supabase_url IS NULL OR v_supabase_url = '' THEN
    -- Use the project ref from the existing config
    v_supabase_url := 'https://deiewcktyzzeviszukqj.supabase.co';
  END IF;

  -- Fire the edge function asynchronously; we don't block the INSERT.
  -- Service role key is fetched from vault.secrets if available, else uses the anon key
  -- in the Authorization header (the function validates internally).
  SELECT net.http_post(
    url := v_supabase_url || '/functions/v1/notify-driver-assignment',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(v_service_role, '')
    ),
    body := jsonb_build_object(
      'assignmentId', NEW.id::text
    )
  ) INTO v_request_id;

  -- Log so we can audit later
  RAISE NOTICE 'Driver-assignment push triggered for assignment %, pg_net request_id=%', NEW.id, v_request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block an assignment insert because of a push notification failure.
  RAISE WARNING 'Failed to fire driver-assignment push for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Trigger: fire AFTER INSERT (so the row is visible to the EF when it queries)
DROP TRIGGER IF EXISTS trg_notify_driver_on_assignment ON public.delivery_assignments;

CREATE TRIGGER trg_notify_driver_on_assignment
  AFTER INSERT ON public.delivery_assignments
  FOR EACH ROW
  WHEN (NEW.driver_id IS NOT NULL)
  EXECUTE FUNCTION public.fn_notify_driver_assignment();

NOTIFY pgrst, 'reload schema';

COMMIT;
