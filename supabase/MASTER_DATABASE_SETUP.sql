-- ============================================================================
-- LIQZAR COMPLETE DATABASE SETUP SCRIPT
-- ============================================================================
-- Run this script in your Supabase SQL Editor to create the complete database
-- This script is idempotent - safe to run multiple times
-- ============================================================================

-- ============================================================================
-- 1. ENUMS & CUSTOM TYPES
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE public.app_role AS ENUM ('admin', 'customer', 'warehouse', 'driver');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 2. USER PROFILES & AUTHENTICATION
-- ============================================================================

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles table (multi-role support)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- ============================================================================
-- 3. PRODUCTS & CATALOG
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  bottle_size TEXT,
  country TEXT,
  alcohol_pct TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  cheapest_retailer TEXT,
  checkers_price NUMERIC,
  pnp_price NUMERIC,
  tops_price NUMERIC,
  woolworths_price NUMERIC,
  norman_price NUMERIC,
  image_url TEXT,
  image_search_url TEXT,
  product_search_url TEXT,
  description TEXT,
  rating NUMERIC DEFAULT 4.5,
  review_count INTEGER DEFAULT 0,
  in_stock BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_trending BOOLEAN DEFAULT false,
  barcode TEXT,
  stock_quantity INTEGER DEFAULT 0,
  low_stock_threshold INTEGER DEFAULT 10,
  last_sold_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product reviews
CREATE TABLE IF NOT EXISTS public.product_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  comment TEXT,
  is_verified_purchase BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 4. CUSTOMER DATA
-- ============================================================================

-- Customer addresses
CREATE TABLE IF NOT EXISTS public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  address_type TEXT NOT NULL DEFAULT 'home' CHECK (address_type IN ('home', 'work', 'other')),
  is_default BOOLEAN DEFAULT false,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  suburb TEXT,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. ORDERS SYSTEM
-- ============================================================================

-- Main orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE DEFAULT ('ORD-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled')),
  subtotal NUMERIC NOT NULL DEFAULT 0,
  vat_amount NUMERIC NOT NULL DEFAULT 0,
  delivery_fee NUMERIC NOT NULL DEFAULT 0,
  discount_amount NUMERIC NOT NULL DEFAULT 0,
  discount_code TEXT,
  total NUMERIC NOT NULL DEFAULT 0,
  delivery_method TEXT NOT NULL DEFAULT 'standard',
  delivery_zone TEXT,
  scheduled_date TEXT,
  scheduled_slot TEXT,
  estimated_delivery TEXT,
  delivery_address JSONB NOT NULL DEFAULT '{}'::jsonb,
  payment_method TEXT NOT NULL DEFAULT 'card',
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_reference TEXT,
  customer_notes TEXT,
  delivery_instructions TEXT,
  assigned_warehouse_id UUID,
  assigned_driver_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- Order items
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  barcode TEXT,
  is_scanned BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  weight_kg NUMERIC(10, 2),
  volume_m3 NUMERIC(10, 4),
  is_grouped BOOLEAN DEFAULT FALSE,
  group_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Order status history (audit trail)
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. WAREHOUSE SYSTEM
-- ============================================================================

-- Warehouse tasks
CREATE TABLE IF NOT EXISTS public.warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL DEFAULT 'pick' CHECK (task_type IN ('pick', 'pack', 'dispatch')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. DRIVER SYSTEM
-- ============================================================================

-- Driver profiles
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
  rating NUMERIC(3, 2) DEFAULT 5.0,
  total_deliveries INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Driver vehicles
CREATE TABLE IF NOT EXISTS public.driver_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES public.driver_profiles(id) ON DELETE CASCADE,
  vehicle_photo_url TEXT,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('scooter', 'car', 'bakkie', 'small_truck', 'medium_truck', 'large_truck')),
  license_plate TEXT NOT NULL,
  make_model TEXT NOT NULL,
  capacity_kg INTEGER,
  capacity_m3 NUMERIC(10, 2),
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(driver_id),
  UNIQUE(license_plate)
);

-- Driver assignments (replaces old driver_assignments)
CREATE TABLE IF NOT EXISTS public.delivery_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
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
  accepted_at TIMESTAMPTZ,
  pickup_verified_at TIMESTAMPTZ,
  delivery_started_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  delivery_photo_url TEXT,
  recipient_name TEXT,
  delivery_notes TEXT,
  current_location JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Delivery tracking (GPS breadcrumbs)
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL REFERENCES public.delivery_assignments(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Package groups (for grouped scanning)
CREATE TABLE IF NOT EXISTS public.package_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  group_name TEXT NOT NULL,
  group_barcode TEXT UNIQUE NOT NULL,
  total_items INTEGER NOT NULL DEFAULT 0,
  total_weight_kg NUMERIC(10, 2),
  total_volume_m3 NUMERIC(10, 4),
  is_scanned BOOLEAN DEFAULT FALSE,
  scanned_at TIMESTAMPTZ,
  scanned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 8. NOTIFICATIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 9. STORAGE BUCKETS
-- ============================================================================

-- Product images bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images', 
  'product-images', 
  true, 
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Driver documents bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'driver-documents', 
  'driver-documents', 
  true,
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

-- ============================================================================
-- 10. HELPER FUNCTIONS
-- ============================================================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Get primary role for a user (returns first role alphabetically if multiple)
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id ORDER BY role LIMIT 1
$$;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  
  -- Assign default customer role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'customer');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'profiles', 'orders', 'warehouse_tasks', 'driver_profiles', 
      'driver_vehicles', 'delivery_assignments', 'product_reviews'
    ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('
      CREATE TRIGGER update_%I_updated_at
        BEFORE UPDATE ON public.%I
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.package_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
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

-- PROFILES POLICIES
CREATE POLICY "Users can read own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can read all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- USER ROLES POLICIES
CREATE POLICY "Users can read own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can insert roles" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete roles" ON public.user_roles FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCTS POLICIES
CREATE POLICY "Anyone can read products" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins can insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update products" ON public.products FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete products" ON public.products FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- PRODUCT REVIEWS POLICIES
CREATE POLICY "Anyone can read reviews" ON public.product_reviews FOR SELECT USING (true);
CREATE POLICY "Users can insert own reviews" ON public.product_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own reviews" ON public.product_reviews FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own reviews" ON public.product_reviews FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CUSTOMER ADDRESSES POLICIES
CREATE POLICY "Users can manage own addresses" ON public.customer_addresses FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ORDERS POLICIES
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Staff can read all orders" ON public.orders FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse') OR 
  public.has_role(auth.uid(), 'driver')
);
CREATE POLICY "Staff can update orders" ON public.orders FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse') OR 
  public.has_role(auth.uid(), 'driver')
);

