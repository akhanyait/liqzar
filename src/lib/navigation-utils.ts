/**
 * Navigation utilities for in-app and external maps navigation
 */

export interface NavigationOptions {
  destinationLat: number;
  destinationLng: number;
  destinationAddress?: string;
  originLat?: number;
  originLng?: number;
}

export interface InAppNavigationState {
  isNavigating: boolean;
  destination: { lat: number; lng: number } | null;
  destinationAddress?: string;
  pickupLocation?: { lat: number; lng: number };
  pickupAddress?: string;
}

// Store navigation state for in-app navigation
let navigationState: InAppNavigationState = {
  isNavigating: false,
  destination: null,
};

/**
 * Get current navigation state
 */
export const getNavigationState = (): InAppNavigationState => {
  return { ...navigationState };
};

/**
 * Start in-app navigation (preferred method - keeps user in app)
 */
export const startInAppNavigation = (options: NavigationOptions): void => {
  navigationState = {
    isNavigating: true,
    destination: {
      lat: options.destinationLat,
      lng: options.destinationLng,
    },
    destinationAddress: options.destinationAddress,
    pickupLocation:
      options.originLat && options.originLng
        ? { lat: options.originLat, lng: options.originLng }
        : undefined,
  };

  // Dispatch event so navigation components can react
  window.dispatchEvent(
    new CustomEvent("startInAppNavigation", { detail: navigationState }),
  );
};

/**
 * Clear navigation state
 */
export const clearNavigation = (): void => {
  navigationState = {
    isNavigating: false,
    destination: null,
  };
  window.dispatchEvent(new CustomEvent("clearNavigation"));
};

/**
 * Detect if running on iOS
 */
const isIOS = (): boolean => {
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
};

/**
 * Detect if running on Android
 */
const isAndroid = (): boolean => {
  return /Android/i.test(navigator.userAgent);
};

/**
 * Launch navigation to a destination using the device's default maps app
 * - iOS: Opens Apple Maps (with Google Maps fallback)
 * - Android: Opens Google Maps
 * - Desktop: Opens Google Maps in browser
 */
export const launchNavigation = (options: NavigationOptions): void => {
  const {
    destinationLat,
    destinationLng,
    destinationAddress,
    originLat,
    originLng,
  } = options;

  // Build destination string
  const destination = destinationAddress
    ? encodeURIComponent(destinationAddress)
    : `${destinationLat},${destinationLng}`;

  // Build origin string if provided
  const origin = originLat && originLng ? `${originLat},${originLng}` : "";

  if (isIOS()) {
    // Try Apple Maps first (native on iOS)
    // Format: maps://?daddr=destination&saddr=origin
    const appleMapsUrl = origin
      ? `maps://?daddr=${destination}&saddr=${origin}&dirflg=d`
      : `maps://?daddr=${destination}&dirflg=d`;

    // Google Maps fallback URL
    const googleMapsUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    // Try Apple Maps first, fallback to Google Maps
    const link = document.createElement("a");
    link.href = appleMapsUrl;
    link.click();

    // If Apple Maps doesn't open within 1 second, try Google Maps
    setTimeout(() => {
      if (document.hidden) return; // Apple Maps opened successfully
      window.open(googleMapsUrl, "_blank");
    }, 1000);
  } else if (isAndroid()) {
    // Google Maps intent for Android
    // Format: google.navigation:q=lat,lng or address
    const googleMapsIntentUrl = `google.navigation:q=${destinationLat},${destinationLng}&mode=d`;
    const googleMapsWebUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    // Try intent first, fallback to web
    const link = document.createElement("a");
    link.href = `intent://navigation?q=${destinationLat},${destinationLng}&mode=d#Intent;scheme=google;package=com.google.android.apps.maps;end`;

    try {
      window.location.href = googleMapsIntentUrl;
    } catch {
      window.open(googleMapsWebUrl, "_blank");
    }
  } else {
    // Desktop - open Google Maps in new tab
    const googleMapsUrl = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;

    window.open(googleMapsUrl, "_blank");
  }
};

/**
 * Launch navigation with just an address string
 */
export const launchNavigationToAddress = (address: string): void => {
  const encodedAddress = encodeURIComponent(address);

  if (isIOS()) {
    window.location.href = `maps://?daddr=${encodedAddress}&dirflg=d`;
  } else if (isAndroid()) {
    window.location.href = `google.navigation:q=${encodedAddress}&mode=d`;
  } else {
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}&travelmode=driving`,
      "_blank",
    );
  }
};

/**
 * Open a location in maps (view only, no navigation)
 */
export const openInMaps = (lat: number, lng: number, label?: string): void => {
  const encodedLabel = label ? encodeURIComponent(label) : "";

  if (isIOS()) {
    window.location.href = `maps://?ll=${lat},${lng}&q=${encodedLabel}`;
  } else if (isAndroid()) {
    window.location.href = `geo:${lat},${lng}?q=${lat},${lng}(${encodedLabel})`;
  } else {
    window.open(`https://www.google.com/maps?q=${lat},${lng}`, "_blank");
  }
};

export default launchNavigation;
