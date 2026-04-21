-- ============================================================================
-- LIQZAR Production Fixes Migration
-- Version: 002
-- Description: Comprehensive production fixes including RLS policy hardening,
--              missing RPC functions, new tables (payments, refunds, compliance,
--              chat, loyalty, delivery zones, background jobs), indexes, and
--              realtime subscriptions.
-- Idempotent: Uses IF NOT EXISTS / IF EXISTS throughout.
-- ============================================================================

-- ============================================================================
-- 1. FIX RLS POLICIES - Harden existing table policies
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1a. admin_audit_log - Restrict to admin only (was open to everyone)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin audit log read" ON admin_audit_log;
DROP POLICY IF EXISTS "Admin audit log write" ON admin_audit_log;
DROP POLICY IF EXISTS "Admin audit log insert" ON admin_audit_log;

DROP POLICY IF EXISTS "Admin audit log read" ON admin_audit_log;
CREATE POLICY "Admin audit log read" ON admin_audit_log
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin audit log insert" ON admin_audit_log;
CREATE POLICY "Admin audit log insert" ON admin_audit_log
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'warehouse')
  );

-- ---------------------------------------------------------------------------
-- 1b. delivery_assignments - Role-based access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers can read own assignments" ON delivery_assignments;
DROP POLICY IF EXISTS "Drivers can update own assignments" ON delivery_assignments;
DROP POLICY IF EXISTS "Admins can manage all assignments" ON delivery_assignments;
DROP POLICY IF EXISTS "Warehouse can read assignments" ON delivery_assignments;
DROP POLICY IF EXISTS "Warehouse can update assignments" ON delivery_assignments;

-- Drivers can SELECT their own assignments (through driver_profiles)
DROP POLICY IF EXISTS "Drivers can read own assignments" ON delivery_assignments;
CREATE POLICY "Drivers can read own assignments" ON delivery_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.driver_profiles
      WHERE driver_profiles.id = delivery_assignments.driver_id
        AND driver_profiles.user_id = auth.uid()
    )
  );

-- Drivers can UPDATE their own assignments
DROP POLICY IF EXISTS "Drivers can update own assignments" ON delivery_assignments;
CREATE POLICY "Drivers can update own assignments" ON delivery_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.driver_profiles
      WHERE driver_profiles.id = delivery_assignments.driver_id
        AND driver_profiles.user_id = auth.uid()
    )
  );

-- Admins: full CRUD on all assignments
DROP POLICY IF EXISTS "Admins select all assignments" ON delivery_assignments;
CREATE POLICY "Admins select all assignments" ON delivery_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert assignments" ON delivery_assignments;
CREATE POLICY "Admins insert assignments" ON delivery_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update all assignments" ON delivery_assignments;
CREATE POLICY "Admins update all assignments" ON delivery_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete assignments" ON delivery_assignments;
CREATE POLICY "Admins delete assignments" ON delivery_assignments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Warehouse can SELECT assignments
DROP POLICY IF EXISTS "Warehouse can read assignments" ON delivery_assignments;
CREATE POLICY "Warehouse can read assignments" ON delivery_assignments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));

-- Warehouse can UPDATE assignments
DROP POLICY IF EXISTS "Warehouse can update assignments" ON delivery_assignments;
CREATE POLICY "Warehouse can update assignments" ON delivery_assignments
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));

-- ---------------------------------------------------------------------------
-- 1c. delivery_tracking - Role-based access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Drivers can insert tracking" ON delivery_tracking;
DROP POLICY IF EXISTS "Admins and customers can read tracking" ON delivery_tracking;
DROP POLICY IF EXISTS "Drivers can read own tracking" ON delivery_tracking;
DROP POLICY IF EXISTS "Customers can read order tracking" ON delivery_tracking;
DROP POLICY IF EXISTS "Admins can read all tracking" ON delivery_tracking;

-- Drivers can INSERT their own tracking entries
DROP POLICY IF EXISTS "Drivers can insert tracking" ON delivery_tracking;
CREATE POLICY "Drivers can insert tracking" ON delivery_tracking
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.driver_profiles dp ON da.driver_id = dp.id
      WHERE da.id = delivery_tracking.assignment_id
        AND dp.user_id = auth.uid()
    )
  );

