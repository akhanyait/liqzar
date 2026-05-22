import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Database,
  Smartphone,
  Shield,
  Fingerprint,
  ScanFace,
  KeyRound,
} from "lucide-react";
import { useAuth, TEST_USERS, type AppRole } from "@/context/AuthContext";

// Drivers use the mobile app exclusively — never the web admin.
const WEB_ALLOWED_ROLES: AppRole[] = ["customer", "admin"];
const WEB_TEST_USERS = TEST_USERS.filter((u) => WEB_ALLOWED_ROLES.includes(u.role));
// Use MODE not DEV — a stale NODE_ENV=production in the shell flips
// `IS_DEV` to false even on the dev server, hiding the test buttons.
const IS_DEV = import.meta.env.MODE !== "production";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseHealth } from "@/hooks/useSupabaseHealth";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { PinPad, PinSetupFlow, isPinSet } from "@/components/native/PinAuth";
import { BiometryType } from "@/hooks/useBiometricAuth";
import { SEO } from "@/components/seo/SEO";

const ROLE_HOME: Record<AppRole, string> = {
  admin: "/admin",
  customer: "/",
  driver: "/driver",
};

const formatPhoneForDisplay = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
};

type AuthView = "quick-login" | "phone-login" | "pin-setup";

const AuthPage = () => {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [devLoginRole, setDevLoginRole] = useState<string | null>(null);
  const [view, setView] = useState<AuthView>("quick-login");
  // Login channel — phone (SMS OTP) or email (email OTP). Switching resets
  // the OTP-requested flag so the user can retry on the other channel.
  const [loginMode, setLoginMode] = useState<"phone" | "email">("phone");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const {
    sendOtp,
    verifyOtp,
    sendEmailOtp,
    verifyEmailOtp,
    devAutoLogin,
    signOut,
    user,
    role,
  } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isLoading, isError, error, isSuccess, refetch } = useSupabaseHealth();
  const {
    isAvailable: biometricAvailable,
    biometryType,
    getBiometryName,
    authenticate,
    isBiometricLoginEnabled,
    storeCredentials,
    getLastPhone,
    isNative,
  } = useBiometricAuth();

  const normalisedPhone = useMemo(() => phone.replace(/\D/g, ""), [phone]);

  // Check if quick login is available
  const hasQuickLogin =
    isPinSet() || (biometricAvailable && isBiometricLoginEnabled());
  const lastPhone = getLastPhone();

  // Set initial view based on quick login availability
  useEffect(() => {
    if (!hasQuickLogin) {
      setView("phone-login");
    }
  }, [hasQuickLogin]);

  // OTP resend cooldown tick
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (!user || !role) return;

    // Drivers are mobile-only. Kick them out of the web session immediately
    // and show a clear message pointing them to the native apps.
    if (role === "driver") {
      (async () => {
        await signOut();
        toast({
          title: "Drivers must use the mobile app",
          description:
            "The driver console is only available on the LIQZAR iOS & Android apps. Please sign in there instead.",
          variant: "destructive",
        });
      })();
      return;
    }

    if (!WEB_ALLOWED_ROLES.includes(role)) {
      (async () => {
        await signOut();
        toast({
          title: "Account type not supported on web",
          description: "Please use the LIQZAR mobile app to continue.",
          variant: "destructive",
        });
      })();
      return;
    }

    navigate(ROLE_HOME[role] || "/", { replace: true });
  }, [navigate, signOut, toast, user, role]);

  const handleRequestOtp = async () => {
    setSubmitting(true);
    const { error } =
      loginMode === "email"
        ? await sendEmailOtp(email)
        : await sendOtp(normalisedPhone);
    setSubmitting(false);

    if (error) {
      toast({
        title: "OTP not sent",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setOtpRequested(true);
    setResendCooldown(30);
    toast({
      title: "OTP sent",
      description:
        loginMode === "email"
          ? "Check your email inbox (and spam) for the 8-digit code."
          : IS_DEV
            ? "DEV MODE: Use 123456 as the OTP."
            : "Check your SMS for the OTP.",
    });
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } =
      loginMode === "email"
        ? await verifyEmailOtp(email, otp.trim())
        : await verifyOtp(normalisedPhone, otp.trim());
    setSubmitting(false);

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    // Store phone for biometric/PIN quick login
    localStorage.setItem("liqzar-last-phone", normalisedPhone);

    // Show PIN setup if not already set
    if (!isPinSet() && isNative) {
      setShowPinSetup(true);
      return;
    }

    toast({
      title: "Logged in",
      description: "Phone login succeeded in test mode.",
    });
    // Navigation handled by useEffect watching user/role
  };

  const handlePinSetupComplete = async (pin: string) => {
    // Also enable biometrics if available
    if (biometricAvailable) {
      await storeCredentials(normalisedPhone);
    }
    setShowPinSetup(false);
    toast({
      title: "Quick login enabled",
      description: "You can now use PIN or biometrics to sign in.",
    });
  };

  const handlePinLogin = async (_result: string) => {
    // PIN/biometric already verified by the PinPad/biometric prompt.
    // Now silently re-authenticate via Supabase using the stored phone.
    const storedPhone = lastPhone;
    if (!storedPhone) {
      toast({
        title: "Error",
        description: "No stored login found. Please sign in with your phone number.",
        variant: "destructive",
      });
      setView("phone-login");
      return;
    }

    setSubmitting(true);
    // Request a fresh OTP — user must receive it on their phone.
    // In development the test OTP flow works as normal.
    const { error: otpError } = await sendOtp(storedPhone);
    if (otpError) {
      toast({
        title: "Could not send OTP",
        description: otpError.message,
        variant: "destructive",
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(false);

    // Transition to OTP entry so the user can confirm ownership of the number.
    setPhone(storedPhone);
    setOtpRequested(true);
    setView("phone-login");
    toast({
      title: "OTP sent",
      description: "Enter the OTP sent to your phone to complete quick login.",
    });
  };

  const handleQuickFill = async (phoneNumber: string, label?: string) => {
    const digits = phoneNumber.replace(/\s/g, "");

    // Hard gate — driver accounts never authenticate on web.
    const tu = TEST_USERS.find((u) => u.phone.replace(/\s/g, "") === digits);
    if (tu?.role === "driver") {
      toast({
        title: "Drivers must use the mobile app",
        description:
          "Driver accounts can only sign in on the LIQZAR iOS & Android apps.",
        variant: "destructive",
      });
      return;
    }

    setDevLoginRole(label || digits);
    const { error } = await devAutoLogin(digits);
    setDevLoginRole(null);
    if (error) {
      toast({
        title: "Dev login failed",
        description: error.message,
        variant: "destructive",
      });
    }
    // Success: onAuthStateChange → user/role set → useEffect navigates
  };

  const BiometricIcon =
    biometryType === BiometryType.FACE_ID ||
    biometryType === BiometryType.FACE_AUTHENTICATION
      ? ScanFace
      : Fingerprint;

  // Show PIN setup flow
  if (showPinSetup) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container px-4 py-8">
          <button
            onClick={() => {
              setShowPinSetup(false);
              toast({
                title: "Logged in",
                description: "You can set up quick login later in settings.",
              });
            }}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>
        <PinSetupFlow
          onComplete={handlePinSetupComplete}
          onSkip={() => {
            setShowPinSetup(false);
            toast({
              title: "Logged in",
              description: "You can set up quick login later in settings.",
            });
          }}
        />
      </div>
    );
  }

  // Quick login view (PIN pad)
  if (view === "quick-login" && hasQuickLogin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container px-4 py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1 text-sm text-muted-foreground mb-4 hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
        <PinPad
          mode="login"
          onSuccess={handlePinLogin}
          onCancel={() => setView("phone-login")}
        />
        <div className="text-center pb-8">
          <button
            onClick={() => setView("phone-login")}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Use phone number instead
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <SEO title="Sign In" path="/auth" noindex description="Sign in to LIQZAR" />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1 text-sm text-muted-foreground mb-8 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-3 mb-8">
          <img
            src="/liqzar-logo.png"
            alt="LIQZAR"
            className="w-14 h-14 object-contain"
            style={{
              filter: "drop-shadow(0 0 12px rgba(212,175,55,0.3))",
            }}
          />
          <div className="flex flex-col">
            <span
              className="text-2xl font-extrabold tracking-widest"
              style={{
                background: "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              LIQZAR
            </span>
            <span className="text-[10px] tracking-[0.2em] font-medium" style={{ color: "#9A8860" }}>
              RESERVE THE FINEST.
            </span>
          </div>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-2">
          {loginMode === "email"
            ? "Login with your email"
            : "Login with your cell number"}
        </h1>
        <p className="text-muted-foreground mb-6">
          {loginMode === "email"
            ? "Enter your email to receive a one-time code in your inbox."
            : "Enter your cell number to receive a one-time PIN via SMS."}
        </p>

        {/* Channel toggle — phone (SMS) vs email (inbox). Switching clears the
            requested-OTP flag so the user can request anew on the other channel. */}
        <div className="mb-6 inline-flex p-1 rounded-xl bg-secondary w-full">
          {(["phone", "email"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setLoginMode(mode);
                setOtp("");
                setOtpRequested(false);
              }}
              className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                loginMode === mode
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {mode === "phone" ? "Phone (SMS)" : "Email"}
            </button>
          ))}
        </div>

        {/* ── DEV ONLY: Instant role login ── */}
        {IS_DEV && (
          <div className="mb-6 p-4 rounded-xl border-2 border-[#D4AF37]/40 bg-[#D4AF37]/5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest" style={{ color: "#D4AF37" }}>
              <CheckCircle2 className="w-4 h-4" /> DEV — Instant Login (no OTP)
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              Driver sign-in is mobile-only — use the LIQZAR iOS / Android apps.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {WEB_TEST_USERS.map((tu) => (
                <button
                  key={tu.phone}
                  type="button"
                  onClick={() => handleQuickFill(tu.phone, tu.label)}
                  disabled={devLoginRole !== null}
                  className="flex flex-col items-start gap-0.5 p-3 rounded-lg bg-background border border-border hover:border-[#D4AF37]/50 transition-all disabled:opacity-50 text-left"
                >
                  <span className="text-xs font-bold text-foreground">{tu.label}</span>
                  <span className="text-[11px] text-muted-foreground">{tu.phone}</span>
                  {devLoginRole === tu.label && (
                    <span className="text-[10px] text-[#D4AF37] font-semibold mt-0.5">Signing in…</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        <form onSubmit={handleVerifyOtp} className="space-y-4">
          {loginMode === "phone" ? (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Cell phone number
              </label>
              <div className="relative">
                <Smartphone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="tel"
                  inputMode="numeric"
                  value={formatPhoneForDisplay(phone)}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="082 123 4567"
                  className="h-12 rounded-xl pl-10"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Email address
              </label>
              <Input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 rounded-xl"
              />
            </div>
          )}

          <Button
            type="button"
            disabled={
              submitting ||
              (otpRequested && resendCooldown > 0) ||
              (loginMode === "phone"
                ? normalisedPhone.length < 10
                : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            }
            onClick={handleRequestOtp}
            className="w-full h-12 rounded-xl bg-secondary text-foreground hover:bg-secondary/80 text-base font-semibold disabled:opacity-50"
          >
            {submitting && !otpRequested
              ? "Please wait..."
              : otpRequested
                ? resendCooldown > 0
                  ? `Resend OTP in ${resendCooldown}s`
                  : "Resend OTP"
                : "Send OTP"}
          </Button>

          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">
              OTP
            </label>
            <Input
              value={otp}
              onChange={(e) =>
                setOtp(e.target.value.replace(/\D/g, "").slice(0, loginMode === "email" ? 8 : 6))
              }
              placeholder={loginMode === "email" ? "Enter 8-digit code" : "Enter 6-digit OTP"}
              className="h-12 rounded-xl"
              maxLength={loginMode === "email" ? 8 : 6}
            />
          </div>

          <Button
            type="submit"
            disabled={
              submitting ||
              otp.length !== (loginMode === "email" ? 8 : 6) ||
              (loginMode === "phone"
                ? normalisedPhone.length < 10
                : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
            }
            className="w-full h-12 rounded-xl text-base font-semibold border-0"
            style={{
              background: "linear-gradient(135deg, #D4AF37, #B8962E, #D4AF37)",
              color: "#0d0b08",
              boxShadow: "0 4px 20px rgba(212,175,55,0.25)",
            }}
          >
            {submitting ? "Please wait..." : "Verify and log in"}
          </Button>
        </form>

        {/* Quick Login Option */}
        {hasQuickLogin && (
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setView("quick-login")}
              className="mt-4 w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-border hover:bg-muted transition-colors"
            >
              <KeyRound className="w-5 h-5 text-accent" />
              <span className="font-medium">
                Use PIN or {getBiometryName()}
              </span>
            </button>
          </div>
        )}

        {/* Test Credentials — DEV ONLY, never shown in production */}
        {IS_DEV && WEB_TEST_USERS.length > 0 && (
          <div className="mt-6 p-4 rounded-xl text-sm space-y-3" style={{ background: "linear-gradient(135deg, rgba(212,175,55,0.06), rgba(212,175,55,0.02))", border: "1px solid rgba(212,175,55,0.15)" }}>
            <div className="flex items-center gap-2 text-foreground font-semibold">
              <CheckCircle2 className="w-4 h-4" style={{ color: "#D4AF37" }} /> DEV: Test login accounts
            </div>
            <p className="text-muted-foreground text-xs">
              Tap a row to auto-fill. OTP for all:{" "}
              <span className="font-semibold text-foreground">123456</span>
            </p>
            <div className="space-y-1.5">
              {WEB_TEST_USERS.map((tu) => (
                <button
                  key={tu.phone}
                  type="button"
                  onClick={() => handleQuickFill(tu.phone, tu.label)}
                  disabled={devLoginRole !== null}
                  className="w-full flex items-center justify-between p-2.5 rounded-lg bg-background hover:bg-muted transition-colors text-left disabled:opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                      {tu.phone}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                    {devLoginRole === tu.label ? "Signing in…" : tu.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Database status — DEV ONLY */}
        {IS_DEV && (
        <div className="mt-4 p-4 border border-border rounded-xl space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Database className="w-4 h-4" /> Database status
          </div>
          {isLoading && (
            <p className="text-sm text-muted-foreground">
              Checking connection…
            </p>
          )}
          {isSuccess && (
            <p className="text-sm text-emerald-600">Database connection OK.</p>
          )}
          {isError && (
            <>
              <p className="text-sm text-destructive">
                {error instanceof Error ? error.message : "Could not connect."}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => refetch()}
              >
                Retry check
              </Button>
            </>
          )}
        </div>
        )}
      </motion.div>
    </div>
  );
};

export default AuthPage;
