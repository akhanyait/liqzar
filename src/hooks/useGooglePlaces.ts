/**
 * Google Places API Hook (New Places API - March 2025)
 * Uses google.maps.places.AutocompleteSuggestion and google.maps.places.Place
 */

/// <reference types="@types/google.maps" />

import { useState, useEffect, useCallback } from "react";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google: typeof google;
    initGoogleMaps: () => void;
  }
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

export interface PlacePrediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  types: string[];
}

export interface PlaceDetails {
  placeId: string;
  formattedAddress: string;
  streetNumber: string;
  streetName: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  coordinates: { lat: number; lng: number };
}

let isScriptLoading = false;
let isScriptLoaded = false;
const scriptLoadCallbacks: (() => void)[] = [];

/**
 * Load Google Maps JavaScript API with async loading
 */
const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (isScriptLoaded && window.google?.maps?.places) {
      resolve();
      return;
    }

    // Add to callbacks if currently loading
    if (isScriptLoading) {
      scriptLoadCallbacks.push(resolve);
      return;
    }

    // Check if script tag already exists
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      if (window.google?.maps?.places) {
        isScriptLoaded = true;
        resolve();
      } else {
        scriptLoadCallbacks.push(resolve);
      }
      return;
    }

    // Start loading
    isScriptLoading = true;

    // Create callback function
    window.initGoogleMaps = () => {
      isScriptLoaded = true;
      isScriptLoading = false;
      resolve();
      scriptLoadCallbacks.forEach((cb) => cb());
      scriptLoadCallbacks.length = 0;
    };

    // Create and append script with async loading (best practice)
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places&loading=async&callback=initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      isScriptLoading = false;
      reject(new Error("Failed to load Google Maps script"));
    };

    document.head.appendChild(script);
  });
};

/**
 * Parse address components from Google Place
 */
const parseAddressComponents = (
  components: google.maps.GeocoderAddressComponent[],
): Omit<PlaceDetails, "placeId" | "formattedAddress" | "coordinates"> => {
  const result = {
    streetNumber: "",
    streetName: "",
    suburb: "",
    city: "",
    province: "",
    postalCode: "",
    country: "",
  };

  components.forEach((component) => {
    const types = component.types;

    if (types.includes("street_number")) {
      result.streetNumber = component.long_name;
    }
    if (types.includes("route")) {
      result.streetName = component.long_name;
    }
    if (
      types.includes("sublocality") ||
      types.includes("sublocality_level_1")
    ) {
      result.suburb = component.long_name;
    }
    if (types.includes("locality")) {
      result.city = component.long_name;
    }
    // South Africa uses administrative_area_level_1 for provinces
    if (types.includes("administrative_area_level_1")) {
      result.province = component.long_name;
    }
    if (types.includes("postal_code")) {
      result.postalCode = component.long_name;
    }
    if (types.includes("country")) {
      result.country = component.long_name;
    }
    // Fallback for suburb if not found
    if (!result.suburb && types.includes("neighborhood")) {
      result.suburb = component.long_name;
    }
    // Some SA addresses have suburb under administrative_area_level_2
    if (!result.suburb && types.includes("administrative_area_level_2")) {
      result.suburb = component.long_name;
    }
  });

  return result;
};

export const useGooglePlaces = () => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize Google Places
  useEffect(() => {
    if (
      !GOOGLE_MAPS_API_KEY ||
      GOOGLE_MAPS_API_KEY === "YOUR_GOOGLE_MAPS_API_KEY"
    ) {
      console.warn("Google Maps API key not configured");
      setError("Google Maps API key not configured");
      return;
    }

    loadGoogleMapsScript()
      .then(() => {
        setIsLoaded(true);
      })
      .catch((err) => {
        console.error("Google Places script load error:", err);
        setError(
          "Failed to load Google Places. Check API key and enable Places API in Google Cloud Console.",
        );
      });
  }, []);

  /**
   * Search for address predictions using new Place API
   */
  const searchPlaces = useCallback(
    async (query: string): Promise<PlacePrediction[]> => {
      if (!isLoaded || !query || query.length < 3) {
        return [];
      }

      try {
        // Use Geocoder for address search (more reliable for SA addresses)
        const geocoder = new window.google.maps.Geocoder();

        return new Promise((resolve) => {
          geocoder.geocode(
            {
              address: query,
              componentRestrictions: { country: "ZA" },
            },
            (results, status) => {
              if (status === "OK" && results) {
                resolve(
                  results.slice(0, 5).map((result) => ({
                    placeId: result.place_id,
                    description: result.formatted_address,
                    mainText: result.formatted_address.split(",")[0],
                    secondaryText: result.formatted_address
                      .split(",")
                      .slice(1)
                      .join(",")
                      .trim(),
                    types: result.types,
                  })),
                );
              } else {
                resolve([]);
              }
            },
          );
        });
      } catch (err) {
        console.error("Search places error:", err);
        return [];
      }
    },
    [isLoaded],
  );

  /**
   * Get detailed place information using Geocoder
   */
  const getPlaceDetails = useCallback(
    async (placeId: string): Promise<PlaceDetails | null> => {
      if (!isLoaded) {
        return null;
      }

      try {
        const geocoder = new window.google.maps.Geocoder();

        return new Promise((resolve) => {
          geocoder.geocode({ placeId }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const place = results[0];
              const parsed = parseAddressComponents(
                place.address_components || [],
              );

              resolve({
                placeId: place.place_id || placeId,
                formattedAddress: place.formatted_address || "",
                ...parsed,
                coordinates: {
                  lat: place.geometry?.location?.lat() || 0,
                  lng: place.geometry?.location?.lng() || 0,
                },
              });
            } else {
              resolve(null);
            }
          });
        });
      } catch (err) {
        console.error("Get place details error:", err);
        return null;
      }
    },
    [isLoaded],
  );

  /**
   * Reverse geocode coordinates to address
   */
  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<PlaceDetails | null> => {
      if (!isLoaded) return null;

      try {
        const geocoder = new window.google.maps.Geocoder();

        return new Promise((resolve) => {
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === "OK" && results && results[0]) {
              const place = results[0];
              const parsed = parseAddressComponents(
                place.address_components || [],
              );

              resolve({
                placeId: place.place_id || "",
                formattedAddress: place.formatted_address || "",
                ...parsed,
                coordinates: { lat, lng },
              });
            } else {
              resolve(null);
            }
          });
        });
      } catch (err) {
        console.error("Reverse geocode error:", err);
        return null;
      }
    },
    [isLoaded],
  );

  return {
    isLoaded,
    error,
    searchPlaces,
    getPlaceDetails,
    reverseGeocode,
  };
};

export default useGooglePlaces;
