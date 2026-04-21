import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

// Canonical 17-status order state machine (matches LIQZAR-SYSTEM-SPECIFICATION.md §6)
// Kept in sync with packages/types, packages/shared, and apps/mobile/src/types
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
  assigned_warehouse_id?: string;
  assigned_driver_id?: string;
  created_at: string;
  updated_at: string;
  confirmed_at?: string;
  packed_at?: string;
  dispatched_at?: string;
  delivered_at?: string;
  items?: OrderItem[];
  // Joined data
  customer_name?: string;
  customer_phone?: string;
  warehouse_status?: WarehouseTaskStatus;
  driver_status?: DriverAssignmentStatus;
}

export interface CreateOrderInput {
  items: {
    product_id: string;
    product_name: string;
    product_image?: string;
    quantity: number;
    unit_price: number;
    subtotal: number;
  }[];
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
  delivery_address: DeliveryAddress;
  payment_method: string;
  customer_notes?: string;
  delivery_instructions?: string;
}

// Hook for customer orders
export function useCustomerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!user) {
      setOrders([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (*)
        `,
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setOrders((data || []) as unknown as Order[]);
    } catch (err) {
      console.error("Error fetching orders:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const createOrder = async (
    input: CreateOrderInput,
  ): Promise<Order | null> => {
    if (!user) {
      setError("Must be logged in to create order");
      return null;
    }

    try {
      // Always use the real Supabase auth UUID — AuthContext.user.id may be
      // a phone number fallback when profile lookup failed (not a valid UUID).
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Prefer real Supabase auth UUID; fall back to context user.id if it IS
      // already a UUID (test-mode local auth resolved it from the profiles table)
      const realUserId =
        authUser?.id ??
        (user?.id && UUID_RE.test(user.id) ? user.id : null);

      if (!realUserId) {
        throw new Error(
          "Authentication required. Please sign out and sign in again."
        );
      }

      // Check stock availability before placing order
      const productIds = input.items.map((i) => i.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("id, name, stock_quantity")
        .in("id", productIds);

      if (products) {
        const productMap = new Map(products.map((p: any) => [p.id, p]));
        const unavailable = input.items.filter((item) => {
          const product = productMap.get(item.product_id) as any;
          return product && product.stock_quantity < item.quantity;
        });
        if (unavailable.length > 0) {
          const names = unavailable.map((u) => u.product_name).join(", ");
          throw new Error(`Insufficient stock for: ${names}. Please adjust your cart.`);
        }
      }

      // Insert the order (order_number is auto-generated)
      const orderPayload = {
        user_id: realUserId,
        status: "pending" as OrderStatus,
        subtotal: input.subtotal,
        vat_amount: input.vat_amount,
        delivery_fee: input.delivery_fee,
        discount_amount: input.discount_amount,
        discount_code: input.discount_code,
        total: input.total,
        delivery_method: input.delivery_method,
        delivery_zone: input.delivery_zone,
        scheduled_date: input.scheduled_date,
        scheduled_slot: input.scheduled_slot,
        delivery_address: input.delivery_address as any,
        payment_method: input.payment_method,
        payment_status: "pending",
        customer_notes: input.customer_notes,
        delivery_instructions: input.delivery_instructions,
      };

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert(orderPayload as any)
        .select()
        .single();

      if (orderError) {
        console.error("[createOrder] orders insert error:", orderError);
        throw orderError;
      }

      // Insert order items
      const { error: itemsError } = await supabase.from("order_items").insert(
        input.items.map((item) => ({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          product_image: item.product_image,
          quantity: item.quantity,
          unit_price: item.unit_price,
          subtotal: item.subtotal,
        })),
      );

      if (itemsError) {
        console.error("[createOrder] order_items insert error:", itemsError);
        throw itemsError;
      }

      // For cash on delivery: auto-confirm since no payment gateway needed.
      // For all other methods: leave as pending — payment gateway will confirm.
      if (input.payment_method === "cash_on_delivery") {
        const { data: confirmedOrder, error: confirmError } = await supabase
          .from("orders")
          .update({
            status: "confirmed" as OrderStatus,
            payment_status: "cash_on_delivery",
            confirmed_at: new Date().toISOString(),
          })
          .eq("id", order.id)
          .select(`*, order_items (*)`)
          .single();

        if (confirmError) throw confirmError;
        await fetchOrders();
        return confirmedOrder as unknown as Order;
      }

      // Non-COD: return pending order; CheckoutPage calls payment gateway next
      await fetchOrders();
      return order as unknown as Order;
    } catch (err: any) {
      const msg = err?.message || err?.details || JSON.stringify(err) || "Failed to create order";
      console.error("[createOrder] error:", msg, err);
      setError(msg);
      // Re-throw so CheckoutPage can surface the real message to the user
      throw new Error(msg);
    }
  };

  const getOrderById = async (orderId: string): Promise<Order | null> => {
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (*)
        `,
        )
        .eq("id", orderId)
        .single();

      if (error) throw error;
      return data as unknown as Order;
    } catch (err) {
      console.error("Error fetching order:", err);
      return null;
    }
  };

  const cancelOrder = async (orderId: string): Promise<boolean> => {
    try {
      // Enforce 10-minute cancellation window (parity with mobile)
      const { data: existing, error: fetchErr } = await supabase
        .from("orders")
        .select("created_at, status")
        .eq("id", orderId)
        .eq("user_id", user?.id)
        .single();

      if (fetchErr) throw fetchErr;

      const CANCEL_WINDOW_MS = 10 * 60 * 1000;
      const orderAge = Date.now() - new Date(existing.created_at).getTime();
      if (orderAge > CANCEL_WINDOW_MS) {
        throw new Error("Cancellation window has passed (10 minutes).");
      }

      // Only allow cancellation from early statuses
      const cancellableStatuses: OrderStatus[] = ["pending", "awaiting_payment", "confirmed"];
      if (!cancellableStatuses.includes(existing.status as OrderStatus)) {
        throw new Error("Order cannot be cancelled at this stage.");
      }

      const { error } = await supabase
        .from("orders")
        .update({ status: "cancelled" as OrderStatus })
        .eq("id", orderId)
        .eq("user_id", user?.id);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (err) {
      console.error("Error cancelling order:", err);
      return false;
    }
  };

  // Subscribe to realtime updates
  useEffect(() => {
    if (!user) return;

    fetchOrders();

    const channel = supabase
      .channel("customer-orders")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchOrders();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    orders,
    loading,
    error,
    createOrder,
    getOrderById,
    cancelOrder,
    refetch: fetchOrders,
  };
}

// Hook for admin orders (all orders)
export function useAdminOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingOrders: 0,
    deliveredToday: 0,
  });

  const fetchOrders = async () => {
    try {
      setLoading(true);

      // Step 1: fetch orders + items (no cross-table joins that can fail RLS)
      const { data, error } = await supabase
        .from("orders")
        .select(`*, order_items (*)`)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Step 2: fetch profiles for the user_ids in this result set
      const userIds = [...new Set((data || []).map((o: any) => o.user_id).filter(Boolean))];
      let profileMap: Record<string, { full_name: string | null; phone: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("id, full_name, phone")
          .in("id", userIds);
        (profileData || []).forEach((p: any) => {
          profileMap[p.id] = { full_name: p.full_name, phone: p.phone };
        });
      }

      // Transform data
      const transformedOrders: Order[] = (data || []).map((order: any) => {
        const profile = profileMap[order.user_id];
        return {
          ...order,
          customer_name: profile?.full_name ?? null,
          customer_phone: profile?.phone ?? null,
          warehouse_status: null,
          driver_status: null,
          items: order.order_items,
        };
      });

      setOrders(transformedOrders);

      // Calculate stats
      const today = new Date().toDateString();
      setStats({
        totalOrders: transformedOrders.length,
        totalRevenue: transformedOrders.reduce(
          (sum, o) => sum + Number(o.total),
          0,
        ),
        pendingOrders: transformedOrders.filter((o) =>
          ["pending", "confirmed", "preparing"].includes(o.status),
        ).length,
        deliveredToday: transformedOrders.filter(
          (o) =>
            o.status === "delivered" &&
            o.delivered_at &&
            new Date(o.delivered_at).toDateString() === today,
        ).length,
      });
    } catch (err) {
      console.error("Error fetching admin orders:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch orders");
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (
    orderId: string,
    status: OrderStatus,
  ): Promise<boolean> => {
    try {
      const updates: Partial<Order> = { status };

      // Set timestamp fields based on status
      if (status === "confirmed")
        updates.confirmed_at = new Date().toISOString();
      if (status === "ready") updates.packed_at = new Date().toISOString();
      if (status === "picked_up")
        updates.dispatched_at = new Date().toISOString();
      if (status === "delivered")
        updates.delivered_at = new Date().toISOString();

      const { error } = await supabase
        .from("orders")
        .update(updates as any)
        .eq("id", orderId);

      if (error) throw error;
      await fetchOrders();
      return true;
    } catch (err) {
      console.error("Error updating order status:", err);
      return false;
    }
  };

  const assignDriver = async (
    orderId: string,
    driverId: string,
  ): Promise<boolean> => {
    try {
      // Advance status to driver_assigned so the driver app sees the handoff
      // and the customer widget reflects the change. Preserves later statuses
      // (picked_up / en_route) if the order is already past this point.
      const { data: current } = await supabase
        .from("orders")
        .select("status")
        .eq("id", orderId)
        .single();

      const PRE_ASSIGN: OrderStatus[] = [
        "pending",
        "confirmed",
        "preparing",
        "ready",
      ];
      const nextStatus: OrderStatus =
        current && PRE_ASSIGN.includes(current.status as OrderStatus)
          ? "driver_assigned"
          : ((current?.status as OrderStatus) ?? "driver_assigned");

      const { error: orderError } = await supabase
        .from("orders")
        .update({
          assigned_driver_id: driverId,
          status: nextStatus,
        })
        .eq("id", orderId);

      if (orderError) throw orderError;

      // Create or update driver assignment
      const { error: assignmentError } = await supabase
        .from("driver_assignments")
        .upsert(
          {
            order_id: orderId,
            driver_id: driverId,
            status: "pending" as DriverAssignmentStatus,
          },
          {
            onConflict: "order_id",
          },
        );

      if (assignmentError) throw assignmentError;

      await fetchOrders();
      return true;
    } catch (err) {
      console.error("Error assigning driver:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel("admin-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => fetchOrders(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    orders,
    loading,
    error,
    stats,
    updateOrderStatus,
    assignDriver,
    refetch: fetchOrders,
  };
}

// Hook for warehouse tasks
export function useWarehouseTasks() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("warehouse_tasks")
        .select(
          `
          *,
          orders (
            id,
            order_number,
            delivery_method,
            scheduled_date,
            scheduled_slot,
            created_at,
            order_items (*)
          )
        `,
        )
        .in("status", ["pending", "picking", "picked", "packing", "packed"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (err) {
      console.error("Error fetching warehouse tasks:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (
    taskId: string,
    status: WarehouseTaskStatus,
    notes?: string,
  ): Promise<boolean> => {
    try {
      const updates: any = { status };

      if (status === "picking") updates.started_at = new Date().toISOString();
      if (status === "picked") {
        updates.picked_at = new Date().toISOString();
        if (notes) updates.picker_notes = notes;
      }
      if (status === "packed") {
        updates.packed_at = new Date().toISOString();
        if (notes) updates.packer_notes = notes;
      }
      if (status === "ready_dispatch")
        updates.completed_at = new Date().toISOString();

      const { error } = await supabase
        .from("warehouse_tasks")
        .update(updates)
        .eq("id", taskId);

      if (error) throw error;

      // Also update order status
      const { data: task } = await supabase
        .from("warehouse_tasks")
        .select("order_id")
        .eq("id", taskId)
        .single();

      if (task) {
        let orderStatus: OrderStatus | null = null;
        if (status === "picking" || status === "packing")
          orderStatus = "preparing";
        if (status === "ready_dispatch") orderStatus = "ready";

        if (orderStatus) {
          await supabase
            .from("orders")
            .update({
              status: orderStatus,
              ...(orderStatus === "ready"
                ? { packed_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", task.order_id);
        }
      }

      await fetchTasks();
      return true;
    } catch (err) {
      console.error("Error updating task status:", err);
      return false;
    }
  };

  const claimTask = async (
    taskId: string,
    userId: string,
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("warehouse_tasks")
        .update({
          assigned_to: userId,
          status: "picking" as WarehouseTaskStatus,
          started_at: new Date().toISOString(),
        })
        .eq("id", taskId)
        .is("assigned_to", null);

      if (error) throw error;
      await fetchTasks();
      return true;
    } catch (err) {
      console.error("Error claiming task:", err);
      return false;
    }
  };

  useEffect(() => {
    fetchTasks();

    const channel = supabase
      .channel("warehouse-tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_tasks" },
        () => fetchTasks(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    tasks,
    loading,
    error,
    updateTaskStatus,
    claimTask,
    refetch: fetchTasks,
  };
}

// Hook for driver assignments
export function useDriverAssignments() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAssignments = async () => {
    if (!user) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("driver_assignments")
        .select(
          `
          *,
          orders (
            id,
            order_number,
            total,
            delivery_address,
            delivery_method,
            customer_notes,
            delivery_instructions,
            created_at,
            order_items (*)
          )
        `,
        )
        .eq("driver_id", user.id)
        .in("status", ["pending", "accepted", "picked_up", "en_route"])
        .order("created_at", { ascending: true });

      if (error) throw error;
      setAssignments(data || []);
    } catch (err) {
      console.error("Error fetching driver assignments:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch assignments",
      );
    } finally {
      setLoading(false);
    }
  };

  const updateAssignmentStatus = async (
    assignmentId: string,
    status: DriverAssignmentStatus,
    data?: {
      deliveryPhoto?: string;
      recipientName?: string;
      deliveryNotes?: string;
    },
  ): Promise<boolean> => {
    try {
      const updates: any = { status };

      if (status === "accepted") updates.accepted_at = new Date().toISOString();
      if (status === "picked_up")
        updates.picked_up_at = new Date().toISOString();
      if (status === "delivered") {
        updates.delivered_at = new Date().toISOString();
        if (data?.deliveryPhoto)
          updates.delivery_photo_url = data.deliveryPhoto;
        if (data?.recipientName) updates.recipient_name = data.recipientName;
        if (data?.deliveryNotes) updates.delivery_notes = data.deliveryNotes;
      }

      const { error } = await supabase
        .from("driver_assignments")
        .update(updates)
        .eq("id", assignmentId);

      if (error) throw error;

      // Also update order status
      const { data: assignment } = await supabase
        .from("driver_assignments")
        .select("order_id")
        .eq("id", assignmentId)
        .single();

      if (assignment) {
        let orderStatus: OrderStatus | null = null;
        if (status === "picked_up") orderStatus = "picked_up";
        if (status === "en_route") orderStatus = "en_route";
        if (status === "delivered") orderStatus = "delivered";

        if (orderStatus) {
          await supabase
            .from("orders")
            .update({
              status: orderStatus,
              ...(orderStatus === "picked_up"
                ? { dispatched_at: new Date().toISOString() }
                : {}),
              ...(orderStatus === "delivered"
                ? { delivered_at: new Date().toISOString() }
                : {}),
            })
            .eq("id", assignment.order_id);
        }
      }

      await fetchAssignments();
      return true;
    } catch (err) {
      console.error("Error updating assignment status:", err);
      return false;
    }
  };

  const updateLocation = async (
    assignmentId: string,
    location: {
      lat: number;
      lng: number;
      accuracy?: number;
      heading?: number;
      speed?: number;
    },
  ): Promise<boolean> => {
    try {
      // Update current location on assignment
      await supabase
        .from("driver_assignments")
        .update({
          current_location: {
            lat: location.lat,
            lng: location.lng,
            timestamp: new Date().toISOString(),
          },
        })
        .eq("id", assignmentId);

      // Add to tracking history
      await supabase.from("delivery_tracking").insert({
        assignment_id: assignmentId,
        latitude: location.lat,
        longitude: location.lng,
        accuracy: location.accuracy,
        heading: location.heading,
        speed: location.speed,
      });

      return true;
    } catch (err) {
      console.error("Error updating location:", err);
      return false;
    }
  };

  useEffect(() => {
    if (!user) return;

    fetchAssignments();

    const channel = supabase
      .channel("driver-assignments")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_assignments",
          filter: `driver_id=eq.${user.id}`,
        },
        () => fetchAssignments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return {
    assignments,
    loading,
    error,
    updateAssignmentStatus,
    updateLocation,
    refetch: fetchAssignments,
  };
}

// Hook for tracking order status (customer view of delivery)
export function useOrderTracking(orderId: string) {
  const [tracking, setTracking] = useState<{
    order: Order | null;
    driverLocation: { lat: number; lng: number; timestamp: string } | null;
    eta: number | null;
  }>({
    order: null,
    driverLocation: null,
    eta: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchTracking = async () => {
    try {
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .select(
          `
          *,
          order_items (*),
          driver_assignments (
            id,
            status,
            current_location,
            driver_id
          )
        `,
        )
        .eq("id", orderId)
        .single();

      if (orderError) throw orderError;

      const assignment = (order as any)?.driver_assignments?.[0];

      setTracking({
        order: order as unknown as Order,
        driverLocation: assignment?.current_location || null,
        eta: null,
      });
    } catch (err) {
      console.error("Error fetching tracking:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orderId) return;

    fetchTracking();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`order-tracking-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => fetchTracking(),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "driver_assignments",
          filter: `order_id=eq.${orderId}`,
        },
        () => fetchTracking(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { ...tracking, loading, refetch: fetchTracking };
}
