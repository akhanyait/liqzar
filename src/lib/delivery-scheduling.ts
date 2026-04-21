/**
 * Delivery Scheduling Logic and Rules
 * ===================================
 *
 * Business Rules:
 * - In-house delivery radius: 20km
 * - Same-day delivery cutoff: 12:00 PM
 * - Within 20km: In-house delivery (same-day eligible if before cutoff)
 * - Outside 20km: Outsourced to partner couriers
 *
 * Customer Options:
 * - Same-day delivery (within 20km + before 12 PM only)
 * - Next-day delivery (always available)
 * - Scheduled delivery (future date picker)
 */

// ============================================================================
// TYPES
// ============================================================================

export type DeliveryZoneType = "in-house" | "outsourced";

export interface DeliveryZone {
  type: DeliveryZoneType;
  distance: number;
  isWithinRadius: boolean;
  estimatedMinutes: number;
}

export interface DeliveryEligibility {
  sameDayAvailable: boolean;
  sameDayReason?: string;
  nextDayAvailable: boolean;
  scheduledAvailable: boolean;
  isInHouse: boolean;
  isOutsourced: boolean;
  distance: number;
}

export interface DeliveryOption {
  id: "same-day" | "next-day" | "scheduled";
  label: string;
  description: string;
  fee: number;
  available: boolean;
  unavailableReason?: string;
  estimatedDelivery: string;
  deliveryDate?: Date;
}

export interface ScheduledSlot {
  id: string;
  date: string;
  dayLabel: string;
  slots: {
    id: string;
    label: string;
    available: boolean;
    capacity: number;
    booked: number;
  }[];
}

