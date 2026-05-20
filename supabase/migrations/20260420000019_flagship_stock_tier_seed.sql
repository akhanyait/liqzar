-- 019 — Seed stock_tier on flagship catalogue
-- Marks 20 hand-picked SKUs across the catalogue with `allocated` or
-- `cellar_reserve` so the scarcity badge renders out of the box.
-- Idempotent: uses ILIKE matches + WHERE filters, so re-runs only touch rows
-- whose tier is still `available`.

BEGIN;

-- ─── Cellar Reserve (6) — rare, high-ticket, heritage ────────────────────
UPDATE public.products
   SET stock_tier = 'cellar_reserve'
 WHERE stock_tier = 'available'
   AND (
        name ILIKE '%Macallan 25%' OR
        name ILIKE '%Macallan 30%' OR
        name ILIKE '%Johnnie Walker Blue%' OR
        name ILIKE '%Louis XIII%' OR
        name ILIKE '%Dom P%rignon%' OR
        name ILIKE '%Krug%Grande Cuv%e%' OR
        name ILIKE '%Hennessy Paradis%' OR
        name ILIKE '%Glenfiddich 30%' OR
        name ILIKE '%Balvenie 30%' OR
        name ILIKE '%Gran Patr%n Burdeos%'
   );

-- ─── Allocated Release (14) — limited or editorial-tier ─────────────────
UPDATE public.products
   SET stock_tier = 'allocated'
 WHERE stock_tier = 'available'
   AND (
        name ILIKE '%Macallan 18%' OR
        name ILIKE '%Macallan 12 Sherry%' OR
        name ILIKE '%Johnnie Walker Gold%' OR
        name ILIKE '%Chivas Regal 25%' OR
        name ILIKE '%Chivas Regal 18%' OR
        name ILIKE '%Glenfiddich 18%' OR
        name ILIKE '%Glenmorangie Signet%' OR
        name ILIKE '%Lagavulin 16%' OR
        name ILIKE '%Talisker 18%' OR
        name ILIKE '%Yamazaki 12%' OR
        name ILIKE '%Hibiki%Harmony%' OR
        name ILIKE '%Hennessy XO%' OR
        name ILIKE '%Remy Martin XO%' OR
        name ILIKE '%Bollinger%La Grande Ann%' OR
        name ILIKE '%Veuve Clicquot La Grande Dame%' OR
        name ILIKE '%Don Julio 1942%' OR
        name ILIKE '%Patr%n Gran Burdeos%' OR
        name ILIKE '%Clase Azul%Reposado%' OR
        name ILIKE '%Zacapa%XO%' OR
        name ILIKE '%Ron Zacapa 23%'
   );

COMMIT;
