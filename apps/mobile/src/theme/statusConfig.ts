/**
 * Shared order status configuration — single source of truth.
 * All screens that display order status pills, colors, or labels
 * should import from here instead of defining their own STATUS_CONFIG.
 */
import { ThemeColors } from "./index";

export interface StatusConfig {
  label: string;
  icon: string;
  color: string;
}

/**
 * Get status color that respects the current theme.
 * Uses theme semantic status tokens where possible,
 * with specific colors for statuses that don't map to a semantic token.
 */
export function getStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case "pending":
      return colors.gold.muted;
    case "awaiting_payment":
      return colors.status.warning;
    case "payment_failed":
      return colors.status.error;
    case "confirmed":
      return colors.status.info;
    case "preparing":
      return colors.status.warning;
    case "ready":
      return colors.gold.primary;
    case "driver_assigned":
      return colors.status.info;
    case "picked_up":
      return colors.status.info;
    case "en_route":
      return colors.status.info;
    case "delivered":
      return colors.status.success;
    case "completed":
      return colors.status.success;
    case "cancelled":
      return colors.status.error;
    case "refunded":
      return colors.text.muted;
    case "delivery_failed":
      return colors.status.error;
    case "return_to_store":
      return colors.status.warning;
    case "return_received":
      return colors.gold.muted;
    case "rescheduled":
      return colors.status.warning;
    default:
      return colors.text.muted;
  }
}

/** Human-readable label for each order status. */
export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: "Pending",
    awaiting_payment: "Awaiting Payment",
    payment_failed: "Payment Failed",
    confirmed: "Confirmed",
    preparing: "Preparing",
    ready: "Ready for Pickup",
    driver_assigned: "Driver Assigned",
    picked_up: "Picked Up",
    en_route: "On the Way",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    refunded: "Refunded",
    delivery_failed: "Delivery Failed",
    return_to_store: "Returning to Store",
    return_received: "Return Received",
    rescheduled: "Rescheduled",
  };
  return (
    labels[status] ||
    status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** Ionicons icon name for each order status. */
export function getStatusIcon(status: string): string {
  const icons: Record<string, string> = {
    pending: "time-outline",
    awaiting_payment: "card-outline",
    payment_failed: "close-circle-outline",
    confirmed: "checkmark-circle-outline",
    preparing: "restaurant-outline",
    ready: "bag-check-outline",
    driver_assigned: "person-outline",
    picked_up: "car-outline",
    en_route: "navigate-outline",
    delivered: "checkmark-done-outline",
    completed: "trophy-outline",
    cancelled: "close-outline",
    refunded: "return-down-back-outline",
    delivery_failed: "alert-circle-outline",
    return_to_store: "arrow-undo-outline",
    return_received: "archive-outline",
    rescheduled: "calendar-outline",
  };
  return icons[status] || "ellipse-outline";
}

/**
 * Full status config object for screens that need color + label + icon together.
 * Theme-aware — pass `colors` from `useTheme()`.
 */
export function getStatusConfig(
  status: string,
  colors: ThemeColors,
): StatusConfig {
  return {
    label: getStatusLabel(status),
    icon: getStatusIcon(status),
    color: getStatusColor(status, colors),
  };
}
