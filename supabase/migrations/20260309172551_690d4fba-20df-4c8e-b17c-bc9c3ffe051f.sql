-- Clear out image URLs sourced from Google image-search redirects (host-locked,
-- start 404'ing as soon as the search ranking shifts). Products with image_url
-- = NULL fall back to the placeholder generator in src/lib/product-utils.ts.
UPDATE products SET image_url = NULL WHERE image_url LIKE '%google.com%';
