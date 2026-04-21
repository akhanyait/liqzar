/**
 * Address Intelligence Service
 * Auto-suggest, validate, and resolve South African addresses
 */

import {
  DeliveryZone,
  determineDeliveryZone,
  SAME_DAY_RADIUS_KM,
  IN_HOUSE_RADIUS_KM,
} from "./delivery-scheduling";

export interface StructuredAddress {
  fullName: string;
  phone: string;
  addressLine1: string; // Unit/Street
  addressLine2: string; // Suburb
  addressLine3: string; // City/Town
  province: string;
  postalCode: string;
  country: string;
  // Resolved data
  coordinates?: { lat: number; lng: number };
  formattedAddress?: string;
  deliveryZone?: DeliveryZone;
  validated?: boolean;
  validationErrors?: string[];
}

export interface AddressSuggestion {
  id: string;
  addressLine1: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  coordinates: { lat: number; lng: number };
  formattedAddress: string;
}

// Alias for component compatibility
export type SuburbSuggestion = AddressSuggestion;

// South African provinces
export const SA_PROVINCES = [
  "Eastern Cape",
  "Free State",
  "Gauteng",
  "KwaZulu-Natal",
  "Limpopo",
  "Mpumalanga",
  "North West",
  "Northern Cape",
  "Western Cape",
] as const;

// Sample suburbs with coordinates (in production, this would be from a geocoding API)
const SUBURB_DATABASE: Record<
  string,
  {
    city: string;
    province: string;
    postalCode: string;
    coordinates: { lat: number; lng: number };
  }
> = {
  Sandton: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    coordinates: { lat: -26.1076, lng: 28.0567 },
  },
  Rosebank: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    coordinates: { lat: -26.1454, lng: 28.0436 },
  },
  Fourways: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    coordinates: { lat: -26.0195, lng: 28.0127 },
  },
  Bryanston: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    coordinates: { lat: -26.057, lng: 28.0204 },
  },
  Midrand: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1685",
    coordinates: { lat: -25.9889, lng: 28.1267 },
  },
  Centurion: {
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0157",
    coordinates: { lat: -25.8603, lng: 28.1894 },
  },
  Menlyn: {
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0181",
    coordinates: { lat: -25.7827, lng: 28.2751 },
  },
  Brooklyn: {
    city: "Pretoria",
    province: "Gauteng",
    postalCode: "0181",
    coordinates: { lat: -25.7695, lng: 28.2376 },
  },
  Randburg: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2194",
    coordinates: { lat: -26.0936, lng: 27.9941 },
  },
  Roodepoort: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1724",
    coordinates: { lat: -26.1625, lng: 27.8727 },
  },
  Bedfordview: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2008",
    coordinates: { lat: -26.183, lng: 28.139 },
  },
  Edenvale: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1609",
    coordinates: { lat: -26.1388, lng: 28.1529 },
  },
  "Kempton Park": {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1619",
    coordinates: { lat: -26.1043, lng: 28.2296 },
  },
  Boksburg: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1459",
    coordinates: { lat: -26.2128, lng: 28.2564 },
  },
  Benoni: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1501",
    coordinates: { lat: -26.1882, lng: 28.321 },
  },
  Germiston: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1401",
    coordinates: { lat: -26.2183, lng: 28.1697 },
  },
  Alberton: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1449",
    coordinates: { lat: -26.2667, lng: 28.1167 },
  },
  Soweto: {
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "1818",
    coordinates: { lat: -26.2485, lng: 27.854 },
  },
  // Cape Town
  "Sea Point": {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8005",
    coordinates: { lat: -33.9152, lng: 18.3853 },
  },
  "Camps Bay": {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "8005",
    coordinates: { lat: -33.951, lng: 18.3777 },
  },
  Claremont: {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7708",
    coordinates: { lat: -33.9857, lng: 18.4609 },
  },
  Constantia: {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7806",
    coordinates: { lat: -34.0279, lng: 18.4209 },
  },
  Bellville: {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7530",
    coordinates: { lat: -33.9017, lng: 18.6289 },
  },
  "Century City": {
    city: "Cape Town",
    province: "Western Cape",
    postalCode: "7441",
    coordinates: { lat: -33.8919, lng: 18.5114 },
  },
  // Durban
  Umhlanga: {
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4320",
    coordinates: { lat: -29.7245, lng: 31.085 },
  },
  Berea: {
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4001",
    coordinates: { lat: -29.8522, lng: 31.0119 },
  },
  Morningside: {
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4001",
    coordinates: { lat: -29.8261, lng: 31.0088 },
  },
  Ballito: {
    city: "Durban",
    province: "KwaZulu-Natal",
    postalCode: "4420",
    coordinates: { lat: -29.539, lng: 31.214 },
  },
};

/**
 * Get suburb suggestions based on input
 */
export const getSuburbSuggestions = (query: string): AddressSuggestion[] => {
  if (!query || query.length < 2) return [];

  const normalizedQuery = query.toLowerCase();
  const matches: AddressSuggestion[] = [];

  Object.entries(SUBURB_DATABASE).forEach(([suburb, data]) => {
    if (
      suburb.toLowerCase().includes(normalizedQuery) ||
      data.city.toLowerCase().includes(normalizedQuery)
    ) {
      matches.push({
        id: `${suburb}-${data.postalCode}`,
        addressLine1: "",
        suburb,
        city: data.city,
        province: data.province,
        postalCode: data.postalCode,
        coordinates: data.coordinates,
        formattedAddress: `${suburb}, ${data.city}, ${data.province} ${data.postalCode}`,
      });
    }
  });

  return matches.slice(0, 5);
};

/**
 * Resolve address to get coordinates and delivery zone
 */
