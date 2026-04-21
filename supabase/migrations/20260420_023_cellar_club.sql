-- 023 — Cellar Club subscriptions
-- Opt-in monthly cellar-curation membership with 3 tiers.
-- Idempotent via IF NOT EXISTS.

BEGIN;

-- ─── Tier enum ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cellar_club_tier') THEN
    CREATE TYPE public.cellar_club_tier AS ENUM (
      'founder',     -- R499/mo: 1 curated bottle
      'grand_cru',   -- R1,299/mo: 2 curated bottles + invites
      'premier'      -- R2,999/mo: 3 curated bottles + priority allocations
    );
  END IF;
END$$;

-- ─── Subscriptions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cellar_club_subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                public.cellar_club_tier NOT NULL,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','paused','cancelled')),
  monthly_amount_cents integer NOT NULL,
  started_at          timestamptz NOT NULL DEFAULT now(),
  current_period_end  timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  last_shipment_at    timestamptz,
  paused_reason       text,
  cancelled_at        timestamptz,
  cancellation_reason text,
  curator_notes       text,
  delivery_address    jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS cellar_club_status_idx
  ON public.cellar_club_subscriptions (status);
CREATE INDEX IF NOT EXISTS cellar_club_period_end_idx
  ON public.cellar_club_subscriptions (current_period_end)
  WHERE status = 'active';

-- ─── Shipments (monthly curated box) ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cellar_club_shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.cellar_club_subscriptions(id) ON DELETE CASCADE,
  order_id        uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  shipped_at      timestamptz,
  month           date NOT NULL,           -- first of month the box is for
  curator_note    text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (subscription_id, month)
);

CREATE INDEX IF NOT EXISTS cellar_club_shipments_sub_idx
  ON public.cellar_club_shipments (subscription_id);

-- ─── RLS ──────────────────────────────────────────────────────────────
ALTER TABLE public.cellar_club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cellar_club_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cellar_club_owner_select" ON public.cellar_club_subscriptions;
CREATE POLICY "cellar_club_owner_select" ON public.cellar_club_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cellar_club_owner_insert" ON public.cellar_club_subscriptions;
CREATE POLICY "cellar_club_owner_insert" ON public.cellar_club_subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cellar_club_owner_update" ON public.cellar_club_subscriptions;
CREATE POLICY "cellar_club_owner_update" ON public.cellar_club_subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cellar_club_admin_all" ON public.cellar_club_subscriptions;
CREATE POLICY "cellar_club_admin_all" ON public.cellar_club_subscriptions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "cellar_club_shipments_owner_select" ON public.cellar_club_shipments;
CREATE POLICY "cellar_club_shipments_owner_select" ON public.cellar_club_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.cellar_club_subscriptions s
      WHERE s.id = subscription_id AND s.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "cellar_club_shipments_admin_all" ON public.cellar_club_shipments;
CREATE POLICY "cellar_club_shipments_admin_all" ON public.cellar_club_shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ─── Admin visibility view ─────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_cellar_club_admin AS
SELECT
  s.id,
  s.user_id,
  p.full_name,
  p.phone,
  s.tier,
  s.status,
  s.monthly_amount_cents,
  s.started_at,
  s.current_period_end,
  s.last_shipment_at,
  s.curator_notes,
  COUNT(sh.id) AS shipments_sent
FROM public.cellar_club_subscriptions s
LEFT JOIN public.profiles p ON p.id = s.user_id
LEFT JOIN public.cellar_club_shipments sh ON sh.subscription_id = s.id
GROUP BY s.id, p.full_name, p.phone
ORDER BY s.started_at DESC;

GRANT SELECT ON public.v_cellar_club_admin TO authenticated;

COMMIT;
