/**
 * ComplianceService - Alcohol delivery compliance management
 * Handles SA Liquor Act requirements for age verification,
 * ID checks, intoxication refusal, and delivery hours.
 */
import { supabase } from "../lib/supabase";

export interface ComplianceCheck {
  orderId: string;
  driverId: string;
  recipientName: string;
  idDocumentType?: "sa_id" | "passport" | "drivers_license";
  idVerified: boolean;
  recipientAppearsSober: boolean;
  recipientIsAdult: boolean;
  substituteRecipient?: boolean;
  gpsLatitude?: number;
  gpsLongitude?: number;
  notes?: string;
  /** Optional photo evidence URL (e.g. from proof-of-delivery camera) */
  evidenceUrl?: string;
}

export interface ComplianceResult {
  passed: boolean;
  events: string[];
  blockingReason?: string;
  /**
   * Indicates what payment action the caller should take when compliance fails.
   * - "none": no payment action needed (e.g. cash on delivery)
   * - "hold": payment captured but delivery refused — hold funds pending resolution
   * - "refund_required": prepaid order refused — caller must initiate refund flow
   */
  paymentAction?: "none" | "hold" | "refund_required";
  /**
   * True if any compliance event failed to persist to the database.
   * Callers should surface this to the driver and/or escalate — an incomplete
   * audit trail is a compliance risk.
   */
  auditLogFailed?: boolean;
}

// SA delivery hours (configurable per zone)
const DEFAULT_DELIVERY_HOURS = { start: 9, end: 21 }; // 9 AM - 9 PM

class ComplianceServiceClass {
  private static instance: ComplianceServiceClass;

  static getInstance(): ComplianceServiceClass {
    if (!ComplianceServiceClass.instance) {
      ComplianceServiceClass.instance = new ComplianceServiceClass();
    }
    return ComplianceServiceClass.instance;
  }

