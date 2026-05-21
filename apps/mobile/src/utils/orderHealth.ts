/**
 * Single source of truth for "is this order in a bad state?" — mirrors the
 * CASE expression in v_orders_with_health (SQL view). When you change one,
 * change the other; both define the same buckets so the customer-facing
 * banner, the order-history pill, and admin queries all agree.
 */

export type StaleReason = "payment_abandoned" | "stuck" | "past_due" | null;

const TERMINAL_STATUSES = new Set([
  "delivered",
  "cancelled",
  "refunded",
  "delivery_failed",
]);

const ACTIVE_MID_FLOW = new Set([
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "en_route",
]);

export function computeStaleReason(o: {
  status?: string;
  created_at?: string;
  updated_at?: string;
  delivery_method?: string;
  scheduled_date?: string | null;
  payment_status?: string;
}): StaleReason {
  if (!o.status || TERMINAL_STATUSES.has(o.status)) return null;

  const now = Date.now();
  const createdMs = o.created_at ? new Date(o.created_at).getTime() : now;
  const lastChangeMs = o.updated_at
    ? new Date(o.updated_at).getTime()
    : createdMs;
  const startOfDayMs = new Date(new Date().setHours(0, 0, 0, 0)).getTime();

  // past_due: scheduled date elapsed
  if (
    o.delivery_method === "scheduled" &&
    o.scheduled_date &&
    new Date(o.scheduled_date).getTime() < startOfDayMs
  ) {
    return "past_due";
  }
  // past_due: same-day placed yesterday or earlier
  if (o.delivery_method === "same-day" && createdMs < startOfDayMs) {
    return "past_due";
  }
  // past_due: next-day > 36h old
  if (
    o.delivery_method === "next-day" &&
    now - createdMs > 36 * 3600 * 1000
  ) {
    return "past_due";
  }
  // stuck: active mid-flow status not advanced in 4h
  if (ACTIVE_MID_FLOW.has(o.status) && now - lastChangeMs > 4 * 3600 * 1000) {
    return "stuck";
  }
  // payment_abandoned: > 1h old, payment not progressed
  const ps = (o.payment_status ?? "").toString();
  if (
    (ps === "" || ps === "pending" || ps === "awaiting_payment") &&
    now - createdMs > 3600 * 1000
  ) {
    return "payment_abandoned";
  }
  return null;
}

/** Customer-facing copy + recommended actions per stale reason. */
export function staleReasonCopy(reason: StaleReason): {
  title: string;
  body: string;
  tone: "warning" | "danger" | "info";
  primaryAction?: { label: string; intent: "pay" | "cancel" | "support" | "refund" | "reschedule" };
  secondaryAction?: { label: string; intent: "pay" | "cancel" | "support" | "refund" | "reschedule" };
} | null {
  switch (reason) {
    case "payment_abandoned":
      return {
        title: "Payment not completed",
        body: "Your order is on hold until payment is confirmed. Complete payment now to release it to fulfilment, or cancel for a full reversal of any pre-authorised amount.",
        tone: "warning",
        primaryAction: { label: "Pay Now", intent: "pay" },
        secondaryAction: { label: "Cancel Order", intent: "cancel" },
      };
    case "stuck":
      return {
        title: "We're following up",
        body: "This order hasn't moved in the last few hours. Our ops team has been alerted and will be in touch shortly. You can also reach us directly.",
        tone: "info",
        primaryAction: { label: "Contact Support", intent: "support" },
      };
    case "past_due":
      return {
        title: "Delivery window missed",
        body: "Sorry — this order didn't reach you in time. You can request a full refund or reschedule for free re-delivery.",
        tone: "danger",
        primaryAction: { label: "Reschedule", intent: "reschedule" },
        secondaryAction: { label: "Request Refund", intent: "refund" },
      };
    default:
      return null;
  }
}
