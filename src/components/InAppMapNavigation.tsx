import { useEffect, useRef, useState, useCallback } from "react";
import {
  Navigation,
  MapPin,
  Phone,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Locate,
  Compass,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// Mapbox token - try env variable first, then hardcoded fallback
const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_ACCESS_TOKEN ||
  "pk.eyJ1IjoiYWtoYW55YWl0IiwiYSI6ImNtbXFyN2wxdzBtMjMycHNiZWJ6OWt5b28ifQ.J2EnpgwudAprvYbMiZCWoQ";

export interface Location {
  lat: number;
  lng: number;
}

export interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  maneuver: string;
  modifier?: string;
  streetName?: string;
}

interface InAppMapNavigationProps {
  driverLocation: Location;
  destination: Location;
  pickupLocation?: Location;
  driverHeading?: number;
  onRouteUpdated?: (
    duration: string,
    distance: string,
    steps: NavigationStep[],
  ) => void;
  onArrived?: () => void;
  destinationLabel?: string;
  pickupLabel?: string;
  className?: string;
  /** Hide built-in nav header + bottom route panel — for host pages that render their own overlays. */
  minimal?: boolean;
  /** Visual style: "dark" (default) or "light". */
  mapStyle?: "dark" | "light";
  /** Extra bottom padding when fitting bounds — lets host pages reserve room for a bottom sheet. */
  bottomPadding?: number;
}

const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return "< 1 min";
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
};

const getManeuverIcon = (maneuver: string, modifier?: string): string => {
  if (maneuver === "turn") {
    if (modifier === "left") return "↰";
    if (modifier === "right") return "↱";
    if (modifier === "sharp left") return "↲";
    if (modifier === "sharp right") return "↳";
    if (modifier === "slight left") return "↖";
    if (modifier === "slight right") return "↗";
  }
  if (maneuver === "merge") return "⤵";
  if (maneuver === "roundabout") return "⟳";
  if (maneuver === "arrive") return "🏁";
  if (maneuver === "depart") return "▶";
  return "→";
};

