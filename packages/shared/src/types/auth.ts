/** Roles that exist across the entire LIQZAR platform */
export type AppRole = "admin" | "customer" | "warehouse" | "driver";

export interface AppUser {
  id: string;
  phone?: string;
  email?: string;
  full_name?: string;
}

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Back-Office Admin",
  customer: "Customer",
  warehouse: "Warehouse Admin",
  driver: "Driver",
};

export const ROLE_HOME_ROUTES: Record<AppRole, string> = {
  admin: "/admin",
  customer: "/",
  warehouse: "/warehouse",
  driver: "/driver",
};
