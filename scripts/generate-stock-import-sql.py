#!/usr/bin/env python3
"""
Generate idempotent UPSERT SQL for the products table from the 38 .xls stock
files at src/assets/brands/stock/.

Output: scripts/stock-import.sql — paste into Supabase SQL editor.

Rules:
  - Price = round(< SP * 1.15, 2)  (15% LIQZAR convenience markup)
  - in_stock = SOH > 0  (out-of-stock rows are included as in_stock=false)
  - Match key: barcode (EAN)  — requires the partial unique index from migration
    20260521000001_products_subcategory_and_barcode_unique.sql.
  - On conflict: update name/category/subcategory/bottle_size/price/stock/in_stock
    but PRESERVE image_url (per user instruction).

Run:  python3 scripts/generate-stock-import-sql.py
"""

import os
import re
import sys
import pandas as pd
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
STOCK_DIR = REPO / "src" / "assets" / "brands" / "stock"
OUT_SQL = REPO / "scripts" / "stock-import.sql"

MARKUP = 1.15  # LIQZAR convenience markup over retail < SP

# Filename → (category, subcategory) mapping.
# Whisky: regular + Cabinet (premium reserve).
# Accessories: classified by description (see classify_accessory below).
# Everything else: single-level category, no subcategory.
FILE_MAP = {
    "Accessories.xls":              ("Accessories",          "__classify__"),
    "Aperetif - Spirit.xls":        ("Aperitif - Spirit",    None),
    "Aperetif -Wine.xls":           ("Aperitif - Wine",      None),
    "Beer Imports.xls":             ("Beer - Imports",       None),
    "Beer Main Stream.xls":         ("Beer - Mainstream",    None),
    "Beer Non alcohol.xls":         ("Beer - Non-Alcoholic", None),
    "Beer Premium.xls":             ("Beer - Premium",       None),
    "Beer Quarts.xls":              ("Beer - Quarts",        None),
    "Box Convinience Wine.xls":     ("Box Wine",             None),
    "Carbonated Fruit Juice.xls":   ("Soft Drinks - Juice",  None),
    "Carbonated Soft Drinks.xls":   ("Soft Drinks",          None),
    "Ciders All.xls":               ("Cider",                None),
    "Cigars.xls":                   ("Cigars",               None),
    "Cocktail All.xls":             ("Ready-To-Drink Cocktails", None),
    "Coolers All.xls":              ("Coolers",              None),
    "Coolers FABS All.xls":         ("Coolers - FAB",        None),
    "Cordials and Squashes.xls":    ("Cordials & Squashes",  None),
    "Fortified Wine.xls":           ("Fortified Wine",       None),
    "Iced Tea.xls":                 ("Iced Tea",             None),
    "Liqueurs Cream.xls":           ("Liqueurs - Cream",     None),
    "Liqueurs Other.xls":           ("Liqueurs - Other",     None),
    "Liqueurs Shooters.xls":        ("Liqueurs - Shooters",  None),
    "Longlife Fruit Juice.xls":     ("Juice - Longlife",     None),
    "Mineral Water.xls":            ("Water",                None),
    "Perle Wine.xls":               ("Perlé Wine",           None),
    "Red Wine.xls":                 ("Red Wine",             None),
    "Rose Wine.xls":                ("Rosé Wine",            None),
    "Snacks_Biltong_Chips.xls":     ("Snacks",               None),
    "Sparkling Wine.xls":           ("Sparkling Wine",       None),
    "Spirit Whisky.xls":            ("Whisky",               "Standard"),
    "Spirits Brandy.xls":           ("Brandy",               None),
    "Spirits Cane.xls":             ("Cane Spirits",         None),
    "Spirits Gin.xls":              ("Gin",                  None),
    "Spirits Rum.xls":              ("Rum",                  None),
    "Spirits Vodka.xls":            ("Vodka",                None),
    "Sports and Energy Drinks.xls": ("Sports & Energy",      None),
    "Whisky Cabinet.xls":           ("Whisky",               "Cabinet"),
    "White Wine.xls":               ("White Wine",           None),
}


