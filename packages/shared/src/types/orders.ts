// Canonical 17-status order state machine (matches LIQZAR-SYSTEM-SPECIFICATION.md §6)
export type OrderStatus =
  | "pending"
  | "awaiting_payment"
  | "payment_failed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "driver_assigned"
  | "picked_up"
  | "en_route"
  | "delivered"
  | "completed"
  | "cancelled"
  | "refunded"
  | "delivery_failed"
  | "rescheduled"
  | "return_to_store"
  | "return_received";

export type WarehouseTaskStatus =
  | "pending"
  | "picking"
  | "picked"
  | "packing"
  | "packed"
  | "ready_dispatch";

export type DriverAssignmentStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "en_route"
  | "delivered"
  | "failed";

export interface DeliveryAddress {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  addressLine3?: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  deliveryZone?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_image?: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string;
  status: OrderStatus;
  subtotal: number;
  vat_amount: number;
  delivery_fee: number;
  discount_amount: number;
  discount_code?: string;
  total: number;
  delivery_method: string;
  delivery_zone?: string;
  scheduled_date?: string;
  scheduled_slot?: string;
  estimated_delivery?: string;
  delivery_address: DeliveryAddress;
  payment_method: string;
  payment_status: string;
  payment_reference?: string;
  customer_notes?: string;
  delivery_instructions?: string;
  delivery_pin?: string;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
}

/** Human-readable status labels (17-status state machine) */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Awaiting Confirmation",
  awaiting_payment: "Awaiting Payment",
  payment_failed: "Payment Failed",
  confirmed: "Confirmed",
  preparing: "Being Prepared",
  ready: "Ready for Pickup",
  driver_assigned: "Driver Assigned",
  picked_up: "Picked Up",
  en_route: "On the Way",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  delivery_failed: "Delivery Failed",
  rescheduled: "Rescheduled",
  return_to_store: "Returning to Store",
  return_received: "Return Received",
};