const InAppMapNavigation = ({
  driverLocation,
  destination,
  pickupLocation,
  driverHeading = 0,
  onRouteUpdated,
  onArrived,
  destinationLabel = "Destination",
  pickupLabel = "Pickup",
  className = "",
  minimal = false,
  mapStyle = "dark",
  bottomPadding = 250,
}: InAppMapNavigationProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [routeInfo, setRouteInfo] = useState<{
    duration: string;
    distance: string;
  } | null>(null);
  const [steps, setSteps] = useState<NavigationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const routeSourceAdded = useRef(false);

  // Load Mapbox GL JS dynamically
  useEffect(() => {
    const loadMapbox = async () => {
      // Check if already loaded
      if ((window as any).mapboxgl) {
        initMap();
        return;
      }

      // Load CSS
      if (!document.querySelector('link[href*="mapbox-gl"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css";
        document.head.appendChild(link);
      }

      // Load JS
      const script = document.createElement("script");
      script.src = "https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js";
      script.async = true;
      script.onload = () => {
        initMap();
      };
      script.onerror = () => {
        console.error("❌ Failed to load Mapbox GL JS");
        setMapError("Failed to load map library");
      };
      document.head.appendChild(script);
    };

    loadMapbox();

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const initMap = useCallback(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    const mapboxgl = (window as any).mapboxgl;
    if (!mapboxgl) {
      setMapError("Mapbox not available");
      return;
    }

    try {
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const map = new mapboxgl.Map({
        container: mapRef.current,
        style:
          mapStyle === "light"
            ? "mapbox://styles/mapbox/light-v11"
            : "mapbox://styles/mapbox/dark-v11",
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 15,
        pitch: 45,
        bearing: driverHeading,
        attributionControl: false,
      });

      mapInstanceRef.current = map;

      // Attribution in minimal position so it doesn't clash with the sheet
      map.addControl(
        new mapboxgl.AttributionControl({ compact: true }),
        "top-right",
      );

      // Skip default NavigationControl + GeolocateControl in minimal mode —
      // the host page renders branded equivalents.
      if (!minimal) {
        map.addControl(
          new mapboxgl.NavigationControl({ showCompass: true }),
          "bottom-right",
        );
        map.addControl(
          new mapboxgl.GeolocateControl({
            positionOptions: { enableHighAccuracy: true },
            trackUserLocation: true,
          }),
          "bottom-right",
        );
      }

      map.on("load", () => {
        setMapLoaded(true);
        addMarkers();
        fetchRoute();
      });

      map.on("error", (e: any) => {
        console.error("Map error:", e);
        // Don't show error for missing image errors (common with navigation style)
        if (e.error?.message?.includes("image")) return;
        setMapError(e.error?.message || "Map error");
      });

      // Fallback if load event doesn't fire
      setTimeout(() => {
        if (!mapLoaded && mapInstanceRef.current) {
          setMapLoaded(true);
          addMarkers();
          fetchRoute();
        }
      }, 5000);
    } catch (err: any) {
      console.error("Map init error:", err);
      setMapError(err.message || "Failed to initialize map");
    }
  }, [driverLocation, driverHeading]);

  const addMarkers = useCallback(() => {
    const mapboxgl = (window as any).mapboxgl;
    const map = mapInstanceRef.current;
    if (!mapboxgl || !map) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Driver marker — premium gold with pulse halo
    const driverEl = document.createElement("div");
    driverEl.innerHTML = `
      <div style="position: relative; width: 56px; height: 56px;">
        <div style="
          position: absolute; inset: -8px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0) 70%);
          animation: liqzar-pulse 1.8s ease-out infinite;
        "></div>
        <div style="
          position: absolute; inset: 0;
          width: 56px; height: 56px;
          background: linear-gradient(135deg, #E4C168, #B8962E);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 6px 20px rgba(212,175,55,0.55), 0 0 0 4px rgba(255,255,255,0.9);
          transform: rotate(${driverHeading}deg);
        ">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="#1c1810">
            <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
          </svg>
        </div>
      </div>
      <style>
        @keyframes liqzar-pulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      </style>
    `;
    const driverMarker = new mapboxgl.Marker({ element: driverEl })
      .setLngLat([driverLocation.lng, driverLocation.lat])
      .addTo(map);
    markersRef.current.push(driverMarker);

    // Pickup marker
    if (pickupLocation) {
      const pickupEl = document.createElement("div");
      pickupEl.innerHTML = `
        <div style="
          width: 40px;
          height: 40px;
          background: #8b5cf6;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.5);
          border: 3px solid white;
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
          </svg>
        </div>
      `;
      const pickupMarker = new mapboxgl.Marker({ element: pickupEl })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .setPopup(new mapboxgl.Popup().setHTML(`<b>${pickupLabel}</b>`))
        .addTo(map);
      markersRef.current.push(pickupMarker);
    }

    // Destination marker — deep espresso pin with gold dot
    const destEl = document.createElement("div");
    destEl.innerHTML = `
      <div style="
        width: 44px;
        height: 44px;
        background: #1c1810;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 4px 14px rgba(28,24,16,0.55), 0 0 0 3px #D4AF37;
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#D4AF37">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `;
    const destMarker = new mapboxgl.Marker({ element: destEl })
      .setLngLat([destination.lng, destination.lat])
      .setPopup(new mapboxgl.Popup().setHTML(`<b>${destinationLabel}</b>`))
      .addTo(map);
    markersRef.current.push(destMarker);
  }, [
    driverLocation,
    destination,
    pickupLocation,
    driverHeading,
    pickupLabel,
    destinationLabel,
  ]);

  const fetchRoute = useCallback(async () => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const origin = pickupLocation || driverLocation;
    const waypoints = pickupLocation
      ? `${driverLocation.lng},${driverLocation.lat};${pickupLocation.lng},${pickupLocation.lat};${destination.lng},${destination.lat}`
      : `${driverLocation.lng},${driverLocation.lat};${destination.lng},${destination.lat}`;

    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${waypoints}?` +
          `steps=true&geometries=geojson&overview=full&annotations=duration,distance&voice_instructions=true&banner_instructions=true&access_token=${MAPBOX_TOKEN}`,
      );

      if (!response.ok) throw new Error("Route fetch failed");

      const data = await response.json();
      if (!data.routes?.length) throw new Error("No routes found");

      const route = data.routes[0];
      const coords = route.geometry.coordinates;

      // Parse steps
      const allSteps: NavigationStep[] = [];
      route.legs.forEach((leg: any) => {
        leg.steps.forEach((step: any) => {
          allSteps.push({
            instruction: step.maneuver.instruction,
            distance: formatDistance(step.distance),
            duration: formatDuration(step.duration),
            maneuver: step.maneuver.type,
            modifier: step.maneuver.modifier,
            streetName: step.name,
          });
        });
      });

      setSteps(allSteps);
      setRouteInfo({
        duration: formatDuration(route.duration),
        distance: formatDistance(route.distance),
      });

      onRouteUpdated?.(
        formatDuration(route.duration),
        formatDistance(route.distance),
        allSteps,
      );

      // Add route to map
      if (map.getSource("route")) {
        (map.getSource("route") as any).setData({
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        });
      } else {
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: coords },
          },
        });

        // Route outline — warm shadow under the gold stroke
        map.addLayer({
          id: "route-outline",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#1c1810",
            "line-width": 12,
            "line-opacity": mapStyle === "light" ? 0.35 : 0.65,
          },
        });

        // Main route — premium gold
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": "#D4AF37",
            "line-width": 6,
            "line-opacity": 1,
          },
        });

        routeSourceAdded.current = true;
      }

      // Fit bounds
      const mapboxgl = (window as any).mapboxgl;
      const bounds = new mapboxgl.LngLatBounds();
      coords.forEach((c: [number, number]) => bounds.extend(c));
      map.fitBounds(bounds, {
        padding: { top: 120, bottom: bottomPadding, left: 60, right: 60 },
        duration: 1000,
      });
    } catch (err) {
      console.error("Route error:", err);
    }
  }, [driverLocation, destination, pickupLocation, onRouteUpdated]);

  // Update driver position
  useEffect(() => {
    if (
      !mapLoaded ||
      !mapInstanceRef.current ||
      markersRef.current.length === 0
    )
      return;

    const driverMarker = markersRef.current[0];
    if (driverMarker) {
      driverMarker.setLngLat([driverLocation.lng, driverLocation.lat]);
      const el = driverMarker.getElement();
      const innerDiv = el?.querySelector("div");
      if (innerDiv) {
        innerDiv.style.transform = `rotate(${driverHeading}deg)`;
      }
    }

    // Check if near destination
    const distToDestination = getDistance(driverLocation, destination);
    if (distToDestination < 50) {
      onArrived?.();
    }
  }, [driverLocation, driverHeading, mapLoaded, destination, onArrived]);

  const getDistance = (a: Location, b: Location): number => {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const lat1 = (a.lat * Math.PI) / 180;
    const lat2 = (b.lat * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  const centerOnDriver = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.flyTo({
        center: [driverLocation.lng, driverLocation.lat],
        zoom: 16,
        bearing: driverHeading,
        pitch: 60,
        duration: 1000,
      });
    }
  };

  const recenterRoute = () => {
    fetchRoute();
  };

  const startNavigation = () => {
    setIsNavigating(true);
    centerOnDriver();
  };

  const currentStep = steps[currentStepIndex];

  if (mapError) {
    const isTokenError =
      mapError.toLowerCase().includes("unauthorized") ||
      mapError.toLowerCase().includes("token");

    return (
      <div className={`relative ${className}`} style={{ minHeight: "400px" }}>
        <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center text-white p-6">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <p className="text-lg font-medium mb-2">Map Error</p>
          <p className="text-sm text-zinc-400 text-center mb-4">{mapError}</p>

          {isTokenError && (
            <div className="bg-zinc-800 rounded-lg p-4 mb-4 max-w-sm text-sm">
              <p className="text-amber-400 font-medium mb-2">
                Token Configuration Required:
              </p>
              <ol className="text-zinc-300 space-y-1 list-decimal list-inside text-xs">
                <li>Go to mapbox.com/account/access-tokens</li>
                <li>Edit your access token</li>
                <li>
                  Add URL:{" "}
                  <code className="text-blue-400">capacitor://localhost</code>
                </li>
                <li>
                  Also add: <code className="text-blue-400">localhost</code>
                </li>
                <li>Save and rebuild the app</li>
              </ol>
            </div>
          )}

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            size="sm"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`} style={{ minHeight: "100%" }}>
      {/* Map Container */}
      <div
        ref={mapRef}
        className={
          minimal
            ? "absolute inset-0 overflow-hidden"
            : "absolute inset-0 rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
        }
        style={{ width: "100%", height: "100%", background: "#18181b" }}
      />

      {/* Loading State */}
      {!mapLoaded && (
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center z-10">
          <div className="text-center text-white">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p>Loading navigation...</p>
          </div>
        </div>
      )}

      {/* Navigation Header */}
      {!minimal && mapLoaded && currentStep && isNavigating && (
        <div className="absolute top-4 left-4 right-4 z-20">
          <div className="bg-zinc-900/90 backdrop-blur-md rounded-xl p-4 shadow-2xl border border-zinc-700">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-blue-600 rounded-xl flex items-center justify-center text-2xl">
                {getManeuverIcon(currentStep.maneuver, currentStep.modifier)}
              </div>
              <div className="flex-1">
                <p className="text-white text-lg font-semibold">
                  {currentStep.instruction}
                </p>
                <p className="text-zinc-400 text-sm">
                  {currentStep.streetName && `on ${currentStep.streetName} • `}
                  {currentStep.distance}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Route Info Panel */}
      {!minimal && mapLoaded && routeInfo && (
        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="bg-zinc-900/90 backdrop-blur-md rounded-t-3xl shadow-2xl border-t border-zinc-700">
            {/* Handle */}
            <div className="flex justify-center py-2">
              <div className="w-10 h-1 bg-zinc-600 rounded-full" />
            </div>

            <div className="px-4 pb-4">
              {/* ETA and Distance */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-2xl font-bold text-white">
                    {routeInfo.duration}
                  </p>
                  <p className="text-zinc-400 text-sm">
                    {routeInfo.distance} • {steps.length} steps
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full bg-zinc-800"
                    onClick={centerOnDriver}
                  >
                    <Locate className="w-5 h-5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    className="rounded-full bg-zinc-800"
                    onClick={recenterRoute}
                  >
                    <RotateCcw className="w-5 h-5" />
                  </Button>
                </div>
              </div>

              {/* Start Navigation Button */}
              {!isNavigating && (
                <Button
                  onClick={startNavigation}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white h-14 rounded-xl text-lg font-semibold gap-2"
                >
                  <Navigation className="w-5 h-5" />
                  Start Navigation
                </Button>
              )}

              {/* Steps List */}
              {isNavigating && (
                <>
                  <button
                    onClick={() => setShowAllSteps(!showAllSteps)}
                    className="w-full flex items-center justify-between py-3 text-zinc-400"
                  >
                    <span className="text-sm">
                      {showAllSteps ? "Hide directions" : "Show all directions"}
                    </span>
                    {showAllSteps ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronUp className="w-4 h-4" />
                    )}
                  </button>

                  {showAllSteps && (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {steps.map((step, idx) => (
                        <div
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-lg ${
                            idx === currentStepIndex
                              ? "bg-blue-600/20 border border-blue-600"
                              : "bg-zinc-800"
                          }`}
                        >
                          <span className="text-xl">
                            {getManeuverIcon(step.maneuver, step.modifier)}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-white text-sm truncate">
                              {step.instruction}
                            </p>
                            <p className="text-zinc-400 text-xs">
                              {step.distance}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InAppMapNavigation;
