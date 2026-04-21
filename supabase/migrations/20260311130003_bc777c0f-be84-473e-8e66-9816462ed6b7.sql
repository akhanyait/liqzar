
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_quantity integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reorder_level integer DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_stock_level integer DEFAULT 50,
  ADD COLUMN IF NOT EXISTS units_sold_30d integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS units_sold_7d integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_restock_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS last_sold_date timestamptz DEFAULT NULL;
