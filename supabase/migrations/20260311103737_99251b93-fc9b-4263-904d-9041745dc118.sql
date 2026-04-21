-- Clear Makro placeholder images (all same broken image)
UPDATE products SET image_url = NULL 
WHERE image_url LIKE '%makro.co.za/sys-master/root/h14/hbc/29755998797854%';

-- Fix HTML entity encoding in URLs
UPDATE products SET image_url = REPLACE(image_url, '&amp;', '&')
WHERE image_url LIKE '%&amp;%';