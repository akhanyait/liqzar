/**
 * LIQZAR Order Workflow Engine
 *
 * Full order lifecycle state machine:
 *
 * HAPPY PATH:
 *   pending → awaiting_payment → confirmed → preparing → ready → driver_assigned →
 *   picked_up → en_route → delivered → completed
 *
 * PAYMENT FAILURE: awaiting_payment → payment_failed → awaiting_payment (retry) OR cancelled
 * CANCELLATION: Any pre-delivery status → cancelled → refunded
 * FAILURE: en_route → delivery_failed → return_to_store → return_received → rescheduled OR cancelled
 * FAILURE (direct): en_route → delivery_failed → rescheduled OR cancelled
 */

import { supabase } from "../lib/supabase";

// ─── Unified Order Statuses ───
export type OrderStatus =
  | "pending" // Order just placed
  | "awaiting_payment" // Waiting for payment confirmation
  | "payment_failed" // Payment attempt failed
  | "confirmed" // Payment confirmed
  | "preparing" // Warehouse picking/packing
  | "ready" // Ready for driver pickup
  | "driver_assigned" // Driver accepted
  | "picked_up" // Driver collected from depot
  | "en_route" // Driver heading to customer
  | "delivered" // Driver confirmed drop-off
  | "completed" // Customer confirmed / auto-closed
  | "cancelled" // Cancelled by customer/admin
  | "refunded" // Refund processed
  | "delivery_failed" // Driver couldn't deliver
  | "rescheduled" // Rescheduled for later delivery
  | "return_to_store" // Goods being returned to depot
  | "return_received"; // Depot confirmed receipt of returned goods

// Payment status values must align with the canonical PaymentStatus type in types/index.ts
export type PaymentStatus =
  | "pending"
  | "awaiting_payment"
  | "authorized"
  | "captured"
  | "failed"
  | "refunded"
  | "partially_refunded"
  | "cash_on_delivery";

// Valid transitions map
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["awaiting_payment", "cancelled"],
  awaiting_payment: ["confirmed", "payment_failed", "cancelled"],
  payment_failed: ["awaiting_payment", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["driver_assigned", "cancelled"],
  driver_assigned: ["picked_up", "cancelled"],
  picked_up: ["en_route"],
  en_route: ["delivered", "delivery_failed"],
  delivered: ["completed"],
  completed: [],
  cancelled: ["refunded"],
  refunded: [],
  delivery_failed: ["rescheduled", "cancelled", "return_to_store"],
  rescheduled: ["driver_assigned"],
  return_to_store: ["return_received", "rescheduled", "cancelled"],
  return_received: ["rescheduled", "cancelled", "refunded"],
};

// Status display config for UI consistency across all roles
export const STATUS_DISPLAY: Record<
  OrderStatus,
  { label: string; color: string; icon: string }
> = {
  pending: { label: "Order Placed", color: "#F59E0B", icon: "time-outline" },
  awaiting_payment: {
    label: "Awaiting Payment",
    color: "#F59E0B",
    icon: "card-outline",
  },
  payment_failed: {
    label: "Payment Failed",
    color: "#EF4444",
    icon: "alert-circle-outline",
  },
  confirmed: {
    label: "Confirmed",
    color: "#3B82F6",
    icon: "checkmark-circle-outline",
  },
  preparing: { label: "Preparing", color: "#8B5CF6", icon: "cube-outline" },
  ready: {
    label: "Ready for Pickup",
    color: "#06B6D4",
    icon: "checkmark-done-outline",
  },
  driver_assigned: {
    label: "Driver Assigned",
    color: "#10B981",
    icon: "car-outline",
  },
  picked_up: {
    label: "Picked Up",
    color: "#10B981",
    icon: "bag-check-outline",
  },
  en_route: { label: "On the Way", color: "#3B82F6", icon: "navigate-outline" },
  delivered: { label: "Delivered", color: "#10B981", icon: "checkmark-circle" },
  completed: {
    label: "Completed",
    color: "#6B7280",
    icon: "checkmark-done-circle",
  },
  cancelled: {
    label: "Cancelled",
    color: "#EF4444",
    icon: "close-circle-outline",
  },
  refunded: {
    label: "Refunded",
    color: "#EF4444",
    icon: "return-down-back-outline",
  },
  delivery_failed: {
    label: "Delivery Failed",
    color: "#EF4444",
    icon: "close-circle",
  },
  rescheduled: {
    label: "Rescheduled",
    color: "#F59E0B",
    icon: "calendar",
  },
  return_to_store: {
    label: "Returning to Store",
    color: "#F97316",
    icon: "arrow-undo-outline",
  },
  return_received: {
    label: "Return Received",
    color: "#6B7280",
    icon: "archive-outline",
  },
};

