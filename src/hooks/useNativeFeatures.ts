/**
 * useNativeFeatures.ts
 * Web-native implementations of device features.
 * Uses browser APIs (Vibration, DeviceMotion, Geolocation, Share, Web Storage).
 * Capacitor is no longer required for the web app — the React Native app in
 * apps/mobile handles iOS/Android native features independently.
 */

import { useState, useEffect, useCallback } from "react";

// Platform helpers (browser-based, no Capacitor)
export const isNativeApp = (): boolean => false; // web is always false; RN app has its own logic
export const isIOS = (): boolean =>
  /iP(hone|ad|od)/.test(navigator.userAgent);
export const isAndroid = (): boolean => /Android/.test(navigator.userAgent);

// ---------------------------------------------------------------------------
// Haptic feedback — uses Web Vibration API (supported on Android Chrome, no-op on iOS)
// ---------------------------------------------------------------------------

// Chrome blocks navigator.vibrate() before the first user gesture and logs a
// noisy "[Intervention]" warning. Skip silently until the page has been
// activated. `userActivation` is Chromium-only; other browsers fall through.
const hasUserActivation = (): boolean => {
  const ua = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return ua ? ua.hasBeenActive : true;
};

export const useHaptics = () => {
  const canVibrate = typeof navigator.vibrate === "function";

  const impact = useCallback(
    (_style: "light" | "medium" | "heavy" = "medium") => {
      if (!canVibrate || !hasUserActivation()) return;
      const duration = { light: 30, medium: 60, heavy: 120 }[_style];
      navigator.vibrate(duration);
    },
    [canVibrate],
  );

  const notification = useCallback(
    (_type: "success" | "warning" | "error" = "success") => {
      if (!canVibrate || !hasUserActivation()) return;
      const pattern = {
        success: [40, 30, 40],
        warning: [60, 40, 60],
        error: [100, 50, 100, 50, 100],
      }[_type];
      navigator.vibrate(pattern);
    },
    [canVibrate],
  );

  const vibrate = useCallback(
    (duration = 300) => {
      if (!canVibrate || !hasUserActivation()) return;
      navigator.vibrate(duration);
    },
    [canVibrate],
  );

  const selectionChanged = useCallback(() => {
    if (!canVibrate || !hasUserActivation()) return;
    navigator.vibrate(10);
  }, [canVibrate]);

  return { impact, notification, vibrate, selectionChanged };
};

// ---------------------------------------------------------------------------
// Shake detection — Web DeviceMotion API
// ---------------------------------------------------------------------------
export const useShakeDetection = (callback: () => void, threshold = 15) => {
  useEffect(() => {
    let lastX = 0,
      lastY = 0,
      lastZ = 0;
    let lastTime = Date.now();

    const handleMotion = (event: DeviceMotionEvent) => {
      const acceleration = event.accelerationIncludingGravity;
      if (!acceleration) return;

      const currentTime = Date.now();
      if (currentTime - lastTime > 100) {
        const deltaX = Math.abs((acceleration.x || 0) - lastX);
        const deltaY = Math.abs((acceleration.y || 0) - lastY);
        const deltaZ = Math.abs((acceleration.z || 0) - lastZ);

        if (deltaX + deltaY + deltaZ > threshold) callback();

        lastX = acceleration.x || 0;
        lastY = acceleration.y || 0;
        lastZ = acceleration.z || 0;
        lastTime = currentTime;
      }
    };

    // Request permission on iOS 13+ (Safari)
    if (typeof (DeviceMotionEvent as any).requestPermission === "function") {
      (DeviceMotionEvent as any)
        .requestPermission()
        .then((response: string) => {
          if (response === "granted")
            window.addEventListener("devicemotion", handleMotion);
        })
        .catch(console.error);
    } else {
      window.addEventListener("devicemotion", handleMotion);
    }

    return () => window.removeEventListener("devicemotion", handleMotion);
  }, [callback, threshold]);
};

// ---------------------------------------------------------------------------
// Pull-to-refresh
// ---------------------------------------------------------------------------
export const usePullToRefresh = (onRefresh: () => Promise<void>) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
      setPullDistance(0);
    }
  }, [onRefresh]);

  return { isRefreshing, pullDistance, setPullDistance, handleRefresh };
};

// ---------------------------------------------------------------------------
// System dark mode detection
// ---------------------------------------------------------------------------
export const useSystemDarkMode = () => {
  const [isDark, setIsDark] = useState(
    window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return isDark;
};

// ---------------------------------------------------------------------------
// Online/Offline detection
// ---------------------------------------------------------------------------
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  return isOnline;
};

// ---------------------------------------------------------------------------
// Geolocation — Web Geolocation API
// ---------------------------------------------------------------------------
export const useGeolocation = () => {
  const [location, setLocation] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getCurrentPosition = useCallback(() => {
    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation(position);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  return { location, error, loading, getCurrentPosition };
};

// ---------------------------------------------------------------------------
// Web Share API with clipboard fallback
// ---------------------------------------------------------------------------
export const useShare = () => {
  const canShare = typeof navigator.share === "function";

  const share = useCallback(
    async (data: { title?: string; text?: string; url?: string }) => {
      if (canShare) {
        try {
          await navigator.share(data);
          return { success: true, method: "native" };
        } catch {
          return { success: false, method: "none" };
        }
      }
      if (data.url) {
        await navigator.clipboard.writeText(data.url);
        return { success: true, method: "clipboard" };
      }
      return { success: false, method: "none" };
    },
    [canShare],
  );

  return { canShare, share };
};

// ---------------------------------------------------------------------------
// Offline-aware localStorage
// ---------------------------------------------------------------------------
export const useOfflineStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      try {
        const valueToStore =
          value instanceof Function ? value(storedValue) : value;
        setStoredValue(valueToStore);
        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (e) {
        console.error("Error saving to localStorage", e);
      }
    },
    [key, storedValue],
  );

  return [storedValue, setValue] as const;
};

// ---------------------------------------------------------------------------
// Swipe gesture
// ---------------------------------------------------------------------------
export const useSwipeGesture = (
  onSwipeLeft?: () => void,
  onSwipeRight?: () => void,
  onSwipeUp?: () => void,
  onSwipeDown?: () => void,
  threshold = 50,
) => {
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(
    null,
  );

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
  }, []);

  const onTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart) return;
      const deltaX = e.changedTouches[0].clientX - touchStart.x;
      const deltaY = e.changedTouches[0].clientY - touchStart.y;

      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX > threshold && onSwipeRight) onSwipeRight();
        if (deltaX < -threshold && onSwipeLeft) onSwipeLeft();
      } else {
        if (deltaY > threshold && onSwipeDown) onSwipeDown();
        if (deltaY < -threshold && onSwipeUp) onSwipeUp();
      }
      setTouchStart(null);
    },
    [touchStart, threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown],
  );

  return { onTouchStart, onTouchEnd };
};
