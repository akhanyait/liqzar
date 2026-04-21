# 🚀 Database Migration Guide

## Moving from OLD → NEW Supabase Project

---

## Overview

**OLD Project:** `emmipyyfcrwkjogepscg` (has 1000+ products)  
**NEW Project:** `ofwphztdugejhxvelczg` (clean slate)

---

## STEP 1: Setup New Database Structure (5 minutes)

### 1.1 Open New Project SQL Editor

Go to: https://supabase.com/dashboard/project/ofwphztdugejhxvelczg/editor/sql

### 1.2 Run Master Setup Script

1. Click **"New query"**
2. Open `supabase/MASTER_DATABASE_SETUP.sql` in VS Code
3. Copy **ALL** contents (⌘A → ⌘C)
4. Paste into Supabase SQL Editor
5. Click **"Run"** button
6. Wait for "Success. No rows returned"
7. ✅ Your new database structure is ready!

---

## STEP 2: Export Products from OLD Database (2 minutes)

### Option A: Export as CSV (EASIEST) ✅ Recommended

1. Go to OLD project: https://supabase.com/dashboard/project/emmipyyfcrwkjogepscg/editor
2. Click **Table Editor** → **products** table
3. Click **"Export CSV"** button (top right)
4. Save file as `products_backup.csv`

### Option B: Export as SQL (Advanced)

1. Go to OLD project SQL Editor
2. Open `supabase/MIGRATE_DATA.sql`
3. Copy and run the query
4. Copy all the INSERT statements from results
5. Save to a text file

---

## STEP 3: Import Products to NEW Database (3 minutes)

### If you used CSV export:

1. Go to NEW project: https://supabase.com/dashboard/project/ofwphztdugejhxvelczg/editor
2. Click **Table Editor** → **products** table
3. Click **"Insert"** → **"Import data from CSV"**
4. Upload your `products_backup.csv`
5. Map columns (should auto-detect)
6. Click **"Import"**
7. ✅ Done! All products copied!

### If you have SQL INSERT statements:

1. Go to NEW project SQL Editor
2. Paste all INSERT statements
3. Click **"Run"**
4. Wait for completion

---

## STEP 4: Update App Configuration (1 minute)

Update your `.env` file with NEW project credentials:

```env
VITE_SUPABASE_PROJECT_ID="ofwphztdugejhxvelczg"
VITE_SUPABASE_URL="https://ofwphztdugejhxvelczg.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="YOUR_NEW_ANON_KEY_HERE"
```

**Get your new anon key:**
Go to: https://supabase.com/dashboard/project/ofwphztdugejhxvelczg/settings/api
Copy the **"anon / public"** key

---

## STEP 5: Rebuild App (30 seconds)

```bash
npm run build && npx cap sync ios
```

---

## STEP 6: Verify Migration (2 minutes)

1. Refresh iOS app (⌘R)
2. Check products load correctly
3. Create test orders
4. Test driver dashboard
5. ✅ Everything working!

---

## Rollback Plan (If Something Goes Wrong)

Just change `.env` back to old project:

```env
VITE_SUPABASE_PROJECT_ID="emmipyyfcrwkjogepscg"
VITE_SUPABASE_URL="https://emmipyyfcrwkjogepscg.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbWlweXlmY3J3a2pvZ2Vwc2NnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NjUyOTIsImV4cCI6MjA4ODU0MTI5Mn0.-cpHP4c5RNoyva6SSNCWo0ajwHLPoA1hYXwH9QQ0lUc"
```

Then rebuild: `npm run build && npx cap sync ios`

---

## What Gets Migrated

✅ **Automatically copied:**

- Database structure (tables, relationships)
- RLS policies
- Functions & triggers
- Indexes
- Storage buckets

📦 **Manually copied:**

- Products data (1000+ items)

❌ **NOT copied** (will be fresh/empty):

- Users & profiles
- Orders
- Driver profiles
- Test data

---

## Total Time: ~15 minutes

1. Setup DB structure: 5 min
2. Export products: 2 min
3. Import products: 3 min
4. Update .env: 1 min
5. Rebuild app: 30 sec
6. Test: 2 min

---

## Next Steps After Migration

1. Create new test users in NEW database
2. Assign driver roles
3. Generate test orders
4. Test complete workflow
5. Optional: Migrate storage files (product images)

---

## Need Help?

**Check products count:**

```sql
SELECT COUNT(*) as total_products FROM products;
```

**Verify tables exist:**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

**Check RLS enabled:**

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public';
```

---

**Status: Ready to migrate! 🚀**

Start with Step 1 above!
