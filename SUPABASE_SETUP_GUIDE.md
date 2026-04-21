# 🚀 Supabase Database Setup Guide

## What You Need

1. **Supabase Account** ✅ (You already have this)
2. **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
3. **5 minutes** to complete setup

---

## Step-by-Step Instructions

### Step 1: Access Supabase SQL Editor

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Log in to your account
3. Select your **liqzar** project (or create a new one if needed)
4. Click **"SQL Editor"** in the left sidebar

---

### Step 2: Run the Master Setup Script

1. In the SQL Editor, click **"+ New query"**
2. Open the file: `supabase/MASTER_DATABASE_SETUP.sql` (in this project)
3. **Copy ALL the contents** (Ctrl+A, Ctrl+C / Cmd+A, Cmd+C)
4. **Paste** into the Supabase SQL Editor
5. Click **"Run"** button (or press Ctrl+Enter / Cmd+Enter)
6. ⏳ Wait ~10-30 seconds for completion
7. ✅ You should see "Success. No rows returned" at the bottom

**Note**: It's safe to run this script multiple times - it won't duplicate data.

---

### Step 3: Verify Setup

After running the script, verify your tables exist:

1. Click **"Table Editor"** in the left sidebar
2. You should see these tables:
   - ✅ `profiles`
   - ✅ `user_roles`
   - ✅ `products` (already has data)
   - ✅ `orders`
   - ✅ `order_items`
   - ✅ `driver_profiles`
   - ✅ `driver_vehicles`
   - ✅ `delivery_assignments`
   - ✅ `warehouse_tasks`
   - ✅ `notifications`
   - ✅ And more...

3. Click **"Storage"** in left sidebar
4. You should see buckets:
   - ✅ `product-images`
   - ✅ `driver-documents`

---

### Step 4: Update Your App Configuration

1. Open file: `src/integrations/supabase/client.ts`
2. Verify your credentials:
   ```typescript
   const supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co";
   const supabaseAnonKey = "your_anon_key_here";
   ```
3. If they're placeholder values, replace with your real ones:
   - Get them from: Supabase Dashboard → Settings → API

---

### Step 5: Create Test Users

You'll need users with different roles. Two options:

#### Option A: Via Supabase Dashboard (Recommended)

1. Go to **Authentication** → **Users**
2. Click **"Add user"** → **"Create new user"**
3. Create these test accounts:

**Customer Account:**

- Email: `customer@test.com`
- Password: `Test123!@#`
- Auto-confirm: ✅ Yes

**Driver Account:**

- Email: `driver@test.com`
- Password: `Test123!@#`
- Auto-confirm: ✅ Yes

**Admin Account:**

- Email: `admin@test.com`
- Password: `Test123!@#`
- Auto-confirm: ✅ Yes

#### Option B: Sign Up Via App

1. Just use the app's sign up form
2. New users automatically get "customer" role

---

### Step 6: Assign Roles

After creating users, assign them roles:

1. Go to **SQL Editor** in Supabase
2. Run this query to make someone a driver:

   ```sql
   -- Get the user_id first
   SELECT id, email FROM auth.users WHERE email = 'driver@test.com';

   -- Assign driver role (replace USER_ID with the actual UUID)
   INSERT INTO user_roles (user_id, role)
   VALUES ('USER_ID_HERE', 'driver');
   ```

3. For admin role:

   ```sql
   INSERT INTO user_roles (user_id, role)
   VALUES ('USER_ID_HERE', 'admin');
   ```

4. Users can have multiple roles! Just insert multiple rows.

---

### Step 7: Test Your Setup

1. **Refresh your iOS app** (⌘R in simulator)
2. **Login as customer** account
3. **Navigate to** `#/test-orders` route
4. **Click** "Create Test Orders"
5. **Switch to driver** account (logout → login as driver)
6. **Go to** Driver Dashboard
7. **You should see** 3 orders! ✅

---

## Quick Role Assignment SQL

