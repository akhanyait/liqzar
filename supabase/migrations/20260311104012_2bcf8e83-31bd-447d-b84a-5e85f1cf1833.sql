-- Fix 5 featured/trending products with NULL images
UPDATE products SET image_url = 'https://armanddebrignac.com/wp-content/uploads/2016/11/Gold_1.jpg' WHERE id = 'e2127d34-8721-40f8-b88e-7408ec41b1f0';
UPDATE products SET image_url = 'https://armanddebrignac.com/wp-content/uploads/2016/11/Rose_1.jpg' WHERE id = 'a7cf994b-f7e7-4dd1-9f02-777ad4628536';
UPDATE products SET image_url = 'https://www.totalwine.com/dynamic/x1000,sq/media/sys_master/images/hce/h4e/8798303674398.png' WHERE id = '42a707d7-f936-440d-8f4b-3fdd981b48e8';
UPDATE products SET image_url = 'https://www.totalwine.com/dynamic/x1000,sq/media/sys_master/images/hfe/h44/12223836white160.png' WHERE id = '62855b87-c1e0-419e-993b-29390ba082bc';
UPDATE products SET image_url = 'https://us.louisxiii-cognac.com/cdn/shop/files/LXIII_TheClassic_PDP_Desktop_Visual1_0dfd2f92-dd2e-4fb8-9fd5-ec5d8a46a0b5.jpg?v=1719931581&width=1000' WHERE id = 'c1e9da2c-ca69-4a01-b06c-2e267cc5d6fb';

-- Fix tiny Woolworths thumbnails (w=80) by increasing to w=500
UPDATE products SET image_url = REPLACE(image_url, '&w=80&', '&w=500&') WHERE image_url LIKE '%woolworthsstatic%&w=80&%';
UPDATE products SET image_url = REPLACE(image_url, '&w=310&', '&w=500&') WHERE image_url LIKE '%woolworthsstatic%&w=310&%';