-- ============================================================================
-- Migration 007: Atomic stock operations [DEF-002]
--
-- Replaces the per-item JavaScript for-loop with a single PL/pgSQL function
-- that reserves/releases all order items atomically in one transaction.
-- A failure on any item raises an exception and rolls back all prior changes.
--
-- Also adds reserve_stock and release_reserved_stock stubs used during the
-- awaiting_payment side effect (kept for backward compatibility; the engine
-- now calls reserve_order_stock instead).
-- ============================================================================

-- ── reserve_order_stock: reserve all items for an order atomically ──────────
CREATE OR REPLACE FUNCTION reserve_order_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity - v_item.quantity
    WHERE id = v_item.product_id
      AND stock_quantity >= v_item.quantity;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK for product %', v_item.product_id
        USING ERRCODE = 'P0001';
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── release_order_stock: release all reserved items for an order atomically ─
CREATE OR REPLACE FUNCTION release_order_stock(p_order_id UUID)
RETURNS VOID AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT oi.product_id, oi.quantity
    FROM order_items oi
    WHERE oi.order_id = p_order_id
  LOOP
    UPDATE products
    SET stock_quantity = stock_quantity + v_item.quantity
    WHERE id = v_item.product_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── reserve_stock: single-product shim retained for backward compatibility ──
CREATE OR REPLACE FUNCTION reserve_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity - p_quantity
  WHERE id = p_product_id
    AND stock_quantity >= p_quantity;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK for product %', p_product_id
      USING ERRCODE = 'P0001';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ── release_reserved_stock: single-product shim retained for compatibility ──
CREATE OR REPLACE FUNCTION release_reserved_stock(p_product_id UUID, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products
  SET stock_quantity = stock_quantity + p_quantity
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
