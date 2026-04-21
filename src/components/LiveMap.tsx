import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  lat: number;
  lng: number;
  label: string;
  color?: "green" | "orange" | "red" | "blue" | "gray";
  popup?: string;
}

interface LiveMapProps {
  center?: [number, number];
  zoom?: number;
  markers?: MapMarker[];
  routeCoords?: [number, number][];
  heatPoints?: { lat: number; lng: number; intensity: number }[];
  className?: string;
  height?: string;
}

const colorMap: Record<string, string> = {
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  blue: "#3b82f6",
  gray: "#9ca3af",
};

// Create larger, more visible marker icons with pulse animation for driver
const createIcon = (color: string, label?: string, isDriver?: boolean) =>
  L.divIcon({
    className: "",
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
        ${isDriver ? `<div style="position: absolute; width: 40px; height: 40px; border-radius: 50%; background: ${color}; opacity: 0.3; animation: pulse 2s infinite;"></div>` : ""}
        <div style="width: ${isDriver ? "20px" : "16px"}; height: ${isDriver ? "20px" : "16px"}; border-radius: 50%; background: ${color}; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); z-index: 10;"></div>
        ${label ? `<div style="margin-top: 4px; padding: 2px 8px; background: rgba(0,0,0,0.8); border-radius: 4px; font-size: 10px; color: white; font-weight: 600; white-space: nowrap; box-shadow: 0 1px 4px rgba(0,0,0,0.3);">${label}</div>` : ""}
      </div>
      <style>
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      </style>
    `,
    iconSize: [60, 50],
    iconAnchor: [30, 10],
  });

const LiveMap = ({
  center = [-26.1076, 28.0567], // Johannesburg
  zoom = 12,
  markers = [],
  routeCoords,
  heatPoints,
  className = "",
  height = "300px",
}: LiveMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView(center, zoom);

    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    ).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, [center, zoom]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    map.setView(center, zoom);
  }, [center, zoom]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing markers
    map.eachLayer((layer) => {
      if (
        layer instanceof L.Marker ||
        layer instanceof L.Polyline ||
        layer instanceof L.CircleMarker
      ) {
        map.removeLayer(layer);
      }
    });

    // Add markers
    markers.forEach((m) => {
      const isDriver = m.label === "You" || m.color === "green";
      const icon = createIcon(colorMap[m.color || "blue"], m.label, isDriver);
      const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
      if (m.popup)
        marker.bindPopup(
          `<div style="font-size:12px;font-weight:600">${m.label}</div><div style="font-size:11px;color:#666">${m.popup}</div>`,
        );
    });

    // Add route with animated dashed line
    if (routeCoords && routeCoords.length > 1) {
      // Add route shadow for depth
      L.polyline(routeCoords, {
        color: "#1e40af",
        weight: 6,
        opacity: 0.4,
      }).addTo(map);

      // Main route line
      L.polyline(routeCoords, {
        color: "#3b82f6",
        weight: 4,
        opacity: 0.9,
        dashArray: "12 6",
      }).addTo(map);
    }

    // Add heat circles
    if (heatPoints) {
      heatPoints.forEach((p) => {
        L.circleMarker([p.lat, p.lng], {
          radius: 6 + p.intensity * 12,
          fillColor: `hsl(${120 - p.intensity * 120}, 80%, 50%)`,
          fillOpacity: 0.35,
          stroke: false,
        }).addTo(map);
      });
    }
  }, [markers, routeCoords, heatPoints]);

  return (
    <div
      ref={mapRef}
      className={`rounded-2xl overflow-hidden border border-border ${className}`}
      style={{ height, width: "100%" }}
    />
  );
};

export default LiveMap;
