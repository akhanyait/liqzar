/** South African provinces */
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

export type SAProvince = (typeof SA_PROVINCES)[number];

/** Delivery zones */
export const DELIVERY_ZONES = {
  SAME_DAY: "same-day",
  IN_HOUSE: "in-house",
  OUTSOURCED: "outsourced",
} as const;
