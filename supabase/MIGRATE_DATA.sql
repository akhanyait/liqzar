-- ============================================================================
-- DATA MIGRATION SCRIPT - Copy Products to New Database
-- ============================================================================
-- This exports your products data as INSERT statements
-- Run this on OLD database (emmipyyfcrwkjogepscg)
-- Copy the output and run it on NEW database (ofwphztdugejhxvelczg)
-- ============================================================================

-- Export all products as INSERT statements
SELECT 
  'INSERT INTO products (id, name, category, bottle_size, country, alcohol_pct, price, cheapest_retailer, ' ||
  'checkers_price, pnp_price, tops_price, woolworths_price, norman_price, image_url, image_search_url, ' ||
  'product_search_url, description, rating, review_count, in_stock, is_featured, is_trending, ' ||
  'barcode, stock_quantity, low_stock_threshold, last_sold_date, created_at, updated_at) VALUES (' ||
  quote_literal(id::text) || '::uuid, ' ||
  quote_literal(name) || ', ' ||
  quote_literal(category) || ', ' ||
  COALESCE(quote_literal(bottle_size), 'NULL') || ', ' ||
  COALESCE(quote_literal(country), 'NULL') || ', ' ||
  COALESCE(quote_literal(alcohol_pct), 'NULL') || ', ' ||
  COALESCE(price::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(cheapest_retailer), 'NULL') || ', ' ||
  COALESCE(checkers_price::text, 'NULL') || ', ' ||
  COALESCE(pnp_price::text, 'NULL') || ', ' ||
  COALESCE(tops_price::text, 'NULL') || ', ' ||
  COALESCE(woolworths_price::text, 'NULL') || ', ' ||
  COALESCE(norman_price::text, 'NULL') || ', ' ||
  COALESCE(quote_literal(image_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(image_search_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(product_search_url), 'NULL') || ', ' ||
  COALESCE(quote_literal(description), 'NULL') || ', ' ||
  COALESCE(rating::text, 'NULL') || ', ' ||
  COALESCE(review_count::text, '0') || ', ' ||
  in_stock || ', ' ||
  is_featured || ', ' ||
  is_trending || ', ' ||
  COALESCE(quote_literal(barcode), 'NULL') || ', ' ||
  COALESCE(stock_quantity::text, '0') || ', ' ||
  COALESCE(low_stock_threshold::text, '10') || ', ' ||
  COALESCE(quote_literal(last_sold_date::text), 'NULL') || ', ' ||
  quote_literal(created_at::text) || '::timestamptz, ' ||
  quote_literal(updated_at::text) || '::timestamptz' ||
  ');'
FROM products
ORDER BY created_at;

-- ============================================================================
-- ALTERNATIVE: Export as CSV (simpler approach)
-- ============================================================================
-- Run this query and download as CSV, then import to new database
-- Just run: SELECT * FROM products ORDER BY created_at;
-- Then click "Download CSV" button in Supabase dashboard
-- ============================================================================
