# ⚡ Quick Start Checklist

## What I Need From You (5 minutes)

### 1. Supabase Project Info

- [ ] Log in to [supabase.com/dashboard](https://supabase.com/dashboard)
- [ ] Select your project (or create new one)
- [ ] Note your **Project URL**: `https://xxxxx.supabase.co`
- [ ] Note your **Anon Key**: Dashboard → Settings → API

### 2. Run Database Setup (2 minutes)

- [ ] Open **SQL Editor** in Supabase Dashboard
- [ ] Copy contents of `supabase/MASTER_DATABASE_SETUP.sql`
- [ ] Paste into SQL Editor
- [ ] Click **Run** button
- [ ] Wait for "Success" message

### 3. Create Test Users (3 minutes)

- [ ] Go to **Authentication** → **Users** in Supabase
- [ ] Create customer: `customer@test.com` / `Test123!@#`
- [ ] Create driver: `driver@test.com` / `Test123!@#`
- [ ] Auto-confirm both: ✅

### 4. Assign Driver Role (30 seconds)

```sql
-- Run in SQL Editor:
SELECT id, email FROM auth.users WHERE email LIKE '%test.com';

-- Copy driver's UUID and run:
INSERT INTO user_roles (user_id, role)
VALUES ('PASTE_DRIVER_UUID_HERE', 'driver')
ON CONFLICT DO NOTHING;
```

### 5. Test in App (2 minutes)

- [ ] Login as customer@test.com
- [ ] Navigate to `#/test-orders`
- [ ] Click "Create Test Orders"
- [ ] Logout → Login as driver@test.com
- [ ] Go to Driver Dashboard
- [ ] See 3 orders! ✅
- [ ] Click "Verify Stock Now"
- [ ] Items should load with product details! ✅

---

## Done! 🎉

You now have:

- ✅ Complete database structure
- ✅ User authentication
- ✅ Test accounts with roles
- ✅ Working orders system
- ✅ Driver scanning system
- ✅ Product catalog

---

## Helpful Files Created

1. **MASTER_DATABASE_SETUP.sql** - Complete database setup (run once)
2. **SUPABASE_SETUP_GUIDE.md** - Detailed instructions
3. **SUPABASE_SQL_REFERENCE.md** - Common SQL commands

---

## If Something Doesn't Work

### Orders not showing in driver dashboard?

- Check order status is `pending`, `preparing`, or `ready`
- Check console logs in Safari Developer Tools

### "No products found" error?

- Your products table has 1000+ items, this shouldn't happen
- Run: `SELECT COUNT(*) FROM products;` in SQL Editor

### "Permission denied" errors?

- Make sure user has correct role assigned
- Check RLS policies are enabled (they are in the script)

### Items not loading in scan screen?

- Make sure you're using real orders (not mock data)
- Check console for UUID errors
- Verify order_items exist: `SELECT * FROM order_items LIMIT 5;`

---

## Quick Commands Reference

**View all users and roles:**

```sql
SELECT u.email, array_agg(ur.role) as roles
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
GROUP BY u.email;
```

**View all orders:**

```sql
SELECT order_number, status, customer_name, total
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

**Count everything:**

```sql
SELECT
  (SELECT COUNT(*) FROM products) as products,
  (SELECT COUNT(*) FROM orders) as orders,
  (SELECT COUNT(*) FROM auth.users) as users,
  (SELECT COUNT(*) FROM driver_profiles) as drivers;
```

---

## Next Steps After Setup

1. Test driver scanning workflow ⏳
2. Apply damage database migration for new fields
3. Add real product barcodes
4. Configure Supabase Edge Functions
5. Set up push notifications
6. Deploy to production

---

## Need More Help?

**Documentation:**

- Full guide: `SUPABASE_SETUP_GUIDE.md`
- SQL reference: `SUPABASE_SQL_REFERENCE.md`
- Database script: `supabase/MASTER_DATABASE_SETUP.sql`

**Supabase Docs:**

- [Row Level Security](https://supabase.com/docs/guides/auth/row-level-security)
- [Storage](https://supabase.com/docs/guides/storage)
- [Edge Functions](https://supabase.com/docs/guides/functions)

---

**Status: Ready to run! 🚀**

Just give me your Supabase project URL and let's get started!
