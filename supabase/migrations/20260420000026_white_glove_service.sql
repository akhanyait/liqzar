-- 026 — White-glove VIP service tier
-- Auto-elevates premium orders (Platinum loyalty OR total >= R5000) into a
-- concierge-handled flow: dedicated handler, hand-delivery, bespoke unboxing.
-- Idempotent.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_white_glove boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS white_glove_notes text,
  ADD COLUMN IF NOT EXISTS concierge_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS concierge_contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS orders_white_glove_idx
  ON public.orders (is_white_glove)
  WHERE is_white_glove = true;

-- ─── Auto-elevate trigger ───────────────────────────────────────────────
-- Qualifying criteria (any of):
--   * Order total >= R5000
--   * Customer is Platinum loyalty tier
--   * Order contains a cellar_reserve product
DROP FUNCTION IF EXISTS public.auto_elevate_white_glove CASCADE;
CREATE OR REPLACE FUNCTION public.auto_elevate_white_glove()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_is_platinum boolean := false;
  v_has_reserve boolean := false;
BEGIN
  IF NEW.is_white_glove = true THEN
    RETURN NEW;  -- already elevated; skip
  END IF;

  -- Platinum tier check
  SELECT COALESCE(tier = 'platinum', false)
    INTO v_is_platinum
    FROM public.loyalty_accounts
   WHERE user_id = NEW.user_id;

  -- Cellar-reserve SKU check (best-effort — skips if table/column missing)
  BEGIN
    SELECT EXISTS (
      SELECT 1
        FROM public.order_items oi
        JOIN public.products p ON p.id = oi.product_id
       WHERE oi.order_id = NEW.id
         AND p.stock_tier = 'cellar_reserve'
    ) INTO v_has_reserve;
  EXCEPTION WHEN OTHERS THEN
    v_has_reserve := false;
  END;

  IF NEW.total >= 5000 OR v_is_platinum OR v_has_reserve THEN
    NEW.is_white_glove := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_auto_white_glove ON public.orders;
CREATE TRIGGER orders_auto_white_glove
  BEFORE INSERT OR UPDATE OF total, user_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_elevate_white_glove();

-- ─── Admin/concierge queue view ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_white_glove_queue AS
SELECT
  o.id,
  o.user_id,
  prof.full_name,
  prof.phone,
  o.total,
  o.status,
  o.scheduled_for_date,
  o.scheduled_window,
  o.delivery_address,
  o.white_glove_notes,
  o.concierge_id,
  o.concierge_contacted_at,
  o.created_at
FROM public.orders o
LEFT JOIN public.profiles prof ON prof.id = o.user_id
WHERE o.is_white_glove = true
  AND o.status NOT IN ('delivered','completed','cancelled','refunded')
ORDER BY o.scheduled_for_date NULLS FIRST, o.created_at ASC;

GRANT SELECT ON public.v_white_glove_queue TO authenticated;

COMMIT;
