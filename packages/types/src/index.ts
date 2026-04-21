// User & Authentication Types
export interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export type AppRole = "admin" | "customer" | "warehouse" | "driver";

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
}

export interface Profile extends User {
  roles: AppRole[];
}

// Product Types
export type StockTier = "available" | "low" | "allocated" | "cellar_reserve";

export interface Product {
  id: string;
  name: string;
  description?: string;
  category?: string;
  price: number;
  image_url?: string;
  stock_quantity: number;
  sku?: string;
  barcode?: string;
  volume?: number; // ml
  alcohol_percentage?: number;
  brand?: string;
  is_active: boolean;
  stock_tier?: StockTier;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  parent_category_id?: string;
}

// Order Types
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

// Canonical 8-value payment status union (matches LIQZAR-SYSTEM-SPECIFICATION.md §PaymentStatus)
export type PaymentStatus =
  | "pending"
  | "authorized"
  | "captured"
  | "failed"
  | "refund_pending"
  | "refund_requested"
  | "refunded"
  | "cancelled";

export interface DeliveryAddress {
  street?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
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
  delivery_method: "same-day" | "next-day" | "scheduled";
  delivery_zone?: string;
  scheduled_date?: string;
  scheduled_slot?: string;
  estimated_delivery?: string;
  delivery_address: DeliveryAddress | string;
  payment_method: string;
  payment_status: PaymentStatus;
  payment_reference?: string;
  customer_notes?: string;
  delivery_instructions?: string;
  assigned_warehouse_id?: string;
  assigned_driver_id?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  packed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  discount_amount: number;
  total: number;
  product?: Product;
  created_at: string;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
  customer?: Profile;
  driver?: Profile;
}

// Driver Types
export interface DriverProfile {
  id: string;
  user_id: string;
  license_number?: string;
  vehicle_type?: string;
  vehicle_registration?: string;
  status: "available" | "busy" | "offline";
  current_location?: {
    latitude: number;
    longitude: number;
  };
  rating?: number;
  total_deliveries?: number;
  created_at: string;
  updated_at: string;
}

export type DriverAssignmentStatus =
  | "pending"
  | "accepted"
  | "picked_up"
  | "en_route"
  | "delivered"
  | "failed";

export interface DriverAssignment {
  id: string;
  driver_id: string;
  order_id: string;
  status: DriverAssignmentStatus;
  assigned_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  delivered_at?: string;
  failed_reason?: string;
}

// Delivery Types
export interface DeliveryTracking {
  id: string;
  assignment_id: string;
  latitude: number;
  longitude: number;
  timestamp: string;
  status: string;
  notes?: string;
}

// Cart Types
export interface CartItem {
  product_id: string;
  quantity: number;
  product: Product;
}

export interface Cart {
  items: CartItem[];
  subtotal: number;
  vat: number;
  delivery_fee: number;
  total: number;
}

// Address Types
export interface CustomerAddress {
  id: string;
  user_id: string;
  is_default: boolean;
  label?: string;
  full_name: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  province: string;
  postal_code: string;
  special_instructions?: string;
  created_at: string;
  updated_at: string;
}

// Notification Types
export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

// Warehouse Types
export type WarehouseTaskStatus =
  | "pending"
  | "picking"
  | "picked"
  | "packing"
  | "packed"
  | "ready_dispatch";

export interface WarehouseTask {
  id: string;
  order_id: string;
  assigned_user_id?: string;
  status: WarehouseTaskStatus;
  priority: "high" | "medium" | "low";
  notes?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: any;
  };
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Search & Filter Types
export interface ProductFilters {
  category?: string;
  brand?: string;
  min_price?: number;
  max_price?: number;
  in_stock?: boolean;
  search?: string;
}

export interface OrderFilters {
  status?: OrderStatus[];
  date_from?: string;
  date_to?: string;
  customer_id?: string;
  driver_id?: string;
}
