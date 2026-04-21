/**
 * DispatchService - Smart driver dispatch with scoring
 * Replaces "first active driver" with multi-factor scoring
 *
 * Limitations:
 * - Single-order dispatch only. Multi-stop batching is NOT supported.
 * - No automatic acceptance timeout. If a driver does not respond, the order
 *   remains in "assigned" status until manually reassigned by an admin.
 *   Automatic timeout-based reassignment requires a background job runner
 *   (e.g., process_auto_complete_jobs or a dedicated cron) which is not yet wired.
 * - Driver online/offline is read from `driver_profiles.status` in the database
 *   but this service does not update it. There is no heartbeat or staleness detection.
 */
import { supabase } from "../lib/supabase";

/** Maximum concurrent deliveries a single driver can handle */
const MAX_CONCURRENT_DELIVERIES = 5;

/**
 * Acceptance timeout in minutes (for documentation/future use).
 * Currently NOT enforced at runtime — requires background job infrastructure.
 */
const ACCEPTANCE_TIMEOUT_MINUTES = 5;

export interface DispatchCandidate {
  driverId: string;
  name: string;
  score: number;
  distance?: number;
  activeDeliveries: number;
  successRate: number;
  rating: number;
}

export interface DispatchResult {
  success: boolean;
  driverId?: string;
  assignmentId?: string;
  score?: number;
  error?: string;
}

class DispatchServiceClass {
  private static instance: DispatchServiceClass;

  static getInstance(): DispatchServiceClass {
    if (!DispatchServiceClass.instance) {
      DispatchServiceClass.instance = new DispatchServiceClass();
    }
    return DispatchServiceClass.instance;
  }

  /**
   * Find and assign the best available driver for an order
   */
  async assignBestDriver(
    orderId: string,
    orderLat?: number,
    orderLng?: number,
  ): Promise<DispatchResult> {
    try {
      // 1. Get all eligible drivers
      const { data: drivers, error } = await supabase
        .from("driver_profiles")
        .select("user_id, full_name, status, is_verified, zone_id")
        .eq("status", "active")
        .eq("is_verified", true);

      if (error) throw error;
      if (!drivers?.length) {
        return { success: false, error: "No available drivers" };
      }

      // N+1 performance warning: each driver triggers an individual RPC call.
      // At scale, replace with a single batch scoring function or move scoring server-side.
      if (drivers.length > 10) {
        console.warn(
          `[DispatchService] N+1 risk: scoring ${drivers.length} drivers with individual calculate_dispatch_score RPC calls. Consider a batch scoring function for scale.`,
        );
      }

      // 2. Score each driver using the database function
      const candidates: DispatchCandidate[] = [];
      for (const driver of drivers) {
        const { data: score } = await supabase.rpc("calculate_dispatch_score", {
          p_driver_id: driver.user_id,
          p_order_lat: orderLat || 0,
          p_order_lng: orderLng || 0,
        });

        candidates.push({
          driverId: driver.user_id,
          name: driver.full_name || "Driver",
          score: score || 0,
          activeDeliveries: 0,
          successRate: 0,
          rating: 0,
        });
      }

      // 3. Sort by score (highest first)
      candidates.sort((a, b) => b.score - a.score);

      // 4. Find best driver that is not at capacity
      let bestDriver: DispatchCandidate | null = null;
      for (const candidate of candidates) {
        const { count } = await supabase
          .from("delivery_assignments")
          .select("*", { count: "exact", head: true })
          .eq("driver_id", candidate.driverId)
          .in("status", ["assigned", "accepted", "picked_up", "en_route"]);

        candidate.activeDeliveries = count || 0;

        if ((count || 0) < MAX_CONCURRENT_DELIVERIES) {
          bestDriver = candidate;
          break;
        }
      }

      if (!bestDriver) {
        console.warn(
          `[DispatchService] All ${candidates.length} eligible drivers are at capacity (max ${MAX_CONCURRENT_DELIVERIES})`,
        );
        return { success: false, error: "All available drivers are at capacity" };
      }

      // 5. Create assignment
      const { data: assignment, error: assignError } = await supabase
        .from("delivery_assignments")
        .insert({
          order_id: orderId,
          driver_id: bestDriver.driverId,
          status: "assigned",
          dispatch_score: bestDriver.score,
        })
        .select()
        .single();

      if (assignError) throw assignError;

      return {
        success: true,
        driverId: bestDriver.driverId,
        assignmentId: assignment.id,
        score: bestDriver.score,
      };
    } catch (error: any) {
      console.error("[DispatchService] assignBestDriver error:", error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get dispatch candidates for manual assignment (admin)
   */
  async getCandidates(
    orderId: string,
    orderLat?: number,
    orderLng?: number,
  ): Promise<DispatchCandidate[]> {
    const { data: drivers, error } = await supabase
      .from("driver_profiles")
      .select("user_id, full_name, status, is_verified")
      .eq("status", "active")
      .eq("is_verified", true);

    if (error) {
      console.error("[DispatchService] getCandidates query error:", error);
      return [];
    }
    if (!drivers?.length) return [];

    const candidates: DispatchCandidate[] = [];
    for (const driver of drivers) {
      const { data: score } = await supabase.rpc("calculate_dispatch_score", {
        p_driver_id: driver.user_id,
        p_order_lat: orderLat || 0,
        p_order_lng: orderLng || 0,
      });

      candidates.push({
        driverId: driver.user_id,
        name: driver.full_name || "Driver",
        score: score || 0,
        activeDeliveries: 0,
        successRate: 0,
        rating: 0,
      });
    }

    return candidates.sort((a, b) => b.score - a.score);
  }

  /**
   * Reassign an order to a different driver
   */
  async reassignDriver(
    orderId: string,
    newDriverId: string,
    reason: string,
  ): Promise<DispatchResult> {
    try {
      // Cancel current assignment
      const { error: cancelError } = await supabase
        .from("delivery_assignments")
        .update({ status: "cancelled", failed_reason: reason })
        .eq("order_id", orderId)
        .in("status", ["assigned", "accepted"]);

      if (cancelError) {
        console.error(
          `[DispatchService] Failed to cancel existing assignment for order ${orderId}:`,
          cancelError,
        );
      }

      // Create new assignment
      const { data, error } = await supabase
        .from("delivery_assignments")
        .insert({
          order_id: orderId,
          driver_id: newDriverId,
          status: "assigned",
        })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        driverId: newDriverId,
        assignmentId: data.id,
      };
    } catch (error: any) {
      console.error(`[DispatchService] reassignDriver error for order ${orderId}:`, error);
      return { success: false, error: error.message };
    }
  }
}

export const DispatchService = DispatchServiceClass.getInstance();
