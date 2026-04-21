// Export client
export { ApiClient, initializeApiClient, getApiClient } from "./client";
export type { ApiConfig, AuthTokens } from "./client";

// Export API modules
export { authApi } from "./auth";
export type { LoginCredentials, RegisterData, AuthResponse } from "./auth";

export { productsApi } from "./products";

export { ordersApi } from "./orders";
export type { CreateOrderData } from "./orders";

export { driversApi } from "./drivers";
export type { UpdateLocationData } from "./drivers";

// Re-export types package for convenience
export type * from "@liqzar/types";
