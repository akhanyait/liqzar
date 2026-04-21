
-- Clear image_url for products where it's not a real image URL
UPDATE products SET image_url = NULL, updated_at = now()
WHERE image_url IS NOT NULL AND (
  -- URLs that are web pages, not images
  image_url LIKE '%gettyimages.com%'
  OR image_url LIKE '%grandcruliquidassets.com/collections%'
  OR image_url LIKE '%saratogawine.com%/country_default%'
  OR image_url LIKE '%woolworths.co.za/images/elasticera/New_Site%'
  -- Woolworths product images that are clearly wrong products (underwear etc)
  OR image_url LIKE '%StayNew-COOLTECH%'
  OR image_url LIKE '%Cotton-Briefs%'
  -- eBay tiny thumbnails
  OR image_url LIKE '%ebayimg.com%s-l140%'
  -- Massmart tiny thumbnails (106x116)
  OR (image_url LIKE '%massmart.co.za%' AND image_url LIKE '%odnHeight=106%')
  -- Keg n Bottle tiny (200x200)
  OR (image_url LIKE '%kegnbottle.com%' AND image_url LIKE '%200x200%')
  -- Generic non-image URLs (no image extension and no CDN pattern)
  OR (
    image_url NOT LIKE '%.jpg%'
    AND image_url NOT LIKE '%.jpeg%'
    AND image_url NOT LIKE '%.png%'
    AND image_url NOT LIKE '%.webp%'
    AND image_url NOT LIKE '%.gif%'
    AND image_url NOT LIKE '%cdn%'
    AND image_url NOT LIKE '%media%'
    AND image_url NOT LIKE '%images%'
    AND image_url NOT LIKE '%static%'
    AND image_url NOT LIKE '%assets%'
  )
);
