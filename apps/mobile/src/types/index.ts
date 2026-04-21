export type StockTier = "available" | "low" | "allocated" | "cellar_reserve";

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  description?: string;
  bottle_size?: string;
  alcohol_pct?: number;
  country?: string;
  rating?: number;
  review_count?: number;
  in_stock: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
  is_best_seller?: boolean;
  is_new_arrival?: boolean;
  discount?: number;
  stock_quantity?: number;
  max_stock?: number;
  barcode?: string;
  stock_tier?: StockTier;
}

export interface Order {
  id: string;
  order_number: string;
  status: "pending" | "awaiting_payment" | "payment_failed" | "confirmed" | "preparing" | "ready" | "driver_assigned" | "picked_up" | "en_route" | "delivered" | "completed" | "cancelled" | "refunded" | "delivery_failed" | "rescheduled" | "return_to_store" | "return_received";
  total: number;
  subtotal: number;
  delivery_fee: number;
  vat_amount: number;
  discount_amount: number;
  created_at: string;
  estimated_delivery?: string;
  delivery_address: Address;
  items?: OrderItem[];
  user_id?: string;
  payment_method?: string;
  payment_status?: "pending" | "awaiting_payment" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded" | "cash_on_delivery";
  delivery_pin?: string;
  delivery_method?: string;
  customer_notes?: string;
  updated_at?: string;
  actual_delivery?: string;
  stock_reserved?: boolean;
  compliance_verified?: boolean;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  image_url?: string;
}

export interface Address {
  id?: string;
  label: string;
  street: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  deliveryZone?: string;
}

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number?: string;
  avatar_url?: string;
  date_of_birth?: string;
}

// Warehouse
export interface WarehouseTask {
  id: string;
  order_id: string;
  order_number: string;
  task_type: "pick" | "pack" | "dispatch";
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "normal";
  assigned_to?: string;
  assigned_name?: string;
  items: WarehouseTaskItem[];
  notes?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
}

export interface WarehouseTaskItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  barcode: string;
  is_scanned: boolean;
  scanned_at?: string;
  image_url?: string;
  location?: string;
}

// Driver
export interface DriverProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  id_number?: string;
  license_number?: string;
  is_verified: boolean;
  is_active: boolean;
  rating: number;
  total_deliveries: number;
  total_earnings: number;
  vehicle?: DriverVehicle;
  avatar_url?: string;
  created_at: string;
}

export interface DriverVehicle {
  id: string;
  driver_id: string;
  type: "scooter" | "motorcycle" | "car" | "van" | "truck";
  make: string;
  model: string;
  year: number;
  license_plate: string;
  color: string;
  capacity_kg: number;
}

export interface DeliveryAssignment {
  id: string;
  order_id: string;
  order_number: string;
  driver_id: string;
  driver_name?: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  status:
    | "assigned"
    | "accepted"
    | "picked_up"
    | "en_route"
    | "delivered"
    | "failed";
  estimated_delivery?: string;
  actual_delivery?: string;
  items_count: number;
  total: number;
  distance_km?: number;
  created_at: string;
}

// Stock
export interface StockAdjustment {
  id: string;
  product_id: string;
  product_name: string;
  previous_qty: number;
  new_qty: number;
  adjustment: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
}

// Promo
export interface PromoCode {
  id: string;
  code: string;
  description: string;
  discount_type: "percentage" | "fixed" | "free_delivery";
  discount_value: number;
  min_order_value?: number;
  max_uses?: number;
  used_count: number;
  is_active: boolean;
  expires_at?: string;
}

// Rating
export interface DeliveryRating {
  id: string;
  order_id: string;
  driver_id: string;
  customer_id: string;
  customer_name: string;
  driver_rating: number;
  delivery_rating: number;
  comment?: string;
  tip_amount: number;
  created_at: string;
}

// Audit Log
export interface AdminAuditLog {
  id: string;
  admin_id: string;
  admin_name?: string;
  action: string;
  target_type: "order" | "product" | "driver" | "customer" | "promo" | "zone" | "setting";
  target_id: string;
  metadata?: Record<string, any>;
  ip_address?: string;
  created_at: string;
}

// Delivery Tracking
export interface DeliveryTracking {
  id: string;
  order_id: string;
  driver_lat: number;
  driver_lng: number;
  eta_minutes: number;
  status: string;
  created_at: string;
}

// Order Status History
export interface OrderStatusHistory {
  id: string;
  order_id: string;
  from_status: string;
  to_status: string;
  triggered_by: "system" | "customer" | "driver" | "admin";
  actor_id?: string;
  metadata?: Record<string, any>;
  created_at: string;
}

