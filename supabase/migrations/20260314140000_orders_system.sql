-- ============================================================================
-- ORDERS SYSTEM MIGRATION
-- Creates the complete order fulfillment pipeline:
-- Customer Orders → Admin → Warehouse → Driver → Delivery
-- ============================================================================

-- Order status enum for clear workflow tracking
CREATE TYPE public.order_status AS ENUM (
  'pending',       -- Order placed, awaiting confirmation
  'confirmed',     -- Payment confirmed, ready for warehouse
  'preparing',     -- Warehouse picking/packing
  'ready',         -- Packed and ready for dispatch
  'picked_up',     -- Driver has picked up
  'en_route',      -- Driver on the way
  'delivered',     -- Successfully delivered
  'cancelled',     -- Cancelled by customer/admin
  'failed'         -- Delivery failed
);

-- Warehouse task status enum
CREATE TYPE public.warehouse_task_status AS ENUM (
  'pending',
  'picking',
  'picked',
  'packing',
  'packed',
  'ready_dispatch'
);

-- Driver assignment status enum
CREATE TYPE public.driver_assignment_status AS ENUM (
  'pending',
  'accepted',
  'picked_up',
  'en_route',
  'delivered',
  'failed'
);

-- ============================================================================
-- 1. CUSTOMER ADDRESSES TABLE
-- ============================================================================
CREATE TABLE public.customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  is_default BOOLEAN DEFAULT FALSE,
  label TEXT, -- 'Home', 'Work', etc.
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  address_line3 TEXT,
  suburb TEXT NOT NULL,
  city TEXT NOT NULL,
  province TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'South Africa',
  coordinates JSONB, -- {lat, lng}
  delivery_zone TEXT, -- 'same-day', 'in-house', 'outsourced'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own addresses" ON public.customer_addresses 
  FOR ALL TO authenticated 
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all addresses" ON public.customer_addresses 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================================
-- 2. ORDERS TABLE (Main order record)
-- ============================================================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL, -- Human-readable order number like "LX-2026-1234"
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  
  -- Financial details (all in ZAR)
  subtotal NUMERIC(10, 2) NOT NULL,
  vat_amount NUMERIC(10, 2) NOT NULL,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  discount_code TEXT,
  total NUMERIC(10, 2) NOT NULL,
  
  -- Delivery info
  delivery_method TEXT NOT NULL, -- 'same-day', 'next-day', 'scheduled'
  delivery_zone TEXT, -- 'same-day', 'in-house', 'outsourced'
  scheduled_date DATE,
  scheduled_slot TEXT, -- e.g., '09:00 - 12:00'
  estimated_delivery TIMESTAMPTZ,
  
  -- Delivery address (snapshot at order time)
  delivery_address JSONB NOT NULL, -- Full address object
  
  -- Payment
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending', -- pending, paid, failed, refunded
  payment_reference TEXT,
  
  -- Customer notes
  customer_notes TEXT,
  delivery_instructions TEXT,
  
  -- Assignment tracking
  assigned_warehouse_id UUID REFERENCES auth.users(id),
  assigned_driver_id UUID REFERENCES auth.users(id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Customers can read their own orders
CREATE POLICY "Users can read own orders" ON public.orders 
  FOR SELECT TO authenticated 
  USING (auth.uid() = user_id);

-- Customers can create orders
CREATE POLICY "Users can create orders" ON public.orders 
  FOR INSERT TO authenticated 
  WITH CHECK (auth.uid() = user_id);

-- Admins can read all orders
CREATE POLICY "Admins can read all orders" ON public.orders 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Admins can update orders
CREATE POLICY "Admins can update orders" ON public.orders 
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Warehouse can read orders assigned to them or unassigned
CREATE POLICY "Warehouse can read assigned orders" ON public.orders 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'warehouse') AND 
    (assigned_warehouse_id = auth.uid() OR assigned_warehouse_id IS NULL)
  );

-- Drivers can read orders assigned to them
CREATE POLICY "Drivers can read assigned orders" ON public.orders 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'driver') AND 
    assigned_driver_id = auth.uid()
  );

-- Index for common queries
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_orders_assigned_warehouse ON public.orders(assigned_warehouse_id) WHERE assigned_warehouse_id IS NOT NULL;
CREATE INDEX idx_orders_assigned_driver ON public.orders(assigned_driver_id) WHERE assigned_driver_id IS NOT NULL;

-- ============================================================================
-- 3. ORDER ITEMS TABLE
-- ============================================================================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) NOT NULL,
  product_name TEXT NOT NULL, -- Snapshot at order time
  product_image TEXT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2) NOT NULL,
  subtotal NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Inherit read access from parent order
