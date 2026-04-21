-- ============================================================
-- Migration 005: Customer payment update RLS policies
-- Allow customers to update payment_status on their own orders
-- and update status/failure_reason on their own payment records
-- ============================================================

-- ── Allow customers to update payment_status on own orders ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders'
    AND policyname = 'Customers can update own order payment status'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers can update own order payment status"
        ON orders FOR UPDATE
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
    $policy$;
  END IF;
END;
$$;

-- ── Allow customers to update own payment records ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'payments'
    AND policyname = 'Customers can update own payments'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Customers can update own payments"
        ON payments FOR UPDATE
        USING (
          EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id
            AND orders.user_id = auth.uid()
          )
        )
        WITH CHECK (
          EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = payments.order_id
            AND orders.user_id = auth.uid()
          )
        );
    $policy$;
  END IF;
END;
$$;
