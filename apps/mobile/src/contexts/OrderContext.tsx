import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
import { supabase } from "../lib/supabase";
import { useAuth } from "./AuthContext";
import {
  orderWorkflow,
  OrderStatus,
  STATUS_DISPLAY,
  WorkflowEvent,
  OrderNotification,
} from "../services/OrderWorkflowEngine";

interface ActiveOrder {
  id: string;
  order_number: string;
  status: OrderStatus;
  total: number;
  created_at: string;
  updated_at?: string;
  user_id: string;
  delivery_address?: any;
  payment_method?: string;
  payment_status?: string;
  driver_name?: string;
  eta_minutes?: number;
  // Enriched by refreshOrders — joined order_items rows (use .length for count)
  // and the customer's full_name resolved from profiles via user_id.
  order_items?: Array<{ id: string; quantity?: number; name?: string }>;
  customer_name?: string;
}

interface OrderContextType {
  // Active orders for current user/role
  activeOrders: ActiveOrder[];
  // Real-time notifications
  notifications: OrderNotification[];
  unreadCount: number;
  // Actions
  placeOrder: (
    orderData: any,
  ) => Promise<{ success: boolean; orderId?: string; error?: string; unavailableItems?: Array<{product_id: string; product_name: string; requested: number; available: number}> }>;
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    metadata?: Record<string, any>,
  ) => Promise<boolean>;
  cancelOrder: (orderId: string, reason?: string) => Promise<boolean>;
  // Driver actions
  acceptDelivery: (orderId: string) => Promise<boolean>;
  markPickedUp: (orderId: string) => Promise<boolean>;
  markEnRoute: (orderId: string, eta?: number) => Promise<boolean>;
  markDelivered: (orderId: string) => Promise<boolean>;
  // Warehouse actions
  startPreparing: (orderId: string) => Promise<boolean>;
  markReady: (orderId: string) => Promise<boolean>;
  // Admin actions
  assignDriver: (
    orderId: string,
    driverId: string,
    driverName: string,
  ) => Promise<boolean>;
  // Stock & PIN verification
  checkStock: (
    items: Array<{ product_id: string; quantity: number; product_name?: string }>,
  ) => Promise<{ available: boolean; items: any[] }>;
  verifyDeliveryPin: (
    orderId: string,
    pin: string,
  ) => Promise<{ verified: boolean; attemptsRemaining?: number; locked?: boolean; error?: string }>;
  getDeliveryPin: (orderId: string) => Promise<string | null>;
  depotRelease: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  driverSignOff: (orderId: string) => Promise<{ success: boolean; error?: string }>;
  // Helpers
  getStatusDisplay: (status: string) => {
    label: string;
    color: string;
    icon: string;
  };
  refreshOrders: () => Promise<void>;
  clearNotification: (index: number) => void;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: React.ReactNode }) {
  const { user, role } = useAuth();
  const [activeOrders, setActiveOrders] = useState<ActiveOrder[]>([]);
  const [notifications, setNotifications] = useState<OrderNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const subscriptionRef = useRef<any>(null);

  // ─── Load orders based on role ───
  const refreshOrders = useCallback(async () => {
    if (!user?.id) return;

    try {
      let query = supabase
        .from("orders")
        // Embed order_items so every screen can read .order_items.length without
        // an N+1 follow-up query. RLS on order_items must allow the current role
        // to read items for orders they can see (driver: assigned orders;
        // customer: own orders; admin: all).
        .select("*, order_items(id, quantity, product_name)")
        .order("created_at", { ascending: false })
        .limit(50);

      // Filter by role
      if (role === "customer" || !role) {
        query = query.eq("user_id", user.id);
      }
      // Admin and warehouse see all active orders
      if (role === "driver") {
        // delivery_assignments.driver_id references driver_profiles.id (NOT auth.users.id).
        // Look up the driver profile first, then filter assignments by that profile id.
        const { data: driverProfile } = await supabase
          .from("driver_profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (!driverProfile?.id) {
          setActiveOrders([]);
          return;
        }

        const { data: assignments } = await supabase
          .from("delivery_assignments")
          .select("order_id")
          .eq("driver_id", driverProfile.id);

        if (assignments && assignments.length > 0) {
          const orderIds = [...new Set(assignments.map((a: any) => a.order_id))];
          query = query.in("id", orderIds);
        } else {
          setActiveOrders([]);
          return;
        }
      }

      const { data, error } = await query;
      if (!error && data) {
        // Enrich with customer names from profiles. The orders query already
        // pulls order_items via the embedded resource (see .select above), so
        // count is `o.order_items.length`. For customer name we need a second
        // batched query because orders.user_id → auth.users (not profiles),
        // and PostgREST can't auto-detect that relationship.
        const uniqueUserIds = Array.from(
          new Set(
            (data as any[])
              .map((o) => o.user_id)
              .filter((id): id is string => !!id),
          ),
        );
        const nameByUserId = new Map<string, string>();
        if (uniqueUserIds.length > 0) {
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", uniqueUserIds);
          if (profs) {
            for (const p of profs as any[]) {
              if (p.full_name) nameByUserId.set(p.id, p.full_name);
            }
          }
        }
        const enriched = (data as any[]).map((o) => ({
          ...o,
          customer_name:
            o.delivery_address?.recipient_name ||
            o.delivery_address?.name ||
            nameByUserId.get(o.user_id) ||
            "",
        }));
        setActiveOrders(enriched as ActiveOrder[]);
      }
    } catch (err) {
      console.log("[OrderCtx] Error loading orders:", err);
    }
  }, [user?.id, role]);

  // ─── Real-time subscription ───
  useEffect(() => {
    if (!user?.id) return;

    // Subscribe to order changes
    const channel = supabase
      .channel(`orders-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          ...(role === "customer" ? { filter: `user_id=eq.${user.id}` } : {}),
        },
        (payload: any) => {
          if (payload.eventType === "UPDATE") {
            setActiveOrders((prev) =>
              prev.map((o) =>
                o.id === payload.new.id ? { ...o, ...payload.new } : o,
              ),
            );
          } else if (payload.eventType === "INSERT") {
            setActiveOrders((prev) => [payload.new as ActiveOrder, ...prev]);
          }
        },
      )
      .on(
        // Drivers: when a new delivery_assignment row is inserted/updated,
        // refresh so the assigned order appears on their dashboard immediately.
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "delivery_assignments",
        },
        () => {
          if (role === "driver") {
            refreshOrders();
          }
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    // Listen for workflow notifications
    const unsubNotif = orderWorkflow.onNotification((notification) => {
      // Only show notifications relevant to current role
      if (
        notification.target_role === role ||
        notification.target_role === "admin"
      ) {
        if (
          !notification.target_user_id ||
          notification.target_user_id === user.id
        ) {
          setNotifications((prev) => [notification, ...prev].slice(0, 20));
          setUnreadCount((c) => c + 1);

          // Show in-app alert for important status changes
          if (
            notification.target_role === role ||
            (role === "customer" && notification.target_role === "customer")
          ) {
            Alert.alert(notification.title, notification.body);
          }
        }
      }
    });

    refreshOrders();

    return () => {
      channel.unsubscribe();
      unsubNotif();
    };
  }, [user?.id, role, refreshOrders]);

  // ─── Refresh on app foreground ───
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") refreshOrders();
    });
    return () => sub.remove();
  }, [refreshOrders]);

  // ─── Place Order (with auto payment processing) ───
  const placeOrder = useCallback(
    async (
      orderData: any,
    ): Promise<{ success: boolean; orderId?: string; error?: string; unavailableItems?: any[] }> => {
      try {
        // Check stock availability before placing order
        if (orderData.items?.length) {
          const stockResult = await orderWorkflow.checkStockAvailability(
            orderData.items.map((i: any) => ({
              product_id: i.product_id,
              quantity: i.quantity,
              product_name: i.product_name || i.name,
            })),
          );
          if (!stockResult.available) {
            const unavailable = stockResult.items.filter((i) => !i.sufficient);
            return {
              success: false,
              error: `${unavailable.length} item(s) are out of stock or have insufficient quantity.`,
              unavailableItems: unavailable,
            };
          }
        }

        const { data: order, error: orderError } = await supabase
          .from("orders")
          .insert({
            user_id: orderData.user_id,
            status: "pending",
            subtotal: orderData.subtotal,
            delivery_fee: orderData.delivery_fee,
            vat_amount: orderData.vat_amount,
            total: orderData.total,
            delivery_address: orderData.delivery_address,
            delivery_method: orderData.delivery_method,
            payment_method: orderData.payment_method,
            payment_status: "pending",
            customer_notes: orderData.customer_notes,
            discount_amount: orderData.discount_amount || 0,
            scheduled_for_date: orderData.scheduled_for_date ?? null,
            scheduled_window: orderData.scheduled_window ?? null,
          })
          .select()
          .single();

        if (orderError) throw orderError;

        // Insert order items
        if (orderData.items?.length) {
          const orderItems = orderData.items.map((item: any) => ({
            order_id: order.id,
            product_id: item.product_id,
            product_name: item.product_name || item.name || "Unknown Product",
            product_image: item.product_image || item.image_url || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            subtotal: item.quantity * item.unit_price,
          }));
          const { error: itemsErr } = await supabase.from("order_items").insert(orderItems);
          if (itemsErr) {
            // Roll back order to avoid ghost orders with no items
            await supabase.from("orders").delete().eq("id", order.id);
            throw new Error(`Failed to save order items: ${itemsErr.message}`);
          }
        }

        // Gift analytics — best-effort, never fail the order on analytics error
        if (orderData.gift?.wrap_style) {
          supabase
            .from("gift_events")
            .insert({
              order_id: order.id,
              user_id: orderData.user_id,
              wrap_style: orderData.gift.wrap_style,
              wrap_fee: orderData.gift.wrap_fee ?? 0,
              has_note: !!orderData.gift.has_note,
              note_length: orderData.gift.note_length ?? 0,
              ship_to_recipient: !!orderData.gift.ship_to_recipient,
              platform: Platform.OS === "ios" ? "ios" : "android",
            })
            .then(
              () => {},
              (err: any) =>
                console.warn("[Gift analytics] insert failed:", err?.message),
            );
        }

        // Order created — payment is handled by PaymentService in CheckoutScreen
        return { success: true, orderId: order.id };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || "Failed to place order",
        };
      }
    },
    [],
  );

  // ─── Status Update Actions ───
  const updateOrderStatus = useCallback(
    async (
      orderId: string,
      status: OrderStatus,
      metadata?: Record<string, any>,
    ): Promise<boolean> => {
      const triggerRole = (role || "customer") as WorkflowEvent["triggered_by"];
      const result = await orderWorkflow.transitionOrder(
        orderId,
        status,
        triggerRole,
        user?.id,
        metadata,
      );
      if (!result.success) {
        if (result.error?.startsWith("concurrent_change:")) {
          // Order was updated by another user/device between our read and write.
          // Refresh silently — the new status will reflect correctly in the UI.
          const actualStatus = result.error.split(":")[1];
          await refreshOrders();
          // Only alert if the current state prevents the driver from proceeding
          // (e.g. order was cancelled, not just advanced to the next natural step)
          const terminalStatuses = ["cancelled", "refunded", "completed", "delivery_failed"];
          if (terminalStatuses.includes(actualStatus)) {
            Alert.alert(
              "Order Status Changed",
              `This order has been ${actualStatus.replace(/_/g, " ")} by another user. Refreshing...`,
            );
          }
          // Otherwise silently refresh — the screen will re-render with the correct state
        } else {
          Alert.alert(
            "Status Update Failed",
            result.error || "Could not update order status.",
          );
        }
      }

      // Audit log for admin actions.
      // [DEF-014] Use result.event.from_status instead of hardcoded "unknown".
      if (role === "admin") {
        const fromStatus = result.event?.from_status ?? "unknown";
        supabase.from("admin_audit_log").insert({
          admin_id: user?.id,
          action: `status_change_${status}`,
          target_type: "order",
          target_id: orderId,
          metadata: {
            from_status: fromStatus,
            to_status: status,
            actor_id: user?.id,
            timestamp: new Date().toISOString(),
            ...metadata,
          },
        }).then(() => {}, (err: any) => console.error("[Audit] Failed to log admin action:", err));
      }

      return result.success;
    },
    [role, user?.id, refreshOrders],
  );

  const cancelOrder = useCallback(
    async (orderId: string, reason?: string): Promise<boolean> => {
      // Enforce 10-minute cancellation window
      const { data: order, error: fetchErr } = await supabase
        .from("orders")
        .select("created_at, status")
        .eq("id", orderId)
        .single();

      if (fetchErr || !order) {
        Alert.alert("Error", "Could not retrieve order details. Please try again.");
        return false;
      }

      // "payment_confirmed" is not a real status — the correct in-flight payment statuses
      // are awaiting_payment and payment_failed. confirmed is included for the short window
      // before warehouse starts picking.
      const cancellableStatuses: string[] = ["pending", "awaiting_payment", "payment_failed", "confirmed"];
      if (!cancellableStatuses.includes(order.status)) {
        Alert.alert(
          "Cannot Cancel",
          "This order is already being prepared and can no longer be cancelled. Please contact support.",
        );
        return false;
      }

      const ageMs = Date.now() - new Date(order.created_at).getTime();
      const CANCELLATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
      if (ageMs > CANCELLATION_WINDOW_MS) {
        Alert.alert(
          "Cancellation Window Expired",
          "Orders can only be cancelled within 10 minutes of being placed. Please contact support if you need further assistance.",
        );
        return false;
      }

      return updateOrderStatus(orderId, "cancelled", {
        reason: reason || "Cancelled by user",
      });
    },
    [updateOrderStatus],
  );

  // ─── Driver Actions ───
  // acceptDelivery: driver acknowledges the assignment.
  // The order stays in driver_assigned — transitioning driver_assigned→driver_assigned
  // is not a valid state machine move. Acceptance is recorded on the delivery_assignments
  // row so dispatch can see the driver has confirmed without touching order status.
  const acceptDelivery = useCallback(
    async (orderId: string): Promise<boolean> => {
      try {
        const { error } = await supabase
          .from("delivery_assignments")
          .update({ status: "accepted" })
          .eq("order_id", orderId)
          .eq("status", "pending");

        if (error) {
          console.error("[OrderContext] acceptDelivery error:", error);
          Alert.alert("Error", "Could not accept delivery. Please try again.");
          return false;
        }
        await refreshOrders();
        return true;
      } catch (err: any) {
        console.error("[OrderContext] acceptDelivery error:", err);
        return false;
      }
    },
    [refreshOrders],
  );

  // markPickedUp: driver confirms physical collection of goods from depot
  const markPickedUp = useCallback(
    async (orderId: string) =>
      updateOrderStatus(orderId, "picked_up", { action: "goods_collected" }),
    [updateOrderStatus],
  );

  const markEnRoute = useCallback(
    async (orderId: string, eta?: number) =>
      updateOrderStatus(orderId, "en_route", { eta_minutes: eta || 15 }),
    [updateOrderStatus],
  );

  const markDelivered = useCallback(
    async (orderId: string) => updateOrderStatus(orderId, "delivered"),
    [updateOrderStatus],
  );

  // ─── Warehouse Actions ───
  const startPreparing = useCallback(
    async (orderId: string) => updateOrderStatus(orderId, "preparing"),
    [updateOrderStatus],
  );

  const markReady = useCallback(
    async (orderId: string) => updateOrderStatus(orderId, "ready"),
    [updateOrderStatus],
  );

  // ─── Admin Actions ───
  const assignDriver = useCallback(
    async (orderId: string, driverId: string, driverName: string): Promise<boolean> => {
      try {
        // Fetch current order status and driver's user_id in parallel
        const [{ data: orderData, error: orderError }, { data: driverData }] = await Promise.all([
          supabase.from("orders").select("status").eq("id", orderId).single(),
          supabase.from("driver_profiles").select("user_id").eq("id", driverId).maybeSingle(),
        ]);

        if (orderError || !orderData) {
          Alert.alert("Error", "Could not load order. Please try again.");
          return false;
        }

        const currentStatus = orderData.status as OrderStatus;

        // Pre-assign driver: write to delivery_assignments regardless of order status.
        // This lets the admin assign a driver before the order reaches 'ready'.
        // DEF-012: Handle unique constraint violation (23505) — a pending/accepted
        // assignment already exists. This is not an error; the admin may re-save
        // without cancelling the previous row first. Log and continue.
        const { error: assignInsertErr } = await supabase
          .from("delivery_assignments")
          .insert({ order_id: orderId, driver_id: driverId, status: "pending" });

        if (assignInsertErr) {
          // Postgres unique violation: duplicate active assignment for this order
          if ((assignInsertErr as any).code === "23505") {
            console.warn(
              `[OrderContext] DEF-012: active delivery_assignment already exists for order ${orderId}. ` +
              "Cancel the existing assignment before re-assigning."
            );
            Alert.alert(
              "Driver Already Assigned",
              "An active assignment already exists for this order. " +
              "Please cancel the current assignment before assigning a new driver."
            );
            return false;
          }
          // Any other DB error is a real failure
          console.error("[OrderContext] delivery_assignments insert error:", assignInsertErr);
          Alert.alert("Error", "Failed to create driver assignment. Please try again.");
          return false;
        }

        // Update orders.assigned_driver_id (references auth.users, so store user_id)
        if (driverData?.user_id) {
          await supabase
            .from("orders")
            .update({ assigned_driver_id: driverData.user_id })
            .eq("id", orderId);
        }

        // Only attempt the order status transition if order is currently 'ready'.
        // For all other statuses the assignment is saved and will be picked up
        // by the workflow engine when the order naturally reaches 'ready'.
        if (currentStatus === "ready") {
          return updateOrderStatus(orderId, "driver_assigned", {
            driver_id: driverId,
            driver_name: driverName,
            // auth user ID needed so notification target_user_id matches user.id in listener
            driver_auth_user_id: driverData?.user_id,
          });
        }

        await refreshOrders();
        return true;
      } catch (err: any) {
        console.error("[OrderContext] assignDriver error:", err);
        Alert.alert("Error", "Failed to assign driver. Please try again.");
        return false;
      }
    },
    [updateOrderStatus, refreshOrders],
  );

  // ─── Stock & PIN Verification ───
  const checkStock = useCallback(
    async (
      items: Array<{ product_id: string; quantity: number; product_name?: string }>,
    ) => orderWorkflow.checkStockAvailability(items),
    [],
  );

  const verifyDeliveryPin = useCallback(
    async (orderId: string, pin: string) =>
      orderWorkflow.verifyDeliveryPin(orderId, pin),
    [],
  );

  const getDeliveryPin = useCallback(
    async (orderId: string) => orderWorkflow.getDeliveryPin(orderId),
    [],
  );

  const depotRelease = useCallback(
    async (orderId: string) => {
      if (!user?.id) return { success: false, error: "Not authenticated" };
      return orderWorkflow.depotRelease(orderId, user.id);
    },
    [user?.id],
  );

  const driverSignOff = useCallback(
    async (orderId: string) => orderWorkflow.driverSignOff(orderId),
    [],
  );

  // ─── Helpers ───
  const getStatusDisplay = useCallback(
    (status: string) =>
      STATUS_DISPLAY[status as OrderStatus] || {
        label: status,
        color: "#6B7280",
        icon: "ellipse-outline",
      },
    [],
  );

  const clearNotification = useCallback((index: number) => {
    setNotifications((prev) => prev.filter((_, i) => i !== index));
    setUnreadCount((c) => Math.max(0, c - 1));
  }, []);

  return (
    <OrderContext.Provider
      value={{
        activeOrders,
        notifications,
        unreadCount,
        placeOrder,
        updateOrderStatus,
        cancelOrder,
        acceptDelivery,
        markPickedUp,
        markEnRoute,
        markDelivered,
        startPreparing,
        markReady,
        assignDriver,
        checkStock,
        verifyDeliveryPin,
        getDeliveryPin,
        depotRelease,
        driverSignOff,
        getStatusDisplay,
        refreshOrders,
        clearNotification,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrders() {
  const context = useContext(OrderContext);
  if (!context) {
    throw new Error("useOrders must be used within OrderProvider");
  }
  return context;
}
