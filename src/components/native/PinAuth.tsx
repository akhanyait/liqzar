import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Fingerprint, ScanFace } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBiometricAuth } from "@/hooks/useBiometricAuth";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { BiometryType } from "@/hooks/useBiometricAuth";

const PIN_LENGTH = 4;
const STORAGE_KEY = "liqzar-pin-hash";

// Simple hash function for PIN (in production, use proper encryption)
const hashPin = (pin: string): string => {
  let hash = 0;
  for (let i = 0; i < pin.length; i++) {
    const char = pin.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
};

interface PinPadProps {
  mode: "login" | "setup" | "confirm";
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
  setupPin?: string;
  title?: string;
  subtitle?: string;
}

export function PinPad({
  mode,
  onSuccess,
  onCancel,
  setupPin,
  title,
  subtitle,
}: PinPadProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [success, setSuccess] = useState(false);
  const { impact, notification } = useHaptics();
  const {
    isAvailable,
    biometryType,
    authenticate,
    getBiometryName,
    getStoredCredentials,
  } = useBiometricAuth();

  const numbers = [
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "",
    "0",
    "delete",
  ];

  const handleNumber = useCallback(
    (num: string) => {
      if (num === "delete") {
        impact("light");
        setPin((prev) => prev.slice(0, -1));
        setError(false);
        return;
      }

      if (num === "" || pin.length >= PIN_LENGTH) return;

      impact("light");
      const newPin = pin + num;
      setPin(newPin);
      setError(false);

      if (newPin.length === PIN_LENGTH) {
        // Validate or setup PIN
        setTimeout(() => {
          if (mode === "login") {
            const storedHash = localStorage.getItem(STORAGE_KEY);
            if (storedHash && hashPin(newPin) === storedHash) {
              setSuccess(true);
              notification("success");
              setTimeout(() => onSuccess(newPin), 300);
            } else {
              setError(true);
              notification("error");
              setPin("");
            }
          } else if (mode === "confirm") {
            if (newPin === setupPin) {
              setSuccess(true);
              notification("success");
              setTimeout(() => onSuccess(newPin), 300);
            } else {
              setError(true);
              notification("error");
              setPin("");
            }
          } else {
            // Setup mode
            onSuccess(newPin);
          }
        }, 100);
      }
    },
    [pin, mode, setupPin, impact, notification, onSuccess],
  );

  const handleBiometric = useCallback(async () => {
    const result = await authenticate("Sign in to LIQZAR");
    if (result) {
      const credentials = await getStoredCredentials();
      if (credentials) {
        setSuccess(true);
        notification("success");
        setTimeout(() => onSuccess("biometric"), 300);
      }
    }
  }, [authenticate, getStoredCredentials, notification, onSuccess]);

  // Try biometric on mount for login mode
  useEffect(() => {
    if (
      mode === "login" &&
      isAvailable &&
      localStorage.getItem("liqzar-biometric-enabled") === "true"
    ) {
      handleBiometric();
    }
  }, [mode, isAvailable]);

  const BiometricIcon =
    biometryType === BiometryType.FACE_ID ||
    biometryType === BiometryType.FACE_AUTHENTICATION
      ? ScanFace
      : Fingerprint;

  const getTitle = () => {
    if (title) return title;
    switch (mode) {
      case "login":
        return "Enter your PIN";
      case "setup":
        return "Create a PIN";
      case "confirm":
        return "Confirm your PIN";
    }
  };

  const getSubtitle = () => {
    if (subtitle) return subtitle;
    switch (mode) {
      case "login":
        return "Enter your 4-digit PIN to sign in";
      case "setup":
        return "Choose a 4-digit PIN for quick access";
      case "confirm":
        return "Re-enter your PIN to confirm";
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
      {/* Header */}
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-2">
          {getTitle()}
        </h2>
        <p className="text-sm text-muted-foreground">{getSubtitle()}</p>
      </div>

      {/* PIN dots */}
      <div className="flex gap-4 mb-8">
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <motion.div
            key={i}
            className={cn(
              "w-4 h-4 rounded-full border-2 transition-colors",
              pin.length > i
                ? error
                  ? "bg-destructive border-destructive"
                  : success
                    ? "bg-green-500 border-green-500"
                    : "bg-foreground border-foreground"
                : "border-muted-foreground/50",
            )}
            animate={
              error && pin.length === 0
                ? { x: [0, -10, 10, -10, 10, 0] }
                : success
                  ? { scale: [1, 1.2, 1] }
                  : {}
            }
            transition={{ duration: 0.4 }}
          />
        ))}
      </div>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-destructive text-sm mb-4"
          >
            {mode === "confirm"
              ? "PINs don't match. Try again."
              : "Incorrect PIN. Try again."}
          </motion.p>
        )}
      </AnimatePresence>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-4 max-w-[280px]">
        {numbers.map((num, i) => (
          <motion.button
            key={i}
            type="button"
            onClick={() => handleNumber(num)}
            disabled={num === "" || success}
            whileTap={{ scale: 0.95 }}
            className={cn(
              "w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-semibold transition-colors",
              num === ""
                ? "invisible"
                : num === "delete"
                  ? "bg-transparent text-foreground active:bg-muted"
                  : "bg-muted text-foreground active:bg-muted/70",
            )}
          >
            {num === "delete" ? <Delete className="w-6 h-6" /> : num}
          </motion.button>
        ))}
      </div>

      {/* Biometric button (login mode only) */}
      {mode === "login" &&
        isAvailable &&
        localStorage.getItem("liqzar-biometric-enabled") === "true" && (
          <motion.button
            type="button"
            onClick={handleBiometric}
            whileTap={{ scale: 0.95 }}
            className="mt-6 flex items-center gap-2 px-6 py-3 rounded-xl bg-accent/10 text-accent font-medium"
          >
            <BiometricIcon className="w-5 h-5" />
            Use {getBiometryName()}
          </motion.button>
        )}

      {/* Cancel button */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="mt-6 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// PIN Setup Flow Component
interface PinSetupFlowProps {
  onComplete: (pin: string) => void;
  onSkip?: () => void;
}

export function PinSetupFlow({ onComplete, onSkip }: PinSetupFlowProps) {
  const [step, setStep] = useState<"setup" | "confirm">("setup");
  const [setupPin, setSetupPin] = useState("");

  const handleSetupComplete = (pin: string) => {
    setSetupPin(pin);
    setStep("confirm");
  };

  const handleConfirmComplete = (pin: string) => {
    // Store the PIN
    localStorage.setItem(STORAGE_KEY, hashPin(pin));
    onComplete(pin);
  };

  return (
    <div className="min-h-screen bg-background">
      {step === "setup" ? (
        <PinPad
          mode="setup"
          onSuccess={handleSetupComplete}
          onCancel={onSkip}
        />
      ) : (
        <PinPad
          mode="confirm"
          setupPin={setupPin}
          onSuccess={handleConfirmComplete}
          onCancel={() => setStep("setup")}
        />
      )}
    </div>
  );
}

// Check if PIN is set
export function isPinSet(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// Clear PIN
export function clearPin(): void {
  localStorage.removeItem(STORAGE_KEY);
}
