-- 027 — Corporate accounts + invoice billing
-- Allows companies to maintain a shared account, a net-30 invoice ledger,
-- and link multiple authorised purchasers (employees) under one tax entity.
-- Idempotent.

BEGIN;

-- ─── Corporate accounts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name    text NOT NULL,
  trading_as      text,
  registration_no text,
  vat_number      text,
  billing_email   text NOT NULL,
  billing_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  credit_limit_cents bigint NOT NULL DEFAULT 0,
  current_balance_cents bigint NOT NULL DEFAULT 0,
  net_terms_days  integer NOT NULL DEFAULT 30,
  status          text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','active','suspended','closed')),
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  onboarded_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corporate_accounts_owner_idx
  ON public.corporate_accounts (owner_user_id);
CREATE INDEX IF NOT EXISTS corporate_accounts_status_idx
  ON public.corporate_accounts (status);

-- ─── Authorised purchasers (many-to-many) ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'purchaser'
    CHECK (role IN ('owner','admin','purchaser')),
  spend_limit_cents bigint,  -- per-order cap (NULL = no cap)
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, user_id)
);

-- ─── Invoice ledger ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.corporate_invoices (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id   uuid NOT NULL REFERENCES public.corporate_accounts(id) ON DELETE CASCADE,
  order_id     uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  invoice_no   text NOT NULL UNIQUE,
  amount_cents bigint NOT NULL,
  vat_cents    bigint NOT NULL DEFAULT 0,
  issued_at    timestamptz NOT NULL DEFAULT now(),
  due_at       timestamptz NOT NULL,
  paid_at      timestamptz,
  status       text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','paid','overdue','void')),
  pdf_url      text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS corporate_invoices_account_idx
  ON public.corporate_invoices (account_id);
CREATE INDEX IF NOT EXISTS corporate_invoices_status_idx
  ON public.corporate_invoices (status) WHERE status IN ('open','overdue');

-- Link an order to the invoicing account
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS corporate_account_id uuid
    REFERENCES public.corporate_accounts(id) ON DELETE SET NULL;

-- ─── Invoice-number generator (LIQ-YYYYMM-NNNN) ────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.corporate_invoice_seq
  START 1 INCREMENT 1 MINVALUE 1 NO MAXVALUE CACHE 1;

CREATE OR REPLACE FUNCTION public.next_corporate_invoice_no()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  v_month text := to_char(now(), 'YYYYMM');
  v_seq   bigint;
BEGIN
  v_seq := nextval('public.corporate_invoice_seq');
  RETURN 'LIQ-' || v_month || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ─── Issue an invoice (called by backend when corporate order is placed)
CREATE OR REPLACE FUNCTION public.issue_corporate_invoice(
  p_account_id uuid,
  p_order_id   uuid,
  p_amount_cents bigint,
  p_vat_cents  bigint DEFAULT 0,
  p_notes      text   DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms integer;
  v_no    text;
  v_id    uuid;
BEGIN
  SELECT net_terms_days INTO v_terms
    FROM public.corporate_accounts
   WHERE id = p_account_id AND status = 'active';

  IF v_terms IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Account not active');
  END IF;

  v_no := public.next_corporate_invoice_no();

  INSERT INTO public.corporate_invoices (
    id, account_id, order_id, invoice_no, amount_cents, vat_cents,
    issued_at, due_at, status, notes
  )
  VALUES (
    gen_random_uuid(), p_account_id, p_order_id, v_no, p_amount_cents, p_vat_cents,
    now(), now() + (v_terms || ' days')::interval, 'open', p_notes
  )
  RETURNING id INTO v_id;

  UPDATE public.corporate_accounts
     SET current_balance_cents = current_balance_cents + p_amount_cents,
         updated_at = now()
   WHERE id = p_account_id;

  RETURN json_build_object('ok', true, 'invoice_id', v_id, 'invoice_no', v_no);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_corporate_invoice(uuid, uuid, bigint, bigint, text) TO authenticated;

-- ─── Mark invoice paid ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mark_corporate_invoice_paid(
  p_invoice_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_amount     bigint;
  v_status     text;
BEGIN
  SELECT account_id, amount_cents, status
    INTO v_account_id, v_amount, v_status
    FROM public.corporate_invoices
   WHERE id = p_invoice_id
   FOR UPDATE;

  IF v_account_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Invoice not found');
  END IF;

  IF v_status = 'paid' THEN
    RETURN json_build_object('ok', false, 'error', 'Already paid');
  END IF;

  UPDATE public.corporate_invoices
     SET status = 'paid', paid_at = now()
   WHERE id = p_invoice_id;

  UPDATE public.corporate_accounts
     SET current_balance_cents = GREATEST(0, current_balance_cents - v_amount),
         updated_at = now()
   WHERE id = v_account_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_corporate_invoice_paid(uuid) TO authenticated;

-- ─── RLS ────────────────────────────────────────────────────────────────
ALTER TABLE public.corporate_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corporate_invoices ENABLE ROW LEVEL SECURITY;

-- Account owners + members + admins can read
DROP POLICY IF EXISTS "corporate_accounts_select" ON public.corporate_accounts;
CREATE POLICY "corporate_accounts_select" ON public.corporate_accounts
  FOR SELECT USING (
    owner_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.corporate_members m
      WHERE m.account_id = corporate_accounts.id AND m.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "corporate_members_select" ON public.corporate_members;
CREATE POLICY "corporate_members_select" ON public.corporate_members
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.corporate_accounts a
      WHERE a.id = corporate_members.account_id AND a.owner_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "corporate_invoices_select" ON public.corporate_invoices;
CREATE POLICY "corporate_invoices_select" ON public.corporate_invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.corporate_accounts a
      WHERE a.id = corporate_invoices.account_id
        AND (
          a.owner_user_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.corporate_members m
            WHERE m.account_id = a.id AND m.user_id = auth.uid()
              AND m.role IN ('owner','admin')
          )
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
    )
  );

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_corporate_accounts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS corporate_accounts_touch ON public.corporate_accounts;
CREATE TRIGGER corporate_accounts_touch
  BEFORE UPDATE ON public.corporate_accounts
  FOR EACH ROW EXECUTE FUNCTION public.touch_corporate_accounts_updated_at();

COMMIT;
