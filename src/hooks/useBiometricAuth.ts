/**
 * useBiometricAuth.ts — Web implementation
 *
 * Native biometric auth (Face ID / Touch ID / Fingerprint) is handled by the
 * React Native app (apps/mobile) via expo-local-authentication.
 *
 * On the web we provide PIN-based quick login only.
 * isAvailable is always false on web so callers gracefully fall back to PIN.
 */

import { useState, useCallback } from "react";

// Mirror of the Capacitor BiometryType enum — no Capacitor dependency
export enum BiometryType {
  NONE = 0,
  TOUCH_ID = 1,
  FACE_ID = 2,
  FINGERPRINT = 3,
  FACE_AUTHENTICATION = 4,
  IRIS_AUTHENTICATION = 5,
  MULTIPLE = 6,
}

interface BiometricState {
  isAvailable: boolean;
  biometryType: BiometryType | null;
  isChecking: boolean;
  error: string | null;
}

export function useBiometricAuth() {
  // Biometrics are not available on the web — use PIN instead.
  const [state] = useState<BiometricState>({
    isAvailable: false,
    biometryType: null,
    isChecking: false,
    error: null,
  });

  // Web is never a native Capacitor platform
  const isNative = false;

  const getBiometryName = useCallback(() => "Biometrics", []);

  const authenticate = useCallback(
    async (_reason?: string): Promise<boolean> => false,
    [],
  );

  const storeCredentials = useCallback(async (phone: string): Promise<boolean> => {
    // On web, just persist the phone for PIN quick-login
    localStorage.setItem("liqzar-biometric-enabled", "true");
    localStorage.setItem("liqzar-last-phone", phone);
    return true;
  }, []);

  const getStoredCredentials = useCallback(
    async (): Promise<{ phone: string } | null> => {
      const phone = localStorage.getItem("liqzar-last-phone");
      return phone ? { phone } : null;
    },
    [],
  );

  const isBiometricLoginEnabled = useCallback(
    () => localStorage.getItem("liqzar-biometric-enabled") === "true",
    [],
  );

  const getLastPhone = useCallback(
    () => localStorage.getItem("liqzar-last-phone"),
    [],
  );

  const clearCredentials = useCallback(async () => {
    localStorage.removeItem("liqzar-biometric-enabled");
    localStorage.removeItem("liqzar-last-phone");
  }, []);

  return {
    ...state,
    isNative,
    getBiometryName,
    authenticate,
    storeCredentials,
    getStoredCredentials,
    isBiometricLoginEnabled,
    getLastPhone,
    clearCredentials,
  };
}
