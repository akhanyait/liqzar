// Shared role model — MIRROR of src/lib/roles.ts (web). Kept in lock-step so
// "admin", "customer", "driver" mean the same thing on both platforms.
// When changing one, change the other.

export type AppRole = "admin" | "customer" | "driver";

export const ROLES: readonly AppRole[] = ["admin", "customer", "driver"] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Back-Office Admin",
  customer: "Customer",
  driver: "Driver",
};

/**
 * Default landing screen per role on mobile. The strings here are screen names
 * from apps/mobile/src/navigation/AppNavigator.tsx — keep them in sync.
 *
 * Customers land on the Home stack; drivers go straight to their dashboard;
 * admins use the back-office view embedded in the mobile shell.
 */
export const ROLE_HOME: Record<AppRole, string> = {
  admin: "AdminDashboard",
  customer: "Home",
  driver: "DriverDashboard",
};

/** Type guard — useful when parsing role values out of the database or storage. */
export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "customer" || value === "driver";
}
