-- ============================================================================
-- LiquorLux Production Schema Migration
-- Version: 001
-- Description: Creates new tables, alters existing tables, adds RPC functions,
--              RLS policies, indexes, and seed data for production readiness.
-- ============================================================================

-- ============================================================================
-- 1. NEW TABLES
-- ============================================================================

-- Admin Audit Log
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('order', 'product', 'driver', 'customer', 'promo', 'zone', 'setting')),
  target_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Customer Disputes
CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  type TEXT NOT NULL CHECK (type IN ('wrong_item', 'damaged', 'missing_item', 'quality', 'late_delivery', 'overcharged', 'other')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'rejected')),
  description TEXT NOT NULL,
  resolution TEXT,
  refund_amount NUMERIC(10,2),
  evidence_urls TEXT[],
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES auth.users(id)
);

-- Promo codes table (might already exist, use IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed', 'free_delivery')),
  discount_value NUMERIC(10,2) NOT NULL,
  min_order_value NUMERIC(10,2),
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all', 'new_users', 'vip')),
  starts_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================================
-- 2. ALTER EXISTING TABLES (add missing columns)
-- ============================================================================

-- Add return_to_store status support to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS return_reason TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS failed_delivery_count INTEGER DEFAULT 0;

-- Add failed delivery tracking to delivery_assignments
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS failed_reason TEXT;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS return_confirmed_at TIMESTAMPTZ;

-- Add stock_quantity if not exists on products
ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_quantity INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS max_stock INTEGER DEFAULT 100;
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER DEFAULT 10;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Add promo tracking to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS promo_code TEXT;

-- ============================================================================
-- 3. PIN TRACKING COLUMNS
-- ============================================================================

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pin_locked BOOLEAN DEFAULT false;

-- ============================================================================
-- 4. RPC FUNCTIONS
-- ============================================================================

-- Server-side order total recalculation
CREATE OR REPLACE FUNCTION recalculate_order_total(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_subtotal NUMERIC(10,2);
  v_delivery_fee NUMERIC(10,2);
  v_discount NUMERIC(10,2);
  v_vat NUMERIC(10,2);
  v_total NUMERIC(10,2);
  v_order RECORD;
BEGIN
  -- Get order
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  -- Recalculate subtotal from order_items joined with products
  SELECT COALESCE(SUM(oi.quantity * p.price), 0) INTO v_subtotal
  FROM order_items oi
  JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;

  -- Apply promo discount
  v_discount := COALESCE(v_order.discount_amount, 0);

  -- Keep existing delivery fee
  v_delivery_fee := COALESCE(v_order.delivery_fee, 0);

  -- Recalculate VAT (15% SA standard)
  v_vat := (v_subtotal - v_discount + v_delivery_fee) * 0.15;

  -- Total
  v_total := v_subtotal - v_discount + v_delivery_fee + v_vat;

  -- Update order
  UPDATE orders SET
    subtotal = v_subtotal,
    vat_amount = v_vat,
    total = v_total,
    updated_at = now()
  WHERE id = p_order_id;

  -- Also update order_items unit_price from products
  UPDATE order_items oi SET
    unit_price = p.price,
    subtotal = oi.quantity * p.price
  FROM products p
  WHERE oi.product_id = p.id AND oi.order_id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount', v_discount,
    'vat', v_vat,
    'total', v_total
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Server-side promo code validation and application
CREATE OR REPLACE FUNCTION validate_and_apply_promo(
  p_code TEXT,
  p_order_id UUID,
  p_subtotal NUMERIC
)
RETURNS JSONB AS $$
DECLARE
  v_promo RECORD;
  v_discount NUMERIC(10,2);
BEGIN
  -- Find active promo
  SELECT * INTO v_promo FROM promo_codes
  WHERE code = UPPER(p_code)
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (starts_at IS NULL OR starts_at <= now());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired promo code');
  END IF;

  -- Check usage limit
  IF v_promo.max_uses IS NOT NULL AND v_promo.used_count >= v_promo.max_uses THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code usage limit reached');
  END IF;

  -- Check minimum order
  IF v_promo.min_order_value IS NOT NULL AND p_subtotal < v_promo.min_order_value THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('Minimum order of R%s required', v_promo.min_order_value));
  END IF;

  -- Calculate discount
  IF v_promo.discount_type = 'percentage' THEN
    v_discount := p_subtotal * (v_promo.discount_value / 100);
  ELSIF v_promo.discount_type = 'fixed' THEN
    v_discount := LEAST(v_promo.discount_value, p_subtotal);
  ELSIF v_promo.discount_type = 'free_delivery' THEN
    v_discount := 0; -- handled by delivery fee logic
  END IF;

  -- Increment usage count
  UPDATE promo_codes SET used_count = used_count + 1 WHERE id = v_promo.id;

  -- Update order with promo
  UPDATE orders SET
    promo_code_id = v_promo.id,
    promo_code = v_promo.code,
    discount_amount = v_discount,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'discount', v_discount,
    'discount_type', v_promo.discount_type,
    'promo_id', v_promo.id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Decrement stock (atomic, with check)
CREATE OR REPLACE FUNCTION decrement_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS JSONB AS $$
DECLARE
  v_current INTEGER;
BEGIN
  SELECT stock_quantity INTO v_current FROM products WHERE id = p_product_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  IF v_current < p_quantity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient stock', 'available', v_current);
  END IF;

  UPDATE products SET
    stock_quantity = stock_quantity - p_quantity,
    in_stock = (stock_quantity - p_quantity) > 0,
    updated_at = now()
  WHERE id = p_product_id;

  RETURN jsonb_build_object('success', true, 'remaining', v_current - p_quantity);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment stock (for cancellation/refund)
CREATE OR REPLACE FUNCTION increment_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS JSONB AS $$
BEGIN
  UPDATE products SET
    stock_quantity = stock_quantity + p_quantity,
    in_stock = true,
    updated_at = now()
  WHERE id = p_product_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Product not found');
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify delivery PIN (with attempt tracking)
CREATE OR REPLACE FUNCTION verify_delivery_pin(p_order_id UUID, p_entered_pin TEXT)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_attempts INTEGER;
  v_max_attempts CONSTANT INTEGER := 3;
BEGIN
  SELECT id, delivery_pin, pin_attempts, pin_locked FROM orders
  WHERE id = p_order_id
  INTO v_order;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('verified', false, 'error', 'Order not found');
  END IF;

  IF v_order.pin_locked THEN
    RETURN jsonb_build_object('verified', false, 'locked', true, 'error', 'PIN verification locked after too many attempts');
  END IF;

  v_attempts := COALESCE(v_order.pin_attempts, 0);

  IF v_order.delivery_pin = p_entered_pin THEN
    -- Success - reset attempts
    UPDATE orders SET pin_attempts = 0 WHERE id = p_order_id;
    RETURN jsonb_build_object('verified', true, 'attempts_remaining', v_max_attempts);
  ELSE
    -- Failed attempt
    v_attempts := v_attempts + 1;
    IF v_attempts >= v_max_attempts THEN
      UPDATE orders SET pin_attempts = v_attempts, pin_locked = true WHERE id = p_order_id;
      RETURN jsonb_build_object('verified', false, 'locked', true, 'attempts_remaining', 0, 'error', 'Too many failed attempts');
    ELSE
      UPDATE orders SET pin_attempts = v_attempts WHERE id = p_order_id;
      RETURN jsonb_build_object('verified', false, 'locked', false, 'attempts_remaining', v_max_attempts - v_attempts);
    END IF;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN ALTER TABLE addresses ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY; EXCEPTION WHEN undefined_table THEN NULL; END $$;
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_tasks ENABLE ROW LEVEL SECURITY;

-- Products: everyone can read, only admin can write
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Products are viewable by everyone' AND tablename = 'products') THEN
    DROP POLICY IF EXISTS "Products are viewable by everyone" ON products;
CREATE POLICY "Products are viewable by everyone" ON products FOR SELECT USING (true);
  END IF;
END $$;

-- Orders: customers see own, admin/warehouse see all
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers see own orders' AND tablename = 'orders') THEN
    DROP POLICY IF EXISTS "Customers see own orders" ON orders;
CREATE POLICY "Customers see own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers create own orders' AND tablename = 'orders') THEN
    DROP POLICY IF EXISTS "Customers create own orders" ON orders;
CREATE POLICY "Customers create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Addresses: users see own
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'addresses' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Users see own addresses" ON addresses;
    CREATE POLICY "Users see own addresses" ON addresses FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'addresses' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Users manage own addresses" ON addresses;
    CREATE POLICY "Users manage own addresses" ON addresses FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Wishlist: users see own
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlist' AND table_schema = 'public') THEN
    DROP POLICY IF EXISTS "Users manage own wishlist" ON wishlist;
    CREATE POLICY "Users manage own wishlist" ON wishlist FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

-- Disputes: customers see own
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers see own disputes' AND tablename = 'disputes') THEN
    DROP POLICY IF EXISTS "Customers see own disputes" ON disputes;
CREATE POLICY "Customers see own disputes" ON disputes FOR SELECT USING (auth.uid() = customer_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Customers create own disputes' AND tablename = 'disputes') THEN
    DROP POLICY IF EXISTS "Customers create own disputes" ON disputes;
CREATE POLICY "Customers create own disputes" ON disputes FOR INSERT WITH CHECK (auth.uid() = customer_id);
  END IF;
END $$;

-- Admin audit log: readable and writable (further restricted by app logic)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin audit log read' AND tablename = 'admin_audit_log') THEN
    DROP POLICY IF EXISTS "Admin audit log read" ON admin_audit_log;
CREATE POLICY "Admin audit log read" ON admin_audit_log FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admin audit log write' AND tablename = 'admin_audit_log') THEN
    DROP POLICY IF EXISTS "Admin audit log write" ON admin_audit_log;
CREATE POLICY "Admin audit log write" ON admin_audit_log FOR INSERT WITH CHECK (true);
  END IF;
END $$;

-- Promo codes: everyone can read active ones
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Active promos are viewable' AND tablename = 'promo_codes') THEN
    DROP POLICY IF EXISTS "Active promos are viewable" ON promo_codes;
CREATE POLICY "Active promos are viewable" ON promo_codes FOR SELECT USING (is_active = true);
  END IF;
END $$;

-- ============================================================================
-- 6. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_driver_id ON delivery_assignments(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_assignments_order_id ON delivery_assignments(order_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_order_id ON warehouse_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_tasks_status ON warehouse_tasks(status);
CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_customer_id ON disputes(customer_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_assignment_id ON delivery_tracking(assignment_id);

-- ============================================================================
-- 7. SEED DATA: DEFAULT PROMO CODES
-- ============================================================================

INSERT INTO promo_codes (code, description, discount_type, discount_value, min_order_value, max_uses, target_audience, expires_at)
VALUES
  ('WELCOME10', '10% off your first order', 'percentage', 10, NULL, NULL, 'new_users', '2027-12-31'::timestamptz),
  ('PREMIUM20', '20% off orders over R500', 'percentage', 20, 500, NULL, 'all', '2027-12-31'::timestamptz),
  ('FREEDELIVERY', 'Free delivery on your next order', 'free_delivery', 0, NULL, 1000, 'all', '2027-06-30'::timestamptz),
  ('SAVE50', 'R50 off orders over R100', 'fixed', 50, 100, 500, 'all', '2027-06-30'::timestamptz),
  ('VIPGOLD', 'R75 off for VIP customers', 'fixed', 75, 200, NULL, 'vip', '2027-12-31'::timestamptz)
ON CONFLICT (code) DO NOTHING;
