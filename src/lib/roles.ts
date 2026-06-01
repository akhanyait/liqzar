// Shared role model — the single source of truth for app roles, their labels,
// and their default landing routes. Web and mobile each have their own
// AuthContext (different storage + session models), but the role *vocabulary*
// should be identical so RoleBadge/Header/ProtectedRoute on web and the mobile
// navigator agree on what "admin" or "driver" means.
//
// Inspired by the ArtisanZA `packages/auth` role model + ROLE_HOME pattern.

export type AppRole = "admin" | "customer" | "driver";

export const ROLES: readonly AppRole[] = ["admin", "customer", "driver"] as const;

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Back-Office Admin",
  customer: "Customer",
  driver: "Driver",
};

/**
 * Default landing route per role. Used by post-login redirect logic so each
 * role lands on the surface that's actually useful to them — customers on the
 * shop, drivers on their job queue, admins on the dashboard.
 *
 * Keep these paths in sync with the routes registered in src/App.tsx.
 */
export const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  customer: "/",
  driver: "/driver",
};

/** Type guard — useful when parsing role values out of the database or storage. */
export function isAppRole(value: unknown): value is AppRole {
  return value === "admin" || value === "customer" || value === "driver";
}