// Customer Dispute
export interface Dispute {
  id: string;
  order_id: string;
  customer_id: string;
  type: "wrong_item" | "damaged" | "missing_item" | "quality" | "late_delivery" | "overcharged" | "other";
  status: "open" | "investigating" | "resolved" | "rejected";
  description: string;
  resolution?: string;
  refund_amount?: number;
  evidence_urls?: string[];
  created_at: string;
  resolved_at?: string;
  resolved_by?: string;
}

// Notification (persistent)
export interface AppNotification {
  id: string;
  user_id: string;
  type: "order_update" | "promotion" | "system" | "driver_alert" | "warehouse_task";
  title: string;
  body: string;
  is_read: boolean;
  data?: Record<string, any>;
  created_at: string;
}

// ─── Payment & Financial ───

export type PaymentStatus = "pending" | "awaiting_payment" | "authorized" | "captured" | "failed" | "refunded" | "partially_refunded" | "cash_on_delivery";

export interface Payment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  payment_method: "card" | "instant_eft" | "snapscan" | "cash_on_delivery" | "apple_pay" | "google_pay";
  gateway: "ozow" | "yoco" | "payfast" | "manual";
  gateway_reference?: string;
  failure_reason?: string;
  created_at: string;
}

export interface Refund {
  id: string;
  order_id: string;
  payment_id?: string;
  amount: number;
  reason: string;
  status: "pending" | "approved" | "processing" | "completed" | "rejected";
  approved_by?: string;
  notes?: string;
  created_at: string;
}

// ─── Compliance & Proof of Delivery ───

export interface ComplianceEvent {
  id: string;
  order_id: string;
  driver_id: string;
  event_type: "age_verified" | "id_checked" | "intoxication_refused" | "minor_refused" | "no_recipient" | "substitute_accepted" | "delivery_hours_violation" | "compliance_incident";
  recipient_name?: string;
  id_document_type?: string;
  id_verified?: boolean;
  outcome: "passed" | "failed" | "refused" | "escalated";
  notes?: string;
  created_at: string;
}

export interface ProofOfDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  photo_url?: string;
  signature_data?: string;
  gps_latitude?: number;
  gps_longitude?: number;
  recipient_name?: string;
  recipient_id_verified: boolean;
  created_at: string;
}

// ─── Support ───

export interface SupportTicket {
  id: string;
  ticket_number: string;
  user_id: string;
  order_id?: string;
  category: "order_issue" | "delivery_problem" | "payment_dispute" | "account_help" | "product_complaint" | "compliance" | "other";
  subject: string;
  description: string;
  status: "open" | "assigned" | "in_progress" | "waiting_customer" | "resolved" | "closed";
  priority: "low" | "medium" | "high" | "urgent";
  created_at: string;
}

// ─── Chat ───

export interface ChatChannel {
  id: string;
  order_id?: string;
  type: "customer_driver" | "driver_dispatch" | "customer_support";
  participant_1: string;
  participant_2: string;
  is_active: boolean;
}

export interface ChatMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  message: string;
  message_type: "text" | "image" | "location" | "system";
  read_at?: string;
  created_at: string;
}

// ─── Loyalty & Referrals ───

export interface LoyaltyAccount {
  id: string;
  user_id: string;
  points_balance: number;
  tier: "bronze" | "silver" | "gold" | "platinum";
  lifetime_points: number;
}

export interface LoyaltyTransaction {
  id: string;
  user_id: string;
  order_id?: string;
  points: number;
  type: "earned" | "redeemed" | "bonus" | "expired" | "adjustment";
  description?: string;
  created_at: string;
}

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  reward_amount: number;
  uses: number;
  max_uses: number;
  is_active: boolean;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  status: "pending" | "first_order_placed" | "reward_issued" | "expired";
  reward_amount?: number;
  created_at: string;
}

// ─── Delivery Zones & Slots ───

export interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  polygon: any;
  base_delivery_fee: number;
  surge_multiplier: number;
  min_order_value: number;
  estimated_delivery_minutes: number;
  is_active: boolean;
  operating_hours: { start: string; end: string };
}

export interface DeliverySlot {
  id: string;
  zone_id?: string;
  date: string;
  start_time: string;
  end_time: string;
  max_orders: number;
  current_orders: number;
  slot_type: "standard" | "express" | "priority";
  premium_fee: number;
  is_available: boolean;
}

// ─── Background Jobs ───

export interface BackgroundJob {
  id: string;
  job_type: "auto_complete" | "stock_expiry" | "reminder" | "cleanup" | "notification";
  target_id: string;
  scheduled_at: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
}
