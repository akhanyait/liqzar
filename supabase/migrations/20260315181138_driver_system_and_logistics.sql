-- Create driver_profiles table
CREATE TABLE IF NOT EXISTS public.driver_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    id_number TEXT NOT NULL,
    profile_picture_url TEXT,
    driver_license_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Create driver_vehicles table
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
    vehicle_photo_url TEXT,
    vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('scooter', 'car', 'bakkie', 'small_truck', 'medium_truck', 'large_truck')),
    license_plate TEXT NOT NULL,
    make_model TEXT NOT NULL,
    capacity_kg INTEGER,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(driver_id),
    UNIQUE(license_plate)
);

-- Create order_items table for individual item tracking
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    barcode TEXT,
    is_scanned BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMP WITH TIME ZONE,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    weight_kg NUMERIC(10, 2),
    volume_m3 NUMERIC(10, 4),
    is_grouped BOOLEAN DEFAULT FALSE,
    group_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create package_groups table for grouped items
CREATE TABLE IF NOT EXISTS public.package_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    group_name TEXT NOT NULL,
    group_barcode TEXT UNIQUE NOT NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10, 2),
    total_volume_m3 NUMERIC(10, 4),
    is_scanned BOOLEAN DEFAULT FALSE,
    scanned_at TIMESTAMP WITH TIME ZONE,
    scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create delivery_assignments table
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL,
    driver_id UUID REFERENCES public.driver_profiles(id) ON DELETE SET NULL,
    assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    total_items INTEGER NOT NULL DEFAULT 0,
    total_weight_kg NUMERIC(10, 2),
    total_volume_m3 NUMERIC(10, 4),
    recommended_vehicle TEXT CHECK (recommended_vehicle IN ('scooter', 'car', 'bakkie', 'small_truck', 'medium_truck', 'large_truck')),
    assigned_vehicle TEXT CHECK (assigned_vehicle IN ('scooter', 'car', 'bakkie', 'small_truck', 'medium_truck', 'large_truck')),
    vehicle_mismatch_warning BOOLEAN DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
    all_items_scanned BOOLEAN DEFAULT FALSE,
    pickup_verified_at TIMESTAMP WITH TIME ZONE,
    delivery_started_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create storage bucket for driver documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('driver-documents', 'driver-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on all tables
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for driver_profiles
DROP POLICY IF EXISTS "Drivers can view own profile" ON public.driver_profiles;
CREATE POLICY "Drivers can view own profile"
    ON public.driver_profiles FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Drivers can update own profile" ON public.driver_profiles;
CREATE POLICY "Drivers can update own profile"
    ON public.driver_profiles FOR UPDATE
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Drivers can insert own profile" ON public.driver_profiles;
CREATE POLICY "Drivers can insert own profile"
    ON public.driver_profiles FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.driver_profiles;
CREATE POLICY "Admins can view all profiles"
    ON public.driver_profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.driver_profiles;
CREATE POLICY "Admins can update all profiles"
    ON public.driver_profiles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- RLS Policies for driver_vehicles
DROP POLICY IF EXISTS "Drivers can view own vehicle" ON public.driver_vehicles;
CREATE POLICY "Drivers can view own vehicle"
    ON public.driver_vehicles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.driver_profiles
            WHERE driver_profiles.id = driver_vehicles.driver_id
            AND driver_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Drivers can update own vehicle" ON public.driver_vehicles;
CREATE POLICY "Drivers can update own vehicle"
    ON public.driver_vehicles FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.driver_profiles
            WHERE driver_profiles.id = driver_vehicles.driver_id
            AND driver_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Drivers can insert own vehicle" ON public.driver_vehicles;
CREATE POLICY "Drivers can insert own vehicle"
    ON public.driver_vehicles FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.driver_profiles
            WHERE driver_profiles.id = driver_vehicles.driver_id
            AND driver_profiles.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Admins can view all vehicles" ON public.driver_vehicles;
CREATE POLICY "Admins can view all vehicles"
    ON public.driver_vehicles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- RLS Policies for order_items
DROP POLICY IF EXISTS "Drivers and admins can view order items" ON public.order_items;
CREATE POLICY "Drivers and admins can view order items"
    ON public.order_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('driver', 'admin', 'warehouse_manager')
        )
    );

DROP POLICY IF EXISTS "Drivers and admins can update order items" ON public.order_items;
CREATE POLICY "Drivers and admins can update order items"
    ON public.order_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('driver', 'admin', 'warehouse_manager')
        )
    );

DROP POLICY IF EXISTS "Admins can insert order items" ON public.order_items;
CREATE POLICY "Admins can insert order items"
    ON public.order_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- RLS Policies for package_groups
DROP POLICY IF EXISTS "Drivers and admins can view package groups" ON public.package_groups;
CREATE POLICY "Drivers and admins can view package groups"
    ON public.package_groups FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('driver', 'admin', 'warehouse_manager')
        )
    );

DROP POLICY IF EXISTS "Admins can manage package groups" ON public.package_groups;
CREATE POLICY "Admins can manage package groups"
    ON public.package_groups FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- RLS Policies for delivery_assignments
DROP POLICY IF EXISTS "Drivers can view own assignments" ON public.delivery_assignments;
CREATE POLICY "Drivers can view own assignments"
    ON public.delivery_assignments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.driver_profiles
            WHERE driver_profiles.id = delivery_assignments.driver_id
            AND driver_profiles.user_id = auth.uid()
        )
        OR
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

DROP POLICY IF EXISTS "Admins can manage deliveries" ON public.delivery_assignments;
CREATE POLICY "Admins can manage deliveries"
    ON public.delivery_assignments FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- Storage policies for driver documents
DROP POLICY IF EXISTS "Drivers can upload own documents" ON storage.objects;
CREATE POLICY "Drivers can upload own documents"
    ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'driver-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Drivers can view own documents" ON storage.objects;
CREATE POLICY "Drivers can view own documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'driver-documents'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

DROP POLICY IF EXISTS "Admins can view all documents" ON storage.objects;
CREATE POLICY "Admins can view all documents"
    ON storage.objects FOR SELECT
    USING (
        bucket_id = 'driver-documents'
        AND EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'warehouse_manager')
        )
    );

-- Add columns to order_items if they don't exist (table may have been created by earlier migration)
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_scanned BOOLEAN DEFAULT FALSE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS scanned_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(10, 2);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS volume_m3 NUMERIC(10, 4);
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS is_grouped BOOLEAN DEFAULT FALSE;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS group_id UUID;
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_driver_profiles_user_id ON public.driver_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_driver_vehicles_driver_id ON public.driver_vehicles(driver_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_group_id ON public.order_items(group_id);
CREATE INDEX IF NOT EXISTS idx_package_groups_order_id ON public.package_groups(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON public.delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_id ON public.delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON public.delivery_assignments(status);

-- Create updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_driver_profiles_updated_at ON public.driver_profiles;
CREATE TRIGGER update_driver_profiles_updated_at BEFORE UPDATE ON public.driver_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_driver_vehicles_updated_at ON public.driver_vehicles;
CREATE TRIGGER update_driver_vehicles_updated_at BEFORE UPDATE ON public.driver_vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_order_items_updated_at ON public.order_items;
CREATE TRIGGER update_order_items_updated_at BEFORE UPDATE ON public.order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_package_groups_updated_at ON public.package_groups;
CREATE TRIGGER update_package_groups_updated_at BEFORE UPDATE ON public.package_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_delivery_assignments_updated_at ON public.delivery_assignments;
CREATE TRIGGER update_delivery_assignments_updated_at BEFORE UPDATE ON public.delivery_assignments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
