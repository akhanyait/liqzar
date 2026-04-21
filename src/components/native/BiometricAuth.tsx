import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Fingerprint,
  ScanFace,
  Lock,
  CheckCircle,
  XCircle,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { useHaptics, isNativeApp, isIOS } from "@/hooks/useNativeFeatures";

interface BiometricAuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onFallback?: () => void;
  title?: string;
  subtitle?: string;
  purpose?: "unlock" | "payment" | "reorder";
}

const BiometricAuth = ({
  isOpen,
  onClose,
  onSuccess,
  onFallback,
  title = "Verify it's you",
  subtitle = "Use biometrics to continue",
  purpose = "unlock",
}: BiometricAuthProps) => {
  const [status, setStatus] = useState<
    "idle" | "scanning" | "success" | "error"
  >("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const { impact, notification } = useHaptics();
  const isIOSDevice = isIOS();

  const authenticate = async () => {
    setStatus("scanning");
    impact("medium");

    // Simulate biometric authentication
    // In real app, use Capacitor plugin like @capawesome-team/capacitor-biometrics
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Simulate 90% success rate
    const success = Math.random() > 0.1;

    if (success) {
      setStatus("success");
      notification("success");
      setTimeout(() => {
        onSuccess();
      }, 500);
    } else {
      setStatus("error");
      setErrorMessage("Authentication failed. Try again.");
      notification("error");
    }
  };

  useEffect(() => {
    if (isOpen) {
      setStatus("idle");
      setErrorMessage("");
      // Auto-start authentication after a brief delay
      const timer = setTimeout(authenticate, 500);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const getPurposeIcon = () => {
    switch (purpose) {
      case "payment":
        return <ShieldCheck className="w-6 h-6 text-primary" />;
      case "reorder":
        return <CheckCircle className="w-6 h-6 text-primary" />;
      default:
        return <Lock className="w-6 h-6 text-primary" />;
    }
  };

  const getPurposeText = () => {
    switch (purpose) {
      case "payment":
        return "Authorize payment";
      case "reorder":
        return "Confirm quick reorder";
      default:
        return subtitle;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end justify-center"
        >
          <motion.div
            initial={{ y: 300, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 300, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-card rounded-t-3xl p-6 pb-safe"
          >
            {/* Close handle */}
            <div className="flex justify-center mb-4">
              <div className="w-10 h-1.5 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="text-center mb-8">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                {getPurposeIcon()}
              </div>
              <h3 className="text-xl font-bold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1">
                {getPurposeText()}
              </p>
            </div>

            {/* Biometric icon */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                {/* Animated ring */}
                {status === "scanning" && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-4 border-primary"
                    animate={{
                      scale: [1, 1.2, 1],
                      opacity: [1, 0.5, 1],
                    }}
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{
                      width: 100,
                      height: 100,
                      marginLeft: -50,
                      marginTop: -50,
                      left: "50%",
                      top: "50%",
                    }}
                  />
                )}

                <motion.div
                  animate={{
                    scale: status === "scanning" ? [1, 1.05, 1] : 1,
                  }}
                  transition={{
                    duration: 0.5,
                    repeat: status === "scanning" ? Infinity : 0,
                  }}
                  className={`w-24 h-24 rounded-full flex items-center justify-center ${
                    status === "success"
                      ? "bg-green-500/20"
                      : status === "error"
                        ? "bg-destructive/20"
                        : "bg-muted"
                  }`}
                >
                  {status === "success" ? (
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  ) : status === "error" ? (
                    <XCircle className="w-12 h-12 text-destructive" />
                  ) : status === "scanning" ? (
                    isIOSDevice ? (
                      <ScanFace className="w-12 h-12 text-primary" />
                    ) : (
                      <Fingerprint className="w-12 h-12 text-primary" />
                    )
                  ) : isIOSDevice ? (
                    <ScanFace className="w-12 h-12 text-muted-foreground" />
                  ) : (
                    <Fingerprint className="w-12 h-12 text-muted-foreground" />
                  )}
                </motion.div>
              </div>
            </div>

            {/* Status text */}
            <div className="text-center mb-6">
              {status === "scanning" && (
                <div className="flex items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>
                    {isIOSDevice
                      ? "Looking for Face ID..."
                      : "Touch the sensor..."}
                  </span>
                </div>
              )}
              {status === "success" && (
                <p className="text-green-500 font-medium">Verified!</p>
              )}
              {status === "error" && (
                <p className="text-destructive">{errorMessage}</p>
              )}
            </div>

            {/* Buttons */}
            <div className="space-y-3">
              {status === "error" && (
                <button
                  onClick={authenticate}
                  className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold"
                >
                  Try Again
                </button>
              )}

              {status !== "success" && (
                <button
                  onClick={onFallback || onClose}
                  className="w-full py-3.5 bg-muted text-foreground rounded-xl font-medium"
                >
                  {onFallback ? "Use Passcode Instead" : "Cancel"}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default BiometricAuth;
