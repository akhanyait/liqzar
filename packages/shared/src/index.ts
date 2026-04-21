/**
 * @liqzar/shared — single source of truth for types, constants, and
 * lightweight helpers shared between:
 *   - Web app  (root /src)
 *   - Mobile   (apps/mobile/src)
 *
 * Import from here in both platforms — never duplicate.
 */

export * from "./types/auth";
export * from "./types/orders";
export * from "./types/products";
export * from "./constants/business-rules";
export * from "./constants/sa-regions";
export * from "./utils/phone";
export * from "./utils/currency";
export * from "./utils/dates";