export interface DatePickerDate {
  date: Date;
  dateString: string;
  dayOfWeek: string;
  dayNumber: number;
  month: string;
  isAvailable: boolean;
  isPast: boolean;
  isToday: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

// Warehouse location (Sandton, JHB)
const WAREHOUSE_LOCATION = {
  lat: -26.1076,
  lng: 28.0567,
  name: "LIQZAR Sandton DC",
  address: "15 Rivonia Rd, Sandton",
};

// Delivery thresholds
export const IN_HOUSE_RADIUS_KM = 20;
export const SAME_DAY_CUTOFF_HOUR = 12; // 12:00 PM

// Time slots for scheduled delivery
const TIME_SLOTS = [
  { id: "slot_09_11", label: "09:00 – 11:00" },
  { id: "slot_11_13", label: "11:00 – 13:00" },
  { id: "slot_13_15", label: "13:00 – 15:00" },
  { id: "slot_15_17", label: "15:00 – 17:00" },
  { id: "slot_17_19", label: "17:00 – 19:00" },
  { id: "slot_19_21", label: "19:00 – 21:00" },
];

// Delivery fees
const DELIVERY_FEES = {
  inHouse: {
    sameDay: 49.99,
    nextDay: 35.0,
    scheduled: 25.0,
  },
  outsourced: {
    standard: 59.99,
    express: 89.99,
  },
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Check if current time is before cutoff
 */
export const isBeforeCutoff = (currentTime: Date = new Date()): boolean => {
  return currentTime.getHours() < SAME_DAY_CUTOFF_HOUR;
};

/**
 * Get time until cutoff in minutes
 */
export const getMinutesUntilCutoff = (
  currentTime: Date = new Date(),
): number => {
  const cutoff = new Date(currentTime);
  cutoff.setHours(SAME_DAY_CUTOFF_HOUR, 0, 0, 0);
  return Math.max(0, (cutoff.getTime() - currentTime.getTime()) / (1000 * 60));
};

/**
 * Check if a date is in the past
 */
export const isPastDate = (
  date: Date,
  currentDate: Date = new Date(),
): boolean => {
  const dateOnly = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
  const todayOnly = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    currentDate.getDate(),
  );
  return dateOnly < todayOnly;
};

/**
 * Check if a date is today
 */
export const isToday = (
  date: Date,
  currentDate: Date = new Date(),
): boolean => {
  return (
    date.getFullYear() === currentDate.getFullYear() &&
    date.getMonth() === currentDate.getMonth() &&
    date.getDate() === currentDate.getDate()
  );
};

// ============================================================================
// CORE DELIVERY LOGIC
// ============================================================================

/**
 * Determine delivery zone based on customer coordinates
 *
 * @param lat Customer latitude
 * @param lng Customer longitude
 * @returns DeliveryZone with type (in-house or outsourced) and distance
 */
export const determineDeliveryZone = (
  lat: number,
  lng: number,
): DeliveryZone => {
  const distance = calculateDistance(
    WAREHOUSE_LOCATION.lat,
    WAREHOUSE_LOCATION.lng,
    lat,
    lng,
  );

  const isWithinRadius = distance <= IN_HOUSE_RADIUS_KM;

  return {
    type: isWithinRadius ? "in-house" : "outsourced",
    distance,
    isWithinRadius,
    estimatedMinutes: isWithinRadius
      ? Math.round(distance * 3) // ~3 min per km for in-house
      : Math.round(distance * 2), // ~2 min per km for outsourced (highway)
  };
};

/**
 * Check if same-day delivery is available
 *
 * Rules:
 * 1. Address must be within 20km (in-house)
 * 2. Order must be placed before 12:00 PM
 */
export const isSameDayAvailable = (
  zone: DeliveryZone,
  currentTime: Date = new Date(),
): { available: boolean; reason?: string } => {
  // Rule 1: Must be in-house (within 20km)
  if (!zone.isWithinRadius) {
    return {
      available: false,
      reason: `Same-day delivery is only available within ${IN_HOUSE_RADIUS_KM}km. Your address is ${zone.distance.toFixed(1)}km away.`,
    };
  }

  // Rule 2: Must be before 12:00 PM cutoff
  if (!isBeforeCutoff(currentTime)) {
    return {
      available: false,
      reason: `Same-day delivery orders must be placed before ${SAME_DAY_CUTOFF_HOUR}:00 PM. Next available: Next-day delivery.`,
    };
  }

  const minutesUntilCutoff = getMinutesUntilCutoff(currentTime);

  return {
    available: true,
    reason: `Order within ${Math.floor(minutesUntilCutoff)} minutes for same-day delivery!`,
  };
};

/**
 * Get full delivery eligibility for an address
 *
 * @param coordinates Customer coordinates
 * @param currentTime Current time for cutoff calculation
 * @returns Complete delivery eligibility information
 */
export const getDeliveryEligibility = (
  coordinates: { lat: number; lng: number } | undefined,
  currentTime: Date = new Date(),
): DeliveryEligibility | null => {
  if (!coordinates) return null;

  const zone = determineDeliveryZone(coordinates.lat, coordinates.lng);
  const sameDayCheck = isSameDayAvailable(zone, currentTime);

  return {
    sameDayAvailable: sameDayCheck.available,
    sameDayReason: sameDayCheck.reason,
    nextDayAvailable: true, // Always available
    scheduledAvailable: true, // Always available
    isInHouse: zone.isWithinRadius,
    isOutsourced: !zone.isWithinRadius,
    distance: zone.distance,
  };
};

/**
 * Get all delivery options based on coordinates
 *
 * @param input Customer coordinates or pre-determined zone
 * @param currentTime Current time for calculations
 * @returns Array of available delivery options
 */
export const getDeliveryOptions = (
  input: DeliveryZone | { lat: number; lng: number } | undefined,
  currentTime: Date = new Date(),
): DeliveryOption[] => {
  if (!input) return [];

  // Convert coordinates to zone if needed
  let zone: DeliveryZone;
  if ("type" in input) {
    zone = input;
  } else if ("lat" in input && "lng" in input) {
    zone = determineDeliveryZone(input.lat, input.lng);
  } else {
    return [];
  }

  const options: DeliveryOption[] = [];
  const sameDayCheck = isSameDayAvailable(zone, currentTime);

  // Calculate dates
  const today = new Date(currentTime);
  const tomorrow = new Date(currentTime);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  // ─────────────────────────────────────────────────────────────────────────
  // IN-HOUSE DELIVERY OPTIONS (within 20km)
  // ─────────────────────────────────────────────────────────────────────────
  if (zone.isWithinRadius) {
    // Same-day delivery option
    const sameDayETA = new Date(
      today.getTime() + zone.estimatedMinutes * 60 * 1000 + 2 * 60 * 60 * 1000,
    ); // +2 hours processing

    options.push({
      id: "same-day",
      label: "Same-Day Delivery",
      description: sameDayCheck.available
        ? `Delivered today by ${sameDayETA.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}`
        : sameDayCheck.reason || "Not available",
      fee: DELIVERY_FEES.inHouse.sameDay,
      available: sameDayCheck.available,
      unavailableReason: sameDayCheck.available
        ? undefined
        : sameDayCheck.reason,
      estimatedDelivery: sameDayCheck.available
        ? `Today, ${formatDate(today)}`
        : "Not available",
      deliveryDate: sameDayCheck.available ? today : undefined,
    });

    // Next-day delivery option
    options.push({
      id: "next-day",
      label: "Next-Day Delivery",
      description: "Delivered tomorrow between 09:00 – 18:00",
      fee: DELIVERY_FEES.inHouse.nextDay,
      available: true,
      estimatedDelivery: formatDate(tomorrow),
      deliveryDate: tomorrow,
    });

    // Scheduled delivery option
    options.push({
      id: "scheduled",
      label: "Schedule for Later",
      description: "Choose your preferred date and time",
      fee: DELIVERY_FEES.inHouse.scheduled,
      available: true,
      estimatedDelivery: "Select a date",
    });
  }
  // ─────────────────────────────────────────────────────────────────────────
  // OUTSOURCED DELIVERY OPTIONS (outside 20km)
  // ─────────────────────────────────────────────────────────────────────────
  else {
    const outsourcedDate = new Date(currentTime);
    outsourcedDate.setDate(outsourcedDate.getDate() + 2); // 2-3 business days

    // Nationwide partner-courier delivery
    options.push({
      id: "next-day",
      label: "Nationwide Delivery",
      description: `Handled by our bonded partner courier \u00b7 arrives within 2 working days`,
      fee: DELIVERY_FEES.outsourced.standard,
      available: true,
      estimatedDelivery: "Within 2 working days",
      deliveryDate: outsourcedDate,
    });

    // Priority nationwide delivery
    options.push({
      id: "scheduled",
      label: "Priority Nationwide",
      description: "Next working day \u00b7 signature on delivery",
      fee: DELIVERY_FEES.outsourced.express,
      available: true,
      estimatedDelivery: "Next working day",
    });
  }

  return options;
};

/**
 * Get zone info for display badges
 */
export const getZoneInfo = (
  coordinates: { lat: number; lng: number } | undefined,
): {
  type: DeliveryZoneType;
  distance: number;
  badge: string;
  label: string;
  color: string;
  description: string;
} | null => {
  if (!coordinates) return null;

  const zone = determineDeliveryZone(coordinates.lat, coordinates.lng);

  if (zone.isWithinRadius) {
    return {
      type: "in-house",
      distance: zone.distance,
      badge: "In-House Delivery",
      label: "In-House Zone",
      color: "green",
      description: `${zone.distance.toFixed(1)}km away • Same-day eligible`,
    };
  }

  return {
    type: "outsourced",
    distance: zone.distance,
    badge: "Partner Delivery",
    label: "Outsourced Zone",
    color: "amber",
    description: `${zone.distance.toFixed(1)}km away • 2-3 day delivery`,
  };
};

// ============================================================================
// SCHEDULED DELIVERY
// ============================================================================

/**
 * Generate available dates for date picker
 *
 * @param startDate Starting date (default: today)
 * @param daysAhead Number of days to show (default: 14)
 * @returns Array of available dates
 */
export const getAvailableDates = (
  startDate: Date = new Date(),
  daysAhead: number = 14,
): DatePickerDate[] => {
  const dates: DatePickerDate[] = [];
  const today = new Date(startDate);
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= daysAhead; i++) {
    // Start from tomorrow
    const date = new Date(today);
    date.setDate(today.getDate() + i);

    // Skip Sundays (or adjust based on business rules)
    const isSunday = date.getDay() === 0;

    dates.push({
      date,
      dateString: date.toISOString().split("T")[0],
      dayOfWeek: date.toLocaleDateString("en-ZA", { weekday: "short" }),
      dayNumber: date.getDate(),
      month: date.toLocaleDateString("en-ZA", { month: "short" }),
      isAvailable: !isSunday,
      isPast: false, // Future dates are never past
      isToday: false, // We start from tomorrow
    });
  }

