-- Stock import prep (21 May 2026):
--   1. Add `subcategory` column for hierarchical taxonomy (Whisky → Cabinet,
--      Accessories → Decanters/Cooler Boxes/etc).
--   2. Add a partial unique index on `barcode` so the bulk import can UPSERT
--      by EAN with ON CONFLICT (barcode) WHERE barcode IS NOT NULL.
--      Partial = legacy products with NULL barcode are not constrained.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_uidx
  ON public.products(barcode)
  WHERE barcode IS NOT NULL;

COMMENT ON COLUMN public.products.subcategory IS
  'Optional sub-grouping under category (e.g. category=Whisky, subcategory=Cabinet for premium reserves; category=Accessories, subcategory=Decanters).';
