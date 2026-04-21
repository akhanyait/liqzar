# 🔧 Supabase Quick Reference - Common SQL Commands

## View All Users

```sql
SELECT
  id,
  email,
  created_at,
  email_confirmed_at,
  last_sign_in_at
FROM auth.users
ORDER BY created_at DESC;
```

## View Users with Their Roles

```sql
SELECT
  u.email,
  u.id as user_id,
  COALESCE(array_agg(ur.role), ARRAY[]::app_role[]) as roles,
  u.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
GROUP BY u.email, u.id, u.created_at
ORDER BY u.created_at DESC;
```

## Assign Driver Role

```sql
-- First, get the user_id
SELECT id, email FROM auth.users WHERE email = 'driver@test.com';

-- Then assign the role (replace USER_ID)
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'driver')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Assign Admin Role

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Make User Both Customer AND Driver

```sql
-- Customers can also be drivers!
INSERT INTO user_roles (user_id, role) VALUES
  ('USER_ID_HERE', 'customer'),
  ('USER_ID_HERE', 'driver')
ON CONFLICT (user_id, role) DO NOTHING;
```

## View All Orders

```sql
SELECT
  o.order_number,
  o.status,
  o.customer_name,
  o.total,
  o.created_at,
  u.email as customer_email,
  COUNT(oi.id) as item_count
FROM orders o
LEFT JOIN auth.users u ON o.user_id = u.id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, o.order_number, o.status, o.customer_name, o.total, o.created_at, u.email
ORDER BY o.created_at DESC;
```

## View Order Details with Items

```sql
-- Replace ORDER_ID with actual order UUID
SELECT
  o.order_number,
  o.status,
  o.customer_name,
  oi.product_name,
  oi.quantity,
  oi.unit_price,
  oi.is_scanned
FROM orders o
JOIN order_items oi ON o.id = oi.order_id
WHERE o.id = 'ORDER_ID_HERE';
```

## View Products with Low Stock

```sql
SELECT
  name,
  category,
  stock_quantity,
  low_stock_threshold,
  price
FROM products
WHERE stock_quantity < low_stock_threshold
  AND in_stock = true
ORDER BY stock_quantity ASC;
```

## Update Product Stock

```sql
-- Add stock
UPDATE products
SET stock_quantity = stock_quantity + 100
WHERE name = 'Guinness Foreign Extra Stout';

-- Set specific stock level
UPDATE products
SET stock_quantity = 50
WHERE id = 'PRODUCT_ID_HERE';
```

## Delete Test Orders (Cleanup)

```sql
-- Delete all orders (careful!)
DELETE FROM orders WHERE order_number LIKE 'ORD-%';

-- Or delete specific order
DELETE FROM orders WHERE id = 'ORDER_ID_HERE';
```

## View Driver Profiles

```sql
SELECT
  dp.full_name,
  dp.phone,
  dp.is_verified,
  u.email,
  dv.vehicle_type,
  dv.license_plate
FROM driver_profiles dp
JOIN auth.users u ON dp.user_id = u.id
LEFT JOIN driver_vehicles dv ON dp.id = dv.driver_id
ORDER BY dp.created_at DESC;
```

## View Active Delivery Assignments

```sql
SELECT
  da.id,
  o.order_number,
  dp.full_name as driver_name,
  da.status,
  da.total_items,
  da.recommended_vehicle,
  da.assigned_vehicle,
  da.vehicle_mismatch_warning
FROM delivery_assignments da
JOIN orders o ON da.order_id = o.id
LEFT JOIN driver_profiles dp ON da.driver_id = dp.id
WHERE da.status IN ('pending', 'accepted', 'picked_up', 'in_transit')
ORDER BY da.created_at DESC;
```

## Check RLS Policies

```sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

## View All Tables in Database

```sql
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns c WHERE c.table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

## Count Records in Each Table

```sql
SELECT
  'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'products', COUNT(*) FROM products
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'order_items', COUNT(*) FROM order_items
UNION ALL
SELECT 'driver_profiles', COUNT(*) FROM driver_profiles
UNION ALL
SELECT 'driver_vehicles', COUNT(*) FROM driver_vehicles
UNION ALL
SELECT 'delivery_assignments', COUNT(*) FROM delivery_assignments
UNION ALL
SELECT 'user_roles', COUNT(*) FROM user_roles;
```

## Remove All RLS Policies (Emergency)

```sql
-- Use this if you need to reset all policies
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
      pol.policyname, pol.schemaname, pol.tablename);
  END LOOP;