// Estimated time per status for progress tracking
export const STATUS_ESTIMATED_MINUTES: Partial<Record<OrderStatus, number>> = {
  confirmed: 2,
  preparing: 10,
  ready: 5,
  driver_assigned: 3,
  picked_up: 5,
  en_route: 15,
};

// ─── Workflow Event Types ───
export type WorkflowEvent = {
  order_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  triggered_by: "system" | "customer" | "driver" | "admin";
  actor_id?: string;
  metadata?: Record<string, any>;
  timestamp: string;
};

export type OrderNotification = {
  title: string;
  body: string;
  target_role: "customer" | "driver" | "admin";
  target_user_id?: string;
  order_id: string;
  data?: Record<string, any>;
};

// ─── Notification Templates ───
const NOTIFICATION_TEMPLATES: Record<
  OrderStatus,
  (orderNumber: string, meta?: any) => OrderNotification[]
> = {
  pending: (orderNumber) => [
    {
      title: "New Order!",
      body: `Order ${orderNumber} placed. Processing payment...`,
      target_role: "customer",
      order_id: "",
    },
  ],
  awaiting_payment: (orderNumber) => [
    {
      title: "Payment Pending",
      body: `Order ${orderNumber} is awaiting payment confirmation.`,
      target_role: "customer",
      order_id: "",
    },
  ],
  payment_failed: (orderNumber, meta) => [
    {
      title: "Payment Failed",
      body: `Payment for order ${orderNumber} failed. ${meta?.reason || "Please try again."}`,
      target_role: "customer",
      order_id: "",
    },
  ],
  confirmed: (orderNumber) => [
    {
      title: "Payment Confirmed",
      body: `Order ${orderNumber} payment received. Preparing your order.`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "New Order to Prepare",
      body: `Order ${orderNumber} confirmed. Start picking items.`,
      target_role: "admin",
      order_id: "",
    },
    {
      title: "New Order",
      body: `Order ${orderNumber} confirmed (payment received).`,
      target_role: "admin",
      order_id: "",
    },
  ],
  preparing: (orderNumber) => [
    {
      title: "Order Being Prepared",
      body: `Your order ${orderNumber} is being picked and packed.`,
      target_role: "customer",
      order_id: "",
    },
  ],
  ready: (orderNumber) => [
    {
      title: "Order Ready!",
      body: `Order ${orderNumber} is packed and ready for pickup.`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "Order Ready for Collection",
      body: `Order ${orderNumber} needs a driver. Assign or auto-assign.`,
      target_role: "admin",
      order_id: "",
    },
  ],
  driver_assigned: (orderNumber, meta) => [
    {
      title: "Driver On the Way to Depot",
      body: `${meta?.driver_name || "A driver"} has been assigned to pick up your order ${orderNumber}.`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "New Delivery Assignment",
      body: `You've been assigned order ${orderNumber}. Head to depot.`,
      target_role: "driver",
      // [DEF-008] Only use driver_auth_user_id (auth.users.id).
      // Removed fallback to driver_id (driver_profiles.id) — that UUID never matches
      // user.id in the notification listener and causes silent misrouting.
      // If driver_auth_user_id is missing the engine logs an error and skips the notification.
      target_user_id: meta?.driver_auth_user_id,
      order_id: "",
    },
    {
      title: "Order Dispatched",
      body: `Order ${orderNumber} ready for dispatch.`,
      target_role: "admin",
      order_id: "",
    },
  ],
  picked_up: (orderNumber) => [
    {
      title: "Order Collected",
      body: `Your order ${orderNumber} has been collected from the depot. Driver is on the way!`,
      target_role: "customer",
      order_id: "",
    },
  ],
  en_route: (orderNumber, meta) => [
    {
      title: "Almost There!",
      body: `Your order ${orderNumber} is ${meta?.eta_minutes || 15} minutes away.`,
      target_role: "customer",
      order_id: "",
    },
  ],
  delivered: (orderNumber) => [
    {
      title: "Order Delivered!",
      body: `Your order ${orderNumber} has been delivered. Enjoy! Please rate your experience.`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "Delivery Confirmed",
      body: `Order ${orderNumber} successfully delivered.`,
      target_role: "admin",
      order_id: "",
    },
  ],
  completed: (orderNumber) => [
    {
      title: "Thank You!",
      body: `Order ${orderNumber} is complete. We hope you enjoyed your purchase!`,
      target_role: "customer",
      order_id: "",
    },
  ],
  cancelled: (orderNumber, meta) => [
    {
      title: "Order Cancelled",
      body: `Order ${orderNumber} has been cancelled. ${meta?.reason || ""}`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "Order Cancelled",
      body: `Order ${orderNumber} cancelled. ${meta?.reason || ""}`,
      target_role: "admin",
      order_id: "",
    },
  ],
  refunded: (orderNumber) => [
    {
      title: "Refund Processed",
      body: `Your refund for order ${orderNumber} has been processed.`,
      target_role: "customer",
      order_id: "",
    },
  ],
  delivery_failed: (orderNumber, meta) => [
    {
      title: "Delivery Issue",
      body: `There was an issue delivering order ${orderNumber}. ${meta?.reason || "We'll reschedule shortly."}`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "Delivery Failed",
      body: `Order ${orderNumber} delivery failed: ${meta?.reason || "unknown reason"}.`,
      target_role: "admin",
      order_id: "",
    },
  ],
  rescheduled: (orderNumber) => [
    {
      title: "Delivery Rescheduled",
      body: `Your order ${orderNumber} has been rescheduled for a new delivery attempt.`,
      target_role: "customer",
      order_id: "",
    },
  ],
  return_to_store: (orderNumber, meta) => [
    {
      title: "Order Returning to Store",
      body: `Your order ${orderNumber} is being returned to the store. ${meta?.reason || "We'll be in touch about next steps."}`,
      target_role: "customer",
      order_id: "",
    },
    {
      title: "Return to Store",
      body: `Order ${orderNumber} returning to depot: ${meta?.reason || "delivery failed"}.`,
      target_role: "admin",
      order_id: "",
    },
  ],
  return_received: (orderNumber) => [
    {
      title: "Return Received",
      body: `Returned goods for order ${orderNumber} have been received at the depot.`,
      target_role: "admin",
      order_id: "",
    },
    {
      title: "Return Received",
      body: `Order ${orderNumber} return has been received and checked in.`,
      target_role: "admin",
      order_id: "",
    },
  ],
};

