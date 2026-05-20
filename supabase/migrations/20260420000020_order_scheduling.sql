-- 020 — Order scheduling columns
-- Allows a customer to pick a future delivery window (2\u20137 days ahead).
-- Admin dispatch reads these to hold the order until the window opens.
-- Idempotent: IF NOT EXISTS guards.

BEGIN;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS scheduled_for_date date,
  ADD COLUMN IF NOT EXISTS scheduled_window   text
  CHECK (
    scheduled_window IS NULL OR
    scheduled_window IN (
      '10:00-12:00',
      '14:00-16:00',
      '18:00-20:00',
      '11:00-13:00',
      '13:00-15:00',
      '15:00-17:00',
      '17:00-19:00',
      '19:00-21:00'
    )
  );

CREATE INDEX IF NOT EXISTS orders_scheduled_for_date_idx
  ON public.orders (scheduled_for_date)
  WHERE scheduled_for_date IS NOT NULL;

COMMIT;
