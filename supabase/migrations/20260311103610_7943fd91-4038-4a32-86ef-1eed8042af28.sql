-- Mark top-rated products as featured (top 12 by rating)
UPDATE products SET is_featured = true
WHERE id IN (
  SELECT id FROM products WHERE image_url IS NOT NULL ORDER BY rating DESC NULLS LAST, price DESC LIMIT 12
);

-- Mark a mix of popular products as trending (next 16 by review count)
UPDATE products SET is_trending = true
WHERE id IN (
  SELECT id FROM products WHERE image_url IS NOT NULL AND is_featured IS NOT TRUE ORDER BY review_count DESC NULLS LAST, rating DESC NULLS LAST LIMIT 16
);