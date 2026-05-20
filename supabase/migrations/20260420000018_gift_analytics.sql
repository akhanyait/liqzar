-- 018 — Gift analytics
-- Tracks gift-wrap, recipient, note and delivery telemetry on orders so
-- merchandising can measure the gifting flow without joining free-form notes.

BEGIN;

-- ─── gift_events: one row per gift action on an order ────────────────────
CREATE TABLE IF NOT EXISTS public.gift_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  wrap_style    text NOT NULL CHECK (wrap_style IN ('none','signature','velvet','hamper')),
  wrap_fee      numeric(10,2) NOT NULL DEFAULT 0,
  has_note      boolean NOT NULL DEFAULT false,
  note_length   integer NOT NULL DEFAULT 0,
  ship_to_recipient boolean NOT NULL DEFAULT false,
  platform      text CHECK (platform IN ('web','ios','android')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_events_order ON public.gift_events(order_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_user  ON public.gift_events(user_id);
CREATE INDEX IF NOT EXISTS idx_gift_events_created ON public.gift_events(created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────────────────
ALTER TABLE public.gift_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gift_events_owner_select" ON public.gift_events;
CREATE POLICY "gift_events_owner_select" ON public.gift_events
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "gift_events_insert_authenticated" ON public.gift_events;
CREATE POLICY "gift_events_insert_authenticated" ON public.gift_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "gift_events_admin_select" ON public.gift_events;
CREATE POLICY "gift_events_admin_select" ON public.gift_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ─── Rollup view for admin dashboard ─────────────────────────────────────
CREATE OR REPLACE VIEW public.v_gift_rollup_daily AS
SELECT
  date_trunc('day', created_at) AS day,
  wrap_style,
  COUNT(*)::int                  AS orders,
  SUM(wrap_fee)::numeric(12,2)   AS gift_revenue,
  SUM(CASE WHEN has_note THEN 1 ELSE 0 END)::int AS with_note,
  SUM(CASE WHEN ship_to_recipient THEN 1 ELSE 0 END)::int AS shipped_to_recipient
FROM public.gift_events
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

GRANT SELECT ON public.v_gift_rollup_daily TO authenticated;

COMMIT;