  /**
   * Perform full compliance check at delivery handoff
   * Returns pass/fail with blocking reasons
   */
  async performHandoffCheck(check: ComplianceCheck): Promise<ComplianceResult> {
    const events: string[] = [];
    let passed = true;
    let blockingReason: string | undefined;
    let paymentAction: ComplianceResult["paymentAction"] = "none";
    let auditLogFailed = false;

    // Determine if order is prepaid (for failure outcome handling)
    const { data: orderData } = await supabase
      .from("orders")
      .select("payment_status, payment_method")
      .eq("id", check.orderId)
      .single();

    const isPrepaid =
      orderData?.payment_status === "captured" ||
      orderData?.payment_status === "authorized";

    // 1. Check delivery hours
    const hourCheck = this.isWithinDeliveryHours();
    if (!hourCheck.allowed) {
      const logged = await this.logComplianceEvent({
        order_id: check.orderId,
        driver_id: check.driverId,
        event_type: "delivery_hours_violation",
        outcome: "failed",
        notes: `Attempted delivery at ${new Date().toLocaleTimeString()}. ${check.notes || ""}`.trim(),
        gps_latitude: check.gpsLatitude,
        gps_longitude: check.gpsLongitude,
        metadata: { requires_reschedule: true },
      });
      if (!logged) auditLogFailed = true;
      events.push("delivery_hours_violation");
      passed = false;
      paymentAction = isPrepaid ? "hold" : "none";
      blockingReason = `Alcohol delivery not permitted at this time. Allowed hours: ${hourCheck.startHour}:00 - ${hourCheck.endHour}:00. Order should be rescheduled for the next available delivery window.`;
      return { passed, events, blockingReason, paymentAction, auditLogFailed };
    }

    // 2. ID verification
    // idDocumentType is optional audit metadata — its absence must not block a
    // delivery where the driver has confirmed the ID was physically checked.
    // The gate is idVerified only; document type is logged when available.
    if (!check.idVerified) {
      const logged = await this.logComplianceEvent({
        order_id: check.orderId,
        driver_id: check.driverId,
        event_type: "id_checked",
        outcome: "failed",
        recipient_name: check.recipientName,
        id_document_type: check.idDocumentType,
        id_verified: false,
        notes: `ID not verified. ${check.notes || ""}`.trim(),
        gps_latitude: check.gpsLatitude,
        gps_longitude: check.gpsLongitude,
      });
      if (!logged) auditLogFailed = true;
      events.push("id_check_failed");
      passed = false;
      paymentAction = isPrepaid ? "refund_required" : "none";
      blockingReason =
        "Valid ID must be presented and verified before alcohol delivery";
      return { passed, events, blockingReason, paymentAction, auditLogFailed };
    }

    // Log successful ID check
    const idLogged = await this.logComplianceEvent({
      order_id: check.orderId,
      driver_id: check.driverId,
      event_type: "id_checked",
      outcome: "passed",
      recipient_name: check.recipientName,
      id_document_type: check.idDocumentType,
      id_verified: true,
      gps_latitude: check.gpsLatitude,
      gps_longitude: check.gpsLongitude,
    });
    if (!idLogged) auditLogFailed = true;
    events.push("id_verified");

    // 3. Age verification (must be 18+ in SA)
    if (!check.recipientIsAdult) {
      const logged = await this.logComplianceEvent({
        order_id: check.orderId,
        driver_id: check.driverId,
        event_type: "minor_refused",
        outcome: "refused",
        recipient_name: check.recipientName,
        notes: `Recipient appears to be under 18. ${check.notes || ""}`.trim(),
        gps_latitude: check.gpsLatitude,
        gps_longitude: check.gpsLongitude,
      });
      if (!logged) auditLogFailed = true;
      events.push("minor_refused");
      passed = false;
      paymentAction = isPrepaid ? "refund_required" : "none";
      blockingReason =
        "Alcohol cannot be delivered to persons under 18 years of age";
      return { passed, events, blockingReason, paymentAction, auditLogFailed };
    }

    // Log age verification
    const ageLogged = await this.logComplianceEvent({
      order_id: check.orderId,
      driver_id: check.driverId,
      event_type: "age_verified",
      outcome: "passed",
      recipient_name: check.recipientName,
      gps_latitude: check.gpsLatitude,
      gps_longitude: check.gpsLongitude,
    });
    if (!ageLogged) auditLogFailed = true;
    events.push("age_verified");

    // 4. Intoxication check
    if (!check.recipientAppearsSober) {
      const intoxicationNotes = check.notes
        ? `Recipient appears intoxicated. Driver observations: ${check.notes}`
        : "Recipient appears intoxicated — no additional observations recorded";

      const logged = await this.logComplianceEvent({
        order_id: check.orderId,
        driver_id: check.driverId,
        event_type: "intoxication_refused",
        outcome: "refused",
        recipient_name: check.recipientName,
        notes: intoxicationNotes,
        gps_latitude: check.gpsLatitude,
        gps_longitude: check.gpsLongitude,
        metadata: {
          evidence_url: check.evidenceUrl || null,
        },
      });
      if (!logged) auditLogFailed = true;
      events.push("intoxication_refused");
      passed = false;
      paymentAction = isPrepaid ? "refund_required" : "none";
      blockingReason =
        "Delivery refused: recipient appears to be visibly intoxicated. SA Liquor Act prohibits delivery to intoxicated persons.";
      return { passed, events, blockingReason, paymentAction, auditLogFailed };
    }

    // 5. Handle substitute recipient — must pass same ID + age checks
    if (check.substituteRecipient) {
      // Substitute recipient must have been independently ID-verified and confirmed adult.
      // The check.idVerified and check.recipientIsAdult flags above already gate this,
      // but we log explicitly that this was a substitute handoff.
      if (!check.idVerified || !check.recipientIsAdult) {
        // This should not be reachable (checks 2 & 3 would have already returned),
        // but guard defensively.
        const logged = await this.logComplianceEvent({
          order_id: check.orderId,
          driver_id: check.driverId,
          event_type: "substitute_recipient",
          outcome: "refused",
          recipient_name: check.recipientName,
          notes: `Substitute recipient failed verification. ${check.notes || ""}`.trim(),
          gps_latitude: check.gpsLatitude,
          gps_longitude: check.gpsLongitude,
        });
        if (!logged) auditLogFailed = true;
        events.push("substitute_refused");
        passed = false;
        paymentAction = isPrepaid ? "refund_required" : "none";
        blockingReason = "Substitute recipient must present valid ID and be 18+";
        return { passed, events, blockingReason, paymentAction, auditLogFailed };
      }

      const subLogged = await this.logComplianceEvent({
        order_id: check.orderId,
        driver_id: check.driverId,
        event_type: "substitute_recipient",
        outcome: "passed",
        recipient_name: check.recipientName,
        notes: `Substitute adult recipient accepted delivery. ID type: ${check.idDocumentType || "unspecified"}. ${check.notes || ""}`.trim(),
        gps_latitude: check.gpsLatitude,
        gps_longitude: check.gpsLongitude,
      });
      if (!subLogged) auditLogFailed = true;
      events.push("substitute_accepted");
    }

    // 6. Mark order as compliance verified
    await supabase
      .from("orders")
      .update({ compliance_verified: true })
      .eq("id", check.orderId);

    return { passed, events, paymentAction, auditLogFailed: auditLogFailed || undefined };
  }

