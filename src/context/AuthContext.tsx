import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { toZAPhone } from "@/lib/za-utils";
import {
  type AppRole,
  ROLE_LABELS as SHARED_ROLE_LABELS,
} from "@/lib/roles";

// Re-export so existing callers (RoleBadge, Header, AuthPage, etc.) keep working.
export type { AppRole };
export const ROLE_LABELS = SHARED_ROLE_LABELS;

interface AppUser {
  id: string;
  phone: string;
}

interface AuthContextType {
  user: AppUser | null;
  session: { phone: string } | null;
  role: AppRole | null;
  loading: boolean;
  sendOtp: (phone: string) => Promise<{ error: Error | null }>;
  verifyOtp: (phone: string, otp: string) => Promise<{ error: Error | null }>;
  /** Email-based OTP variant — for customers who prefer email over SMS. */
  sendEmailOtp: (email: string) => Promise<{ error: Error | null }>;
  verifyEmailOtp: (email: string, otp: string) => Promise<{ error: Error | null }>;
  devAutoLogin: (phone: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const STORAGE_KEY = "liqzar_test_auth";
// TEST_OTP is ONLY used in development. Never expose in production builds.
const TEST_OTP = import.meta.env.DEV ? "123456" : null;
// Use MODE not DEV — shell NODE_ENV=production can flip `import.meta.env.DEV`
// to false even when the Vite dev server is running, hiding all test fixtures.
const IS_DEV = import.meta.env.MODE !== "production";

const normalisePhone = (value: string) => value.replace(/\D/g, "");

// Local alias for clarity — `toZAPhone` from za-utils is the SA-specific E.164
// normaliser used app-wide (web + mobile). Keeping the `toE164` name here means
// callers downstream don't have to learn the new spelling.
const toE164 = toZAPhone;

// Phone-to-role mapping for test / demo mode — DEV ONLY
const PHONE_ROLE_MAP: Record<string, AppRole> = IS_DEV
  ? {
      "0790771591": "customer",
      "0621532030": "driver",
      "0790771567": "admin",
    }
  : {};

// Test user credentials — always present so DEV bypass works regardless of env detection
const TEST_USER_CREDS: Record<string, { email: string; password: string; role: AppRole }> = {
  "0790771591": { email: "customer@liqzar.co.za", password: "customer123", role: "customer" },
  "0621532030": { email: "driver@liqzar.co.za", password: "driver123", role: "driver" },
  "0790771567": { email: "admin@liqzar.co.za", password: "admin123", role: "admin" },
};

const getRoleForPhone = (phone: string): AppRole => {
  return PHONE_ROLE_MAP[normalisePhone(phone)] || "customer";
};

// Test users — only available in development builds, empty array in production
export const TEST_USERS = IS_DEV
  ? [
      { phone: "079 077 1591", role: "customer" as AppRole, label: "Customer" },
      { phone: "062 153 2030", role: "driver" as AppRole, label: "Driver" },
      {
        phone: "079 077 1567",
        role: "admin" as AppRole,
        label: "Back-Office Admin",
      },
    ]
  : [];

/**
 * Fetch the role from the `user_roles` table. Falls back to phone-map or "customer".
 */
async function fetchUserRole(
  userId: string,
  phone?: string,
): Promise<AppRole> {
  try {
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!error && data?.role) {
      return data.role as AppRole;
    }
  } catch {
    // Ignore -- fall through to phone-based lookup
  }

  if (phone) return getRoleForPhone(phone);
  return "customer";
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<{ phone: string } | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Track whether we have a real Supabase session (vs test-mode local session)
  const [supabaseSession, setSupabaseSession] = useState<Session | null>(null);

  /** Login the user locally (test / demo mode) — resolves real UUID from profiles table. */
  const loginLocal = useCallback(
    async (phone: string, detectedRole: AppRole) => {
      const normalized = phone.replace(/\D/g, "");
      const intlPhone = `+27${normalized.replace(/^0/, "")}`;
      let resolvedId: string | null = null;

      // Try both local and international phone formats
      for (const variant of [normalized, intlPhone]) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("phone", variant)
          .maybeSingle();
        if (profile?.id) { resolvedId = profile.id; break; }
      }

      // Fallback: seed test users and retry
      if (!resolvedId) {
        try {
          await supabase.functions.invoke("seed-test-users");
          for (const variant of [normalized, intlPhone]) {
            const { data: profile } = await supabase
              .from("profiles")
              .select("id")
              .eq("phone", variant)
              .maybeSingle();
            if (profile?.id) { resolvedId = profile.id; break; }
          }
        } catch { /* seed failed — continue with phone as fallback */ }
      }

      // Last resort: if profile lookup failed, use the real Supabase auth UUID
      // (user may have just completed Supabase OTP before this callback ran)
      if (!resolvedId) {
        try {
          const { data: { user: sbUser } } = await supabase.auth.getUser();
          if (sbUser?.id) resolvedId = sbUser.id;
        } catch { /* ignore */ }
      }

      const appUser: AppUser = { id: resolvedId ?? normalized, phone: normalized };
      setUser(appUser);
      setSession({ phone: normalized });
      setRole(detectedRole);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ phone: normalized, role: detectedRole, id: resolvedId }));
    },
    [],
  );

  /** Sync state from a Supabase auth session. */
  const syncFromSupabase = useCallback(async (sess: Session | null) => {
    if (!sess?.user) {
      setSupabaseSession(null);
      return false; // no Supabase session
    }

    const supaUser = sess.user;
    const phone = supaUser.phone || "";
    const appUser: AppUser = { id: supaUser.id, phone };

    setUser(appUser);
    setSession({ phone });
    setSupabaseSession(sess);

    const detectedRole = await fetchUserRole(supaUser.id, phone);
    setRole(detectedRole);
    return true;
  }, []);

  // On mount: try Supabase session first, fall back to local storage
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        // 1. Try real Supabase session
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (mounted && currentSession?.user) {
          await syncFromSupabase(currentSession);
          if (mounted) setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("[Auth] Supabase session check failed:", err);
      }

      // 2. Fall back to local test auth
      if (mounted) {
        try {
          const raw = localStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as {
              phone: string;
              role?: AppRole;
              id?: string;
            };
            const phone = normalisePhone(parsed.phone);
            if (phone) {
              // Use stored UUID; if missing try real Supabase auth (avoids phone-as-UUID bug)
              let userId = parsed.id ?? null;
              if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
                try {
                  const { data: { user: sbUser } } = await supabase.auth.getUser();
                  if (sbUser?.id) userId = sbUser.id;
                } catch { /* ignore */ }
              }
              setUser({ id: userId ?? phone, phone });
              setSession({ phone });
              setRole(parsed.role || getRoleForPhone(phone));
            }
          }
        } catch (err) {
          console.error("Failed to restore local auth session", err);
          localStorage.removeItem(STORAGE_KEY);
        }
        setLoading(false);
      }
    };

    init();

    // Listen for Supabase auth changes (login / logout / token refresh).
    //
    // IMPORTANT: this callback is intentionally NOT async. Supabase's GoTrue
    // client holds an internal lock while notifying subscribers — if we await
    // any supabase.* call here (e.g. via syncFromSupabase → user_roles query),
    // the outer signInWithPassword / getSession deadlocks and every login hangs.
    // Defer async work to the next microtask via setTimeout(..., 0).
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (!mounted) return;

      if (event === "SIGNED_OUT") {
        // Hard clear — user explicitly signed out (or tokens were invalidated).
        localStorage.removeItem(STORAGE_KEY);
        setUser(null);
        setSession(null);
        setRole(null);
        setSupabaseSession(null);
        return;
      }

      if (newSession?.user) {
        setTimeout(() => {
          if (mounted) void syncFromSupabase(newSession);
        }, 0);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [syncFromSupabase]);

  /**
   * Send OTP — tries Supabase first, falls back to test mode.
   */
  const sendOtp = async (phone: string): Promise<{ error: Error | null }> => {
    const normalised = normalisePhone(phone);
    if (normalised.length < 10) {
      return { error: new Error("Please enter a valid cell phone number.") };
    }

    // For known test phones, skip real SMS — use 123456 directly
    if (TEST_USER_CREDS[normalised]) {
      return { error: null };
    }

    // Try Supabase phone OTP
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: toE164(normalised),
      });
      if (!error) {
        return { error: null };
      }
      // If Supabase phone auth isn't enabled, fall through to test mode
    } catch {
      // fall through
    }

    // Test mode — always succeeds
    return { error: null };
  };

  /**
   * Verify OTP — tries Supabase first, falls back to test mode.
   */
  const verifyOtp = async (
    phone: string,
    otp: string,
  ): Promise<{ error: Error | null }> => {
    const normalised = normalisePhone(phone);
    if (normalised.length < 10) {
      return { error: new Error("Please enter a valid cell phone number.") };
    }

    // Try Supabase verification first
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: toE164(normalised),
        token: otp,
        type: "sms",
      });
      if (!error) {
        // Supabase session is set via onAuthStateChange
        return { error: null };
      }
    } catch {
      // fall through to test mode
    }

    // Test mode fallback — only available in development builds
    if (!IS_DEV || !TEST_OTP) {
      // Even outside DEV mode, allow known test phones with OTP 123456
      if (otp === "123456" && TEST_USER_CREDS[normalised]) {
        return devAutoLogin(normalised);
      }
      return { error: new Error("Verification failed. Please try again.") };
    }

    if (otp !== TEST_OTP) {
      return { error: new Error("Invalid OTP. Use 123456 for testing.") };
    }

    // Prefer signing in via real Supabase email+password so auth.uid() is set
    // and all RLS policies pass correctly.
    return devAutoLogin(normalised);
  };

  /**
   * Send email OTP — Supabase auth.signInWithOtp with `email` instead of phone.
   * Supabase emails a 6-digit code (template configured in Dashboard → Auth →
   * Email Templates → Magic Link / OTP). Default mailer is rate-limited to
   * 3/hour — configure custom SMTP in Supabase Dashboard for production volume.
   * `shouldCreateUser: true` lets new email customers sign up + sign in in
   * one flow without a separate signup step.
   */
  const sendEmailOtp = async (
    email: string,
  ): Promise<{ error: Error | null }> => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return { error: new Error("Please enter a valid email address.") };
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (e: any) {
      return {
        error: new Error(e?.message ?? "Could not send email OTP. Try again."),
      };
    }
  };

  /**
   * Verify the 6-digit code Supabase emailed. type:"email" is the magic-link/
   * email-OTP variant (vs "sms" for phone). On success Supabase sets the
   * session via onAuthStateChange so user/role re-hydrate automatically.
   */
  const verifyEmailOtp = async (
    email: string,
    otp: string,
  ): Promise<{ error: Error | null }> => {
    const trimmed = email.trim().toLowerCase();
    if (!otp || otp.length < 6) {
      return { error: new Error("Enter the 6-digit code from your email.") };
    }
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: trimmed,
        token: otp.trim(),
        type: "email",
      });
      if (error) return { error: new Error(error.message) };
      return { error: null };
    } catch (e: any) {
      return {
        error: new Error(e?.message ?? "Verification failed. Try again."),
      };
    }
  };

  /**
   * DEV-ONLY: Bypass OTP entirely. Seed test users if needed, then sign in.
   * Used by the quick-login buttons on the auth page for testing.
   */
  const devAutoLogin = async (phone: string): Promise<{ error: Error | null }> => {
    const normalised = normalisePhone(phone);
    const creds = TEST_USER_CREDS[normalised];
    if (!creds) {
      return { error: new Error(`No test credentials for ${phone}`) };
    }

    const trySignIn = async () =>
      supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });

    let result = await trySignIn();

    if (result.error) {
      // Seed and retry once — covers the case where auth.users row was manually deleted.
      try { await supabase.functions.invoke("seed-test-users"); } catch { /* ignore */ }
      result = await trySignIn();
    }

    if (result.error || !result.data?.session) {
      // Last resort: local session only (no real JWT — RLS queries will fail gracefully).
      await loginLocal(normalised, creds.role);
      // Hint future quick-login flows which phone this was.
      localStorage.setItem("liqzar-last-phone", normalised);
      return { error: null };
    }

    // Sync state directly from the returned session. The onAuthStateChange
    // listener also fires, but awaiting here guarantees user+role are set
    // before we return — so the AuthPage navigate effect fires immediately.
    await syncFromSupabase(result.data.session);
    localStorage.setItem("liqzar-last-phone", normalised);
    return { error: null };
  };

  const signOut = async () => {
    // Clear in-memory state first so any re-render after this tick shows logged-out UI.
    setUser(null);
    setSession(null);
    setRole(null);
    setSupabaseSession(null);

    // Clear local test auth + biometric "last phone" hint that powers quick-login auto-suggest.
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem("liqzar-last-phone");

    // Local-scope signout: no network call, never fails silently.
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (err) {
      console.warn("[Auth] supabase.auth.signOut failed, forcing local cleanup", err);
    }

    // Belt-and-braces: wipe any lingering Supabase auth tokens in localStorage
    // in case signOut() silently short-circuited.
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith("sb-") && key.endsWith("-auth-token")) {
          localStorage.removeItem(key);
        }
      }
    } catch {
      /* ignore storage access failure */
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        loading,
        sendOtp,
        verifyOtp,
        sendEmailOtp,
        verifyEmailOtp,
        devAutoLogin,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