def classify_accessory(name: str) -> str:
    """Keyword-based sub-category for the Accessories category."""
    n = name.upper()
    if "DECANTER" in n:
        return "Decanters"
    if "COOLER" in n:
        return "Cooler Boxes"
    if "FLASK" in n:
        return "Flasks"
    if any(k in n for k in ("POURER", "SPOON", "OPENER", "STOPPER", "FUNNEL")):
        return "Bar Tools"
    if "SET" in n or re.search(r"\d+\s*PC", n) or re.search(r"\d+'S", n):
        return "Sets"
    if "GLASS" in n or "GLS" in n:
        return "Glassware"
    return "Other"


def title_case_product(s: str) -> str:
    """Friendly title-case: keep small connector words lowercase, uppercase
    after most punctuation. 'DARLING SLOW BEER CAN CASE' → 'Darling Slow Beer Can Case'.
    Preserves brand abbreviations like JW, J/W, NRB by leaving 1-3 letter all-caps tokens alone."""
    s = s.strip()
    out = []
    for tok in s.split():
        # Keep short all-caps + tokens with mixed special chars as-is
        if len(tok) <= 3 and tok.isupper():
            out.append(tok)
        elif re.fullmatch(r"[A-Z0-9/_'.&-]+", tok) and len(tok) <= 5:
            out.append(tok)
        else:
            out.append(tok.title())
    return " ".join(out)


def sql_str(v) -> str:
    """SQL string literal, escaping single quotes. NULL for missing values."""
    if v is None or (isinstance(v, float) and pd.isna(v)) or v == "":
        return "NULL"
    s = str(v).replace("'", "''")
    return f"'{s}'"


def sql_num(v) -> str:
    """SQL numeric literal. NULL for missing/NaN."""
    if v is None or pd.isna(v):
        return "NULL"
    try:
        return str(round(float(v), 2))
    except (ValueError, TypeError):
        return "NULL"


def sql_bool(v) -> str:
    return "true" if bool(v) else "false"


