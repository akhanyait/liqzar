/** South African VAT rate — prices are VAT-inclusive */
export const ZA_VAT_RATE = 0.15;
export const ZA_VAT_DIVISOR = 1 + ZA_VAT_RATE;

/** Free delivery threshold (ZAR) */
export const FREE_DELIVERY_THRESHOLD_ZAR = 150;

/** Standard delivery fee (ZAR) */
export const DELIVERY_FEE_ZAR = 9.99;

/** Maximum units per product per order (liquor fairness / compliance) */
export const MAX_QTY_PER_ITEM = 24;

/** Minimum legal drinking age in South Africa */
export const LEGAL_DRINKING_AGE = 18;

/** Same-day delivery order cutoff hour (24h format, SAST = UTC+2) */
export const SAME_DAY_CUTOFF_HOUR_SAST = 14; // 2 PM

/** Delivery PIN max attempts before lockout */
export const DELIVERY_PIN_MAX_ATTEMPTS = 3;

/** Loyalty points earned per rand spent */
export const LOYALTY_POINTS_PER_RAND = 1;

/** Loyalty points required for R10 reward */
export const LOYALTY_POINTS_PER_REWARD = 100;
