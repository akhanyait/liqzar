-- 022 — Split delivery (order_shipments)
-- Allows a single order to be split across multiple recipients / addresses.
-- Each shipment has its own recipient, address, status, and (optionally)
-- assigned driver. order_items gets a nullable shipment_id so rows can be
-- grouped per shipment.
--
-- Existing single-address orders are unaffected: shipment_id stays NULL and
-- the delivery_address on orders remains the canonical address.
-- Idempotent via IF NOT EXISTS / DO blocks.

BEGIN;

CREATE TABLE IF NOT EXISTS public.order_shipments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  recipient_name     text NOT NULL,
  recipient_phone    text,
  recipient_email    text,
  delivery_address   jsonb NOT NULL,
  gift_note          text CHECK (gift_note IS NULL OR length(gift_note) <= 240),
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN (
                         'pending','preparing','ready','picked_up',
                         'en_route','delivered','failed','cancelled'
                       )),
  assigned_driver_id uuid REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
  driver_pin         text,
  scheduled_for_date date,
  scheduled_window   text,
  delivery_fee       numeric(10,2) NOT NULL DEFAULT 0,
  dispatched_at      timestamptz,
  delivered_at       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_shipments_order_idx
  ON public.order_shipments(order_id);
CREATE INDEX IF NOT EXISTS order_shipments_status_idx
  ON public.order_shipments(status);
CREATE INDEX IF NOT EXISTS order_shipments_driver_idx
  ON public.order_shipments(assigned_driver_id)
  WHERE assigned_driver_id IS NOT NULL;

-- order_items: optional shipment mapping
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS shipment_id uuid
  REFERENCES public.order_shipments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS order_items_shipment_idx
  ON public.order_items(shipment_id)
  WHERE shipment_id IS NOT NULL;

-- orders: mark multi-shipment orders for admin filtering
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS is_multi_shipment boolean NOT NULL DEFAULT false;

-- ─── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.order_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_shipments_owner_select" ON public.order_shipments;
CREATE POLICY "order_shipments_owner_select" ON public.order_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_shipments.order_id AND o.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_shipments_driver_select" ON public.order_shipments;
CREATE POLICY "order_shipments_driver_select" ON public.order_shipments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.driver_profiles d
      WHERE d.id = order_shipments.assigned_driver_id
        AND d.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "order_shipments_admin_all" ON public.order_shipments;
CREATE POLICY "order_shipments_admin_all" ON public.order_shipments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ─── updated_at trigger ────────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.touch_order_shipments_updated_at CASCADE;
CREATE OR REPLACE FUNCTION public.touch_order_shipments_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_shipments_touch ON public.order_shipments;
CREATE TRIGGER order_shipments_touch
  BEFORE UPDATE ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.touch_order_shipments_updated_at();

-- ─── Helper to mark an order as multi-shipment when any row is inserted ─
DROP FUNCTION IF EXISTS public.mark_order_multi_shipment CASCADE;
CREATE OR REPLACE FUNCTION public.mark_order_multi_shipment()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.orders
     SET is_multi_shipment = true
   WHERE id = NEW.order_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS order_shipments_flag_order ON public.order_shipments;
CREATE TRIGGER order_shipments_flag_order
  AFTER INSERT ON public.order_shipments
  FOR EACH ROW EXECUTE FUNCTION public.mark_order_multi_shipment();

COMMIT;
