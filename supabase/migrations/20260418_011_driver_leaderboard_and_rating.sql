-- Migration 011: driver rating column + leaderboard view
-- Adds driver_profiles.rating (0-5, default 5.0) + 7-day deliveries leaderboard.

-- ─── 1. Add rating + total_deliveries to driver_profiles ───────────────────
ALTER TABLE public.driver_profiles
  ADD COLUMN IF NOT EXISTS rating NUMERIC(3, 2) DEFAULT 5.00 NOT NULL,
  ADD COLUMN IF NOT EXISTS total_deliveries INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE public.driver_profiles
  DROP CONSTRAINT IF EXISTS driver_profiles_rating_bounds;
ALTER TABLE public.driver_profiles
  ADD CONSTRAINT driver_profiles_rating_bounds
  CHECK (rating >= 0 AND rating <= 5);

-- ─── 2. Leaderboard view (7-day rolling window) ────────────────────────────
-- Ranks drivers by delivered-order count over the past 7 days.
-- Exposed column `driver_user_id` matches auth.users.id (= orders.assigned_driver_id).
DROP VIEW IF EXISTS public.driver_leaderboard;

-- security_invoker=false (the default) runs the view as its owner so global
-- rank can be computed across all drivers. Leaderboard is intended to be
-- visible to authenticated staff/drivers.
CREATE VIEW public.driver_leaderboard AS
SELECT
  assigned_driver_id AS driver_user_id,
  COUNT(*) AS deliveries_7d,
  RANK() OVER (ORDER BY COUNT(*) DESC) AS rank
FROM public.orders
WHERE status = 'delivered'
  AND delivered_at >= (NOW() - INTERVAL '7 days')
  AND assigned_driver_id IS NOT NULL
GROUP BY assigned_driver_id;

COMMENT ON VIEW public.driver_leaderboard IS
  '7-day rolling driver leaderboard. Ranks by delivered order count.';

GRANT SELECT ON public.driver_leaderboard TO authenticated;
