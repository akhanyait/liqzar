import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { SecureAuthStorage } from "../services/storage";

export type AppRole = "admin" | "customer" | "driver";

interface AppUser {
  id: string;
  email?: string;
  phone?: string;
  full_name?: string;
}

interface AuthContextType {
  user: AppUser | null;
  role: AppRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithPhone: (phone: string, otp: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = "liqzar_mobile_auth";

// Gate test credentials behind __DEV__
const TEST_OTP = __DEV__ ? "123456" : null;

// Phone-to-role mapping (DEV fallback only)
const PHONE_ROLE_MAP: Record<string, AppRole> = __DEV__
  ? {
      "0790771591": "customer",
      "0621532030": "driver",
      "0790771567": "admin",
    }
  : {};

// Test accounts — always available for bypass (visible UI list is DEV-only via TEST_USERS)
const TEST_CREDENTIALS: Record<string, { email: string; password: string; role: AppRole; label: string }> = {
  "0790771591": { email: "customer@liqzar.co.za", password: "customer123", role: "customer", label: "Customer" },
  "0621532030": { email: "driver@liqzar.co.za", password: "driver123", role: "driver", label: "Driver" },
  "0790771567": { email: "admin@liqzar.co.za", password: "admin123", role: "admin", label: "Back-Office Admin" },
};

// Test accounts for easy login (DEV only)
// uuid fields are the real Supabase UUIDs seeded in the profiles table.
// Used directly to bypass RLS during unauthenticated phone/OTP login.
export const TEST_USERS = __DEV__
  ? [
      {
        phone: "079 077 1591",
        role: "customer" as AppRole,
        label: "Customer",
        email: "customer@liqzar.co.za",
        password: "customer123",
        uuid: "03e54bd5-ae6a-48b0-b9e0-3622e8810045",
      },
      {
        phone: "062 153 2030",
        role: "driver" as AppRole,
        label: "Driver",
        email: "driver@liqzar.co.za",
        password: "driver123",
        uuid: "dadb0cb5-fccd-454b-b338-34f39920ee37",
      },
      {
        phone: "079 077 1567",
        role: "admin" as AppRole,
        label: "Back-Office Admin",
        email: "admin@liqzar.co.za",
        password: "admin123",
        uuid: "bf1da00f-d4b9-46c6-a81c-351ec370215a",
      },
    ]
  : [];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Back-Office Admin",
  customer: "Customer",
  driver: "Driver",
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const isValidUuid = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

/**
 * Load the role for a user from the server (user_roles table).
 * Falls back to PHONE_ROLE_MAP in __DEV__ mode, or 'customer' in production.
 */
const loadRoleFromServer = async (
  userId: string,
  phone?: string,
): Promise<AppRole> => {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .single();

    if (!error && data?.role) {
      return data.role as AppRole;
    }
  } catch (e) {
    console.error("[Auth] Failed to query user_roles:", e);
  }

  // Fallback: DEV mode uses phone-based role map
  if (__DEV__ && phone) {
    const normalized = normalizePhone(phone);
    if (PHONE_ROLE_MAP[normalized]) {
      return PHONE_ROLE_MAP[normalized];
    }
  }

  // Production fallback: default to customer
  return "customer";
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      // Prioritise the real Supabase session — it carries the JWT that auth.uid() needs
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user) {
        // Determine role: check custom storage first (fastest), then server
        const stored = await SecureAuthStorage.getItem(STORAGE_KEY);
        let storedRole: AppRole | null = null;
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (parsed.user?.id === session.user.id && parsed.role) {
              storedRole = parsed.role as AppRole;
            }
          } catch (_) { /* ignore */ }
        }

        const resolvedRole =
          storedRole ?? (await loadRoleFromServer(session.user.id));

        const appUser: AppUser = {
          id: session.user.id,
          email: session.user.email,
          phone: session.user.phone,
          full_name: session.user.user_metadata?.full_name,
        };
        setUser(appUser);
        setRole(resolvedRole);
        setLoading(false);
        return;
      }

      // No live Supabase session — check legacy custom storage as fallback
      const stored = await SecureAuthStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);

        // Guard: reject stale non-UUID ids (e.g. old phone-as-id sessions)
        if (!parsed.user?.id || !isValidUuid(parsed.user.id)) {
          console.warn("[Auth] Stale session detected (non-UUID id), clearing storage.");
          await SecureAuthStorage.removeItem(STORAGE_KEY);
          setLoading(false);
          return;
        }

        // Storage exists but no Supabase JWT — clear and force re-login so RLS works
        console.warn("[Auth] Stored user without active Supabase session — clearing.");
        await SecureAuthStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error("Error loading auth:", error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    // Check if it's a test account (DEV only) — sign in via real Supabase auth
    // so auth.uid() is set and RLS policies pass
    if (__DEV__ && TEST_USERS.length > 0) {
      const testUser = TEST_USERS.find(
        (u) => u.email === email.toLowerCase() && u.password === password,
      );
      if (testUser) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: testUser.email,
          password: testUser.password,
        });
        if (error) throw error;

        if (data.user) {
          const appUser: AppUser = {
            id: data.user.id,
            email: data.user.email,
            phone: testUser.phone,
            full_name: testUser.label,
          };
          setUser(appUser);
          setRole(testUser.role);
          await SecureAuthStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ user: appUser, role: testUser.role }),
          );
        }
        return;
      }
    }

    // Real Supabase auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    if (data.user) {
      const appUser: AppUser = {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name,
      };
      // Load role from server
      const serverRole = await loadRoleFromServer(data.user.id);
      setUser(appUser);
      setRole(serverRole);
      await SecureAuthStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: appUser, role: serverRole }),
      );
    }
  };

  const signInWithPhone = async (phone: string, otp: string) => {
    const normalized = normalizePhone(phone);

    if (normalized.length < 10) {
      throw new Error("Please enter a valid cell phone number.");
    }

    // Test phone bypass — works for known test numbers with OTP 123456
    if (otp === "123456" && TEST_CREDENTIALS[normalized]) {
      const testCred = TEST_CREDENTIALS[normalized];

      const trySignIn = () =>
        supabase.auth.signInWithPassword({ email: testCred.email, password: testCred.password });

      let { data, error } = await trySignIn();

      // If credentials not found, seed test users and retry once
      if (error && (error.message.toLowerCase().includes("invalid") || error.message.toLowerCase().includes("credentials"))) {
        try {
          await supabase.functions.invoke("seed-test-users");
        } catch { /* ignore */ }
        const retry = await trySignIn();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      if (data.user) {
        const appUser: AppUser = {
          id: data.user.id,
          phone: normalized,
          full_name: testCred.label,
        };
        setUser(appUser);
        setRole(testCred.role);
        await SecureAuthStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ user: appUser, role: testCred.role }),
        );
      }
      return;
    }

    // Real Supabase OTP verification
    const { data, error } = await supabase.auth.verifyOtp({
      phone,
      token: otp,
      type: "sms",
    });
    if (error) throw error;

    if (data.user) {
      const appUser: AppUser = {
        id: data.user.id,
        phone: data.user.phone,
        full_name: data.user.user_metadata?.full_name,
      };

      // Load role from user_roles table
      const serverRole = await loadRoleFromServer(
        data.user.id,
        data.user.phone,
      );
      setUser(appUser);
      setRole(serverRole);
      await SecureAuthStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: appUser, role: serverRole }),
      );
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
      },
    });
    if (error) throw error;

    if (data.user) {
      const appUser: AppUser = {
        id: data.user.id,
        email: data.user.email,
        full_name: fullName,
      };
      setUser(appUser);
      setRole("customer");
      await SecureAuthStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ user: appUser, role: "customer" }),
      );
    }
  };

  const signOut = async () => {
    await SecureAuthStorage.removeItem(STORAGE_KEY);
    await supabase.auth.signOut();
    setUser(null);
    setRole(null);
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        loading,
        signIn,
        signInWithPhone,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
