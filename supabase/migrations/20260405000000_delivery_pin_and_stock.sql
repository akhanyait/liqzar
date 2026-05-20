-- =============================================================
-- LIQZAR Delivery PIN & Stock Verification System
-- =============================================================

-- 1. Add delivery PIN column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_pin VARCHAR(4);

-- 2. Add depot release & PIN verification tracking to driver_assignments
ALTER TABLE driver_assignments
  ADD COLUMN IF NOT EXISTS depot_released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS depot_released_by UUID,
  ADD COLUMN IF NOT EXISTS driver_signed_off_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_pin_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS customer_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pin_attempts INTEGER DEFAULT 0;

-- 3. Trigger: Auto-generate 4-digit delivery PIN when order is confirmed
CREATE OR REPLACE FUNCTION generate_delivery_pin()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'confirmed' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    NEW.delivery_pin := LPAD(FLOOR(RANDOM() * 9000 + 1000)::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_delivery_pin_trigger ON orders;
CREATE TRIGGER generate_delivery_pin_trigger
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION generate_delivery_pin();

-- Also handle direct insert with confirmed status
DROP TRIGGER IF EXISTS generate_delivery_pin_insert_trigger ON orders;
CREATE TRIGGER generate_delivery_pin_insert_trigger
  BEFORE INSERT ON orders
  FOR EACH ROW
  WHEN (NEW.status = 'confirmed')
  EXECUTE FUNCTION generate_delivery_pin();

-- 4. Function: Check stock availability for an order's items
CREATE OR REPLACE FUNCTION check_stock_availability(p_order_id UUID)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  requested INTEGER,
  available INTEGER,
  sufficient BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    oi.product_id,
    oi.product_name::TEXT,
    oi.quantity AS requested,
    COALESCE(p.stock_quantity, 0) AS available,
    COALESCE(p.stock_quantity, 0) >= oi.quantity AS sufficient
  FROM order_items oi
  LEFT JOIN products p ON p.id = oi.product_id
  WHERE oi.order_id = p_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function: Check stock for cart items before order placement
CREATE OR REPLACE FUNCTION check_cart_stock(p_items JSONB)
RETURNS TABLE(
  product_id UUID,
  product_name TEXT,
  requested INTEGER,
  available INTEGER,
  sufficient BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (item->>'product_id')::UUID AS product_id,
    COALESCE(p.name, item->>'product_name')::TEXT AS product_name,
    (item->>'quantity')::INTEGER AS requested,
    COALESCE(p.stock_quantity, 0) AS available,
    COALESCE(p.stock_quantity, 0) >= (item->>'quantity')::INTEGER AS sufficient
  FROM jsonb_array_elements(p_items) AS item
  LEFT JOIN products p ON p.id = (item->>'product_id')::UUID;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Function: Verify delivery PIN
CREATE OR REPLACE FUNCTION verify_delivery_pin(p_order_id UUID, p_entered_pin VARCHAR(4))
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_assignment RECORD;
  v_max_attempts INTEGER := 3;
BEGIN
  -- Get order and its PIN
  SELECT id, delivery_pin, status INTO v_order
  FROM orders WHERE id = p_order_id;

  IF v_order IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'error', 'Order not found');
  END IF;

  -- Get driver assignment
  SELECT id, pin_attempts INTO v_assignment
  FROM driver_assignments WHERE order_id = p_order_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('verified', false, 'error', 'No delivery assignment found');
  END IF;

  -- Check max attempts
  IF COALESCE(v_assignment.pin_attempts, 0) >= v_max_attempts THEN
    RETURN jsonb_build_object(
      'verified', false,
      'error', 'Maximum PIN attempts exceeded. Contact support.',
      'attempts_remaining', 0,
      'locked', true
    );
  END IF;

  -- Verify PIN
  IF v_order.delivery_pin = p_entered_pin THEN
    -- PIN correct: mark verified
    UPDATE driver_assignments
    SET customer_pin_verified_at = NOW()
    WHERE id = v_assignment.id;

    RETURN jsonb_build_object(
      'verified', true,
      'message', 'PIN verified successfully'
    );
  ELSE
    -- PIN incorrect: increment attempts
    UPDATE driver_assignments
    SET pin_attempts = COALESCE(pin_attempts, 0) + 1
    WHERE id = v_assignment.id;

    RETURN jsonb_build_object(
      'verified', false,
      'error', 'Incorrect PIN',
      'attempts_remaining', v_max_attempts - COALESCE(v_assignment.pin_attempts, 0) - 1
    );
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Function: Record depot release
CREATE OR REPLACE FUNCTION record_depot_release(p_order_id UUID, p_warehouse_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  SELECT id INTO v_assignment
  FROM driver_assignments WHERE order_id = p_order_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No delivery assignment found');
  END IF;

  UPDATE driver_assignments
  SET depot_released_at = NOW(),
      depot_released_by = p_warehouse_user_id
  WHERE id = v_assignment.id;

  RETURN jsonb_build_object('success', true, 'message', 'Goods released to driver');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Function: Record driver sign-off at depot
CREATE OR REPLACE FUNCTION record_driver_signoff(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_assignment RECORD;
BEGIN
  SELECT id, depot_released_at INTO v_assignment
  FROM driver_assignments WHERE order_id = p_order_id
  ORDER BY created_at DESC LIMIT 1;

  IF v_assignment IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No delivery assignment found');
  END IF;

  IF v_assignment.depot_released_at IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Goods not yet released by warehouse');
  END IF;

  UPDATE driver_assignments
  SET driver_signed_off_at = NOW()
  WHERE id = v_assignment.id;

  RETURN jsonb_build_object('success', true, 'message', 'Driver sign-off recorded');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