export const resolveAddress = (
  input:
    | { suburb: string; city?: string; province?: string; postalCode?: string }
    | string,
  cityParam?: string,
): {
  coordinates: { lat: number; lng: number } | null;
  deliveryZone: DeliveryZone | null;
  postalCode: string | null;
  province: string | null;
} | null => {
  // Handle both object and string parameters
  const suburb = typeof input === "string" ? input : input.suburb;
  const city = typeof input === "string" ? cityParam : input.city;

  if (!suburb) return null;

  // Look up suburb
  const suburbData = SUBURB_DATABASE[suburb];

  if (suburbData) {
    const zone = determineDeliveryZone(
      suburbData.coordinates.lat,
      suburbData.coordinates.lng,
    );

    return {
      coordinates: suburbData.coordinates,
      deliveryZone: zone,
      postalCode: suburbData.postalCode,
      province: suburbData.province,
    };
  }

  // Try to find by city match
  if (city) {
    const cityMatch = Object.entries(SUBURB_DATABASE).find(
      ([_, data]) => data.city.toLowerCase() === city.toLowerCase(),
    );

    if (cityMatch) {
      const zone = determineDeliveryZone(
        cityMatch[1].coordinates.lat,
        cityMatch[1].coordinates.lng,
      );

      return {
        coordinates: cityMatch[1].coordinates,
        deliveryZone: zone,
        postalCode: cityMatch[1].postalCode,
        province: cityMatch[1].province,
      };
    }
  }

  return {
    coordinates: null,
    deliveryZone: null,
    postalCode: null,
    province: null,
  };
};

/**
 * Validate South African address
 */
export const validateAddress = (
  address:
    | Partial<StructuredAddress>
    | {
        suburb?: string;
        city?: string;
        province?: string;
        postalCode?: string;
      },
): { isValid: boolean; valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Handle both full StructuredAddress and simplified format
  const suburb =
    "addressLine2" in address ? address.addressLine2 : (address as any).suburb;
  const city =
    "addressLine3" in address ? address.addressLine3 : (address as any).city;
  const province = address.province;
  const postalCode = address.postalCode;

  if ("fullName" in address && !address.fullName?.trim()) {
    errors.push("Full name is required");
  }

  if (
    "phone" in address &&
    (!address.phone?.trim() || address.phone.trim().length < 10)
  ) {
    errors.push("Valid phone number is required (min 10 digits)");
  }

  if ("addressLine1" in address && !address.addressLine1?.trim()) {
    errors.push("Street address is required");
  }

  if (!suburb?.trim()) {
    errors.push("Suburb is required");
  }

  if (!city?.trim()) {
    errors.push("City/Town is required");
  }

  if (!province || !SA_PROVINCES.includes(province as any)) {
    errors.push("Valid province is required");
  }

  if (!postalCode?.trim() || !/^\d{4,5}$/.test(postalCode.trim())) {
    errors.push("Valid postal code is required (4-5 digits)");
  }

  const isValid = errors.length === 0;
  return {
    isValid,
    valid: isValid, // Alias for backwards compatibility
    errors,
  };
};

/**
 * Format address for display
 */
export const formatAddressForDisplay = (address: StructuredAddress): string => {
  const parts = [
    address.addressLine1,
    address.addressLine2,
    address.addressLine3,
    address.province,
    address.postalCode,
  ].filter(Boolean);

  return parts.join(", ");
};

/**
 * Get delivery zone description
 */
export const getDeliveryZoneDescription = (
  zone: DeliveryZone | "same-day" | "in-house" | "outsourced",
): {
  label: string;
  description: string;
  color: string;
} => {
  // Handle both DeliveryZone object and simple string type
  const zoneType = typeof zone === "string" ? zone : zone.type;
  const distance = typeof zone === "object" ? zone.distance : 0;

  switch (zoneType) {
    case "same-day":
      return {
        label: "Same-Day Zone",
        description: `Within ${SAME_DAY_RADIUS_KM} km - Same-day delivery available`,
        color: "green",
      };
    case "in-house":
      return {
        label: "Standard Delivery Zone",
        description: `Within ${IN_HOUSE_RADIUS_KM} km - Delivered by our team`,
        color: "blue",
      };
    case "outsourced":
      return {
        label: "Extended Delivery Zone",
        description:
          distance > 0
            ? `${distance.toFixed(1)} km away - Partner delivery`
            : "Partner delivery service",
        color: "amber",
      };
    default:
      return {
        label: "Delivery Zone",
        description: "Delivery available",
        color: "gray",
      };
  }
};

/**
 * Auto-fill address from postal code (South African postal codes)
 */
export const autoFillFromPostalCode = (
  postalCode: string,
): { suburb?: string; city?: string; province?: string } | null => {
  // Find suburb by postal code
  const match = Object.entries(SUBURB_DATABASE).find(
    ([_, data]) => data.postalCode === postalCode,
  );

  if (match) {
    return {
      suburb: match[0],
      city: match[1].city,
      province: match[1].province,
    };
  }

  // Basic postal code to province mapping
  const postalMap: Record<string, string> = {
    "0": "Gauteng", // 0001-0999 Pretoria
    "1": "Gauteng", // 1000-1999 Johannesburg South
    "2": "Gauteng", // 2000-2199 Johannesburg
    "3": "KwaZulu-Natal",
    "4": "KwaZulu-Natal", // Durban
    "5": "Free State",
    "6": "Eastern Cape",
    "7": "Western Cape",
    "8": "Western Cape", // Cape Town
    "9": "Northern Cape",
  };

  const firstDigit = postalCode.charAt(0);
  if (postalMap[firstDigit]) {
    return { province: postalMap[firstDigit] };
  }

  return null;
};

export { SUBURB_DATABASE };
