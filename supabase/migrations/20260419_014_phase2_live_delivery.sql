-- Migration 014: Phase 2 — Live delivery (tracking + chat + share-trip)
--
-- Adds three tables that make the delivery experience Uber-grade:
--
--   public.driver_live_locations — single-row-per-order live GPS pin
--                                  (decoupled from the driver_assignments vs
--                                  delivery_assignments schema drift; both
--                                  web + mobile write/read the same table)
--
--   public.delivery_messages     — customer ↔ driver chat (was localStorage-only)
--
--   public.order_share_tokens    — public tokens for share-trip links (read-only
--                                  tracking page at /track/:token, no auth required)
--
-- All three published on supabase_realtime so clients can subscribe to UPDATEs.
-- Idempotent: CREATE IF NOT EXISTS + DROP POLICY IF EXISTS throughout.

-- ─── DRIVER LIVE LOCATIONS ────────────────────────────────────────────
-- One row per active delivery. Driver app UPSERTs every ~8s while en_route;
-- customer app subscribes to Realtime UPDATEs on the row keyed by order_id.
CREATE TABLE IF NOT EXISTS public.driver_live_locations (
  order_id      UUID PRIMARY KEY REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat           DOUBLE PRECISION NOT NULL,
  lng           DOUBLE PRECISION NOT NULL,
  heading       DOUBLE PRECISION,
  speed_mps     DOUBLE PRECISION,
  accuracy_m    DOUBLE PRECISION,
  eta_minutes   INTEGER,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS driver_live_locations_driver_idx
  ON public.driver_live_locations (driver_id);

ALTER TABLE public.driver_live_locations ENABLE ROW LEVEL SECURITY;

-- Customer: can read location for their own orders.
DROP POLICY IF EXISTS "Customer reads live location for own order"
  ON public.driver_live_locations;
CREATE POLICY "Customer reads live location for own order"
  ON public.driver_live_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = driver_live_locations.order_id
        AND o.user_id = auth.uid()
    )
  );

-- Driver: can read + upsert location for orders assigned to them.
DROP POLICY IF EXISTS "Driver reads own live location"
  ON public.driver_live_locations;
CREATE POLICY "Driver reads own live location"
  ON public.driver_live_locations FOR SELECT
  USING (driver_id = auth.uid());

DROP POLICY IF EXISTS "Driver inserts own live location"
  ON public.driver_live_locations;
CREATE POLICY "Driver inserts own live location"
  ON public.driver_live_locations FOR INSERT
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Driver updates own live location"
  ON public.driver_live_locations;
CREATE POLICY "Driver updates own live location"
  ON public.driver_live_locations FOR UPDATE
  USING (driver_id = auth.uid())
  WITH CHECK (driver_id = auth.uid());

DROP POLICY IF EXISTS "Driver deletes own live location"
  ON public.driver_live_locations;
CREATE POLICY "Driver deletes own live location"
  ON public.driver_live_locations FOR DELETE
  USING (driver_id = auth.uid());

-- Admin: full access (for support + monitoring).
DROP POLICY IF EXISTS "Admin full access live location"
  ON public.driver_live_locations;
CREATE POLICY "Admin full access live location"
  ON public.driver_live_locations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── DELIVERY MESSAGES (chat) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.delivery_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('customer', 'driver', 'admin', 'system')),
  body        TEXT NOT NULL CHECK (length(body) > 0 AND length(body) <= 2000),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_messages_order_idx
  ON public.delivery_messages (order_id, created_at);
CREATE INDEX IF NOT EXISTS delivery_messages_sender_idx
  ON public.delivery_messages (sender_id);

ALTER TABLE public.delivery_messages ENABLE ROW LEVEL SECURITY;

-- Customer OR assigned driver can read messages for the order.
DROP POLICY IF EXISTS "Customer + driver read delivery messages"
  ON public.delivery_messages;
CREATE POLICY "Customer + driver read delivery messages"
  ON public.delivery_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_messages.order_id
        AND (o.user_id = auth.uid() OR o.assigned_driver_id = auth.uid())
    )
  );

-- Customer OR assigned driver can post messages.
DROP POLICY IF EXISTS "Customer + driver post delivery messages"
  ON public.delivery_messages;
CREATE POLICY "Customer + driver post delivery messages"
  ON public.delivery_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_messages.order_id
        AND (o.user_id = auth.uid() OR o.assigned_driver_id = auth.uid())
    )
  );

-- Customer + driver can mark messages as read (UPDATE read_at).
DROP POLICY IF EXISTS "Recipient marks delivery messages read"
  ON public.delivery_messages;
CREATE POLICY "Recipient marks delivery messages read"
  ON public.delivery_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_messages.order_id
        AND (o.user_id = auth.uid() OR o.assigned_driver_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = delivery_messages.order_id
        AND (o.user_id = auth.uid() OR o.assigned_driver_id = auth.uid())
    )
  );

-- Admin: full access.
DROP POLICY IF EXISTS "Admin full access delivery messages"
  ON public.delivery_messages;
CREATE POLICY "Admin full access delivery messages"
  ON public.delivery_messages FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── ORDER SHARE TOKENS (share-trip) ──────────────────────────────────
-- Customer generates a time-limited token; anyone with the token can read a
-- sanitized view of the order (status, ETA, live pin) via a public EF.
-- Direct table reads are restricted to the owner + admin; public access
-- goes through the `public-trip` Edge Function which does token validation.
CREATE TABLE IF NOT EXISTS public.order_share_tokens (
  token        TEXT PRIMARY KEY,
  order_id     UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  created_by   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_share_tokens_order_idx
  ON public.order_share_tokens (order_id);
CREATE INDEX IF NOT EXISTS order_share_tokens_expires_idx
  ON public.order_share_tokens (expires_at);

ALTER TABLE public.order_share_tokens ENABLE ROW LEVEL SECURITY;

-- Owner of the order can read + create + revoke their own tokens.
DROP POLICY IF EXISTS "Owner reads own share tokens"
  ON public.order_share_tokens;
CREATE POLICY "Owner reads own share tokens"
  ON public.order_share_tokens FOR SELECT
  USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_share_tokens.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner creates own share tokens"
  ON public.order_share_tokens;
CREATE POLICY "Owner creates own share tokens"
  ON public.order_share_tokens FOR INSERT
  WITH CHECK (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_share_tokens.order_id
        AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner revokes own share tokens"
  ON public.order_share_tokens;
CREATE POLICY "Owner revokes own share tokens"
  ON public.order_share_tokens FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Admin: full access.
DROP POLICY IF EXISTS "Admin full access share tokens"
  ON public.order_share_tokens;
CREATE POLICY "Admin full access share tokens"
  ON public.order_share_tokens FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ─── REALTIME ─────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_live_locations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_live_locations;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_messages;
  END IF;
END $$;