  return dates;
};

/**
 * Generate scheduled delivery slots for a specific number of days
 */
export const getScheduledSlots = (
  startDate: Date = new Date(),
  daysAhead: number = 7,
): ScheduledSlot[] => {
  const slots: ScheduledSlot[] = [];
  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 1); // Start from tomorrow

  for (let d = 0; d < daysAhead; d++) {
    const date = new Date(start);
    date.setDate(start.getDate() + d);

    // Skip Sundays
    if (date.getDay() === 0) continue;

    const daySlots = TIME_SLOTS.map((slot) => {
      // Mock capacity (in production, fetch from backend)
      const capacity = 10;
      const booked = Math.floor(Math.random() * 8);

      return {
        id: slot.id,
        label: slot.label,
        available: booked < capacity,
        capacity,
        booked,
      };
    });

    slots.push({
      id: date.toISOString().split("T")[0],
      date: date.toISOString().split("T")[0],
      dayLabel: date.toLocaleDateString("en-ZA", {
        weekday: "short",
        day: "numeric",
        month: "short",
      }),
      slots: daySlots,
    });
  }

  return slots;
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate delivery selection before order placement
 *
 * @param selectedOption The customer's selected delivery option
 * @param coordinates Customer coordinates
 * @param scheduledDate Selected date for scheduled delivery
 * @param scheduledSlot Selected time slot for scheduled delivery
 * @returns Validation result with error messages and suggestions
 */
