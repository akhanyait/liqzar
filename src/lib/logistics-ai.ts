/**
 * AI-powered logistics and transport recommendation system
 * Calculates optimal vehicle type based on order characteristics
 */

export type VehicleType =
  | "scooter"
  | "car"
  | "bakkie"
  | "small_truck"
  | "medium_truck"
  | "large_truck";

export interface VehicleCapacity {
  type: VehicleType;
  label: string;
  maxWeight: number; // kg
  maxVolume: number; // m³
  icon: string;
}

export const VEHICLE_CAPACITIES: VehicleCapacity[] = [
  {
    type: "scooter",
    label: "Scooter/Motorbike",
    maxWeight: 20,
    maxVolume: 0.15,
    icon: "🛵",
  },
  {
    type: "car",
    label: "Small Car",
    maxWeight: 100,
    maxVolume: 0.5,
    icon: "🚗",
  },
  {
    type: "bakkie",
    label: "Bakkie/Pickup",
    maxWeight: 500,
    maxVolume: 2.0,
    icon: "🚙",
  },
  {
    type: "small_truck",
    label: "Small Delivery Truck",
    maxWeight: 1000,
    maxVolume: 5.0,
    icon: "🚚",
  },
  {
    type: "medium_truck",
    label: "Medium Truck",
    maxWeight: 2000,
    maxVolume: 10.0,
    icon: "🚛",
  },
  {
    type: "large_truck",
    label: "Large Truck",
    maxWeight: 5000,
    maxVolume: 20.0,
    icon: "🏗️",
  },
];

export interface OrderCharacteristics {
  totalWeight: number; // kg
  totalVolume: number; // m³
  itemCount: number;
  distance: number; // km
  isFragile?: boolean;
  requiresRefrigeration?: boolean;
}

export interface RecommendationResult {
  recommendedVehicle: VehicleType;
  confidence: number; // 0-100
  reason: string;
  alternativeVehicles: VehicleType[];
  warnings: string[];
}

/**
 * Calculate recommended vehicle type using AI logic
 */
export function calculateRecommendedVehicle(
  characteristics: OrderCharacteristics,
): RecommendationResult {
  const {
    totalWeight,
    totalVolume,
    itemCount,
    distance,
    isFragile,
    requiresRefrigeration,
  } = characteristics;

  let recommendedVehicle: VehicleType = "scooter";
  let confidence = 0;
  let reason = "";
  const warnings: string[] = [];
  const alternativeVehicles: VehicleType[] = [];

  // Weight-based primary recommendation
  if (totalWeight <= 20 && totalVolume <= 0.15) {
    recommendedVehicle = "scooter";
    confidence = 95;
    reason = "Lightweight delivery suitable for scooter";
  } else if (totalWeight <= 100 && totalVolume <= 0.5) {
    recommendedVehicle = "car";
    confidence = 90;
    reason = "Medium-sized delivery fits standard car";
  } else if (totalWeight <= 500 && totalVolume <= 2.0) {
    recommendedVehicle = "bakkie";
    confidence = 90;
    reason = "Large delivery requires pickup truck capacity";
  } else if (totalWeight <= 1000 && totalVolume <= 5.0) {
    recommendedVehicle = "small_truck";
    confidence = 85;
    reason = "Heavy load requires small delivery truck";
  } else if (totalWeight <= 2000 && totalVolume <= 10.0) {
    recommendedVehicle = "medium_truck";
    confidence = 85;
    reason = "Very heavy load requires medium truck";
  } else {
    recommendedVehicle = "large_truck";
    confidence = 80;
    reason = "Extremely heavy load requires large truck";
  }

  // Distance factor - upgrade if long distance
  if (distance > 50 && recommendedVehicle !== "large_truck") {
    const vehicleIndex = VEHICLE_CAPACITIES.findIndex(
      (v) => v.type === recommendedVehicle,
    );
    if (vehicleIndex < VEHICLE_CAPACITIES.length - 1) {
      alternativeVehicles.push(recommendedVehicle);
      recommendedVehicle = VEHICLE_CAPACITIES[vehicleIndex + 1].type;
      reason += " - Upgraded for long-distance delivery";
      confidence -= 10;
      warnings.push(
        "Long distance delivery may require larger vehicle for comfort",
      );
    }
  }

  // Item count factor - many items need more space
  if (itemCount > 20 && recommendedVehicle === "scooter") {
    alternativeVehicles.push("scooter");
    recommendedVehicle = "car";
    reason = "High item count requires car space despite low weight";
    confidence = 80;
    warnings.push("Many items may be difficult to secure on scooter");
  }

  // Fragile items - prefer more stable vehicles
  if (
    isFragile &&
    (recommendedVehicle === "scooter" || recommendedVehicle === "bakkie")
  ) {
    warnings.push("Fragile items - ensure proper packaging and suspension");
    confidence -= 5;
  }

  // Refrigeration requirement - limits vehicle options
  if (requiresRefrigeration) {
    if (recommendedVehicle === "scooter") {
      alternativeVehicles.push("scooter");
      recommendedVehicle = "car";
      reason = "Refrigerated delivery requires enclosed vehicle";
      warnings.push("Ensure vehicle has cooling equipment");
      confidence = 70;
    } else {
      warnings.push("Verify vehicle has refrigeration capability");
      confidence -= 10;
    }
  }

  // Volume vs weight check - if volume is the limiting factor
  const vehicleCapacity = VEHICLE_CAPACITIES.find(
    (v) => v.type === recommendedVehicle,
  );
  if (vehicleCapacity) {
    const weightUtilization = (totalWeight / vehicleCapacity.maxWeight) * 100;
    const volumeUtilization = (totalVolume / vehicleCapacity.maxVolume) * 100;

    if (volumeUtilization > weightUtilization + 30) {
      warnings.push("Bulky items - volume is the limiting factor");

      // Check if we need vehicle upgrade for volume
      if (volumeUtilization > 90) {
        const currentIndex = VEHICLE_CAPACITIES.findIndex(
          (v) => v.type === recommendedVehicle,
        );
        if (currentIndex < VEHICLE_CAPACITIES.length - 1) {
          alternativeVehicles.push(recommendedVehicle);
          recommendedVehicle = VEHICLE_CAPACITIES[currentIndex + 1].type;
          reason = "Upgraded for bulky items (volume constraint)";
          confidence -= 15;
        }
      }
    }
  }

  // Generate alternative vehicles (one tier down and one tier up)
  const currentIndex = VEHICLE_CAPACITIES.findIndex(
    (v) => v.type === recommendedVehicle,
  );
  if (
    currentIndex > 0 &&
    !alternativeVehicles.includes(VEHICLE_CAPACITIES[currentIndex - 1].type)
  ) {
    alternativeVehicles.push(VEHICLE_CAPACITIES[currentIndex - 1].type);
  }
  if (
    currentIndex < VEHICLE_CAPACITIES.length - 1 &&
    !alternativeVehicles.includes(VEHICLE_CAPACITIES[currentIndex + 1].type)
  ) {
    alternativeVehicles.push(VEHICLE_CAPACITIES[currentIndex + 1].type);
  }

  return {
    recommendedVehicle,
    confidence: Math.max(0, Math.min(100, confidence)),
    reason,
    alternativeVehicles,
    warnings,
  };
}