END $$;
```

## Create Sample Driver Assignment

```sql
-- First, get order_id and driver_profile_id
SELECT o.id as order_id, o.order_number
FROM orders o
WHERE o.status = 'pending'
LIMIT 1;

SELECT dp.id as driver_id, dp.full_name
FROM driver_profiles dp
LIMIT 1;

-- Then create assignment
INSERT INTO delivery_assignments (
  order_id,
  driver_id,
  total_items,
  recommended_vehicle,
  assigned_vehicle,
  status
)
VALUES (
  'ORDER_ID_HERE',
  'DRIVER_PROFILE_ID_HERE',
  5,
  'car',
  'car',
  'pending'
);
```

## Update Order Status

```sql
-- Update single order
UPDATE orders
SET status = 'preparing'
WHERE order_number = 'ORD-2401';

-- Update all pending orders to preparing
UPDATE orders
SET status = 'preparing',
    updated_at = NOW()
WHERE status = 'pending';
```

## Grant Storage Permissions

```sql
-- Allow authenticated users to upload to product-images
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Make product images publicly readable
CREATE POLICY "Public can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');
```

## Reset User Password (Admin)

```sql
-- This generates a new password reset link
-- Run from Supabase dashboard only
SELECT auth.update_user(
  '{"id": "USER_ID_HERE"}',
  '{"password": "NewPassword123!"}'
);
```

## Find Orders Without Items

```sql
SELECT
  o.order_number,
  o.status,
  o.created_at
FROM orders o
LEFT JOIN order_items oi ON o.id = oi.order_id
WHERE oi.id IS NULL;
```

## Find Products Never Ordered

```sql
SELECT
  p.name,
  p.category,
  p.price,
  p.in_stock
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
WHERE oi.id IS NULL
  AND p.in_stock = true
ORDER BY p.name;
```

## Backup - Export Orders to JSON

```sql
SELECT json_agg(row_to_json(orders.*))
FROM orders
WHERE created_at > NOW() - INTERVAL '7 days';
```

## Check Database Size

```sql
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Emergency Recovery

### If App Can't Connect to Supabase

1. Check Project URL: Dashboard → Settings → API
2. Check Anon Key: Dashboard → Settings → API
3. Verify in: `src/integrations/supabase/client.ts`

### If RLS Blocking Everything

```sql
-- Temporarily disable RLS on specific table (NOT for production!)
ALTER TABLE products DISABLE ROW LEVEL SECURITY;

-- Re-enable when fixed
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
```

### If Need to Start Fresh

```sql
-- ⚠️ DANGER: This deletes ALL orders and related data
TRUNCATE orders CASCADE;

-- ⚠️ DANGER: This deletes ALL users except auth
DELETE FROM profiles;

-- ⚠️ Better: Delete only test data
DELETE FROM orders WHERE order_number LIKE 'ORD-%';
```

---

## Useful Queries for Development

### See Last 10 Database Changes

```sql
SELECT
  table_name,
  MAX(updated_at) as last_updated
FROM (
  SELECT 'orders' as table_name, MAX(updated_at) as updated_at FROM orders
  UNION ALL
  SELECT 'products', MAX(updated_at) FROM products
  UNION ALL
  SELECT 'driver_profiles', MAX(updated_at) FROM driver_profiles
) as changes
GROUP BY table_name
ORDER BY last_updated DESC NULLS LAST;
```

### Monitor Active Driver Locations

```sql
SELECT
  dp.full_name,
  da.status,
  o.order_number,
  dt.latitude,
  dt.longitude,
  dt.speed,
  dt.created_at as last_ping
FROM delivery_tracking dt
JOIN delivery_assignments da ON dt.assignment_id = da.id
JOIN driver_profiles dp ON da.driver_id = dp.id
JOIN orders o ON da.order_id = o.id
WHERE dt.created_at > NOW() - INTERVAL '5 minutes'
ORDER BY dt.created_at DESC;
```

### Find Duplicate Products

```sql
SELECT
  name,
  COUNT(*) as count
FROM products
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

---

## Pro Tips

1. **Always backup before running DELETE/TRUNCATE**
2. **Use transactions for multiple changes:**
   ```sql
   BEGIN;
   -- Your queries here
   COMMIT; -- or ROLLBACK if something went wrong
   ```
3. **Test RLS policies with specific user:**
   ```sql
   SET LOCAL role TO authenticated;
   SET LOCAL request.jwt.claims TO '{"sub": "USER_ID_HERE"}';
   -- Test your query
   RESET role;
   ```

---

📚 **Keep this file handy for quick database operations!**
