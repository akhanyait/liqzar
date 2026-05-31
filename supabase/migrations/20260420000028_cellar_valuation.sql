-- 028 — Personal cellar valuation tool
-- Gives collectors a running tally of what they've purchased, current market
-- value estimate (based on latest product.price), and a category breakdown.
-- Idempotent. Read-only via views.

BEGIN;

-- Each unique customer × product row with quantity owned (sum of delivered
-- order items), purchase cost paid, and the current product price.
CREATE OR REPLACE VIEW public.v_cellar_holdings AS
SELECT
  o.user_id,
  oi.product_id,
  p.name,
  p.category,
  p.image_url,
  p.bottle_size,
  SUM(oi.quantity)::integer                AS qty_owned,
  SUM(oi.quantity * oi.unit_price)::numeric AS paid_total,
  MAX(o.created_at)                         AS last_acquired_at,
  p.price                                   AS current_unit_price,
  (SUM(oi.quantity) * p.price)::numeric    AS current_value
FROM public.orders o
JOIN public.order_items oi ON oi.order_id = o.id
JOIN public.products p     ON p.id = oi.product_id
WHERE o.status IN ('delivered','completed')
GROUP BY o.user_id, oi.product_id,
         p.name, p.category, p.image_url, p.bottle_size, p.price;

GRANT SELECT ON public.v_cellar_holdings TO authenticated;

-- Summary: totals per customer
CREATE OR REPLACE VIEW public.v_cellar_summary AS
SELECT
  user_id,
  COUNT(DISTINCT product_id)::integer   AS unique_skus,
  SUM(qty_owned)::integer               AS total_bottles,
  SUM(paid_total)::numeric              AS total_paid,
  SUM(current_value)::numeric           AS current_value,
  SUM(current_value) - SUM(paid_total)  AS unrealised_gain
FROM public.v_cellar_holdings
GROUP BY user_id;

GRANT SELECT ON public.v_cellar_summary TO authenticated;

-- Category breakdown per customer
CREATE OR REPLACE VIEW public.v_cellar_categories AS
SELECT
  user_id,
  category,
  SUM(qty_owned)::integer    AS bottles,
  SUM(current_value)::numeric AS value
FROM public.v_cellar_holdings
GROUP BY user_id, category
ORDER BY SUM(current_value) DESC;

GRANT SELECT ON public.v_cellar_categories TO authenticated;

COMMIT;
