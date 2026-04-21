# Database Migration Required

## ⚠️ Important: Apply Migration Before Using New Features

The following features require database migration to be applied:

### Features Created:

1. **Driver Profile System** - `/driver/profile`
2. **Vehicle Registration** - `/driver/vehicle`
3. **Item Scanning System** - `/driver/scan/:orderId`
4. **AI Transport Recommendations** - Admin assignment interface

### Migration File:

`supabase/migrations/20260315181138_driver_system_and_logistics.sql`

### To Apply Migration:

#### Option 1: Supabase Dashboard (Recommended for hosted project)

1. Go to your Supabase project dashboard
2. Navigate to **Database** → **Migrations**
3. Click **New Migration**
4. Copy the contents of `supabase/migrations/20260315181138_driver_system_and_logistics.sql`
5. Paste and run the migration

#### Option 2: Supabase CLI (if installed locally)

```bash
cd supabase
supabase db push
```

### Tables Created by Migration:

1. **driver_profiles** - Driver personal info, photos, verification
2. **driver_vehicles** - Vehicle type, capacity, license plate
3. **order_items** - Individual item scanning tracking
4. **package_groups** - Grouped package scanning (1 barcode for multiple items)
5. **delivery_assignments** - AI recommendations, vehicle mismatch warnings

### Storage Bucket Created:

- **driver-documents** - For profile photos, licenses, vehicle photos

### TypeScript Type Errors:

The DriverScanItems component will show TypeScript errors until migration is applied and types are regenerated. This is expected and will resolve automatically after:

1. Applying the migration
2. Regenerating Supabase types: `npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/integrations/supabase/types.ts`

### Current Status:

✅ Admin assignment interface with AI recommendations - **READY TO USE** (uses TypeScript interfaces, no database dependency)
✅ Dark theme applied
✅ Earnings removed from driver interface
⏳ Driver profile/vehicle pages - **REQUIRES MIGRATION**
⏳ Item scanning system - **REQUIRES MIGRATION**

The app will build and run, but profile/vehicle/scanning features will not work until migration is applied.
