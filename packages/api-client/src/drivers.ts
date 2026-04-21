import { getApiClient } from "./client";
import type {
  Order,
  DriverAssignment,
  DeliveryTracking,
  DriverProfile,
} from "@liqzar/types";

export interface UpdateLocationData {
  latitude: number;
  longitude: number;
  timestamp?: string;
}

export const driversApi = {
  /**
   * Get driver profile
   */
  async getDriverProfile(driverId?: string): Promise<DriverProfile> {
    const client = getApiClient();
    const url = driverId ? `/drivers/${driverId}` : "/drivers/me";
    return client.get(url);
  },

  /**
   * Get orders assigned to driver
   */
  async getAssignedOrders(status?: string[]): Promise<Order[]> {
    const client = getApiClient();
    return client.get("/drivers/orders", { status });
  },

  /**
   * Get driver assignments
   */
  async getAssignments(): Promise<DriverAssignment[]> {
    const client = getApiClient();
    return client.get("/drivers/assignments");
  },

  /**
   * Accept delivery assignment
   */
  async acceptAssignment(assignmentId: string): Promise<DriverAssignment> {
    const client = getApiClient();
    return client.post(`/drivers/assignments/${assignmentId}/accept`);
  },

  /**
   * Mark order as picked up
   */
  async markPickedUp(orderId: string): Promise<Order> {
    const client = getApiClient();
    return client.post(`/drivers/orders/${orderId}/pickup`);
  },

  /**
   * Start delivery
   */
  async startDelivery(orderId: string): Promise<Order> {
    const client = getApiClient();
    return client.post(`/drivers/orders/${orderId}/start`);
  },

  /**
   * Complete delivery
   */
  async completeDelivery(
    orderId: string,
    data: {
      signature?: string;
      photo?: string;
      notes?: string;
    },
  ): Promise<Order> {
    const client = getApiClient();
    return client.post(`/drivers/orders/${orderId}/complete`, data);
  },

  /**
   * Report delivery issue
   */
  async reportIssue(
    orderId: string,
    issue: {
      type: string;
      description: string;
      photo?: string;
    },
  ): Promise<void> {
    const client = getApiClient();
    return client.post(`/drivers/orders/${orderId}/issue`, issue);
  },

  /**
   * Update driver location
   */
  async updateLocation(location: UpdateLocationData): Promise<void> {
    const client = getApiClient();
    return client.post("/drivers/location", location);
  },

  /**
   * Update driver status
   */
  async updateStatus(
    status: "available" | "busy" | "offline",
  ): Promise<DriverProfile> {
    const client = getApiClient();
    return client.patch("/drivers/me/status", { status });
  },

  /**
   * Get delivery tracking for order
   */
  async getDeliveryTracking(orderId: string): Promise<DeliveryTracking[]> {
    const client = getApiClient();
    return client.get(`/drivers/orders/${orderId}/tracking`);
  },

  /**
   * Get driver statistics
   */
  async getStatistics(): Promise<{
    total_deliveries: number;
    completed_today: number;
    rating: number;
    earnings_today: number;
  }> {
    const client = getApiClient();
    return client.get("/drivers/statistics");
  },

  /**
   * Scan item barcode
   */
  async scanItem(
    orderId: string,
    barcode: string,
  ): Promise<{
    product: any;
    verified: boolean;
  }> {
    const client = getApiClient();
    return client.post(`/drivers/orders/${orderId}/scan`, { barcode });
  },
};