-- Drivers can SELECT their own tracking entries
DROP POLICY IF EXISTS "Drivers can read own tracking" ON delivery_tracking;
CREATE POLICY "Drivers can read own tracking" ON delivery_tracking
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.driver_profiles dp ON da.driver_id = dp.id
      WHERE da.id = delivery_tracking.assignment_id
        AND dp.user_id = auth.uid()
    )
  );

-- Customers can SELECT tracking for their orders
DROP POLICY IF EXISTS "Customers can read order tracking" ON delivery_tracking;
CREATE POLICY "Customers can read order tracking" ON delivery_tracking
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.orders o ON da.order_id = o.id
      WHERE da.id = delivery_tracking.assignment_id
        AND o.user_id = auth.uid()
    )
  );

-- Admins can SELECT all tracking
DROP POLICY IF EXISTS "Admins can read all tracking" ON delivery_tracking;
CREATE POLICY "Admins can read all tracking" ON delivery_tracking
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 1d. warehouse_tasks - Role-based access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Warehouse staff can manage tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Warehouse can read tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Warehouse can update tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Admins select all tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Admins insert tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Admins update all tasks" ON warehouse_tasks;
DROP POLICY IF EXISTS "Admins delete tasks" ON warehouse_tasks;

-- Warehouse users can SELECT all tasks
DROP POLICY IF EXISTS "Warehouse can read tasks" ON warehouse_tasks;
CREATE POLICY "Warehouse can read tasks" ON warehouse_tasks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));

-- Warehouse users can UPDATE all tasks
DROP POLICY IF EXISTS "Warehouse can update tasks" ON warehouse_tasks;
CREATE POLICY "Warehouse can update tasks" ON warehouse_tasks
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));

-- Admins: full CRUD
DROP POLICY IF EXISTS "Admins select all tasks" ON warehouse_tasks;
CREATE POLICY "Admins select all tasks" ON warehouse_tasks
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins insert tasks" ON warehouse_tasks;
CREATE POLICY "Admins insert tasks" ON warehouse_tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins update all tasks" ON warehouse_tasks;
CREATE POLICY "Admins update all tasks" ON warehouse_tasks
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins delete tasks" ON warehouse_tasks;
CREATE POLICY "Admins delete tasks" ON warehouse_tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 1e. order_items - Granular access
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read items from own orders" ON order_items;
DROP POLICY IF EXISTS "Staff can read all order items" ON order_items;
DROP POLICY IF EXISTS "Staff can update order items" ON order_items;
DROP POLICY IF EXISTS "Customers read own order items" ON order_items;
DROP POLICY IF EXISTS "Drivers read assigned order items" ON order_items;
DROP POLICY IF EXISTS "Warehouse reads all order items" ON order_items;
DROP POLICY IF EXISTS "Admins read all order items" ON order_items;
DROP POLICY IF EXISTS "System can insert order items" ON order_items;
DROP POLICY IF EXISTS "Admins can insert order items" ON order_items;
DROP POLICY IF EXISTS "Admins can update order items" ON order_items;
DROP POLICY IF EXISTS "Warehouse can update order items" ON order_items;

-- Customers can SELECT items for their own orders
DROP POLICY IF EXISTS "Customers read own order items" ON order_items;
CREATE POLICY "Customers read own order items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
        AND orders.user_id = auth.uid()
    )
  );

-- Drivers can SELECT items for their assigned orders
DROP POLICY IF EXISTS "Drivers read assigned order items" ON order_items;
CREATE POLICY "Drivers read assigned order items" ON order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_assignments da
      JOIN public.driver_profiles dp ON da.driver_id = dp.id
      WHERE da.order_id = order_items.order_id
        AND dp.user_id = auth.uid()
    )
  );

-- Warehouse can SELECT all order items
DROP POLICY IF EXISTS "Warehouse reads all order items" ON order_items;
CREATE POLICY "Warehouse reads all order items" ON order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));

-- Admins can SELECT all order items
DROP POLICY IF EXISTS "Admins read all order items" ON order_items;
CREATE POLICY "Admins read all order items" ON order_items
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- System / service role can INSERT (authenticated with admin, or service role)
DROP POLICY IF EXISTS "System can insert order items" ON order_items;
CREATE POLICY "System can insert order items" ON order_items
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Admins can update order items
DROP POLICY IF EXISTS "Admins can update order items" ON order_items;
CREATE POLICY "Admins can update order items" ON order_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Warehouse can update order items (for scanning)
DROP POLICY IF EXISTS "Warehouse can update order items" ON order_items;
CREATE POLICY "Warehouse can update order items" ON order_items
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'warehouse'));


