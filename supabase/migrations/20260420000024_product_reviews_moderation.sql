-- 024 — Product reviews: verified-buyer + moderation
-- Extends the existing product_reviews table with verified-buyer flag and
-- moderation state (pending/approved/rejected). Adds a moderation view and a
-- helper that automatically marks buyers as verified.
-- Idempotent.

BEGIN;

ALTER TABLE public.product_reviews
  ADD COLUMN IF NOT EXISTS verified_buyer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending','approved','rejected','flagged')),
  ADD COLUMN IF NOT EXISTS moderation_notes text,
  ADD COLUMN IF NOT EXISTS moderated_at timestamptz,
  ADD COLUMN IF NOT EXISTS moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS flagged_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS photo_urls text[];

CREATE INDEX IF NOT EXISTS product_reviews_moderation_idx
  ON public.product_reviews (moderation_status);
CREATE INDEX IF NOT EXISTS product_reviews_product_approved_idx
  ON public.product_reviews (product_id)
  WHERE moderation_status = 'approved';

-- ─── Set verified_buyer automatically when a review is inserted ────────
CREATE OR REPLACE FUNCTION public.set_review_verified_buyer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM public.orders o
      JOIN public.order_items oi ON oi.order_id = o.id
     WHERE o.user_id = NEW.user_id
       AND oi.product_id = NEW.product_id
       AND o.status IN ('delivered','completed')
  ) THEN
    NEW.verified_buyer := true;
    NEW.moderation_status := 'approved';  -- verified-buyer reviews skip manual queue
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS product_reviews_verify ON public.product_reviews;
CREATE TRIGGER product_reviews_verify
  BEFORE INSERT ON public.product_reviews
  FOR EACH ROW EXECUTE FUNCTION public.set_review_verified_buyer();

-- ─── Moderation view for admin ─────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_review_moderation_queue AS
SELECT
  r.id,
  r.product_id,
  p.name AS product_name,
  r.user_id,
  prof.full_name,
  r.title,
  r.comment,
  r.rating,
  r.verified_buyer,
  r.moderation_status,
  r.flagged_count,
  r.created_at
FROM public.product_reviews r
LEFT JOIN public.products p ON p.id = r.product_id
LEFT JOIN public.profiles prof ON prof.id = r.user_id
WHERE r.moderation_status IN ('pending','flagged')
ORDER BY r.flagged_count DESC, r.created_at ASC;

GRANT SELECT ON public.v_review_moderation_queue TO authenticated;

-- ─── Update public review policies to hide non-approved reviews ────────
DROP POLICY IF EXISTS "product_reviews_public_select" ON public.product_reviews;
CREATE POLICY "product_reviews_public_select" ON public.product_reviews
  FOR SELECT USING (
    moderation_status = 'approved'
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- Flag a review (any authed user)
CREATE TABLE IF NOT EXISTS public.review_flags (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id  uuid NOT NULL REFERENCES public.product_reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

ALTER TABLE public.review_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "review_flags_owner_insert" ON public.review_flags;
CREATE POLICY "review_flags_owner_insert" ON public.review_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "review_flags_admin_select" ON public.review_flags;
CREATE POLICY "review_flags_admin_select" ON public.review_flags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

CREATE OR REPLACE FUNCTION public.bump_review_flag_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.product_reviews
     SET flagged_count = flagged_count + 1,
         moderation_status = CASE
           WHEN flagged_count + 1 >= 3 THEN 'flagged'
           ELSE moderation_status
         END
   WHERE id = NEW.review_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS review_flags_bump ON public.review_flags;
CREATE TRIGGER review_flags_bump
  AFTER INSERT ON public.review_flags
  FOR EACH ROW EXECUTE FUNCTION public.bump_review_flag_count();

COMMIT;