def main():
    if not STOCK_DIR.is_dir():
        sys.exit(f"Stock dir not found: {STOCK_DIR}")

    rows = []
    skipped = {
        "no_ean": 0,
        "no_price": 0,
        "duplicate_ean_in_file": 0,
        "short_ean_likely_accounting_stub": 0,
        "price_below_R5_likely_placeholder": 0,
    }
    seen_eans = set()

    for filename in sorted(os.listdir(STOCK_DIR)):
        if not filename.endswith(".xls"):
            continue
        if filename not in FILE_MAP:
            print(f"⚠️  Unmapped filename: {filename}", file=sys.stderr)
            continue
        category, subcat_or_classify = FILE_MAP[filename]
        df = pd.read_excel(STOCK_DIR / filename, header=1)

        for _, row in df.iterrows():
            ean = row.get("EAN")
            if pd.isna(ean) or not str(ean).strip():
                skipped["no_ean"] += 1
                continue
            ean = str(ean).strip()
            # Some EANs come through as floats (e.g. 6.009888e+12); fix.
            if "." in ean and ean.endswith(".0"):
                ean = ean[:-2]
            # Real EANs are 8 or 13 digits. Shorter codes (e.g. "2100805")
            # are internal accounting stubs for VAT-rate buckets that the
            # supplier exports with every category — not actual products.
            if len(ean) < 8:
                skipped["short_ean_likely_accounting_stub"] += 1
                continue
            if ean in seen_eans:
                skipped["duplicate_ean_in_file"] += 1
                continue
            seen_eans.add(ean)

            sp = pd.to_numeric(row.get("< SP"), errors="coerce")
            if pd.isna(sp) or sp <= 0:
                skipped["no_price"] += 1
                continue
            # Below R5 is almost certainly a placeholder (PLASTIC GLASS R2,
            # GRANDPA SACHETS R3.99, etc.) — no real liquor SKU is under R5.
            if sp < 5:
                skipped["price_below_R5_likely_placeholder"] += 1
                continue
            price = round(float(sp) * MARKUP, 2)

            soh = pd.to_numeric(row.get("SOH"), errors="coerce")
            soh = 0 if pd.isna(soh) else int(soh)
            in_stock = soh > 0
            # Clamp negative SOH (warehouse adjustment artifacts) to 0
            stock_qty = max(soh, 0)

            name = title_case_product(str(row.get("Product Description", "")).strip())
            bottle_size = row.get("Size")
            bottle_size = None if pd.isna(bottle_size) else str(bottle_size).strip()

            subcategory = subcat_or_classify
            if subcat_or_classify == "__classify__":
                subcategory = classify_accessory(name)

            rows.append({
                "barcode": ean,
                "name": name,
                "category": category,
                "subcategory": subcategory,
                "bottle_size": bottle_size,
                "price": price,
                "stock_quantity": stock_qty,
                "in_stock": in_stock,
            })

    print(f"Built {len(rows)} rows. Skipped: {skipped}")

    # Write SQL — single VALUES list, one UPSERT statement, transactional.
    with open(OUT_SQL, "w") as f:
        f.write("-- LIQZAR stock import — generated by scripts/generate-stock-import-sql.py\n")
        f.write(f"-- Source: src/assets/brands/stock/ (38 .xls files)\n")
        f.write(f"-- Rows: {len(rows)}\n")
        f.write(f"-- Price = round(< SP * {MARKUP}, 2)\n")
        f.write(f"-- Skipped: {skipped}\n")
        f.write(f"-- Idempotent: re-run safely. Preserves image_url on existing rows.\n\n")
        f.write("BEGIN;\n\n")
        f.write("WITH incoming (barcode, name, category, subcategory, bottle_size, price, stock_quantity, in_stock) AS (\n  VALUES\n")
        for i, r in enumerate(rows):
            vals = (
                f"({sql_str(r['barcode'])}, "
                f"{sql_str(r['name'])}, "
                f"{sql_str(r['category'])}, "
                f"{sql_str(r['subcategory'])}, "
                f"{sql_str(r['bottle_size'])}, "
                f"{sql_num(r['price'])}, "
                f"{r['stock_quantity']}, "
                f"{sql_bool(r['in_stock'])})"
            )
            sep = "," if i < len(rows) - 1 else ""
            f.write(f"    {vals}{sep}\n")
        f.write(")\n")
        f.write("INSERT INTO products (\n"
                "  barcode, name, category, subcategory, bottle_size,\n"
                "  price, stock_quantity, in_stock, markup_pct, updated_at\n"
                ")\n"
                "SELECT\n"
                "  barcode, name, category, subcategory, bottle_size,\n"
                "  price, stock_quantity, in_stock, 15, NOW()\n"
                "FROM incoming\n"
                "ON CONFLICT (barcode) WHERE barcode IS NOT NULL\n"
                "DO UPDATE SET\n"
                "  name           = EXCLUDED.name,\n"
                "  category       = EXCLUDED.category,\n"
                "  subcategory    = EXCLUDED.subcategory,\n"
                "  bottle_size    = EXCLUDED.bottle_size,\n"
                "  price          = EXCLUDED.price,\n"
                "  stock_quantity = EXCLUDED.stock_quantity,\n"
                "  in_stock       = EXCLUDED.in_stock,\n"
                "  markup_pct     = EXCLUDED.markup_pct,\n"
                "  updated_at     = NOW();\n"
                "  -- image_url, description, country, alcohol_pct, rating, is_featured,\n"
                "  -- is_trending, is_new_arrival, is_best_seller are PRESERVED on update.\n\n")
        f.write("-- Sanity: count what landed.\n")
        f.write("SELECT category, COUNT(*) AS n FROM products WHERE updated_at >= NOW() - INTERVAL '1 minute' GROUP BY category ORDER BY n DESC;\n\n")
        f.write("COMMIT;\n")
    print(f"\n✓ Wrote {OUT_SQL}")
    print(f"  Size: {OUT_SQL.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