// ─── The Engine ───
class OrderWorkflowEngine {
  private listeners: Map<string, Set<(event: WorkflowEvent) => void>> =
    new Map();
  private notificationListeners: Set<
    (notification: OrderNotification) => void
  > = new Set();

  /**
   * Check if a status transition is valid
   */
  canTransition(from: OrderStatus, to: OrderStatus): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Get valid next statuses from current status
   */
  getNextStatuses(current: OrderStatus): OrderStatus[] {
    return VALID_TRANSITIONS[current] || [];
  }

  /**
   * Core: Transition an order to a new status with full side effects
   */
  async transitionOrder(
    orderId: string,
    toStatus: OrderStatus,
    triggeredBy: WorkflowEvent["triggered_by"],
    actorId?: string,
    metadata?: Record<string, any>,
  ): Promise<{ success: boolean; error?: string; event?: WorkflowEvent; warnings?: string[] }> {
    try {
      // 1. Fetch current order
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("id, order_number, status, user_id, payment_method, payment_status, total, compliance_verified, delivery_address")
        .eq("id", orderId)
        .single();

      if (fetchError || !order) {
        return { success: false, error: "Order not found" };
      }

      const fromStatus = order.status as OrderStatus;

      // 2. Validate transition
      if (!this.canTransition(fromStatus, toStatus)) {
        return {
          success: false,
          error: `Invalid transition: ${fromStatus} → ${toStatus}. Allowed: ${VALID_TRANSITIONS[fromStatus]?.join(", ")}`,
        };
      }

      // 3. Update order status in Supabase
      const updates: Record<string, any> = {
        status: toStatus,
        updated_at: new Date().toISOString(),
      };

      // [DEF-001] Payment status handling on status transitions.
      // The capture-payment Edge Function is the sole authoritative writer of
      // payment_status='captured' on orders. The engine must NOT overwrite it.
      //
      // COD orders: set payment_status='cash_on_delivery' when confirmed.
      // Card orders: the EF already set 'captured' before this transition runs.
      //              Do not write anything — trust the EF.
      // If somehow a card order reaches 'confirmed' without a captured payment
      //   (e.g. admin force-confirm), the EF will update it when the webhook fires.
      if (toStatus === "confirmed") {
        if (order.payment_method === "cash_on_delivery") {
          updates.payment_status = "cash_on_delivery";
        }
        // For all other payment methods: do NOT write payment_status here.
        // The capture-payment EF is the sole writer. [DEF-001]
      }
      if (toStatus === "refunded") {
        updates.payment_status = "refunded";
      }
      if (toStatus === "delivered") {
        updates.actual_delivery = new Date().toISOString();
      }

      // Use optimistic concurrency: only update if status still matches what we read.
      // This prevents TOCTOU race conditions where two concurrent transitions
      // could both read the same fromStatus and both succeed.
      const { data: updateData, error: updateError } = await supabase
        .from("orders")
        .update(updates)
        .eq("id", orderId)
        .eq("status", fromStatus)
        .select();

      if (updateError) {
        return { success: false, error: updateError.message };
      }

      if (!updateData || updateData.length === 0) {
        // Re-fetch the actual current status to give a meaningful message
        const { data: current } = await supabase
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();
        const actualStatus = current?.status ?? "unknown";
        // If the order is already in the target status, treat it as success (idempotent)
        if (actualStatus === toStatus) {
          return { success: true };
        }
        return {
          success: false,
          error: `concurrent_change:${actualStatus}`,
        };
      }

      // [DEF-013] Collect non-critical side effect failures as warnings rather than
      // swallowing them entirely. Critical failures (delivery_assignments, warehouse_tasks)
      // throw and abort the transition. Non-critical ones are collected here.
      const sideEffectWarnings: string[] = [];

      // 4. Log status history (non-critical — audit trail, not fulfillment)
      await supabase
        .from("order_status_history")
        .insert({
          order_id: orderId,
          from_status: fromStatus,
          to_status: toStatus,
          changed_by: actorId || null,
          notes: triggeredBy ? `Triggered by: ${triggeredBy}` : null,
        })
        .then(
          () => {},
          (err: any) => {
            const msg = `status_history_write_failed: ${err?.message}`;
            sideEffectWarnings.push(msg);
            console.error(`[Workflow] [DEF-013] ${msg} (order=${orderId})`);
          }
        );

      // 5. Trigger side effects (critical failures throw and abort here)
      await this.handleSideEffects(
        orderId,
        order,
        fromStatus,
        toStatus,
        metadata,
        sideEffectWarnings,
      );

      // 6. Build event
      const event: WorkflowEvent = {
        order_id: orderId,
        from_status: fromStatus,
        to_status: toStatus,
        triggered_by: triggeredBy,
        actor_id: actorId,
        metadata,
        timestamp: new Date().toISOString(),
      };

      // 7. Fire notifications
      const notifications =
        NOTIFICATION_TEMPLATES[toStatus]?.(order.order_number, metadata) || [];
      notifications.forEach((n) => {
        n.order_id = orderId;
        if (!n.target_user_id && n.target_role === "customer") {
          n.target_user_id = order.user_id;
        }
        this.emitNotification(n);
      });

      // 8. Notify listeners
      this.emitEvent(orderId, event);

      return {
        success: true,
        event,
        warnings: sideEffectWarnings.length > 0 ? sideEffectWarnings : undefined,
      };
    } catch (err: any) {
      console.error(`[OrderWorkflowEngine] transitionOrder FAILED: order=${orderId}, to=${toStatus}`, err);
      return { success: false, error: err?.message || "Unknown error" };
    }
  }