CREATE POLICY "Users can read own order items" ON public.order_items 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all order items" ON public.order_items 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Warehouse can read assigned order items" ON public.order_items 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'warehouse') AND
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND (orders.assigned_warehouse_id = auth.uid() OR orders.assigned_warehouse_id IS NULL)
    )
  );

CREATE POLICY "Drivers can read assigned order items" ON public.order_items 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'driver') AND
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.assigned_driver_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert order items" ON public.order_items 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_items.order_id 
      AND orders.user_id = auth.uid()
    )
  );

CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_order_items_product_id ON public.order_items(product_id);

-- ============================================================================
-- 4. WAREHOUSE TASKS TABLE
-- ============================================================================
CREATE TABLE public.warehouse_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  status warehouse_task_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES auth.users(id),
  picker_notes TEXT,
  packer_notes TEXT,
  started_at TIMESTAMPTZ,
  picked_at TIMESTAMPTZ,
  packed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.warehouse_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Warehouse can manage tasks" ON public.warehouse_tasks 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'warehouse'));

CREATE POLICY "Admins can manage tasks" ON public.warehouse_tasks 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_warehouse_tasks_status ON public.warehouse_tasks(status);
CREATE INDEX idx_warehouse_tasks_order ON public.warehouse_tasks(order_id);

-- ============================================================================
-- 5. DRIVER ASSIGNMENTS TABLE
-- ============================================================================
CREATE TABLE public.driver_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL UNIQUE,
  driver_id UUID REFERENCES auth.users(id) NOT NULL,
  status driver_assignment_status NOT NULL DEFAULT 'pending',
  
  -- Tracking
  current_location JSONB, -- {lat, lng, timestamp}
  eta_minutes INTEGER,
  distance_km NUMERIC(6, 2),
  
  -- Events
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Proof of delivery
  delivery_photo_url TEXT,
  recipient_name TEXT,
  delivery_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can read own assignments" ON public.driver_assignments 
  FOR SELECT TO authenticated 
  USING (driver_id = auth.uid());

CREATE POLICY "Drivers can update own assignments" ON public.driver_assignments 
  FOR UPDATE TO authenticated 
  USING (driver_id = auth.uid());

CREATE POLICY "Admins can manage all assignments" ON public.driver_assignments 
  FOR ALL TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Customers can read own order assignments" ON public.driver_assignments 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = driver_assignments.order_id 
      AND orders.user_id = auth.uid()
    )
  );

CREATE INDEX idx_driver_assignments_driver ON public.driver_assignments(driver_id);
CREATE INDEX idx_driver_assignments_status ON public.driver_assignments(status);

-- ============================================================================
-- 6. DELIVERY TRACKING (GPS breadcrumbs)
-- ============================================================================
CREATE TABLE public.delivery_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id UUID REFERENCES public.driver_assignments(id) ON DELETE CASCADE NOT NULL,
  latitude NUMERIC(10, 7) NOT NULL,
  longitude NUMERIC(10, 7) NOT NULL,
  accuracy NUMERIC(6, 2),
  heading NUMERIC(5, 2),
  speed NUMERIC(6, 2),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers can insert tracking" ON public.delivery_tracking 
  FOR INSERT TO authenticated 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.driver_assignments 
      WHERE driver_assignments.id = delivery_tracking.assignment_id 
      AND driver_assignments.driver_id = auth.uid()
    )
  );

CREATE POLICY "Admins can read all tracking" ON public.delivery_tracking 
  FOR SELECT TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Customers can track their own order
CREATE POLICY "Customers can read own order tracking" ON public.delivery_tracking 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.driver_assignments da
      JOIN public.orders o ON o.id = da.order_id
      WHERE da.id = delivery_tracking.assignment_id 
      AND o.user_id = auth.uid()
    )
  );

CREATE INDEX idx_delivery_tracking_assignment ON public.delivery_tracking(assignment_id);
CREATE INDEX idx_delivery_tracking_time ON public.delivery_tracking(recorded_at DESC);

-- ============================================================================
-- 7. ORDER STATUS HISTORY (Audit trail)
-- ============================================================================
CREATE TABLE public.order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  from_status order_status,
  to_status order_status NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own order history" ON public.order_status_history 
  FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.orders 
      WHERE orders.id = order_status_history.order_id 
      AND orders.user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can read all history" ON public.order_status_history 
  FOR SELECT TO authenticated 
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'warehouse') OR 
    public.has_role(auth.uid(), 'driver')
  );

CREATE INDEX idx_order_status_history ON public.order_status_history(order_id, created_at DESC);

-- ============================================================================
-- 8. FUNCTIONS & TRIGGERS
-- ============================================================================

-- Generate human-readable order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  year_part TEXT;
  seq_num INTEGER;
