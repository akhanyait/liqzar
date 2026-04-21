import { useEffect, useRef, useState, useCallback } from "react";

// Extend Window interface for Google Maps
declare global {
  interface Window {
    google: typeof google;
    initGoogleMapsNav?: () => void;
  }
}

export interface Location {
  lat: number;
  lng: number;
}

export interface NavMarker {
  position: Location;
  type: "driver" | "customer" | "store" | "pickup" | "dropoff";
  label?: string;
  heading?: number; // Direction the driver is facing (0-360)
  info?: string;
}

// Navigation step from Directions API
export interface NavigationStep {
  instruction: string; // HTML instructions (e.g., "Turn left onto Main St")
  distance: string; // "200 m"
  duration: string; // "1 min"
  maneuver?: string; // "turn-left", "turn-right", "straight", etc.
  startLocation: Location;
  endLocation: Location;
}

interface GoogleMapsNavigationProps {
  center: Location;
  zoom?: number;
  markers?: NavMarker[];
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
  mapStyle?: "dark" | "light" | "uber";
}

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

// Uber-style dark map theme
const uberDarkStyle: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "administrative",
    elementType: "geometry",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "administrative.country",
    elementType: "labels.text.fill",
    stylers: [{ color: "#9e9e9e" }],
  },
  {
    featureType: "administrative.land_parcel",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "administrative.locality",
    elementType: "labels.text.fill",
    stylers: [{ color: "#bdbdbd" }],
  },
  {
    featureType: "poi",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "poi.park",
    elementType: "geometry",
    stylers: [{ color: "#181818" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "poi.park",
    elementType: "labels.text.stroke",
    stylers: [{ color: "#1b1b1b" }],
  },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "labels.text.fill",
    stylers: [{ color: "#8a8a8a" }],
  },
  {
    featureType: "road.arterial",
    elementType: "geometry",
    stylers: [{ color: "#373737" }],
  },
  {
    featureType: "road.highway",
    elementType: "geometry",
    stylers: [{ color: "#3c3c3c" }],
  },
  {
    featureType: "road.highway.controlled_access",
    elementType: "geometry",
    stylers: [{ color: "#4e4e4e" }],
  },
  {
    featureType: "road.local",
    elementType: "labels.text.fill",
    stylers: [{ color: "#616161" }],
  },
  {
    featureType: "transit",
    elementType: "labels.text.fill",
    stylers: [{ color: "#757575" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "water",
    elementType: "labels.text.fill",
    stylers: [{ color: "#3d3d3d" }],
  },
];

// Light map style
const lightStyle: google.maps.MapTypeStyle[] = [
  {
    featureType: "poi.business",
    stylers: [{ visibility: "off" }],
  },
  {
    featureType: "transit",
    elementType: "labels.icon",
    stylers: [{ visibility: "off" }],
  },
];

// Create SVG car icon that can rotate
const createCarIcon = (heading: number = 0, color: string = "#f59e0b") => {
  // Car SVG pointing up (0 degrees)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
      <defs>
        <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.4)"/>
        </filter>
      </defs>
      <g transform="rotate(${heading}, 24, 24)" filter="url(#shadow)">
        <!-- Car body -->
        <path d="M24 6 L32 18 L32 36 Q32 40 28 40 L20 40 Q16 40 16 36 L16 18 Z" 
              fill="${color}" stroke="#ffffff" stroke-width="2"/>
        <!-- Windshield -->
        <path d="M20 14 L28 14 L30 22 L18 22 Z" fill="#1f2937" opacity="0.8"/>
        <!-- Headlights -->
        <circle cx="19" cy="10" r="2" fill="#fef3c7"/>
        <circle cx="29" cy="10" r="2" fill="#fef3c7"/>
        <!-- Direction indicator (front) -->
        <polygon points="24,4 22,8 26,8" fill="#ffffff"/>
      </g>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Create store/location marker
const createLocationIcon = (
  type: "store" | "pickup" | "dropoff" | "customer",
  label?: string,
) => {
  const colors: Record<string, { bg: string; icon: string }> = {
    store: { bg: "#1c1810", icon: "🏪" },
    pickup: { bg: "#D4AF37", icon: "📦" },
    dropoff: { bg: "#1c1810", icon: "📍" },
    customer: { bg: "#D4AF37", icon: "🏠" },
  };
  const { bg, icon } = colors[type] || colors.store;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="56" height="72" viewBox="0 0 56 72">
      <defs>
        <filter id="markerShadow" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.3)"/>
        </filter>
      </defs>
      <g filter="url(#markerShadow)">
        <!-- Pin shape -->
        <path d="M28 2 C16 2 6 12 6 24 C6 40 28 62 28 62 C28 62 50 40 50 24 C50 12 40 2 28 2 Z" 
              fill="${bg}" stroke="#ffffff" stroke-width="2"/>
        <!-- Inner circle -->
        <circle cx="28" cy="22" r="14" fill="#ffffff"/>
        <!-- Icon text -->
        <text x="28" y="28" font-size="18" text-anchor="middle" dominant-baseline="middle">${icon}</text>
      </g>
      ${
        label
          ? `
        <rect x="4" y="58" width="48" height="18" rx="4" fill="rgba(0,0,0,0.85)"/>
        <text x="28" y="70" font-size="10" font-weight="bold" fill="white" text-anchor="middle" font-family="system-ui">${label}</text>
      `
          : ""
      }
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

// Load Google Maps script
const loadGoogleMapsScript = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve();
      return;
    }

    // Check if script already exists
    const existingScript = document.querySelector(
      `script[src*="maps.googleapis.com"]`,
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve());
      return;
    }

    window.initGoogleMapsNav = () => {
      resolve();
    };

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geometry,places&callback=initGoogleMapsNav`;
    script.async = true;
    script.defer = true;
    script.onerror = () =>
      reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(script);
  });
};

// Calculate bearing between two points
const calculateBearing = (from: Location, to: Location): number => {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  let bearing = (Math.atan2(y, x) * 180) / Math.PI;
  bearing = (bearing + 360) % 360;
  return bearing;
};

const GoogleMapsNavigation = ({
  center,
  zoom = 15,
  markers = [],
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
  mapStyle = "uber",
}: GoogleMapsNavigationProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<google.maps.Map | null>(null);
  const driverMarker = useRef<google.maps.Marker | null>(null);
  const routeRenderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const trafficLayer = useRef<google.maps.TrafficLayer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const previousDriverLocation = useRef<Location | null>(null);

  // Initialize map
  useEffect(() => {
    const initMap = async () => {
      try {
        setIsLoading(true);
        await loadGoogleMapsScript();

        if (!mapRef.current || mapInstance.current) {
          setIsLoading(false);
          return;
        }

        const styleOptions =
          mapStyle === "dark" || mapStyle === "uber"
            ? uberDarkStyle
            : lightStyle;

        const map = new google.maps.Map(mapRef.current, {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          styles: styleOptions,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: {
            position: google.maps.ControlPosition.RIGHT_CENTER,
          },
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          gestureHandling: "greedy",
          clickableIcons: false,
        });

        mapInstance.current = map;

        // Add traffic layer
        if (showTraffic) {
          trafficLayer.current = new google.maps.TrafficLayer();
          trafficLayer.current.setMap(map);
        }

        // Initialize directions renderer
        routeRenderer.current = new google.maps.DirectionsRenderer({
          suppressMarkers: true, // We use custom markers
          polylineOptions: {
            strokeColor: "#D4AF37",
            strokeOpacity: 1,
            strokeWeight: 6,
          },
        });
        routeRenderer.current.setMap(map);

        setIsLoading(false);
        setError(null);
        onMapReady?.();
      } catch (err) {
        console.error("Failed to initialize Google Maps:", err);
        setError("Failed to load map. Please check your internet connection.");
        setIsLoading(false);
      }
    };

    initMap();

    return () => {
      if (driverMarker.current) {
        driverMarker.current.setMap(null);
      }
      markersRef.current.forEach((m) => m.setMap(null));
      if (routeRenderer.current) {
        routeRenderer.current.setMap(null);
      }
      if (trafficLayer.current) {
        trafficLayer.current.setMap(null);
      }
    };
  }, []);

  // Handle driver location updates with smooth animation
  const animateDriverMarker = useCallback(
    (newPosition: Location, heading: number) => {
      if (!mapInstance.current) return;

      if (!driverMarker.current) {
        // Create driver marker
        driverMarker.current = new google.maps.Marker({
          position: { lat: newPosition.lat, lng: newPosition.lng },
          map: mapInstance.current,
          icon: {
            url: createCarIcon(heading, "#f59e0b"),
            scaledSize: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 24),
          },
          zIndex: 1000,
          title: "Driver",
        });
      } else {
        // Animate to new position
        const startPos = driverMarker.current.getPosition();
        if (startPos) {
          const startLat = startPos.lat();
          const startLng = startPos.lng();
          const deltaLat = newPosition.lat - startLat;
          const deltaLng = newPosition.lng - startLng;

          // Calculate new bearing based on movement
          let newHeading = heading;
          if (previousDriverLocation.current) {
            newHeading = calculateBearing(
              previousDriverLocation.current,
              newPosition,
            );
          }

          // Smooth animation over 1 second
          const duration = 1000;
          const startTime = performance.now();

          const animate = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease-out function for smooth deceleration
            const easeOut = 1 - Math.pow(1 - progress, 3);

            const lat = startLat + deltaLat * easeOut;
            const lng = startLng + deltaLng * easeOut;

            driverMarker.current?.setPosition({ lat, lng });

            // Update icon with new heading
            if (progress < 1) {
              requestAnimationFrame(animate);
            } else {
              // Final position - update icon
              driverMarker.current?.setIcon({
                url: createCarIcon(newHeading, "#f59e0b"),
                scaledSize: new google.maps.Size(48, 48),
                anchor: new google.maps.Point(24, 24),
              });
            }
          };

          requestAnimationFrame(animate);
        }
      }

      previousDriverLocation.current = newPosition;
    },
    [],
  );

  // Update driver location
  useEffect(() => {
    if (driverLocation) {
      animateDriverMarker(driverLocation, driverHeading);

      // Optionally pan map to follow driver
      // mapInstance.current?.panTo({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
  }, [driverLocation, driverHeading, animateDriverMarker]);

  // Calculate and display route
  useEffect(() => {
    if (!mapInstance.current || !showRoute) return;

    const origin = driverLocation || pickupLocation;
    if (!origin || !destination) return;

    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (result, status) => {
        if (status === "OK" && result && routeRenderer.current) {
          routeRenderer.current.setDirections(result);

          // Extract duration, distance, and navigation steps
          const leg = result.routes[0]?.legs[0];
          if (leg && onRouteCalculated) {
            // Parse steps for turn-by-turn navigation
            const navigationSteps: NavigationStep[] = (leg.steps || []).map(
              (step) => ({
                instruction: step.instructions || "",
                distance: step.distance?.text || "",
                duration: step.duration?.text || "",
                maneuver: step.maneuver || undefined,
                startLocation: {
                  lat: step.start_location.lat(),
                  lng: step.start_location.lng(),
                },
                endLocation: {
                  lat: step.end_location.lat(),
                  lng: step.end_location.lng(),
                },
              }),
            );

            onRouteCalculated(
              leg.duration_in_traffic?.text || leg.duration?.text || "",
              leg.distance?.text || "",
              navigationSteps,
            );
          }
        }
      },
    );
  }, [
    driverLocation,
    destination,
    pickupLocation,
    showRoute,
    onRouteCalculated,
  ]);

  // Add/update custom markers
  useEffect(() => {
    if (!mapInstance.current) return;

    // Clear existing markers
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];

    // Add destination marker
    if (destination) {
      const destMarker = new google.maps.Marker({
        position: { lat: destination.lat, lng: destination.lng },
        map: mapInstance.current,
        icon: {
          url: createLocationIcon("dropoff", "Delivery"),
          scaledSize: new google.maps.Size(56, 72),
          anchor: new google.maps.Point(28, 62),
        },
        zIndex: 100,
      });
      markersRef.current.push(destMarker);
    }

    // Add pickup location marker
    if (pickupLocation) {
      const pickupMarker = new google.maps.Marker({
        position: { lat: pickupLocation.lat, lng: pickupLocation.lng },
        map: mapInstance.current,
        icon: {
          url: createLocationIcon("pickup", "Pickup"),
          scaledSize: new google.maps.Size(56, 72),
          anchor: new google.maps.Point(28, 62),
        },
        zIndex: 99,
      });
      markersRef.current.push(pickupMarker);
    }

    // Add custom markers
    markers.forEach((m) => {
      const marker = new google.maps.Marker({
        position: { lat: m.position.lat, lng: m.position.lng },
        map: mapInstance.current!,
        icon:
          m.type === "driver"
            ? {
                url: createCarIcon(m.heading || 0, "#f59e0b"),
                scaledSize: new google.maps.Size(48, 48),
                anchor: new google.maps.Point(24, 24),
              }
            : {
                url: createLocationIcon(m.type, m.label),
                scaledSize: new google.maps.Size(56, 72),
                anchor: new google.maps.Point(28, 62),
              },
        zIndex: m.type === "driver" ? 1000 : 50,
      });

      if (m.info) {
        const infoWindow = new google.maps.InfoWindow({
          content: `<div style="padding: 8px; font-family: system-ui;"><strong>${m.label || ""}</strong><br/>${m.info}</div>`,
        });
        marker.addListener("click", () => {
          infoWindow.open(mapInstance.current!, marker);
        });
      }

      markersRef.current.push(marker);
    });
  }, [markers, destination, pickupLocation]);

  // Update map center
  useEffect(() => {
    if (mapInstance.current) {
      mapInstance.current.setCenter({ lat: center.lat, lng: center.lng });
    }
  }, [center]);

  // Handle my location button
  const handleMyLocation = useCallback(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          mapInstance.current?.panTo(pos);
          mapInstance.current?.setZoom(16);
        },
        (error) => {
          console.error("Geolocation error:", error);
        },
      );
    }
  }, []);

  // Fit bounds to show all markers
  const fitBounds = useCallback(() => {
    if (!mapInstance.current) return;

    const bounds = new google.maps.LatLngBounds();

    if (driverLocation) {
      bounds.extend({ lat: driverLocation.lat, lng: driverLocation.lng });
    }
    if (destination) {
      bounds.extend({ lat: destination.lat, lng: destination.lng });
    }
    if (pickupLocation) {
      bounds.extend({ lat: pickupLocation.lat, lng: pickupLocation.lng });
    }

    markers.forEach((m) => {
      bounds.extend({ lat: m.position.lat, lng: m.position.lng });
    });

    mapInstance.current.fitBounds(bounds, { top: 60, bottom: 60, left: 60, right: 60 } as any);
  }, [driverLocation, destination, pickupLocation, markers]);

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 bg-background flex items-center justify-center z-10">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading map...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 bg-background flex items-center justify-center z-10">
          <div className="text-center px-4">
            <p className="text-destructive font-medium mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="text-primary text-sm underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Map container */}
      <div ref={mapRef} className="w-full h-full rounded-2xl overflow-hidden" />

      {/* Map controls */}
      <div className="absolute right-3 top-3 flex flex-col gap-2 z-20">
        <button
          onClick={handleMyLocation}
          className="w-10 h-10 bg-background rounded-xl shadow-lg flex items-center justify-center hover:bg-secondary transition-colors"
          title="My Location"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <circle cx="12" cy="12" r="3" strokeWidth={2} />
            <path strokeWidth={2} d="M12 2v4m0 12v4M2 12h4m12 0h4" />
          </svg>
        </button>
        <button
          onClick={fitBounds}
          className="w-10 h-10 bg-background rounded-xl shadow-lg flex items-center justify-center hover:bg-secondary transition-colors"
          title="Fit All Markers"
        >
          <svg
            className="w-5 h-5 text-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeWidth={2}
              strokeLinecap="round"
              d="M4 8V4h4M4 16v4h4M16 4h4v4M16 20h4v-4"
            />
          </svg>
        </button>
      </div>

      {/* Attribution */}
      <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground/60 z-10">
        Map data © Google
      </div>
    </div>
  );
};

export default GoogleMapsNavigation;