-- ORDER ITEMS POLICIES
CREATE POLICY "Users can read items from own orders" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Staff can read all order items" ON public.order_items FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse') OR 
  public.has_role(auth.uid(), 'driver')
);
CREATE POLICY "Staff can update order items" ON public.order_items FOR UPDATE TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse') OR 
  public.has_role(auth.uid(), 'driver')
);

-- WAREHOUSE TASKS POLICIES
CREATE POLICY "Warehouse staff can manage tasks" ON public.warehouse_tasks FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse')
);

-- DRIVER PROFILES POLICIES
CREATE POLICY "Drivers can read own profile" ON public.driver_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Drivers can update own profile" ON public.driver_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Drivers can insert own profile" ON public.driver_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all driver profiles" ON public.driver_profiles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DRIVER VEHICLES POLICIES
CREATE POLICY "Drivers can manage own vehicle" ON public.driver_vehicles FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_profiles WHERE driver_profiles.id = driver_vehicles.driver_id AND driver_profiles.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all vehicles" ON public.driver_vehicles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DELIVERY ASSIGNMENTS POLICIES
CREATE POLICY "Drivers can read own assignments" ON public.delivery_assignments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_profiles WHERE driver_profiles.id = delivery_assignments.driver_id AND driver_profiles.user_id = auth.uid())
);
CREATE POLICY "Drivers can update own assignments" ON public.delivery_assignments FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.driver_profiles WHERE driver_profiles.id = delivery_assignments.driver_id AND driver_profiles.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all assignments" ON public.delivery_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- DELIVERY TRACKING POLICIES
CREATE POLICY "Drivers can insert tracking" ON public.delivery_tracking FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.driver_profiles dp ON da.driver_id = dp.id
    WHERE da.id = delivery_tracking.assignment_id AND dp.user_id = auth.uid()
  )
);
CREATE POLICY "Admins and customers can read tracking" ON public.delivery_tracking FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR
  EXISTS (
    SELECT 1 FROM public.delivery_assignments da
    JOIN public.orders o ON da.order_id = o.id
    WHERE da.id = delivery_tracking.assignment_id AND o.user_id = auth.uid()
  )
);

-- NOTIFICATIONS POLICIES
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- PACKAGE GROUPS POLICIES
CREATE POLICY "Staff can manage package groups" ON public.package_groups FOR ALL TO authenticated USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'warehouse') OR 
  public.has_role(auth.uid(), 'driver')
);

-- ============================================================================
-- 12. STORAGE POLICIES
-- ============================================================================

-- Product images storage policies
CREATE POLICY "Anyone can view product images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "Admins can upload product images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can update product images" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Admins can delete product images" ON storage.objects FOR DELETE TO authenticated USING (
  bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin')
);

-- Driver documents storage policies
CREATE POLICY "Anyone can view driver documents" ON storage.objects FOR SELECT USING (bucket_id = 'driver-documents');
CREATE POLICY "Drivers can upload own documents" ON storage.objects FOR INSERT TO authenticated WITH CHECK (
  bucket_id = 'driver-documents' AND (
    public.has_role(auth.uid(), 'driver') OR 
    public.has_role(auth.uid(), 'admin')
  )
);
CREATE POLICY "Drivers can update own documents" ON storage.objects FOR UPDATE TO authenticated USING (
  bucket_id = 'driver-documents' AND (
    public.has_role(auth.uid(), 'driver') OR 
    public.has_role(auth.uid(), 'admin')
  )
);

-- ============================================================================
-- 13. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category);
CREATE INDEX IF NOT EXISTS idx_products_in_stock ON public.products(in_stock) WHERE in_stock = true;
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_id ON public.delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON public.delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_status ON public.delivery_assignments(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read) WHERE is_read = false;

-- ============================================================================
-- SETUP COMPLETE!
-- ============================================================================
-- Your database is now fully configured with:
-- ✅ User authentication & roles
-- ✅ Products catalog
-- ✅ Orders & order items
-- ✅ Warehouse management
-- ✅ Driver profiles & vehicles
-- ✅ Delivery assignments & tracking
-- ✅ Notifications system
-- ✅ Storage buckets (product-images, driver-documents)
-- ✅ RLS policies for security
-- ✅ Performance indexes
-- ============================================================================
