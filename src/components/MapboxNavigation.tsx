import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

// Set token immediately at module load
const MAPBOX_TOKEN =
  "pk.eyJ1IjoiYWtoYW55YWl0IiwiYSI6ImNtODRwZGR1cTBiZmsycXNlM3hmbTVlMWwifQ.5iZ3xG3cTm5pRfxHwDNjFw";

// Initialize mapbox token
if (typeof mapboxgl !== "undefined") {
  mapboxgl.accessToken = MAPBOX_TOKEN;
}

// Check WebGL2 and WebGL support
const checkWebGLSupport = (): { webgl: boolean; webgl2: boolean } => {
  try {
    const canvas = document.createElement("canvas");
    const webgl2 = !!canvas.getContext("webgl2");
    const webgl = !!(
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
    );
    return { webgl, webgl2 };
  } catch (e) {
    return { webgl: false, webgl2: false };
  }
};

const webglSupport = checkWebGLSupport();

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
  name?: string;
}

interface MapboxNavigationProps {
  center: Location;
  zoom?: number;
  driverLocation?: Location;
  driverHeading?: number;
  destination?: Location;
  pickupLocation?: Location;
  showRoute?: boolean;
  showTraffic?: boolean;
  onMapReady?: () => void;
  onRouteCalculated?: (
    duration: string,
    distance: string,
    steps?: NavigationStep[],
  ) => void;
  className?: string;
  height?: string;
  mapStyle?: "dark" | "navigation" | "streets";
}