  /**
   * Handle automated side effects per transition
   */
  private async handleSideEffects(
    orderId: string,
    order: any,
    fromStatus: OrderStatus,
    toStatus: OrderStatus,
    metadata?: Record<string, any>,
    sideEffectWarnings: string[] = [],
  ) {
    switch (toStatus) {
      case "awaiting_payment": {
        // [DEF-002] Reserve stock for all order items atomically in one DB transaction.
        // A single RPC call replaces the old per-item for-loop which had no rollback
        // on partial failure and no row-level lock to prevent concurrent over-selling.
        const { error: reserveErr } = await supabase.rpc("reserve_order_stock", {
          p_order_id: orderId,
        });
        if (reserveErr) {
          // Throw so transitionOrder returns success:false — blocks awaiting_payment.
          // Customer sees "item out of stock" before any payment is initiated.
          throw new Error(`stock_reservation_failed: ${reserveErr.message}`);
        }
        break;
      }

      case "payment_failed": {
        // [DEF-002] Release reserved stock atomically via the new RPC.
        const { error: releaseErr } = await supabase.rpc("release_order_stock", {
          p_order_id: orderId,
        });
        if (releaseErr) {
          const msg = `stock_release_failed: ${releaseErr.message}`;
          sideEffectWarnings.push(msg);
          console.error(`[Workflow] [DEF-013] ${msg} (order=${orderId}) — stock may remain reserved`);
        }
        break;
      }

      case "confirmed": {
        // Stock was already atomically reserved at awaiting_payment via reserve_order_stock.
        // [DEF-002] No second decrement needed — reserve_order_stock already decremented
        // stock_quantity. The old pattern of reserve-then-decrement created a double-deduct.
        // We keep a reference to orderItems for the price-check below.
        const { data: orderItems } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);

        // [DEF-010] Validate unit prices match actual product prices.
        // If a mismatch is found, ABORT the confirmation and require admin review.
        // DO NOT silently correct prices post-payment — that creates an accounting
        // discrepancy (customer charged X, records show Y) and may violate CPA.
        const productIds = orderItems?.map(i => i.product_id) || [];
        const { data: products } = await supabase
          .from("products")
          .select("id, price")
          .in("id", productIds);

        if (products && orderItems) {
          const priceMap = new Map(products.map(p => [p.id, p.price]));
          const { data: fullItems } = await supabase
            .from("order_items")
            .select("product_id, unit_price")
            .eq("order_id", orderId);

          if (fullItems) {
            const mismatchedProductIds: string[] = [];
            for (const item of fullItems) {
              const realPrice = priceMap.get(item.product_id);
              if (realPrice && Math.abs(item.unit_price - realPrice) > 0.01) {
                mismatchedProductIds.push(item.product_id);
                console.warn(
                  `[Workflow] [DEF-010] Price mismatch on order ${orderId} for product ${item.product_id}: ` +
                  `order has ${item.unit_price}, current price is ${realPrice}. Blocking confirmation.`
                );
              }
            }

            if (mismatchedProductIds.length > 0) {
              // Abort: return a structured error the caller can surface to admin
              throw new Error(
                `price_mismatch:${mismatchedProductIds.join(",")}`,
              );
            }
          }
        }

        // Auto-create warehouse pick task
        await this.createWarehouseTask(orderId, order.order_number, "pick");
        // Generate delivery PIN via server-side RPC for cryptographic security
        const { data: pin, error: pinErr } = await supabase.rpc("generate_delivery_pin", {
          p_order_id: orderId,
        });
        if (pinErr) {
          console.error(`[Workflow] Failed to generate delivery PIN for order ${orderId}:`, pinErr);
        }
        // PIN is stored server-side by the RPC; no client-side update needed
        break;
      }

      case "preparing":
        // Update warehouse task to in_progress
        await supabase
          .from("warehouse_tasks")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("task_type", "pick");
        break;

      case "ready":
        // Auto-create pack-complete, mark warehouse pick done
        await supabase
          .from("warehouse_tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("task_type", "pick");
        // Create dispatch task
        await this.createWarehouseTask(orderId, order.order_number, "dispatch");
        // Auto-assign nearest available driver (simulation)
        await this.autoAssignDriver(orderId, order);
        break;

      case "driver_assigned":
        // [DEF-015] Stamp the exact moment the driver was assigned.
        // orders.updated_at resets on ANY column change (e.g. payment EF write)
        // and is therefore an unreliable proxy for assignment time.
        // driver_assigned_at is immutable after being set here.
        await supabase
          .from("orders")
          .update({ driver_assigned_at: new Date().toISOString() })
          .eq("id", orderId)
          .then(
            () => {},
            (err: any) => {
              const msg = `driver_assigned_at_write_failed: ${err?.message}`;
              sideEffectWarnings.push(msg);
              console.warn(`[Workflow] [DEF-015] ${msg} (order=${orderId})`);
            }
          );

        // [DEF-008] Warn when driver_auth_user_id is absent — notification will not be delivered.
        if (metadata?.driver_id && !metadata?.driver_auth_user_id) {
          console.error(
            `[Workflow] DEF-008: driver_auth_user_id missing for order ${orderId}. ` +
            `Driver in-app notification will not be sent. ` +
            `Callers must pass driver_auth_user_id = auth.users.id alongside driver_id = driver_profiles.id.`
          );
        }
        // Update existing pre-assignment row (inserted by admin assignDriver),
        // or insert fresh if none exists (e.g. auto-assigned by system).
        if (metadata?.driver_id) {
          const { data: existing } = await supabase
            .from("delivery_assignments")
            .select("id")
            .eq("order_id", orderId)
            .eq("driver_id", metadata.driver_id)
            .maybeSingle();

          if (existing?.id) {
            // Row already exists from pre-assignment — keep status as "pending"
            // (driver must explicitly accept). Nothing to update.
          } else {
            // [DEF-013] delivery_assignments INSERT is CRITICAL — if this fails the driver
            // cannot see the order. Throw so transitionOrder returns success:false.
            const { error: assignInsertErr } = await supabase
              .from("delivery_assignments")
              .insert({
                order_id: orderId,
                driver_id: metadata.driver_id,
                status: "pending",
                created_at: new Date().toISOString(),
              });
            if (assignInsertErr) {
              throw new Error(
                `delivery_assignment_failed: ${assignInsertErr.message}`
              );
            }
          }
        }
        break;

      case "picked_up":
        // Update delivery assignment
        await supabase
          .from("delivery_assignments")
          .update({ status: "picked_up" })
          .eq("order_id", orderId);
        // Mark warehouse dispatch task complete
        await supabase
          .from("warehouse_tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("task_type", "dispatch");
        break;

      case "en_route": {
        // Update delivery assignment status.
        // CHECK constraint: ('pending','accepted','picked_up','in_transit','delivered','cancelled')
        // 'en_route' is NOT valid — use 'in_transit'. [DEF-007]
        await supabase
          .from("delivery_assignments")
          .update({ status: "in_transit" })
          .eq("order_id", orderId);

        // delivery_tracking requires assignment_id (NOT NULL FK) and uses
        // latitude/longitude — not order_id, driver_lat/driver_lng, or eta_minutes.
        // Fetch the assignment that was just updated to get its id.
        const { data: enRouteAssignment } = await supabase
          .from("delivery_assignments")
          .select("id")
          .eq("order_id", orderId)
          .eq("status", "in_transit")
          .maybeSingle();

        if (enRouteAssignment?.id) {
          await supabase
            .from("delivery_tracking")
            .insert({
              assignment_id: enRouteAssignment.id,
              latitude: metadata?.lat ?? -26.1076,
              longitude: metadata?.lng ?? 28.0567,
            })
            .then(() => {}, (err: any) => console.error(`[Workflow] Failed to create delivery tracking entry for order ${orderId}:`, err));
        }
        break;
      }

      case "delivered":
        // Before marking delivered, check compliance
        if (order.compliance_verified !== true) {
          throw new Error("Compliance verification required before delivery completion");
        }
        // Complete delivery assignment
        await supabase
          .from("delivery_assignments")
          .update({
            status: "delivered",
            actual_delivery: new Date().toISOString(),
          })
          .eq("order_id", orderId);
        // Schedule auto-complete via persistent background job
        await supabase.from("background_jobs").insert({
          job_type: "auto_complete",
          target_id: orderId,
          scheduled_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "pending",
        }).then(() => {}, (err: any) => console.error(`[Workflow] Failed to schedule auto-complete job for order ${orderId}:`, err));
        break;

      case "cancelled": {
        // [DEF-009] Only restore stock if not already restored by a prior side effect.
        // return_received already calls increment_stock for all items.
        // If this cancellation follows return_received, restoring again creates phantom stock.
        const stockAlreadyRestored = fromStatus === "return_received";

        if (!stockAlreadyRestored) {
          const { data: cancelledItems } = await supabase
            .from("order_items")
            .select("product_id, quantity")
            .eq("order_id", orderId);

          if (cancelledItems) {
            for (const item of cancelledItems) {
              const { error: stockErr } = await supabase.rpc("increment_stock", {
                p_product_id: item.product_id,
                p_quantity: item.quantity,
              });
              if (stockErr) {
                console.error(
                  `[Workflow] CRITICAL: Failed to restore stock for product ${item.product_id} (qty: ${item.quantity}) on order ${orderId} cancellation:`,
                  stockErr,
                );
              }
            }
          }
        } else {
          console.log(
            `[Workflow] [DEF-009] Skipping stock restore for order ${orderId} cancelled from 'return_received' — already restored.`
          );
        }

        // Cancel any pending warehouse tasks
        await supabase
          .from("warehouse_tasks")
          .update({ status: "cancelled" })
          .eq("order_id", orderId)
          .in("status", ["pending", "in_progress"]);
        // Cancel delivery assignment if exists.
        // [DEF-007] 'failed' is not in CHECK constraint — use 'cancelled'.
        // [DEF-007] 'assigned' was never a valid status — include 'pending' and 'in_transit'.
        await supabase
          .from("delivery_assignments")
          .update({ status: "cancelled" })
          .eq("order_id", orderId)
          .in("status", ["pending", "accepted", "in_transit"]);
        // Auto-trigger refund only when money was actually captured/authorised.
        // The previous check included `payment_method === "card"` without a
        // payment_status guard, which caused unpaid card orders to be incorrectly
        // marked as refunded on cancellation.
        if (
          order.payment_status === "captured" ||
          order.payment_status === "authorized"
        ) {
          setTimeout(() => {
            this.transitionOrder(orderId, "refunded", "system");
          }, 2000);
        }
        break;
      }

      case "refunded": {
        // Stock was already restored in the "cancelled" case — do NOT restore again here.
        // Update payment status
        await supabase
          .from("orders")
          .update({ payment_status: "refunded" })
          .eq("id", orderId);

        // TODO: Integrate with payment gateway for actual refund
        console.log(`[Workflow] Refund processed for order ${orderId} - payment gateway integration pending`);
        break;
      }

      case "delivery_failed":
        // Update delivery assignment.
        // [DEF-007] 'failed' is not in CHECK constraint — use 'cancelled'.
        await supabase
          .from("delivery_assignments")
          .update({
            status: "cancelled",
            failed_reason: metadata?.reason || "unknown",
            failed_at: new Date().toISOString(),
          })
          .eq("order_id", orderId);
        // Log the failure reason
        console.warn(`[Workflow] Delivery failed for order ${orderId}: ${metadata?.reason || 'unknown'}`);
        break;

      case "return_to_store":
        // Create return-to-store warehouse task
        await this.createWarehouseTask(orderId, order.order_number, "dispatch");
        // Log return reason
        console.warn(`[Workflow] Return to store for order ${orderId}: ${metadata?.reason || 'delivery failed'}`);
        break;

      case "return_received": {
        // Depot has confirmed receipt of returned goods
        // Restore stock from returned items
        const { data: returnedItems } = await supabase
          .from("order_items")
          .select("product_id, quantity")
          .eq("order_id", orderId);

        if (returnedItems) {
          for (const item of returnedItems) {
            await supabase.rpc("increment_stock", {
              p_product_id: item.product_id,
              p_quantity: item.quantity,
            }).then(() => {}, (err: any) => console.error(`[Workflow] Failed to increment stock for returned product ${item.product_id}:`, err));
          }
        }
        // Mark return warehouse task as complete
        await supabase
          .from("warehouse_tasks")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("order_id", orderId)
          .eq("task_type", "dispatch")
          .eq("status", "pending");
        break;
      }

      case "rescheduled":
        // Create a new warehouse task for re-pick
        await this.createWarehouseTask(orderId, order.order_number, "dispatch");
        break;
    }
  }

  /**
   * Create a warehouse task for an order
   */
  // [DEF-013] createWarehouseTask is CRITICAL — warehouse must receive the pick task.
  // Throws on failure so the caller (handleSideEffects) propagates the error upward,
  // causing transitionOrder to return success:false and alert the operator.
  private async createWarehouseTask(
    orderId: string,
    orderNumber: string,
    taskType: "pick" | "pack" | "dispatch",
  ) {
    const { data: items } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", orderId);

    const { error: taskErr } = await supabase
      .from("warehouse_tasks")
      .insert({
        order_id: orderId,
        order_number: orderNumber,
        task_type: taskType,
        status: "pending",
        priority: "high",
        items_count: items?.length || 0,
        created_at: new Date().toISOString(),
      });

    if (taskErr) {
      throw new Error(
        `warehouse_task_create_failed (${taskType}): ${taskErr.message}`
      );
    }
  }

  /**
   * Auto-assign the best available driver using dispatch scoring.
   * Scores drivers based on proximity, rating, and availability via server-side RPC.
   */
  private async autoAssignDriver(orderId: string, order: any) {
    // Get order delivery coordinates for scoring
    const orderLat = order.delivery_address?.coordinates?.lat || order.delivery_lat || -26.1076;
    const orderLng = order.delivery_address?.coordinates?.lng || order.delivery_lng || 28.0567;

    // Score drivers and pick the best.
    // [DEF-005] Select BOTH id (driver_profiles PK, FK target for delivery_assignments)
    // AND user_id (auth.users.id, needed for notification routing).
    const { data: drivers } = await supabase
      .from("driver_profiles")
      .select("id, user_id, full_name, status, is_verified")
      .eq("status", "active")
      .eq("is_verified", true);

    if (drivers?.length) {
      // Calculate dispatch scores
      const scored = await Promise.all(
        drivers.map(async (d) => {
          const { data } = await supabase.rpc("calculate_dispatch_score", {
            p_driver_id: d.user_id,
            p_order_lat: orderLat,
            p_order_lng: orderLng,
          });
          return { ...d, score: data || 0 };
        }),
      );
      scored.sort((a, b) => b.score - a.score);
      const bestDriver = scored[0];

      // Transition to driver_assigned.
      // [DEF-005] driver_id must be driver_profiles.id (FK target).
      // [DEF-008] driver_auth_user_id must be auth.users.id (notification routing).
      await this.transitionOrder(
        orderId,
        "driver_assigned",
        "system",
        undefined,
        {
          driver_id: bestDriver.id,               // driver_profiles.id — FK target
          driver_name: bestDriver.full_name,
          driver_auth_user_id: bestDriver.user_id, // auth.users.id — notification target
          dispatch_score: bestDriver.score,
        },
      );
    }
    // If no drivers, admin gets notified via "ready" notification to manually assign
  }

  // ─── Payment Processing ───

  /**
   * Payment handling - delegates to PaymentService.
   * This is called by CheckoutScreen after PaymentService returns.
   * Do NOT simulate - return the actual payment result.
   */
  async processPayment(
    orderId: string,
    paymentMethod: string,
  ): Promise<{ success: boolean; paymentId?: string }> {
    throw new Error(
      "Payment must be processed through PaymentService before confirming order",
    );
  }

  // ─── Demo: Simulate Full Order Flow ───

  /**
   * For testing: Run through the entire order lifecycle with delays
   */
  async simulateFullFlow(orderId: string, speedMs = 3000) {
    console.warn("[Workflow] simulateFullFlow is disabled in production");
    return;
  }

  // ─── Stock Availability Check ───

  /**
   * Check stock availability for cart items before placing order.
   * Returns { available: boolean, items: [...] } where each item has
   * product_id, product_name, requested, available, sufficient.
   */
  async checkStockAvailability(
    items: Array<{ product_id: string; quantity: number; product_name?: string }>,
  ): Promise<{
    available: boolean;
    items: Array<{
      product_id: string;
      product_name: string;
      requested: number;
      available: number;
      sufficient: boolean;
    }>;
    error?: string;
  }> {
    try {
      const productIds = items.map((i) => i.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_quantity")
        .in("id", productIds);

      const productMap = new Map(
        (products || []).map((p: any) => [p.id, p]),
      );

      const result = items.map((item) => {
        const product = productMap.get(item.product_id) as any;
        const available = product?.stock_quantity ?? 0;
        return {
          product_id: item.product_id,
          product_name: product?.name || item.product_name || "Unknown",
          requested: item.quantity,
          available,
          sufficient: available >= item.quantity,
        };
      });

      return {
        available: result.every((r) => r.sufficient),
        items: result,
      };
    } catch (err: any) {
      // Fail-closed: if stock check fails, do NOT allow the order through
      console.error("[Workflow] Stock availability check failed:", err?.message || err);
      return { available: false, items: [], error: "Stock check unavailable. Please try again." };
    }
  }

  // ─── Delivery PIN Verification ───

  /**
   * Verify delivery PIN entered by driver at customer doorstep.
   * Returns { verified, attemptsRemaining, locked, error }.
   */
  async verifyDeliveryPin(
    orderId: string,
    enteredPin: string,
  ): Promise<{
    verified: boolean;
    attemptsRemaining?: number;
    locked?: boolean;
    error?: string;
  }> {
    try {
      const { data: result } = await supabase.rpc("verify_delivery_pin", {
        p_order_id: orderId,
        p_entered_pin: enteredPin,
      });

      if (result) {
        return {
          verified: result.verified === true,
          attemptsRemaining: result.attempts_remaining,
          locked: result.locked === true,
          error: result.error,
        };
      }
      return { verified: false, error: "Verification failed" };
    } catch (rpcError: any) {
      // SECURITY: Do NOT fall back to client-side PIN comparison.
      // Fetching the PIN to the client for comparison would expose it in memory/network logs.
      console.warn(
        `[Workflow] verifyDeliveryPin: RPC verify_delivery_pin failed for order ${orderId}. ` +
        `PIN verification unavailable. Error: ${rpcError?.message || "unknown"}`,
      );
      return { verified: false, error: "PIN verification service unavailable. Please try again." };
    }
  }

  /**
   * Get delivery PIN for a customer's order.
   * DEF-011: Delegates to get_my_delivery_pin RPC which enforces both ownership
   * and timing gate (status must be driver_assigned / picked_up / en_route).
   * Direct column reads are no longer used — the RLS SELECT policy would expose
   * the PIN at any order status via a raw PostgREST call.
   */
  async getDeliveryPin(orderId: string): Promise<string | null> {
    const { data, error } = await supabase.rpc("get_my_delivery_pin", {
      p_order_id: orderId,
    });

    if (error) {
      console.error("[Workflow] getDeliveryPin: RPC error", error);
      return null;
    }

    return (data as string | null) || null;
  }

  // ─── Depot Release & Driver Sign-off ───

  /**
   * Warehouse confirms release of goods to driver
   */
  async depotRelease(
    orderId: string,
    warehouseUserId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result } = await supabase.rpc("record_depot_release", {
        p_order_id: orderId,
        p_warehouse_user_id: warehouseUserId,
      });

      if (result?.success) {
        return { success: true };
      }

      return { success: false, error: "Depot release service unavailable" };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  /**
   * Driver confirms receipt of goods at depot
   */
  async driverSignOff(
    orderId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: result } = await supabase.rpc("record_driver_signoff", {
        p_order_id: orderId,
      });

      if (result?.success) {
        return { success: true };
      }

      // Fallback direct update
      await supabase
        .from("delivery_assignments")
        .update({
          driver_signed_off_at: new Date().toISOString(),
        })
        .eq("order_id", orderId);

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message };
    }
  }

  // ─── Event System ───

  onOrderEvent(
    orderId: string,
    callback: (event: WorkflowEvent) => void,
  ): () => void {
    if (!this.listeners.has(orderId)) {
      this.listeners.set(orderId, new Set());
    }
    this.listeners.get(orderId)!.add(callback);
    return () => {
      this.listeners.get(orderId)?.delete(callback);
    };
  }

  onNotification(
    callback: (notification: OrderNotification) => void,
  ): () => void {
    this.notificationListeners.add(callback);
    return () => {
      this.notificationListeners.delete(callback);
    };
  }

  private emitEvent(orderId: string, event: WorkflowEvent) {
    this.listeners.get(orderId)?.forEach((cb) => cb(event));
    // Also emit to wildcard listeners
    this.listeners.get("*")?.forEach((cb) => cb(event));
  }

  private emitNotification(notification: OrderNotification) {
    this.notificationListeners.forEach((cb) => cb(notification));
  }

  // ─── Convenience Queries ───

  async getOrderTimeline(orderId: string): Promise<WorkflowEvent[]> {
    const { data } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    return (data || []).map((row: any) => ({
      order_id: row.order_id,
      from_status: row.from_status,
      to_status: row.to_status,
      triggered_by: row.triggered_by,
      actor_id: row.actor_id,
      metadata: row.metadata,
      timestamp: row.created_at,
    }));
  }
}

// Singleton
export const orderWorkflow = new OrderWorkflowEngine();