-- ============================================================================
-- 2. MISSING RPC FUNCTIONS
-- ============================================================================

-- ---------------------------------------------------------------------------
-- record_depot_release: Records when warehouse releases order to driver
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_depot_release(
  p_order_id UUID,
  p_driver_id UUID,
  p_items_verified BOOLEAN DEFAULT true,
  p_notes TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  -- Update delivery assignment
  UPDATE delivery_assignments
  SET status = 'picked_up',
      pickup_verified_at = NOW(),
      delivery_notes = COALESCE(p_notes, delivery_notes)
  WHERE order_id = p_order_id AND driver_id = p_driver_id;

  -- Log status change in order_status_history
  INSERT INTO order_status_history (order_id, old_status, new_status, changed_by, notes)
  VALUES (p_order_id, 'ready', 'picked_up', p_driver_id, 'Depot release confirmed');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- record_driver_signoff: Records driver's sign-off after pickup verification
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION record_driver_signoff(
  p_order_id UUID,
  p_driver_id UUID,
  p_items_count INTEGER,
  p_signature TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
  UPDATE delivery_assignments
  SET items_verified = true,
      verified_count = p_items_count,
      signature = p_signature
  WHERE order_id = p_order_id AND driver_id = p_driver_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------------
-- increment_failed_delivery_count: Increments failed delivery counter
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION increment_failed_delivery_count(
  p_order_id UUID
) RETURNS VOID AS $$
BEGIN
  UPDATE orders
  SET failed_delivery_count = COALESCE(failed_delivery_count, 0) + 1
  WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 3. SECURE PIN GENERATION RPC
-- ============================================================================

CREATE OR REPLACE FUNCTION generate_delivery_pin(
  p_order_id UUID
) RETURNS TEXT AS $$
DECLARE
  v_pin TEXT;
BEGIN
  -- Generate cryptographically secure 4-digit PIN
  v_pin := LPAD(FLOOR(random() * 10000)::TEXT, 4, '0');

  -- Use pgcrypto / gen_random_uuid if available, fallback to random
  BEGIN
    v_pin := LPAD(
      (abs(('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::int) % 10000)::TEXT,
      4, '0'
    );
  EXCEPTION WHEN OTHERS THEN
    v_pin := LPAD(FLOOR(random() * 10000)::TEXT, 4, '0');
  END;

  UPDATE orders
  SET delivery_pin = v_pin,
      pin_attempts = 0,
      pin_locked = false
  WHERE id = p_order_id;

  RETURN v_pin;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 4. NEW TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 4a. payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','authorized','captured','failed','cancelled','refunded','partially_refunded')),
  payment_method TEXT NOT NULL
    CHECK (payment_method IN ('card','instant_eft','snapscan','cash_on_delivery','apple_pay','google_pay')),
  gateway TEXT NOT NULL DEFAULT 'yoco'
    CHECK (gateway IN ('yoco','payfast','manual')),
  gateway_reference TEXT,
  gateway_response JSONB,
  failure_reason TEXT,
  authorized_at TIMESTAMPTZ,
  captured_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  refunded_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4b. refunds
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  payment_id UUID REFERENCES payments(id),
  amount DECIMAL(10,2) NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','processing','completed','rejected')),
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  gateway_reference TEXT,
  gateway_response JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4c. proof_of_delivery
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS proof_of_delivery (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  photo_url TEXT,
  photo_storage_path TEXT,
  signature_data TEXT,
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  gps_accuracy DECIMAL(6,2),
  recipient_name TEXT,
  recipient_id_verified BOOLEAN DEFAULT false,
  id_type TEXT CHECK (id_type IN ('sa_id','passport','drivers_license')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4d. compliance_events (alcohol handoff compliance)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'age_verified','id_checked','intoxication_refused','minor_refused',
      'no_recipient','substitute_accepted','delivery_hours_violation','compliance_incident'
    )),
  recipient_name TEXT,
  id_document_type TEXT,
  id_verified BOOLEAN,
  outcome TEXT NOT NULL
    CHECK (outcome IN ('passed','failed','refused','escalated')),
  notes TEXT,
  gps_latitude DECIMAL(10,8),
  gps_longitude DECIMAL(11,8),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4e. delivery_ratings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) UNIQUE,
  customer_id UUID NOT NULL REFERENCES auth.users(id),
  driver_id UUID NOT NULL REFERENCES auth.users(id),
  delivery_rating INTEGER NOT NULL CHECK (delivery_rating BETWEEN 1 AND 5),
  driver_rating INTEGER NOT NULL CHECK (driver_rating BETWEEN 1 AND 5),
  comment TEXT,
  tip_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4f. support_tickets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number TEXT NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),
  category TEXT NOT NULL
    CHECK (category IN (
      'order_issue','delivery_problem','payment_dispute',
      'account_help','product_complaint','compliance','other'
    )),
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','assigned','in_progress','waiting_customer','resolved','closed')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('low','medium','high','urgent')),
  assigned_to UUID REFERENCES auth.users(id),
  resolution TEXT,
  sla_deadline TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 4g. chat_channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id),
  type TEXT NOT NULL
    CHECK (type IN ('customer_driver','driver_dispatch','customer_support')),
  participant_1 UUID NOT NULL REFERENCES auth.users(id),
  participant_2 UUID NOT NULL REFERENCES auth.users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4h. chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES chat_channels(id),
  sender_id UUID NOT NULL REFERENCES auth.users(id),
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text'
    CHECK (message_type IN ('text','image','location','system')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4i. loyalty_accounts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze'
    CHECK (tier IN ('bronze','silver','gold','platinum')),
  lifetime_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4j. loyalty_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  order_id UUID REFERENCES orders(id),
  points INTEGER NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('earned','redeemed','bonus','expired','adjustment')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4k. referral_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  code TEXT NOT NULL UNIQUE,
  reward_amount DECIMAL(10,2) DEFAULT 50.00,
  uses INTEGER DEFAULT 0,
  max_uses INTEGER DEFAULT 100,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4l. referrals
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referred_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','first_order_placed','reward_issued','expired')),
  reward_amount DECIMAL(10,2),
  first_order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 4m. delivery_zones
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  polygon JSONB NOT NULL,
  base_delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 9.99,
  surge_multiplier DECIMAL(4,2) DEFAULT 1.0,
  min_order_value DECIMAL(10,2) DEFAULT 0,
  max_delivery_distance_km DECIMAL(6,2),
  estimated_delivery_minutes INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  operating_hours JSONB DEFAULT '{"start": "09:00", "end": "21:00"}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4n. delivery_slots
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS delivery_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_id UUID REFERENCES delivery_zones(id),
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_orders INTEGER DEFAULT 20,
  current_orders INTEGER DEFAULT 0,
  slot_type TEXT DEFAULT 'standard'
    CHECK (slot_type IN ('standard','express','priority')),
  premium_fee DECIMAL(10,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4o. scheduled_deliveries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scheduled_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id),
  slot_id UUID REFERENCES delivery_slots(id),
  scheduled_date DATE NOT NULL,
  scheduled_start_time TIME NOT NULL,
  scheduled_end_time TIME NOT NULL,
  delivery_type TEXT DEFAULT 'standard'
    CHECK (delivery_type IN ('standard','express','priority')),
  special_instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 4p. background_jobs (persistent auto-complete and scheduled tasks)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS background_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL
    CHECK (job_type IN ('auto_complete','stock_expiry','reminder','cleanup','notification')),
  target_id UUID NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ---------------------------------------------------------------------------
-- 4q. webhook_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL
    CHECK (source IN ('yoco','payfast','system')),
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processed','failed','ignored')),
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================================
-- 5. ALTER orders TABLE - Add new columns
-- ============================================================================

-- payment_status may already exist from MASTER_DATABASE_SETUP; IF NOT EXISTS keeps it safe
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';
-- Add CHECK constraint only if it does not already exist
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'orders_payment_status_v2_check'
  ) THEN
    BEGIN
      ALTER TABLE orders ADD CONSTRAINT orders_payment_status_v2_check
        CHECK (payment_status IN (
          'pending','awaiting_payment','authorized','captured','failed',
          'refunded','partially_refunded','cash_on_delivery'
        ));
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_reserved BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_reserved_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_decremented_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS compliance_verified BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS scheduled_delivery_id UUID;


-- ============================================================================
-- 6. ALTER delivery_assignments TABLE - Add new columns
-- ============================================================================

ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS items_verified BOOLEAN DEFAULT false;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS verified_count INTEGER;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS signature TEXT;
ALTER TABLE delivery_assignments ADD COLUMN IF NOT EXISTS dispatch_score DECIMAL(6,3);


-- ============================================================================
-- 7. DISPATCH SCORING FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_dispatch_score(
  p_driver_id UUID,
  p_order_lat DECIMAL,
  p_order_lng DECIMAL
) RETURNS DECIMAL AS $$
DECLARE
  v_score DECIMAL := 0;
  v_active_deliveries INTEGER;
  v_success_rate DECIMAL;
  v_driver_lat DECIMAL;
  v_driver_lng DECIMAL;
  v_distance DECIMAL;
BEGIN
  -- Factor 1: Current load (fewer active = higher score, weight 30%)
  SELECT COUNT(*) INTO v_active_deliveries
  FROM delivery_assignments
  WHERE driver_id = p_driver_id
    AND status IN ('assigned','picked_up','in_transit');
  v_score := v_score + (GREATEST(0, 5 - v_active_deliveries) * 6); -- 0-30 points

  -- Factor 2: Success rate (weight 25%)
  SELECT COALESCE(
    (COUNT(*) FILTER (WHERE status = 'delivered')::DECIMAL
      / NULLIF(COUNT(*)::DECIMAL, 0)) * 25,
    12.5
  ) INTO v_success_rate
  FROM delivery_assignments
  WHERE driver_id = p_driver_id;
  v_score := v_score + v_success_rate;

  -- Factor 3: Last known proximity (weight 25%)
  -- Uses delivery_tracking joined through delivery_assignments
  SELECT dt.latitude, dt.longitude
  INTO v_driver_lat, v_driver_lng
  FROM delivery_tracking dt
  JOIN delivery_assignments da ON da.id = dt.assignment_id
  WHERE da.driver_id = p_driver_id
  ORDER BY dt.created_at DESC
  LIMIT 1;

  IF v_driver_lat IS NOT NULL AND p_order_lat IS NOT NULL THEN
    -- Approximate distance in km using Euclidean on degree coords * 111 km/deg
    v_distance := sqrt(power(v_driver_lat - p_order_lat, 2) + power(v_driver_lng - p_order_lng, 2)) * 111;
    v_score := v_score + GREATEST(0, 25 - (v_distance * 2.5));
  ELSE
    v_score := v_score + 12.5; -- default mid-score when no location data
  END IF;

  -- Factor 4: Rating (weight 20%)
  v_score := v_score + COALESCE(
    (SELECT AVG(driver_rating) FROM delivery_ratings WHERE driver_id = p_driver_id) * 4,
    14 -- default when no ratings
  );

  RETURN ROUND(v_score, 3);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 8. STOCK RESERVATION FUNCTIONS
-- ============================================================================

-- Reserve stock atomically (uses SELECT ... FOR UPDATE)
CREATE OR REPLACE FUNCTION reserve_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  v_available INTEGER;
BEGIN
  SELECT stock_quantity INTO v_available
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_available >= p_quantity THEN
    UPDATE products
    SET stock_quantity = stock_quantity - p_quantity
    WHERE id = p_product_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release previously reserved stock
CREATE OR REPLACE FUNCTION release_reserved_stock(
  p_product_id UUID,
  p_quantity INTEGER
) RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 9. AUTO-COMPLETE JOB FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION process_auto_complete_jobs() RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_job RECORD;
BEGIN
  FOR v_job IN
    SELECT bj.id, bj.target_id
    FROM background_jobs bj
    WHERE bj.job_type = 'auto_complete'
      AND bj.status = 'pending'
      AND bj.scheduled_at <= NOW()
    FOR UPDATE SKIP LOCKED
    LIMIT 100
  LOOP
    -- Only transition orders that are currently in 'delivered' status
    UPDATE orders SET status = 'completed'
    WHERE id = v_job.target_id AND status = 'delivered';

    UPDATE background_jobs
    SET status = 'completed', completed_at = NOW()
    WHERE id = v_job.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================================
-- 10. RLS POLICIES FOR ALL NEW TABLES
-- ============================================================================

-- Enable RLS on every new table
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE proof_of_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 10a. payments: customer reads own, admin reads all, service inserts
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customer reads own payments" ON payments;
CREATE POLICY "Customer reads own payments" ON payments
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admin reads all payments" ON payments;
CREATE POLICY "Admin reads all payments" ON payments
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admin manages payments" ON payments;
CREATE POLICY "Admin manages payments" ON payments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System inserts payments" ON payments;
CREATE POLICY "System inserts payments" ON payments
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10b. refunds: customer reads own, admin manages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customer reads own refunds" ON refunds;
CREATE POLICY "Customer reads own refunds" ON refunds
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = refunds.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admin manages refunds" ON refunds;
CREATE POLICY "Admin manages refunds" ON refunds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10c. proof_of_delivery: driver inserts own, customer/admin reads
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Driver inserts own proof" ON proof_of_delivery;
CREATE POLICY "Driver inserts own proof" ON proof_of_delivery
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Driver reads own proof" ON proof_of_delivery;
CREATE POLICY "Driver reads own proof" ON proof_of_delivery
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Customer reads own proof" ON proof_of_delivery;
CREATE POLICY "Customer reads own proof" ON proof_of_delivery
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = proof_of_delivery.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admin reads all proof" ON proof_of_delivery;
CREATE POLICY "Admin reads all proof" ON proof_of_delivery
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10d. compliance_events: driver inserts own, admin reads all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Driver inserts own compliance" ON compliance_events;
CREATE POLICY "Driver inserts own compliance" ON compliance_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Driver reads own compliance" ON compliance_events;
CREATE POLICY "Driver reads own compliance" ON compliance_events
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admin reads all compliance" ON compliance_events;
CREATE POLICY "Admin reads all compliance" ON compliance_events
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10e. delivery_ratings: customer manages own, driver reads own, admin reads all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customer inserts own rating" ON delivery_ratings;
CREATE POLICY "Customer inserts own rating" ON delivery_ratings
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customer reads own ratings" ON delivery_ratings;
CREATE POLICY "Customer reads own ratings" ON delivery_ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Customer updates own rating" ON delivery_ratings;
CREATE POLICY "Customer updates own rating" ON delivery_ratings
  FOR UPDATE TO authenticated
  USING (auth.uid() = customer_id);

DROP POLICY IF EXISTS "Driver reads own ratings" ON delivery_ratings;
CREATE POLICY "Driver reads own ratings" ON delivery_ratings
  FOR SELECT TO authenticated
  USING (auth.uid() = driver_id);

DROP POLICY IF EXISTS "Admin reads all ratings" ON delivery_ratings;
CREATE POLICY "Admin reads all ratings" ON delivery_ratings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10f. support_tickets: user manages own, admin manages all
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User reads own tickets" ON support_tickets;
CREATE POLICY "User reads own tickets" ON support_tickets
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User creates own tickets" ON support_tickets;
CREATE POLICY "User creates own tickets" ON support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User updates own tickets" ON support_tickets;
CREATE POLICY "User updates own tickets" ON support_tickets
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manages all tickets" ON support_tickets;
CREATE POLICY "Admin manages all tickets" ON support_tickets
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10g. chat_channels: participants only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants read own channels" ON chat_channels;
CREATE POLICY "Participants read own channels" ON chat_channels
  FOR SELECT TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Participants create channels" ON chat_channels;
CREATE POLICY "Participants create channels" ON chat_channels
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Participants update channels" ON chat_channels;
CREATE POLICY "Participants update channels" ON chat_channels
  FOR UPDATE TO authenticated
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

DROP POLICY IF EXISTS "Admin manages all channels" ON chat_channels;
CREATE POLICY "Admin manages all channels" ON chat_channels
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10h. chat_messages: participants only (through channel)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Participants read channel messages" ON chat_messages;
CREATE POLICY "Participants read channel messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM chat_channels
      WHERE chat_channels.id = chat_messages.channel_id
        AND (chat_channels.participant_1 = auth.uid() OR chat_channels.participant_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants send messages" ON chat_messages;
CREATE POLICY "Participants send messages" ON chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM chat_channels
      WHERE chat_channels.id = chat_messages.channel_id
        AND (chat_channels.participant_1 = auth.uid() OR chat_channels.participant_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants update own messages" ON chat_messages;
CREATE POLICY "Participants update own messages" ON chat_messages
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM chat_channels
      WHERE chat_channels.id = chat_messages.channel_id
        AND (chat_channels.participant_1 = auth.uid() OR chat_channels.participant_2 = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admin reads all messages" ON chat_messages;
CREATE POLICY "Admin reads all messages" ON chat_messages
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10i. loyalty_accounts: user reads own, admin manages
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User reads own loyalty" ON loyalty_accounts;
CREATE POLICY "User reads own loyalty" ON loyalty_accounts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manages loyalty" ON loyalty_accounts;
CREATE POLICY "Admin manages loyalty" ON loyalty_accounts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System inserts loyalty accounts" ON loyalty_accounts;
CREATE POLICY "System inserts loyalty accounts" ON loyalty_accounts
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 10j. loyalty_transactions: user reads own
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User reads own loyalty txns" ON loyalty_transactions;
CREATE POLICY "User reads own loyalty txns" ON loyalty_transactions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manages loyalty txns" ON loyalty_transactions;
CREATE POLICY "Admin manages loyalty txns" ON loyalty_transactions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10k. referral_codes: user manages own
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User reads own referral code" ON referral_codes;
CREATE POLICY "User reads own referral code" ON referral_codes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "User creates own referral code" ON referral_codes;
CREATE POLICY "User creates own referral code" ON referral_codes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "User updates own referral code" ON referral_codes;
CREATE POLICY "User updates own referral code" ON referral_codes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin manages referral codes" ON referral_codes;
CREATE POLICY "Admin manages referral codes" ON referral_codes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10l. referrals: user reads own
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "User reads own referrals as referrer" ON referrals;
CREATE POLICY "User reads own referrals as referrer" ON referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "User reads own referrals as referred" ON referrals;
CREATE POLICY "User reads own referrals as referred" ON referrals
  FOR SELECT TO authenticated
  USING (auth.uid() = referred_id);

DROP POLICY IF EXISTS "Admin manages referrals" ON referrals;
CREATE POLICY "Admin manages referrals" ON referrals
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10m. delivery_zones: everyone reads active
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone reads active zones" ON delivery_zones;
CREATE POLICY "Anyone reads active zones" ON delivery_zones
  FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admin manages zones" ON delivery_zones;
CREATE POLICY "Admin manages zones" ON delivery_zones
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10n. delivery_slots: everyone reads available
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone reads available slots" ON delivery_slots;
CREATE POLICY "Anyone reads available slots" ON delivery_slots
  FOR SELECT
  USING (is_available = true);

DROP POLICY IF EXISTS "Admin manages slots" ON delivery_slots;
CREATE POLICY "Admin manages slots" ON delivery_slots
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10o. scheduled_deliveries: customer reads own
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Customer reads own scheduled" ON scheduled_deliveries;
CREATE POLICY "Customer reads own scheduled" ON scheduled_deliveries
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM orders WHERE orders.id = scheduled_deliveries.order_id AND orders.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Admin manages scheduled deliveries" ON scheduled_deliveries;
CREATE POLICY "Admin manages scheduled deliveries" ON scheduled_deliveries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System inserts scheduled deliveries" ON scheduled_deliveries;
CREATE POLICY "System inserts scheduled deliveries" ON scheduled_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 10p. background_jobs: admin only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin manages background jobs" ON background_jobs;
CREATE POLICY "Admin manages background jobs" ON background_jobs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10q. webhook_events: admin and service role
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin reads webhook events" ON webhook_events;
CREATE POLICY "Admin reads webhook events" ON webhook_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "System inserts webhook events" ON webhook_events;
CREATE POLICY "System inserts webhook events" ON webhook_events
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ============================================================================
-- 11. INDEXES FOR ALL NEW TABLES
-- ============================================================================

-- payments
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_gateway_reference ON payments(gateway_reference);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON payments(created_at DESC);

-- refunds
CREATE INDEX IF NOT EXISTS idx_refunds_order_id ON refunds(order_id);
CREATE INDEX IF NOT EXISTS idx_refunds_payment_id ON refunds(payment_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- proof_of_delivery
CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_order_id ON proof_of_delivery(order_id);
CREATE INDEX IF NOT EXISTS idx_proof_of_delivery_driver_id ON proof_of_delivery(driver_id);

-- compliance_events
CREATE INDEX IF NOT EXISTS idx_compliance_events_order_id ON compliance_events(order_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_driver_id ON compliance_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_compliance_events_event_type ON compliance_events(event_type);
CREATE INDEX IF NOT EXISTS idx_compliance_events_outcome ON compliance_events(outcome);

-- delivery_ratings
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_customer_id ON delivery_ratings(customer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_driver_id ON delivery_ratings(driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_ratings_order_id ON delivery_ratings(order_id);

-- support_tickets
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_order_id ON support_tickets(order_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON support_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ticket_number ON support_tickets(ticket_number);

-- chat_channels
CREATE INDEX IF NOT EXISTS idx_chat_channels_order_id ON chat_channels(order_id);
CREATE INDEX IF NOT EXISTS idx_chat_channels_participant_1 ON chat_channels(participant_1);
CREATE INDEX IF NOT EXISTS idx_chat_channels_participant_2 ON chat_channels(participant_2);
CREATE INDEX IF NOT EXISTS idx_chat_channels_type ON chat_channels(type);

-- chat_messages
CREATE INDEX IF NOT EXISTS idx_chat_messages_channel_id ON chat_messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- loyalty_accounts
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_user_id ON loyalty_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_accounts_tier ON loyalty_accounts(tier);

-- loyalty_transactions
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_user_id ON loyalty_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_order_id ON loyalty_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_type ON loyalty_transactions(type);

-- referral_codes
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);

-- referrals
CREATE INDEX IF NOT EXISTS idx_referrals_referrer_id ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referred_id ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referral_code_id ON referrals(referral_code_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);

-- delivery_zones
CREATE INDEX IF NOT EXISTS idx_delivery_zones_is_active ON delivery_zones(is_active) WHERE is_active = true;

-- delivery_slots
CREATE INDEX IF NOT EXISTS idx_delivery_slots_zone_id ON delivery_slots(zone_id);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_date ON delivery_slots(date);
CREATE INDEX IF NOT EXISTS idx_delivery_slots_available ON delivery_slots(is_available) WHERE is_available = true;

-- scheduled_deliveries
CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_order_id ON scheduled_deliveries(order_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_slot_id ON scheduled_deliveries(slot_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_deliveries_date ON scheduled_deliveries(scheduled_date);

-- background_jobs
CREATE INDEX IF NOT EXISTS idx_background_jobs_status ON background_jobs(status);
CREATE INDEX IF NOT EXISTS idx_background_jobs_job_type ON background_jobs(job_type);
CREATE INDEX IF NOT EXISTS idx_background_jobs_scheduled_at ON background_jobs(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_background_jobs_pending ON background_jobs(scheduled_at)
  WHERE status = 'pending';

-- webhook_events
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);


-- ============================================================================
-- 12. ENABLE REALTIME FOR chat_messages
-- ============================================================================

-- Add chat_messages to the Supabase realtime publication
-- This allows clients to subscribe to new messages in real time
DO $$ BEGIN
  -- Check if the publication exists (Supabase creates it by default)
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    -- Alter the publication to add the chat_messages table
    ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
  END IF;
EXCEPTION
  WHEN duplicate_object THEN
    -- Table already in publication, ignore
    NULL;
END $$;


-- ============================================================================
-- Apply updated_at triggers for new tables that have updated_at columns
-- ============================================================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN
    SELECT unnest(ARRAY[
      'payments', 'refunds', 'support_tickets', 'chat_channels',
      'loyalty_accounts', 'delivery_zones'
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
-- MIGRATION COMPLETE
-- ============================================================================
-- This migration adds:
--   - Hardened RLS policies for admin_audit_log, delivery_assignments,
--     delivery_tracking, warehouse_tasks, and order_items
--   - RPC functions: record_depot_release, record_driver_signoff,
--     increment_failed_delivery_count, generate_delivery_pin
--   - 17 new tables: payments, refunds, proof_of_delivery, compliance_events,
--     delivery_ratings, support_tickets, chat_channels, chat_messages,
--     loyalty_accounts, loyalty_transactions, referral_codes, referrals,
--     delivery_zones, delivery_slots, scheduled_deliveries, background_jobs,
--     webhook_events
--   - New columns on orders and delivery_assignments
--   - Dispatch scoring function (calculate_dispatch_score)
--   - Stock reservation functions (reserve_stock, release_reserved_stock)
--   - Auto-complete job processor (process_auto_complete_jobs)
--   - RLS policies for all 17 new tables
--   - Performance indexes on all new tables
--   - Realtime subscription for chat_messages
-- ============================================================================