export const validateDeliverySelection = (
  selectedOption: "same-day" | "next-day" | "scheduled",
  coordinates: { lat: number; lng: number } | undefined,
  scheduledDate?: string,
  scheduledSlot?: string,
): {
  valid: boolean;
  message?: string;
  suggestedOption?: "next-day" | "scheduled";
  errors: string[];
} => {
  const errors: string[] = [];

  // Check if we have coordinates
  if (!coordinates) {
    return {
      valid: false,
      message: "Please provide a delivery address",
      errors: ["Delivery address is required"],
    };
  }

  const zone = determineDeliveryZone(coordinates.lat, coordinates.lng);

  // Validate same-day selection
  if (selectedOption === "same-day") {
    // Check if address is within 20km
    if (!zone.isWithinRadius) {
      errors.push(
        `Same-day delivery is not available for addresses outside ${IN_HOUSE_RADIUS_KM}km`,
      );
      return {
        valid: false,
        message: `Your address is ${zone.distance.toFixed(1)}km away. Same-day delivery is only available within ${IN_HOUSE_RADIUS_KM}km.`,
        suggestedOption: "next-day",
        errors,
      };
    }

    // Check if before cutoff
    if (!isBeforeCutoff()) {
      errors.push(
        `Same-day orders must be placed before ${SAME_DAY_CUTOFF_HOUR}:00 PM`,
      );
      return {
        valid: false,
        message: `Same-day delivery cutoff is ${SAME_DAY_CUTOFF_HOUR}:00 PM. Your order will be delivered next day.`,
        suggestedOption: "next-day",
        errors,
      };
    }
  }

  // Validate scheduled delivery
  if (selectedOption === "scheduled") {
    if (!scheduledDate) {
      errors.push("Please select a delivery date");
    }

    if (scheduledDate && !scheduledSlot && zone.isWithinRadius) {
      errors.push("Please select a delivery time slot");
    }

    // Check if date is in the past
    if (scheduledDate) {
      const selectedDate = new Date(scheduledDate);
      if (isPastDate(selectedDate)) {
        errors.push("Cannot select a past date");
      }
    }

    if (errors.length > 0) {
      return {
        valid: false,
        message: errors[0],
        errors,
      };
    }
  }

  // Validate outsourced delivery (cannot select same-day)
  if (!zone.isWithinRadius && selectedOption === "same-day") {
    return {
      valid: false,
      message: "Same-day delivery is not available for outsourced deliveries",
      suggestedOption: "next-day",
      errors: ["Same-day not available for this address"],
    };
  }

  return {
    valid: true,
    errors: [],
  };
};

/**
 * Get the default/recommended delivery option
 */
export const getDefaultDeliveryOption = (
  coordinates: { lat: number; lng: number } | undefined,
  currentTime: Date = new Date(),
): "same-day" | "next-day" | "scheduled" => {
  if (!coordinates) return "next-day";

  const zone = determineDeliveryZone(coordinates.lat, coordinates.lng);

  // If outsourced, default to standard delivery
  if (!zone.isWithinRadius) {
    return "next-day";
  }

  // If in-house and before cutoff, default to same-day
  if (isBeforeCutoff(currentTime)) {
    return "same-day";
  }

  // Otherwise, default to next-day
  return "next-day";
};

// ============================================================================
// FEE CALCULATION
// ============================================================================

/**
 * Calculate delivery fee based on zone and option
 */
export const getDeliveryFee = (
  coordinates: { lat: number; lng: number } | undefined,
  option: "same-day" | "next-day" | "scheduled",
): number => {
  if (!coordinates) return 0;

  const zone = determineDeliveryZone(coordinates.lat, coordinates.lng);

  if (zone.isWithinRadius) {
    switch (option) {
      case "same-day":
        return DELIVERY_FEES.inHouse.sameDay;
      case "next-day":
        return DELIVERY_FEES.inHouse.nextDay;
      case "scheduled":
        return DELIVERY_FEES.inHouse.scheduled;
    }
  } else {
    switch (option) {
      case "next-day":
        return DELIVERY_FEES.outsourced.standard;
      case "scheduled":
        return DELIVERY_FEES.outsourced.express;
      default:
        return DELIVERY_FEES.outsourced.standard;
    }
  }
};

