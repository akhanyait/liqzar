-- Migration 012: DB trigger — order status change emits notifications
-- Inserts into public.notifications for the customer and (if set) assigned driver
-- whenever orders.status transitions to a user-facing state. The existing
-- useNotifications hook subscribes to realtime INSERTs and will toast on arrival.

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  order_label TEXT;
  cust_title  TEXT;
  cust_msg    TEXT;
  drv_title   TEXT;
  drv_msg     TEXT;
BEGIN
  -- Only act on real transitions
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  order_label := COALESCE(NEW.order_number, '#' || substring(NEW.id::text, 1, 8));

  -- ─── Customer-facing copy ─────────────────────────────────────────────
  CASE NEW.status::text
    WHEN 'confirmed' THEN
      cust_title := 'Order confirmed';
      cust_msg   := 'Your order ' || order_label || ' has been confirmed.';
    WHEN 'preparing' THEN
      cust_title := 'Preparing your order';
      cust_msg   := 'We''re getting order ' || order_label || ' ready.';
    WHEN 'ready' THEN
      cust_title := 'Ready for dispatch';
      cust_msg   := 'Order ' || order_label || ' is packed and ready.';
    WHEN 'driver_assigned' THEN
      cust_title := 'Driver assigned';
      cust_msg   := 'A driver has been assigned to order ' || order_label || '.';
    WHEN 'picked_up' THEN
      cust_title := 'Driver has your order';
      cust_msg   := 'Your driver just picked up order ' || order_label || '.';
    WHEN 'en_route' THEN
      cust_title := 'On the way';
      cust_msg   := 'Your order is on its way. Track it live.';
    WHEN 'delivered' THEN
      cust_title := 'Delivered';
      cust_msg   := 'Enjoy! Order ' || order_label || ' has been delivered.';
    WHEN 'delivery_failed' THEN
      cust_title := 'Delivery could not be completed';
      cust_msg   := 'We couldn''t deliver ' || order_label || '. Please check your notifications.';
    WHEN 'cancelled' THEN
      cust_title := 'Order cancelled';
      cust_msg   := 'Order ' || order_label || ' has been cancelled.';
    WHEN 'refunded' THEN
      cust_title := 'Refund processed';
      cust_msg   := 'Your refund for ' || order_label || ' has been processed.';
    ELSE
      cust_title := NULL;
  END CASE;

  IF cust_title IS NOT NULL AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type)
    VALUES (NEW.user_id, cust_title, cust_msg, 'order_status');
  END IF;

  -- ─── Driver-facing copy (only when an assigned driver is set) ────────
  IF NEW.assigned_driver_id IS NOT NULL THEN
    CASE NEW.status::text
      WHEN 'driver_assigned' THEN
        drv_title := 'New delivery assigned';
        drv_msg   := 'You''ve been assigned order ' || order_label || '.';
      WHEN 'ready' THEN
        drv_title := 'Order ready for pickup';
        drv_msg   := 'Order ' || order_label || ' is ready at the depot.';
      WHEN 'cancelled' THEN
        drv_title := 'Order cancelled';
        drv_msg   := 'Order ' || order_label || ' was cancelled.';
      ELSE
        drv_title := NULL;
    END CASE;

    IF drv_title IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, message, type)
      VALUES (NEW.assigned_driver_id, drv_title, drv_msg, 'order_status');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_order_status_change ON public.orders;
CREATE TRIGGER trg_notify_order_status_change
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.notify_order_status_change();

COMMENT ON FUNCTION public.notify_order_status_change() IS
  'Emits notifications rows for the customer and assigned driver when an order status transitions.';
