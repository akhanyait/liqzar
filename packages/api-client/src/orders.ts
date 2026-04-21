import { getApiClient } from "./client";
import type {
  Order,
  OrderWithItems,
  OrderFilters,
  OrderItem,
  PaginatedResponse,
} from "@liqzar/types";

export interface CreateOrderData {
  items: Array<{
    product_id: string;
    quantity: number;
  }>;
  delivery_address: any;
  delivery_method: "same-day" | "next-day" | "scheduled";
  scheduled_date?: string;
  scheduled_slot?: string;
  payment_method: string;
  customer_notes?: string;
  delivery_instructions?: string;
  discount_code?: string;
}

export const ordersApi = {
  /**
   * Create a new order
   */
  async createOrder(data: CreateOrderData): Promise<Order> {
    const client = getApiClient();
    return client.post("/orders", data);
  },

  /**
   * Get all orders for current user
   */
  async getOrders(filters?: OrderFilters): Promise<PaginatedResponse<Order>> {
    const client = getApiClient();
    return client.get("/orders", filters);
  },

  /**
   * Get single order by ID
   */
  async getOrder(orderId: string): Promise<OrderWithItems> {
    const client = getApiClient();
    return client.get(`/orders/${orderId}`);
  },

  /**
   * Get order items
   */
  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const client = getApiClient();
    return client.get(`/orders/${orderId}/items`);
  },

  /**
   * Cancel an order
   */
  async cancelOrder(orderId: string, reason?: string): Promise<Order> {
    const client = getApiClient();
    return client.post(`/orders/${orderId}/cancel`, { reason });
  },

  /**
   * Track order
   */
  async trackOrder(orderId: string): Promise<{
    order: Order;
    tracking: any[];
    estimated_delivery: string;
  }> {
    const client = getApiClient();
    return client.get(`/orders/${orderId}/track`);
  },

  /**
   * Get order history
   */
  async getOrderHistory(
    page: number = 1,
    limit: number = 20,
  ): Promise<PaginatedResponse<Order>> {
    const client = getApiClient();
    return client.get("/orders/history", { page, limit });
  },

  /**
   * Reorder (create new order from previous order)
   */
  async reorder(orderId: string): Promise<Order> {
    const client = getApiClient();
    return client.post(`/orders/${orderId}/reorder`);
  },
};