// ============================================================================
// NOTIFICATION FORMATTING
// ============================================================================

/**
 * Format delivery status for notifications
 */
export const formatDeliveryStatus = (
  status: string,
  details?: Record<string, any>,
): { title: string; message: string } => {
  const statusMessages: Record<string, { title: string; message: string }> = {
    order_confirmed: {
      title: "✅ Order Confirmed",
      message: `Your order has been received and is being processed.`,
    },
    scheduled_same_day: {
      title: "🚀 Same-Day Delivery",
      message: `Your order is scheduled for delivery today by ${details?.eta || "end of day"}.`,
    },
    scheduled_next_day: {
      title: "📅 Next-Day Delivery",
      message: `Your order is scheduled for delivery tomorrow.`,
    },
    scheduled_date: {
      title: "📅 Scheduled Delivery",
      message: `Your order is scheduled for ${details?.date || "your selected date"}.`,
    },
    driver_allocated: {
      title: "🚗 Driver Assigned",
      message: `${details?.driverName || "Your driver"} has been assigned to your delivery.`,
    },
    driver_to_warehouse: {
      title: "🏪 Driver En Route to Warehouse",
      message: `Your driver is heading to collect your order.`,
    },
    order_loaded: {
      title: "📦 Order Loaded",
      message: `Your order has been loaded and is ready for dispatch.`,
    },
    driver_en_route: {
      title: "🚗 Driver On The Way",
      message: `Your order is on its way! ETA: ${details?.eta || "soon"}.`,
    },
    arriving_soon: {
      title: "📍 Almost There!",
      message: `Your driver is ${details?.minutes || "a few"} minutes away.`,
    },
    delivered: {
      title: "🎉 Delivered!",
      message: `Your order has been delivered. Enjoy!`,
    },
    delivery_rescheduled: {
      title: "📅 Delivery Rescheduled",
      message: `Your delivery has been rescheduled to ${details?.newDate || "a new time"}.`,
    },
  };

  return (
    statusMessages[status] || {
      title: "Order Update",
      message: "Your order status has been updated.",
    }
  );
};

// ============================================================================
// EXAMPLE SCENARIOS (for testing/documentation)
// ============================================================================

/**
 * Example scenarios demonstrating the delivery logic
 */
export const EXAMPLE_SCENARIOS = {
  // Scenario 1: Customer within 20km, before 12 PM
  withinRadiusBeforeCutoff: {
    coordinates: { lat: -26.11, lng: 28.06 }, // ~0.5km from warehouse
    time: new Date("2026-03-14T10:00:00"), // 10:00 AM
    expected: {
      sameDayAvailable: true,
      nextDayAvailable: true,
      scheduledAvailable: true,
    },
  },

  // Scenario 2: Customer within 20km, after 12 PM
  withinRadiusAfterCutoff: {
    coordinates: { lat: -26.11, lng: 28.06 }, // ~0.5km from warehouse
    time: new Date("2026-03-14T14:00:00"), // 2:00 PM
    expected: {
      sameDayAvailable: false,
      sameDayReason: "Same-day delivery orders must be placed before 12:00 PM",
      nextDayAvailable: true,
      scheduledAvailable: true,
    },
  },

  // Scenario 3: Customer outside 20km
  outsideRadius: {
    coordinates: { lat: -26.2, lng: 28.5 }, // ~45km from warehouse
    time: new Date("2026-03-14T10:00:00"), // 10:00 AM
    expected: {
      sameDayAvailable: false,
      sameDayReason: "Same-day delivery is only available within 20km",
      nextDayAvailable: true,
      scheduledAvailable: true,
      deliveryType: "outsourced",
    },
  },

  // Scenario 4: Edge case - exactly 20km
  exactlyOnRadius: {
    coordinates: { lat: -26.1076 + 0.18, lng: 28.0567 }, // ~20km north
    time: new Date("2026-03-14T10:00:00"),
    expected: {
      sameDayAvailable: true, // Still within radius
      deliveryType: "in-house",
    },
  },
};

// ============================================================================
// EXPORTS
// ============================================================================

export { WAREHOUSE_LOCATION, DELIVERY_FEES };

// Legacy alias for backwards compatibility
export const SAME_DAY_RADIUS_KM = IN_HOUSE_RADIUS_KM;
