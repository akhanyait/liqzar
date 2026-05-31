-- 021 — Digital gift cards
-- Lets customers purchase a store-credit card and recipients redeem it at
-- checkout (cents-based, 12-month validity by default).
-- Idempotent: IF NOT EXISTS guards + OR REPLACE functions.

BEGIN;

-- ─── Tables ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gift_cards (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code             text NOT NULL UNIQUE,
  amount_cents     integer NOT NULL CHECK (amount_cents > 0),
  balance_cents    integer NOT NULL CHECK (balance_cents >= 0),
  purchaser_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  recipient_email  text,
  recipient_name   text,
  recipient_phone  text,
  message          text CHECK (message IS NULL OR length(message) <= 240),
  purchase_order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','active','redeemed','expired','cancelled')),
  expires_at       timestamptz NOT NULL DEFAULT (now() + interval '365 days'),
  activated_at     timestamptz,
  last_used_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_cards_code_idx ON public.gift_cards(code);
CREATE INDEX IF NOT EXISTS gift_cards_purchaser_idx ON public.gift_cards(purchaser_id);
CREATE INDEX IF NOT EXISTS gift_cards_recipient_email_idx ON public.gift_cards(recipient_email);
CREATE INDEX IF NOT EXISTS gift_cards_status_idx ON public.gift_cards(status);

CREATE TABLE IF NOT EXISTS public.gift_card_redemptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id  uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  order_id      uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  amount_cents  integer NOT NULL CHECK (amount_cents > 0),
  redeemed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gift_card_redemptions_card_idx ON public.gift_card_redemptions(gift_card_id);
CREATE INDEX IF NOT EXISTS gift_card_redemptions_order_idx ON public.gift_card_redemptions(order_id);

-- ─── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.gift_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gift_card_redemptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "gift_cards_owner_select" ON public.gift_cards;
CREATE POLICY "gift_cards_owner_select" ON public.gift_cards
  FOR SELECT USING (
    auth.uid() = purchaser_id
    OR (recipient_email IS NOT NULL AND recipient_email = lower(coalesce((auth.jwt() ->> 'email'), '')))
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "gift_cards_admin_all" ON public.gift_cards;
CREATE POLICY "gift_cards_admin_all" ON public.gift_cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "gift_card_redemptions_owner_select" ON public.gift_card_redemptions;
CREATE POLICY "gift_card_redemptions_owner_select" ON public.gift_card_redemptions
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- ─── Code generator (8-char alnum, exclude look-alikes) ────────────────
DROP FUNCTION IF EXISTS public.generate_gift_card_code CASCADE;
CREATE OR REPLACE FUNCTION public.generate_gift_card_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
  i int;
BEGIN
  LOOP
    code := '';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    code := code || '-';
    FOR i IN 1..4 LOOP
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.gift_cards WHERE gift_cards.code = code);
  END LOOP;
  RETURN code;
END;
$$;

-- ─── Issue card (called after payment capture) ─────────────────────────
DROP FUNCTION IF EXISTS public.issue_gift_card CASCADE;
CREATE OR REPLACE FUNCTION public.issue_gift_card(
  p_amount_cents integer,
  p_purchaser_id uuid,
  p_recipient_email text,
  p_recipient_name text,
  p_recipient_phone text,
  p_message text,
  p_order_id uuid
)
RETURNS public.gift_cards
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_row public.gift_cards;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Gift card amount must be positive';
  END IF;

  v_code := public.generate_gift_card_code();

  INSERT INTO public.gift_cards (
    code, amount_cents, balance_cents,
    purchaser_id, recipient_email, recipient_name, recipient_phone, message,
    purchase_order_id, status, activated_at
  ) VALUES (
    v_code, p_amount_cents, p_amount_cents,
    p_purchaser_id, lower(p_recipient_email), p_recipient_name, p_recipient_phone, p_message,
    p_order_id, 'active', now()
  ) RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

-- ─── Redeem card at checkout (decrements balance atomically) ───────────
DROP FUNCTION IF EXISTS public.redeem_gift_card CASCADE;
CREATE OR REPLACE FUNCTION public.redeem_gift_card(
  p_code text,
  p_amount_cents integer,
  p_order_id uuid
)
RETURNS TABLE (
  applied_cents integer,
  remaining_balance_cents integer,
  card_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_card public.gift_cards;
  v_apply integer;
BEGIN
  IF p_amount_cents <= 0 THEN
    RAISE EXCEPTION 'Redemption amount must be positive';
  END IF;

  SELECT * INTO v_card
    FROM public.gift_cards
   WHERE code = upper(p_code)
     AND status = 'active'
     AND (expires_at IS NULL OR expires_at > now())
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Gift card not found, inactive, or expired';
  END IF;

  IF v_card.balance_cents <= 0 THEN
    RAISE EXCEPTION 'Gift card has no remaining balance';
  END IF;

  v_apply := LEAST(v_card.balance_cents, p_amount_cents);

  UPDATE public.gift_cards
     SET balance_cents = balance_cents - v_apply,
         last_used_at = now(),
         status = CASE WHEN balance_cents - v_apply = 0 THEN 'redeemed' ELSE status END
   WHERE id = v_card.id;

  INSERT INTO public.gift_card_redemptions (
    gift_card_id, order_id, user_id, amount_cents
  ) VALUES (
    v_card.id, p_order_id, auth.uid(), v_apply
  );

  RETURN QUERY SELECT v_apply, v_card.balance_cents - v_apply, v_card.id;
END;
$$;

-- ─── Balance check (no auth, used for preview at checkout) ────────────
DROP FUNCTION IF EXISTS public.check_gift_card_balance CASCADE;
CREATE OR REPLACE FUNCTION public.check_gift_card_balance(p_code text)
RETURNS TABLE (balance_cents integer, expires_at timestamptz, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT gc.balance_cents, gc.expires_at, gc.status
    FROM public.gift_cards gc
   WHERE gc.code = upper(p_code)
   LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_gift_card(text, integer, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.issue_gift_card(integer, uuid, text, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_gift_card_balance(text) TO authenticated, anon;

COMMIT;
