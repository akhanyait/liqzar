-- Migration 013: Wishlist + Back-in-stock subscriptions
--
-- Adds two customer-facing tables:
--   public.wishlists           — per-user saved products (cross-device)
--   public.stock_notifications — subscribers waiting for out-of-stock items
--
-- Plus a DB trigger that, whenever a product transitions from in_stock=false
-- (or stock_quantity=0) back to available, inserts a row into public.notifications
-- for every subscriber and marks their subscription as fulfilled.
--
-- Idempotent: CREATE IF NOT EXISTS + DROP POLICY IF EXISTS patterns throughout.

-- ─── WISHLISTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.wishlists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS wishlists_user_id_idx ON public.wishlists (user_id);
CREATE INDEX IF NOT EXISTS wishlists_product_id_idx ON public.wishlists (product_id);

ALTER TABLE public.wishlists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own wishlist" ON public.wishlists;
CREATE POLICY "Users read own wishlist"
  ON public.wishlists FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own wishlist" ON public.wishlists;
CREATE POLICY "Users insert own wishlist"
  ON public.wishlists FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own wishlist" ON public.wishlists;
CREATE POLICY "Users delete own wishlist"
  ON public.wishlists FOR DELETE
  USING (auth.uid() = user_id);

-- ─── STOCK NOTIFICATIONS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.stock_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id     UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'notified', 'cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notified_at    TIMESTAMPTZ,
  UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS stock_notifications_user_id_idx
  ON public.stock_notifications (user_id);
CREATE INDEX IF NOT EXISTS stock_notifications_product_status_idx
  ON public.stock_notifications (product_id, status);

ALTER TABLE public.stock_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own stock subs" ON public.stock_notifications;
CREATE POLICY "Users read own stock subs"
  ON public.stock_notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own stock subs" ON public.stock_notifications;
CREATE POLICY "Users insert own stock subs"
  ON public.stock_notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own stock subs" ON public.stock_notifications;
CREATE POLICY "Users update own stock subs"
  ON public.stock_notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own stock subs" ON public.stock_notifications;
CREATE POLICY "Users delete own stock subs"
  ON public.stock_notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Admins (via service role) need full access for the notify-restock EF.
-- Service role bypasses RLS automatically, so no admin policy required.

-- ─── AUTO-NOTIFY TRIGGER ──────────────────────────────────────────────
-- Fires when a product transitions from unavailable → available.
-- "Available" means in_stock=true AND stock_quantity > 0 (or stock_quantity IS NULL).
CREATE OR REPLACE FUNCTION public.notify_stock_returned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  was_unavailable BOOLEAN;
  now_available   BOOLEAN;
BEGIN
  was_unavailable := (
    COALESCE(OLD.in_stock, TRUE) = FALSE
    OR COALESCE(OLD.stock_quantity, 0) <= 0
  );
  now_available := (
    COALESCE(NEW.in_stock, TRUE) = TRUE
    AND (NEW.stock_quantity IS NULL OR NEW.stock_quantity > 0)
  );

  IF NOT (was_unavailable AND now_available) THEN
    RETURN NEW;
  END IF;

  -- For every pending subscriber: insert a notification, mark sub as notified.
  INSERT INTO public.notifications (user_id, title, message, type)
  SELECT
    sn.user_id,
    'Back in stock',
    COALESCE(NEW.name, 'A product you love') || ' is back in stock. Tap to buy.',
    'stock_back'
  FROM public.stock_notifications sn
  WHERE sn.product_id = NEW.id
    AND sn.status = 'pending';

  UPDATE public.stock_notifications
  SET status = 'notified', notified_at = now()
  WHERE product_id = NEW.id AND status = 'pending';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_stock_returned ON public.products;
CREATE TRIGGER trg_notify_stock_returned
  AFTER UPDATE OF in_stock, stock_quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_stock_returned();

-- ─── REALTIME ────────────────────────────────────────────────────────
-- Wishlist changes should propagate across a user's devices in real time.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'wishlists'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.wishlists;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'stock_notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.stock_notifications;
  END IF;
END $$;