/**
 * Check if assigned vehicle is suitable for the load
 */
export function checkVehicleMismatch(
  orderCharacteristics: OrderCharacteristics,
  assignedVehicle: VehicleType,
): {
  isMismatch: boolean;
  severity: "none" | "warning" | "critical";
  message: string;
} {
  const recommendation = calculateRecommendedVehicle(orderCharacteristics);
  const assignedCapacity = VEHICLE_CAPACITIES.find(
    (v) => v.type === assignedVehicle,
  );
  const recommendedCapacity = VEHICLE_CAPACITIES.find(
    (v) => v.type === recommendation.recommendedVehicle,
  );

  if (!assignedCapacity || !recommendedCapacity) {
    return {
      isMismatch: false,
      severity: "none",
      message: "",
    };
  }

  // Check if assigned vehicle capacity is sufficient
  const { totalWeight, totalVolume } = orderCharacteristics;
  const weightExceeded = totalWeight > assignedCapacity.maxWeight;
  const volumeExceeded = totalVolume > assignedCapacity.maxVolume;

  if (weightExceeded || volumeExceeded) {
    return {
      isMismatch: true,
      severity: "critical",
      message: `⚠️ CRITICAL: ${assignedCapacity.label} capacity exceeded! Vehicle: ${assignedCapacity.maxWeight}kg / ${assignedCapacity.maxVolume}m³ | Load: ${totalWeight}kg / ${totalVolume}m³`,
    };
  }

  // Check if assigned vehicle is smaller than recommended
  const assignedIndex = VEHICLE_CAPACITIES.findIndex(
    (v) => v.type === assignedVehicle,
  );
  const recommendedIndex = VEHICLE_CAPACITIES.findIndex(
    (v) => v.type === recommendation.recommendedVehicle,
  );

  if (assignedIndex < recommendedIndex) {
    const utilizationWeight = (totalWeight / assignedCapacity.maxWeight) * 100;
    const utilizationVolume = (totalVolume / assignedCapacity.maxVolume) * 100;

    if (utilizationWeight > 85 || utilizationVolume > 85) {
      return {
        isMismatch: true,
        severity: "warning",
        message: `⚠️ WARNING: ${assignedCapacity.label} may be undersized. Recommended: ${recommendedCapacity.label}. Utilization: ${Math.round(Math.max(utilizationWeight, utilizationVolume))}%`,
      };
    }
  }

  // Check if assigned vehicle is much larger than needed (inefficient)
  if (assignedIndex > recommendedIndex + 1) {
    return {
      isMismatch: true,
      severity: "warning",
      message: `ℹ️ Note: ${assignedCapacity.label} may be oversized for this delivery. Consider ${recommendedCapacity.label} for efficiency.`,
    };
  }

  return {
    isMismatch: false,
    severity: "none",
    message: `✓ ${assignedCapacity.label} is suitable for this delivery`,
  };
}

/**
 * Get vehicle capacity info by type
 */
export function getVehicleCapacity(
  vehicleType: VehicleType,
): VehicleCapacity | undefined {
  return VEHICLE_CAPACITIES.find((v) => v.type === vehicleType);
}

/**
 * Calculate total order characteristics from items
 */
export function calculateOrderCharacteristics(
  items: Array<{
    weight_kg?: number | null;
    volume_m3?: number | null;
    quantity: number;
  }>,
  distance: number,
  options?: {
    isFragile?: boolean;
    requiresRefrigeration?: boolean;
  },
): OrderCharacteristics {
  let totalWeight = 0;
  let totalVolume = 0;
  let itemCount = 0;

  items.forEach((item) => {
    const quantity = item.quantity || 1;
    totalWeight += (item.weight_kg || 0) * quantity;
    totalVolume += (item.volume_m3 || 0) * quantity;
    itemCount += quantity;
  });

  return {
    totalWeight,
    totalVolume,
    itemCount,
    distance,
    isFragile: options?.isFragile,
    requiresRefrigeration: options?.requiresRefrigeration,
  };
}