// Custom car marker — premium gold
const createCarMarker = (heading: number = 0) => {
  const el = document.createElement("div");
  el.className = "car-marker";
  el.innerHTML = `
    <div style="
      width: 48px;
      height: 48px;
      background: linear-gradient(135deg, #E4C168 0%, #B8962E 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 6px 20px rgba(212,175,55,0.55), 0 0 0 3px rgba(255,255,255,0.9);
      transform: rotate(${heading}deg);
      transition: transform 0.3s ease;
    ">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="#1c1810" xmlns="http://www.w3.org/2000/svg">
        <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
      </svg>
    </div>
    <div style="
      position: absolute;
      width: 70px;
      height: 70px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(212,175,55,0.35) 0%, rgba(212,175,55,0) 70%);
      top: -11px;
      left: -11px;
      animation: liqzar-driver-pulse 1.8s ease-out infinite;
      pointer-events: none;
    "></div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    @keyframes liqzar-driver-pulse {
      0% { transform: scale(0.85); opacity: 0.9; }
      100% { transform: scale(1.5); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  return el;
};

// Destination marker — espresso pin with gold accent for dropoff, gold fill for pickup
const createDestinationMarker = (type: "pickup" | "dropoff" = "dropoff") => {
  const el = document.createElement("div");
  const isPickup = type === "pickup";
  const fill = isPickup ? "#D4AF37" : "#1c1810";
  const iconFill = isPickup ? "#1c1810" : "#D4AF37";
  el.innerHTML = `
    <div style="
      width: 40px;
      height: 40px;
      background: ${fill};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 14px rgba(28,24,16,0.55);
      border: 3px solid ${isPickup ? "#1c1810" : "#D4AF37"};
    ">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" fill="${iconFill}"/>
        <circle cx="12" cy="9" r="2.5" fill="${fill}"/>
      </svg>
    </div>
    <div style="
      position: absolute;
      bottom: -8px;
      left: 50%;
      transform: translateX(-50%);
      width: 0;
      height: 0;
      border-left: 8px solid transparent;
      border-right: 8px solid transparent;
      border-top: 8px solid ${fill};
    "></div>
  `;
  return el;
};

const MapboxNavigation = ({
  center,
  zoom = 14,
  driverLocation,
  driverHeading = 0,
  destination,
  pickupLocation,
  showRoute = true,
  showTraffic = true,
  onMapReady,
  onRouteCalculated,
  className = "",
  height = "400px",
  mapStyle = "navigation",
}: MapboxNavigationProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const driverMarker = useRef<mapboxgl.Marker | null>(null);
  const destinationMarker = useRef<mapboxgl.Marker | null>(null);
  const pickupMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const routeLayerAdded = useRef(false);
  const isLoadedRef = useRef(false);

  // Get map style URL - using free tier styles
  const getMapStyle = useCallback(() => {
    switch (mapStyle) {
      case "dark":
        return "mapbox://styles/mapbox/dark-v11";
      case "navigation":
        return "mapbox://styles/mapbox/dark-v11"; // Dark style (free tier)
      case "streets":
        return "mapbox://styles/mapbox/streets-v12";
      default:
        return "mapbox://styles/mapbox/streets-v12";
    }
  }, [mapStyle]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    // Validate token
    if (!MAPBOX_TOKEN || MAPBOX_TOKEN.length < 50) {
      console.error("🗺️ Invalid Mapbox token:", MAPBOX_TOKEN);
      return;
    }

    // Check container dimensions
    const containerRect = mapContainer.current.getBoundingClientRect();

    if (containerRect.width === 0 || containerRect.height === 0) {
      console.warn("🗺️ Container has no dimensions, waiting...");
      // Retry after a short delay
      setTimeout(() => {
        setIsMapLoaded(false); // Force re-render
      }, 100);
      return;
    }

    // Ensure token is set
    mapboxgl.accessToken = MAPBOX_TOKEN;

    try {
      // Use simple style URL
      const styleUrl = "mapbox://styles/mapbox/streets-v12";

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: styleUrl,
        center: [center.lng, center.lat],
        zoom: zoom,
        pitch: 0,
        bearing: 0,
        attributionControl: true,
        trackResize: true,
        preserveDrawingBuffer: true,
        antialias: false, // Disable for better performance on iOS
        fadeDuration: 0, // Disable fade for faster rendering
        crossSourceCollisions: false,
      });

      // Add navigation controls
      map.current.addControl(
        new mapboxgl.NavigationControl({ showCompass: true }),
        "bottom-right",
      );

      map.current.on("load", () => {
        if (!isLoadedRef.current) {
          isLoadedRef.current = true;
          setIsMapLoaded(true);
          onMapReady?.();
        }
      });

      map.current.on("idle", () => {
        if (!isLoadedRef.current) {
          isLoadedRef.current = true;
          setIsMapLoaded(true);
        }
      });

      map.current.on("style.load", () => {
        if (!isLoadedRef.current) {
          isLoadedRef.current = true;
          setIsMapLoaded(true);
        }
      });

      map.current.on("error", (e: any) => {
        // Better error logging
        const error = e.error || e;
        const errorMsg =
          error?.message || error?.toString?.() || "Unknown error";
        const errorStack = error?.stack || "";
        console.error("🗺️ Mapbox error:", errorMsg);
        if (errorStack) console.error("🗺️ Stack:", errorStack);
        if (e.source) console.error("🗺️ Source:", JSON.stringify(e.source));
      });

      // Fallback timeout to show map even if events don't fire
      setTimeout(() => {
        if (!isLoadedRef.current && map.current) {
          isLoadedRef.current = true;
          setIsMapLoaded(true);
          // Trigger resize to ensure proper rendering
          map.current.resize();
        }
      }, 3000);
    } catch (error) {
      console.error("🗺️ Failed to initialize Mapbox:", error);
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Update driver marker
  useEffect(() => {
    if (!map.current || !isMapLoaded || !driverLocation) return;

    if (driverMarker.current) {
      driverMarker.current.setLngLat([driverLocation.lng, driverLocation.lat]);
      // Update rotation
      const el = driverMarker.current.getElement();
      const innerDiv = el.querySelector("div") as HTMLElement;
      if (innerDiv) {
        innerDiv.style.transform = `rotate(${driverHeading}deg)`;
      }
    } else {
      driverMarker.current = new mapboxgl.Marker({
        element: createCarMarker(driverHeading),
        anchor: "center",
      })
        .setLngLat([driverLocation.lng, driverLocation.lat])
        .addTo(map.current);
    }

    // Smoothly pan to driver location
    map.current.easeTo({
      center: [driverLocation.lng, driverLocation.lat],
      bearing: driverHeading,
      duration: 1000,
    });
  }, [driverLocation, driverHeading, isMapLoaded]);

  // Update destination marker
  useEffect(() => {
    if (!map.current || !isMapLoaded || !destination) return;

    if (destinationMarker.current) {
      destinationMarker.current.setLngLat([destination.lng, destination.lat]);
    } else {
      destinationMarker.current = new mapboxgl.Marker({
        element: createDestinationMarker("dropoff"),
        anchor: "bottom",
      })
        .setLngLat([destination.lng, destination.lat])
        .addTo(map.current);
    }
  }, [destination, isMapLoaded]);

  // Update pickup marker
  useEffect(() => {
    if (!map.current || !isMapLoaded || !pickupLocation) return;

    if (pickupMarkerRef.current) {
      pickupMarkerRef.current.setLngLat([
        pickupLocation.lng,
        pickupLocation.lat,
      ]);
    } else {
      pickupMarkerRef.current = new mapboxgl.Marker({
        element: createDestinationMarker("pickup"),
        anchor: "bottom",
      })
        .setLngLat([pickupLocation.lng, pickupLocation.lat])
        .addTo(map.current);
    }
  }, [pickupLocation, isMapLoaded]);

  // Fetch and render route
  useEffect(() => {
    if (!map.current || !isMapLoaded || !showRoute) return;

    const origin = driverLocation || pickupLocation;
    if (!origin || !destination) return;

    const fetchRoute = async () => {
      try {
        // Using driving profile (free tier compatible)
        const response = await fetch(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?` +
            `steps=true&geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`,
        );

        const data = await response.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates;

          // Parse navigation steps
          const steps: NavigationStep[] = route.legs[0].steps.map(
            (step: any) => ({
              instruction: step.maneuver.instruction,
              distance: formatDistance(step.distance),
              duration: formatDuration(step.duration),
              maneuver: step.maneuver.type,
              modifier: step.maneuver.modifier,
              name: step.name,
            }),
          );

          setNavigationSteps(steps);

          // Call callback with route info
          onRouteCalculated?.(
            formatDuration(route.duration),
            formatDistance(route.distance),
            steps,
          );

          // Add or update route layer
          if (map.current) {
            if (map.current.getSource("route")) {
              (
                map.current.getSource("route") as mapboxgl.GeoJSONSource
              ).setData({
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: coordinates,
                },
              });
            } else {
              // Add route outline (shadow)
              map.current.addLayer({
                id: "route-outline",
                type: "line",
                source: {
                  type: "geojson",
                  data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: coordinates,
                    },
                  },
                },
                layout: {
                  "line-join": "round",
                  "line-cap": "round",
                },
                paint: {
                  "line-color": "#1c1810",
                  "line-width": 12,
                  "line-opacity": 0.6,
                },
              });

              // Add main route line
              map.current.addSource("route", {
                type: "geojson",
                data: {
                  type: "Feature",
                  properties: {},
                  geometry: {
                    type: "LineString",
                    coordinates: coordinates,
                  },
                },
              });

              map.current.addLayer({
                id: "route",
                type: "line",
                source: "route",
                layout: {
                  "line-join": "round",
                  "line-cap": "round",
                },
                paint: {
                  "line-color": "#D4AF37",
                  "line-width": 6,
                  "line-opacity": 1,
                },
              });

              // Add animated dashed line on top
              map.current.addLayer({
                id: "route-arrows",
                type: "symbol",
                source: "route",
                layout: {
                  "symbol-placement": "line",
                  "symbol-spacing": 50,
                  "icon-image": "arrow-right",
                  "icon-size": 0.5,
                },
              });

              routeLayerAdded.current = true;
            }

            // Fit map to show entire route
            const bounds = new mapboxgl.LngLatBounds();
            coordinates.forEach((coord: [number, number]) => {
              bounds.extend(coord);
            });
            map.current.fitBounds(bounds, {
              padding: { top: 150, bottom: 200, left: 50, right: 50 },
              duration: 1000,
            });
          }
        }
      } catch (error) {
        console.error("Error fetching route:", error);
      }
    };

    fetchRoute();
  }, [
    driverLocation,
    destination,
    pickupLocation,
    showRoute,
    isMapLoaded,
    onRouteCalculated,
  ]);

  return (
    <div
      className={`relative ${className}`}
      style={{
        height,
        minHeight: height,
        width: "100%",
        position: "relative",
        overflow: "hidden",
        borderRadius: "0.5rem",
      }}
    >
      {/* Map container - must have explicit dimensions */}
      <div
        ref={mapContainer}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "100%",
        }}
      />

      {/* Loading state */}
      {!isMapLoaded && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg"
          style={{ zIndex: 10 }}
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-xs text-muted-foreground">Loading map...</p>
            <p className="text-xs text-gray-600 mt-1">
              WebGL: {webglSupport.webgl ? "✓" : "✗"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

// Helper functions
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} sec`;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours} hr ${remainingMinutes} min`;
}

export default MapboxNavigation;