  /**
   * Handle no-recipient scenario
   */
  async reportNoRecipient(
    orderId: string,
    driverId: string,
    lat?: number,
    lng?: number,
  ): Promise<void> {
    await this.logComplianceEvent({
      order_id: orderId,
      driver_id: driverId,
      event_type: "no_recipient",
      outcome: "failed",
      notes: "No eligible recipient available at delivery location",
      gps_latitude: lat,
      gps_longitude: lng,
    });
  }

  /**
   * Check if current time is within delivery hours
   */
  isWithinDeliveryHours(hours = DEFAULT_DELIVERY_HOURS): {
    allowed: boolean;
    startHour: number;
    endHour: number;
  } {
    const now = new Date();
    const currentHour = now.getHours();
    return {
      allowed: currentHour >= hours.start && currentHour < hours.end,
      startHour: hours.start,
      endHour: hours.end,
    };
  }

  /**
   * Log a compliance event to the database.
   * Returns true on success, false if the DB insert failed.
   * Callers must check this and set auditLogFailed if false — an incomplete
   * audit trail is a compliance risk under the SA Liquor Act.
   */
  private async logComplianceEvent(event: {
    order_id: string;
    driver_id: string;
    event_type: string;
    outcome: string;
    recipient_name?: string;
    id_document_type?: string;
    id_verified?: boolean;
    notes?: string;
    gps_latitude?: number;
    gps_longitude?: number;
    metadata?: Record<string, any>;
  }): Promise<boolean> {
    try {
      const { error } = await supabase.from("compliance_events").insert(event);
      if (error) {
        console.error(
          `[ComplianceService] DB error logging compliance event (type=${event.event_type}, order=${event.order_id}):`,
          error,
        );
        return false;
      }
      return true;
    } catch (error) {
      console.error(
        "[ComplianceService] Failed to log compliance event:",
        error,
      );
      return false;
    }
  }

  /**
   * Get compliance history for an order
   */
  async getOrderComplianceEvents(orderId: string) {
    return supabase
      .from("compliance_events")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
  }

  /**
   * Report a compliance incident
   */
  async reportIncident(
    orderId: string,
    driverId: string,
    description: string,
    lat?: number,
    lng?: number,
  ) {
    await this.logComplianceEvent({
      order_id: orderId,
      driver_id: driverId,
      event_type: "compliance_incident",
      outcome: "escalated",
      notes: description,
      gps_latitude: lat,
      gps_longitude: lng,
    });

    // Create a support ticket for the incident
    await supabase.from("support_tickets").insert({
      ticket_number: `CMP-${Date.now()}`,
      user_id: driverId,
      order_id: orderId,
      category: "compliance",
      subject: "Compliance Incident Report",
      description,
      priority: "urgent",
    });
  }
}

export const ComplianceService = ComplianceServiceClass.getInstance();