Copy this to assign roles to your existing test users:

```sql
-- Step 1: View all users and their IDs
SELECT id, email, created_at FROM auth.users ORDER BY created_at DESC;

-- Step 2: Assign driver role (replace with actual user_id)
INSERT INTO user_roles (user_id, role)
VALUES ('put-driver-user-id-here', 'driver')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Assign admin role (replace with actual user_id)
INSERT INTO user_roles (user_id, role)
VALUES ('put-admin-user-id-here', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 4: Verify roles assigned
SELECT
  u.email,
  ur.role
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
ORDER BY u.email;
```

---

## Troubleshooting

### ❌ "relation already exists" errors

**Solution**: This is normal! The script checks if tables exist before creating them. Ignore these.

### ❌ "function already exists" errors

**Solution**: Also normal! Script recreates functions to ensure they're up to date.

### ❌ Can't see tables after running script

**Solution**:

1. Refresh the Supabase page (F5)
2. Click between "Table Editor" and another menu item
3. Check if you're looking at the right project

### ❌ RLS errors when testing

**Solution**:

1. Make sure user has the correct role assigned
2. Check that RLS is enabled on tables
3. Run this to check RLS policies:
   ```sql
   SELECT schemaname, tablename, policyname
   FROM pg_policies
   WHERE schemaname = 'public';
   ```

---

## What's Included in the Database

| Category          | Tables                                                                         | Description                         |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------- |
| **Users**         | `profiles`, `user_roles`                                                       | User accounts & multi-role system   |
| **Products**      | `products`, `product_reviews`                                                  | Catalog with 1000+ products         |
| **Orders**        | `orders`, `order_items`, `order_status_history`                                | Complete order management           |
| **Warehouse**     | `warehouse_tasks`                                                              | Pick, pack, dispatch workflow       |
| **Driver**        | `driver_profiles`, `driver_vehicles`, `delivery_assignments`, `package_groups` | Driver system with vehicle matching |
| **Tracking**      | `delivery_tracking`                                                            | Real-time GPS tracking              |
| **Customer**      | `customer_addresses`                                                           | Saved delivery addresses            |
| **Notifications** | `notifications`                                                                | Push notification system            |

---

## Next Steps After Setup

1. ✅ Database structure created
2. ✅ Test users created with roles
3. ✅ Test orders generated
4. 🔄 **Now**: Test the complete driver workflow
5. 🔄 **Next**: Add real products (or use seed function)
6. 🔄 **Next**: Configure Supabase Edge Functions for AI features
7. 🔄 **Next**: Set up real payment gateway (if using)

---

## Need Help?

**Common Issues:**

1. **"No products found"** → Your products table is empty. Run the seed function or import CSV.
2. **"Invalid UUID"** → Make sure you're using real database orders, not mock data.
3. **"Permission denied"** → Check that RLS policies are set up (they are in the script).
4. **"Orders not showing"** → Make sure orders have status: `pending`, `preparing`, or `ready`.

**Get Your API Keys:**

- Supabase Dashboard → Settings → API
- You need: `Project URL` and `anon/public` key

---

## Database Schema Diagram

```
auth.users (Supabase Auth)
    ↓
profiles (1:1)
    ↓
user_roles (1:many) → app_role ENUM (customer, driver, warehouse, admin)
    ↓
orders (1:many)
    ↓
order_items (1:many) → products
    ↓
delivery_assignments → driver_profiles → driver_vehicles
    ↓
delivery_tracking (GPS breadcrumbs)
```

---

## Success Criteria

After setup, you should be able to:

- ✅ Sign up/login with test accounts
- ✅ Switch between customer/driver/admin roles
- ✅ View products catalog (1000+ items)
- ✅ Create test orders as customer
- ✅ See orders in driver dashboard
- ✅ Scan items in orders
- ✅ Track inventory deductions
- ✅ Upload driver documents
- ✅ Register vehicle info

---

**🎉 Setup Complete! Your database is production-ready.**