BEGIN
  year_part := EXTRACT(YEAR FROM NOW())::TEXT;
  SELECT COALESCE(MAX(
    NULLIF(REGEXP_REPLACE(order_number, '^LX-\d{4}-', ''), '')::INTEGER
  ), 0) + 1 INTO seq_num
  FROM public.orders
  WHERE order_number LIKE 'LX-' || year_part || '-%';
  
  RETURN 'LX-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
END;
$$;

-- Auto-set order number before insert
CREATE OR REPLACE FUNCTION public.set_order_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := public.generate_order_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_number();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER warehouse_tasks_updated_at
  BEFORE UPDATE ON public.warehouse_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER driver_assignments_updated_at
  BEFORE UPDATE ON public.driver_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- Log status changes
CREATE OR REPLACE FUNCTION public.log_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.order_status_history (order_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, auth.uid());
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_order_status_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.log_order_status_change();

-- Decrement stock when order is confirmed
CREATE OR REPLACE FUNCTION public.decrement_stock_on_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When order status changes to confirmed, decrement stock
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    UPDATE public.products p
    SET stock_quantity = GREATEST(0, stock_quantity - oi.quantity)
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
    AND p.id = oi.product_id;
  END IF;
  
  -- If order is cancelled, restore stock
  IF NEW.status = 'cancelled' AND OLD.status NOT IN ('cancelled', 'failed') THEN
    UPDATE public.products p
    SET stock_quantity = stock_quantity + oi.quantity
    FROM public.order_items oi
    WHERE oi.order_id = NEW.id
    AND p.id = oi.product_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER decrement_stock_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_stock_on_order();

-- Also handle insert (when order is created with confirmed status)
CREATE TRIGGER decrement_stock_on_insert_trigger
  AFTER INSERT ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION public.decrement_stock_on_order();

-- Create warehouse task when order is confirmed
CREATE OR REPLACE FUNCTION public.create_warehouse_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- When order becomes confirmed, create warehouse task
  IF NEW.status = 'confirmed' AND (OLD IS NULL OR OLD.status != 'confirmed') THEN
    INSERT INTO public.warehouse_tasks (order_id, status)
    VALUES (NEW.id, 'pending')
    ON CONFLICT (order_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_warehouse_task_trigger
  AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.create_warehouse_task();

-- ============================================================================
-- 9. REALTIME SUBSCRIPTIONS
-- ============================================================================
-- Enable realtime for orders
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.warehouse_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;

-- ============================================================================
-- 10. VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for admin order dashboard
CREATE OR REPLACE VIEW public.v_orders_dashboard AS
SELECT 
  o.id,
  o.order_number,
  o.status,
  o.total,
  o.delivery_method,
  o.created_at,
  p.full_name as customer_name,
  p.phone as customer_phone,
  (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) as item_count,
  wt.status as warehouse_status,
  da.status as driver_status,
  da.driver_id
FROM public.orders o
LEFT JOIN public.profiles p ON p.id = o.user_id
LEFT JOIN public.warehouse_tasks wt ON wt.order_id = o.id
LEFT JOIN public.driver_assignments da ON da.order_id = o.id
ORDER BY o.created_at DESC;

-- View for warehouse picking queue
CREATE OR REPLACE VIEW public.v_warehouse_queue AS
SELECT 
  o.id as order_id,
  o.order_number,
  o.created_at as order_time,
  o.delivery_method,
  o.scheduled_date,
  o.scheduled_slot,
  wt.id as task_id,
  wt.status as task_status,
  wt.assigned_to,
  (
    SELECT json_agg(json_build_object(
      'id', oi.id,
      'product_id', oi.product_id,
      'product_name', oi.product_name,
      'quantity', oi.quantity,
      'product_image', oi.product_image
    ))
    FROM public.order_items oi
    WHERE oi.order_id = o.id
  ) as items
FROM public.orders o
JOIN public.warehouse_tasks wt ON wt.order_id = o.id
WHERE o.status IN ('confirmed', 'preparing')
ORDER BY 
  CASE o.delivery_method 
    WHEN 'same-day' THEN 1 
    WHEN 'next-day' THEN 2 
    ELSE 3 
  END,
  o.created_at ASC;

-- View for driver available orders
CREATE OR REPLACE VIEW public.v_driver_orders AS
SELECT 
  o.id as order_id,
  o.order_number,
  o.delivery_address,
  o.delivery_method,
  o.total,
  o.created_at,
  da.id as assignment_id,
  da.status as assignment_status,
  da.driver_id,
  (SELECT COUNT(*) FROM public.order_items oi WHERE oi.order_id = o.id) as item_count
FROM public.orders o
LEFT JOIN public.driver_assignments da ON da.order_id = o.id
WHERE o.status IN ('ready', 'picked_up', 'en_route')
ORDER BY o.created_at ASC;
