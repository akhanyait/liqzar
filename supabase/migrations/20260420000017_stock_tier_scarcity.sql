-- Migration 017: Product scarcity tier
--
-- Adds a merchandising-controlled scarcity tier to products so premium catalogue
-- items can signal allocation / cellar-reserve status without another table.
--
-- Values:
--   available       — default, plenty of stock, no badge
--   low             — auto-set when stock_quantity <= 5 AND > 0
--   allocated       — merchandiser-set, limited release
--   cellar_reserve  — merchandiser-set, rare / high-value
--
-- A BEFORE UPDATE trigger keeps `low` in sync with stock_quantity changes, but
-- never overrides the two manual tiers (allocated / cellar_reserve).
-- Idempotent: guarded by IF NOT EXISTS / OR REPLACE.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'stock_tier_enum'
  ) THEN
    CREATE TYPE public.stock_tier_enum AS ENUM (
      'available',
      'low',
      'allocated',
      'cellar_reserve'
    );
  END IF;
END$$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_tier public.stock_tier_enum
  NOT NULL DEFAULT 'available';

CREATE INDEX IF NOT EXISTS products_stock_tier_idx
  ON public.products (stock_tier)
  WHERE stock_tier <> 'available';

-- Auto-sync `low` with stock_quantity. Preserves manual tiers.
DROP FUNCTION IF EXISTS public.sync_stock_tier_low CASCADE;
CREATE OR REPLACE FUNCTION public.sync_stock_tier_low()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.stock_tier IN ('allocated', 'cellar_reserve') THEN
    RETURN NEW;
  END IF;

  IF NEW.stock_quantity IS NULL THEN
    NEW.stock_tier := 'available';
  ELSIF NEW.stock_quantity > 0 AND NEW.stock_quantity <= 5 THEN
    NEW.stock_tier := 'low';
  ELSE
    NEW.stock_tier := 'available';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_stock_tier_low ON public.products;
CREATE TRIGGER trg_sync_stock_tier_low
  BEFORE UPDATE OF stock_quantity ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_stock_tier_low();

COMMENT ON COLUMN public.products.stock_tier IS
  'Merchandising scarcity tier. allocated/cellar_reserve are manual; low is auto-synced from stock_quantity <= 5.';
