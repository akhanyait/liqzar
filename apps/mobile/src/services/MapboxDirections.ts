/**
 * MapboxDirections — thin wrapper around Mapbox Directions API.
 *
 * We avoid pulling the full Mapbox Navigation SDK (commercial, heavy) and
 * instead use the public Directions API + @rnmapbox/maps for rendering. This
 * gives us Uber-style in-app turn-by-turn at zero per-route licensing cost,
 * within the generous Directions API free tier (100k requests/month).
 */
import Constants from "expo-constants";

const ACCESS_TOKEN =
  Constants.expoConfig?.extra?.mapboxAccessToken ?? "";

export interface DirectionsCoordinate {
  longitude: number;
  latitude: number;
}

export interface DirectionsStep {
  /** Distance for this maneuver, metres */
  distance: number;
  /** Time for this maneuver, seconds */
  duration: number;
  /** Plain-English instruction ("Turn left onto Main Rd") */
  instruction: string;
  /** Maneuver type — used to pick an arrow icon */
  maneuverType: string;
  /** Modifier — direction of turn */
  maneuverModifier?: string;
  /** Coordinates of this segment as [lng, lat] */
  geometry: [number, number][];
}

export interface DirectionsRoute {
  /** GeoJSON LineString geometry — render with ShapeSource on Mapbox */
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  /** Total distance, metres */
  distance: number;
  /** Total duration, seconds */
  duration: number;
  /** All maneuver steps */
  steps: DirectionsStep[];
}

const PROFILE = "driving-traffic";

export class MapboxDirectionsError extends Error {
  constructor(message: string, public code?: string, public mapboxCode?: string) {
    super(message);
    this.name = "MapboxDirectionsError";
  }
}

/**
 * Translate a Directions API error into a single-sentence user-facing string.
 * Falls back to the raw error message for unknown codes so we never lose info.
 */
export function friendlyDirectionsError(err: unknown): string {
  if (err instanceof MapboxDirectionsError) {
    // mapboxCode comes from the API response body's "code" field.
    switch (err.mapboxCode) {
      case "InvalidInput":
        // Most common in-the-wild cause: route exceeds the ~10 000 km cap,
        // which happens when the driver's GPS is far from the destination
        // (e.g. emulator default location). Surface that concretely.
        if (err.message.toLowerCase().includes("maximum distance")) {
          return "You're too far from the destination to compute an in-app route. Open in external Maps instead.";
        }
        return "Could not compute a route — please check the destination address.";
      case "NoRoute":
        return "No driving route exists between these points.";
      case "NoSegment":
        return "Couldn't snap your location to a road. Move slightly and try again.";
      case "ProfileNotFound":
        return "Routing profile unavailable.";
      case "InvalidToken":
      case "TokenRequired":
        return "Mapbox token rejected. Check MAPBOX_ACCESS_TOKEN in EAS env.";
      case "Forbidden":
        return "Mapbox token doesn't have permission for the Directions API.";
    }
    // HTTP-level (no mapboxCode)
    if (err.code === "429") return "Too many routing requests — try again in a moment.";
    if (err.code === "401" || err.code === "403") return "Mapbox token rejected. Check token + scopes.";
    if (err.code && err.code.startsWith("5")) return "Mapbox routing service is temporarily unavailable.";
    return `Routing failed (${err.code ?? "error"}).`;
  }
  // Generic / network error
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("Network request failed") || msg.includes("ENOTFOUND")) {
    return "No internet connection — routing is offline.";
  }
  return "Routing failed. Try again.";
}

/**
 * Get driving directions between an ordered list of waypoints.
 * Returns null when no token is configured (so callers can fall back to a
 * straight polyline rather than crashing).
 */
export async function getDrivingDirections(
  waypoints: DirectionsCoordinate[],
): Promise<DirectionsRoute | null> {
  if (!ACCESS_TOKEN) {
    console.warn("[MapboxDirections] No MAPBOX_ACCESS_TOKEN configured");
    return null;
  }
  if (waypoints.length < 2) {
    return null;
  }

  const coordinates = waypoints
    .map((c) => `${c.longitude},${c.latitude}`)
    .join(";");
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/${PROFILE}/${coordinates}` +
    `?geometries=geojson` +
    `&overview=full` +
    `&steps=true` +
    `&access_token=${ACCESS_TOKEN}`;

  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    // Mapbox returns errors as JSON: {"code":"InvalidInput","message":"..."}
    // Extract the structured code so friendlyDirectionsError() can map it,
    // and surface the human message verbatim in the Error's .message field
    // (callers that don't translate get something readable already).
    let mapboxCode: string | undefined;
    let mapboxMsg = body.slice(0, 200);
    try {
      const parsed = JSON.parse(body);
      mapboxCode = parsed?.code;
      if (parsed?.message) mapboxMsg = parsed.message;
    } catch {
      // Body wasn't JSON — fall back to the truncated raw text.
    }
    throw new MapboxDirectionsError(mapboxMsg, String(res.status), mapboxCode);
  }

  const json = await res.json();
  if (!json?.routes?.[0]) {
    return null;
  }

  const r = json.routes[0];
  const steps: DirectionsStep[] = (r.legs ?? []).flatMap((leg: any) =>
    (leg.steps ?? []).map((s: any) => ({
      distance: s.distance ?? 0,
      duration: s.duration ?? 0,
      instruction:
        s.maneuver?.instruction ??
        s.name ??
        "Continue",
      maneuverType: s.maneuver?.type ?? "continue",
      maneuverModifier: s.maneuver?.modifier,
      geometry: s.geometry?.coordinates ?? [],
    })),
  );

  return {
    geometry: r.geometry,
    distance: r.distance ?? 0,
    duration: r.duration ?? 0,
    steps,
  };
}

/** Format a distance in metres for display. */
export const formatDistance = (m: number): string => {
  if (!Number.isFinite(m) || m <= 0) return "—";
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
};

/** Format a duration in seconds for display. */
export const formatDuration = (s: number): string => {
  if (!Number.isFinite(s) || s <= 0) return "—";
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
};

/** Pick an icon name (Ionicons) for a maneuver. Used by the next-step UI. */
export const maneuverIcon = (type: string, modifier?: string): string => {
  const m = modifier ?? "";
  if (type === "depart" || type === "arrive") return "flag-outline";
  if (type === "roundabout" || type === "rotary") return "sync-outline";
  if (type === "merge") return "git-merge-outline";
  if (type === "fork") return "git-branch-outline";
  if (m.includes("uturn")) return "return-up-back-outline";
  if (m.includes("sharp left") || m.includes("left")) return "arrow-back-outline";
  if (m.includes("sharp right") || m.includes("right")) return "arrow-forward-outline";
  return "arrow-up-outline";
};
