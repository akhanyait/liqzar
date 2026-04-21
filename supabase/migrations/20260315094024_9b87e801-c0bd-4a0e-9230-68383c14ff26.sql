
-- Orders table
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL DEFAULT ('ORD-' || upper(substr(gen_random_uuid()::text, 1, 8))),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  subtotal numeric NOT NULL DEFAULT 0,
  vat_amount numeric NOT NULL DEFAULT 0,
  delivery_fee numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_code text,
  total numeric NOT NULL DEFAULT 0,
  delivery_method text NOT NULL DEFAULT 'standard',
  delivery_zone text,
  scheduled_date text,
  scheduled_slot text,
  estimated_delivery text,
  delivery_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  payment_method text NOT NULL DEFAULT 'card',
  payment_status text NOT NULL DEFAULT 'pending',
  payment_reference text,
  customer_notes text,
  delivery_instructions text,
  assigned_warehouse_id uuid,
  assigned_driver_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  packed_at timestamptz,
  dispatched_at timestamptz,
  delivered_at timestamptz
);

-- Order items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  product_image text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Driver assignments table
CREATE TABLE IF NOT EXISTS public.driver_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  accepted_at timestamptz,
  picked_up_at timestamptz,
  delivered_at timestamptz,
  delivery_photo_url text,
  recipient_name text,
  delivery_notes text,
  current_location jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Delivery tracking table
CREATE TABLE IF NOT EXISTS public.delivery_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.driver_assignments(id) ON DELETE CASCADE,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  heading double precision,
  speed double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Warehouse tasks table
CREATE TABLE IF NOT EXISTS public.warehouse_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  assigned_to uuid REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'pending',
  priority integer NOT NULL DEFAULT 0,
  notes text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouse_tasks ENABLE ROW LEVEL SECURITY;

-- Orders RLS (drop first for idempotency)
DROP POLICY IF EXISTS "Users can read own orders" ON public.orders;
DROP POLICY IF EXISTS "Users can insert own orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can read all orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Drivers can read assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Warehouse can read assigned orders" ON public.orders;
DROP POLICY IF EXISTS "Warehouse can update orders" ON public.orders;
CREATE POLICY "Users can read own orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can read assigned orders" ON public.orders FOR SELECT TO authenticated USING (assigned_driver_id = auth.uid());
CREATE POLICY "Warehouse can read assigned orders" ON public.orders FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));
CREATE POLICY "Warehouse can update orders" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));

-- Order items RLS
DROP POLICY IF EXISTS "Users can read own order items" ON public.order_items;
DROP POLICY IF EXISTS "Users can insert order items" ON public.order_items;
DROP POLICY IF EXISTS "Admins can read all order items" ON public.order_items;
DROP POLICY IF EXISTS "Drivers can read assigned order items" ON public.order_items;
DROP POLICY IF EXISTS "Warehouse can read order items" ON public.order_items;
CREATE POLICY "Users can read own order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Users can insert order items" ON public.order_items FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));
CREATE POLICY "Admins can read all order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can read assigned order items" ON public.order_items FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.assigned_driver_id = auth.uid()));
CREATE POLICY "Warehouse can read order items" ON public.order_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));

-- Driver assignments RLS
DROP POLICY IF EXISTS "Drivers can read own assignments" ON public.driver_assignments;
DROP POLICY IF EXISTS "Admins can manage assignments" ON public.driver_assignments;
DROP POLICY IF EXISTS "Drivers can update own assignments" ON public.driver_assignments;
CREATE POLICY "Drivers can read own assignments" ON public.driver_assignments FOR SELECT TO authenticated USING (driver_id = auth.uid());
CREATE POLICY "Admins can manage assignments" ON public.driver_assignments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Drivers can update own assignments" ON public.driver_assignments FOR UPDATE TO authenticated USING (driver_id = auth.uid());

-- Delivery tracking RLS
DROP POLICY IF EXISTS "Drivers can insert tracking" ON public.delivery_tracking;
DROP POLICY IF EXISTS "Admins can read tracking" ON public.delivery_tracking;
CREATE POLICY "Drivers can insert tracking" ON public.delivery_tracking FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.driver_assignments WHERE driver_assignments.id = delivery_tracking.assignment_id AND driver_assignments.driver_id = auth.uid()));
CREATE POLICY "Admins can read tracking" ON public.delivery_tracking FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Warehouse tasks RLS
DROP POLICY IF EXISTS "Warehouse can read tasks" ON public.warehouse_tasks;
DROP POLICY IF EXISTS "Warehouse can update tasks" ON public.warehouse_tasks;
DROP POLICY IF EXISTS "Admins can manage warehouse tasks" ON public.warehouse_tasks;
CREATE POLICY "Warehouse can read tasks" ON public.warehouse_tasks FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));
CREATE POLICY "Warehouse can update tasks" ON public.warehouse_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'warehouse'));
CREATE POLICY "Admins can manage warehouse tasks" ON public.warehouse_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Enable realtime for orders (idempotent)
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_assignments;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
