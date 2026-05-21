import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  Platform,
  ActivityIndicator,
  Animated,
  Easing,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Location from "expo-location";
import Mapbox from "@rnmapbox/maps";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";
import {
  getDrivingDirections,
  formatDistance,
  formatDuration,
  type DirectionsRoute,
} from "../../services/MapboxDirections";

type ActiveOrderLite = {
  id: string;
  order_number: string;
  total: number;
  status: string;
  delivery_address?: any;
  // Enriched by OrderContext.refreshOrders — falls back to address recipient
  // and then profile.full_name when delivery_address has no recipient set.
  customer_name?: string;
};

interface Props {
  visible: boolean;
  onClose: () => void;
  orders: ActiveOrderLite[];
}

interface Stop {
  id: string;
  order_number: string;
  total: number;
  status: string;
  customer: string;
  address: string;
  latitude: number;
  longitude: number;
  /** True when coords came from the fallback (no real geocoding on the order). */
  isFallback: boolean;
}

// Johannesburg metro fallback when no coordinates available
const FALLBACK_LAT = -26.106;
const FALLBACK_LNG = 28.0567;

const haversineKm = (
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number => {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};

const orderStopsByNearestNeighbour = (
  stops: Stop[],
  start: { latitude: number; longitude: number },
): Stop[] => {
  if (stops.length <= 1) return stops;
  const remaining = [...stops];
  const out: Stop[] = [];
  let cursor = start;
  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(cursor, remaining[i]);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    out.push(next);
    cursor = { latitude: next.latitude, longitude: next.longitude };
  }
  return out;
};

const extractStop = (o: ActiveOrderLite): Stop => {
  const addr = o.delivery_address;
  // Prefer the OrderContext-enriched customer_name (already cascades through
  // delivery_address.recipient_name → profiles.full_name). Falls back to
  // raw address fields then empty string so downstream UI can decide what
  // to render in place of a placeholder.
  const customer =
    o.customer_name || addr?.recipient_name || addr?.name || "";
  const coords = addr?.coordinates || addr?.location || addr?.geo;
  const lat = Number(coords?.latitude ?? coords?.lat ?? addr?.latitude ?? addr?.lat);
  const lng = Number(coords?.longitude ?? coords?.lng ?? addr?.longitude ?? addr?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  // Address resolution: prefer a human address; if only coords exist (test
  // data, or address was geocoded but never reverse-geocoded), show the
  // coordinates so the card doesn't read "No address" while a pin clearly
  // exists. 4dp ≈ 11m precision — enough to identify a pin without leaking
  // exact unit numbers.
  const addressFromText =
    typeof addr === "string"
      ? addr
      : addr?.formatted_address || addr?.address || addr?.line_1;
  const addressStr =
    addressFromText ||
    (hasCoords ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : "No address");
  return {
    id: o.id,
    order_number: o.order_number,
    total: o.total ?? 0,
    status: o.status,
    customer,
    address: addressStr,
    latitude: hasCoords ? lat : FALLBACK_LAT,
    longitude: hasCoords ? lng : FALLBACK_LNG,
    isFallback: !hasCoords,
  };
};

// Decide the next-action button for a stop based on order status.
// The 17-status state machine requires ready → driver_assigned → picked_up → en_route → delivered.
// Drivers must pick up from the depot before they can navigate to the customer, so a stop
// whose order is not yet picked_up routes to DriverDepotPickup, NOT DriverNavigation.
type StopAction = {
  label: string;
  icon: string;
  screen: "DriverDepotPickup" | "DriverNavigation" | "DriverDeliveryPinVerify";
  disabled?: boolean;
  hint?: string;
};

const actionForStop = (status: string): StopAction => {
  switch (status) {
    case "pending":
    case "preparing":
      return {
        label: "Awaiting Prep",
        icon: "time-outline",
        screen: "DriverDepotPickup",
        disabled: true,
        hint: "Warehouse still preparing this order",
      };
    case "ready":
    case "driver_assigned":
      return {
        label: "Go to Depot",
        icon: "business-outline",
        screen: "DriverDepotPickup",
      };
    case "picked_up":
      return {
        label: "Start Navigation",
        icon: "navigate",
        screen: "DriverNavigation",
      };
    case "en_route":
      return {
        label: "Resume Navigation",
        icon: "navigate",
        screen: "DriverNavigation",
      };
    case "arrived":
      return {
        label: "Verify Delivery PIN",
        icon: "keypad-outline",
        screen: "DriverDeliveryPinVerify",
      };
    default:
      return {
        label: "View Details",
        icon: "open-outline",
        screen: "DriverNavigation",
        disabled: true,
        hint: `Status: ${status}`,
      };
  }
};

export default function DriverRoutePlanModal({
  visible,
  onClose,
  orders,
}: Props) {
  const { colors, gradients, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  // Vehicle type for the driver puck. Falls back to "car" when no
  // driver_vehicles row exists (e.g. trial account, fresh signup).
  type VehicleType =
    | "scooter"
    | "car"
    | "bakkie"
    | "small_truck"
    | "medium_truck"
    | "large_truck";
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      // driver_vehicles → driver_profiles.user_id → auth.users.id chain.
      const { data: prof } = await supabase
        .from("driver_profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled || !prof?.id) return;
      const { data: veh } = await supabase
        .from("driver_vehicles")
        .select("vehicle_type")
        .eq("driver_id", prof.id)
        .maybeSingle();
      if (!cancelled && veh?.vehicle_type) {
        setVehicleType(veh.vehicle_type as VehicleType);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Ionicons names per vehicle. Scooter doesn't have a true match — bicycle
  // reads as a two-wheeler; bakkie + small_truck use the pickup; large
  // trucks use the lorry icon.
  const vehicleIcon = useMemo(() => {
    switch (vehicleType) {
      case "scooter":
        return "bicycle";
      case "car":
        return "car-sport";
      case "bakkie":
      case "small_truck":
        return "car";
      case "medium_truck":
      case "large_truck":
        return "bus";
      default:
        return "car-sport";
    }
  }, [vehicleType]);

  // Soft pulse animation on the driver puck — conveys "live" without a
  // heavy reanimated dependency. Loops while modal is open.
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1400,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, pulseAnim]);
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.5, 0],
  });

  // Modal with statusBarTranslucent renders behind the Android status bar,
  // and useSafeAreaInsets() inside a Modal context sometimes returns 0 for top
  // (the SafeAreaProvider tree doesn't cross the Modal boundary on Android).
  // Fall back to StatusBar.currentHeight so the title never sits under the clock.
  const topInset = Math.max(
    insets.top,
    Platform.OS === "android" ? StatusBar.currentHeight ?? 0 : 0,
  );
  const [sortMode, setSortMode] = useState<"optimal" | "scheduled">("optimal");
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Tap-to-focus state: when a stop card is tapped, pan camera to that stop
  // and highlight its marker. Tapping the same card a second time clears the
  // focus and the camera flies back to the overview bounds.
  const [focusedStopId, setFocusedStopId] = useState<string | null>(null);
  const cameraRef = useRef<Mapbox.Camera>(null);

  // Acquire driver GPS once when the modal opens. Single-shot (not watch) —
  // the modal is a planning view, not active navigation, so periodic re-fixes
  // would just churn the camera. The driver's UserLocation puck is also
  // rendered separately and stays live via the native location provider.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") return;
        const fix = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!cancelled) {
          setDriverLocation({
            latitude: fix.coords.latitude,
            longitude: fix.coords.longitude,
          });
        }
      } catch (err) {
        // Permission denied / location unavailable — silently skip, the map
        // will still render stops centred on the fallback.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const rawStops = useMemo<Stop[]>(() => orders.map(extractStop), [orders]);

  const stops = useMemo<Stop[]>(() => {
    if (sortMode === "scheduled" || rawStops.length === 0) return rawStops;
    // Anchor optimal ordering on the driver if we have their GPS, otherwise
    // anchor on the first stop (legacy behaviour).
    const anchor = driverLocation ?? rawStops[0];
    return orderStopsByNearestNeighbour(rawStops, anchor);
  }, [rawStops, sortMode, driverLocation]);

  // True when none of the stops have real coords — show a warning overlay so
  // the driver knows the map is showing the fallback location, not the actual
  // delivery destinations.
  const allCoordsMissing = useMemo(
    () => stops.length > 0 && stops.every((s) => s.isFallback),
    [stops],
  );

  // Per-stop leg distance from the previous waypoint (driver location for the
  // first stop). Haversine — same approximation we use on the dashboard cards.
  // Real route distance would need per-leg data from Directions API, which
  // would also require N waypoint calls if the optimal sort changes mid-screen.
  // Straight-line is "good enough" to help the driver plan the run.
  const legDistanceText = useMemo<(string | null)[]>(() => {
    if (allCoordsMissing) return stops.map(() => null);
    const anchor = driverLocation ?? null;
    return stops.map((s, i) => {
      const from =
        i === 0
          ? anchor
          : { latitude: stops[i - 1].latitude, longitude: stops[i - 1].longitude };
      if (!from) return null;
      const km = haversineKm(from, { latitude: s.latitude, longitude: s.longitude });
      if (km < 1) return `${Math.round(km * 1000)} m`;
      return `${km.toFixed(1)} km`;
    });
  }, [stops, driverLocation, allCoordsMissing]);

  // Fetch route from Mapbox Directions API whenever stop order changes
  useEffect(() => {
    let cancelled = false;
    if (!visible || stops.length < 2 || allCoordsMissing) {
      setRoute(null);
      return;
    }
    // If we have driver GPS, route from driver → stops, otherwise stops only.
    const waypoints = driverLocation
      ? [{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }, ...stops]
      : stops;
    setLoadingRoute(true);
    getDrivingDirections(
      waypoints.map((s) => ({ latitude: s.latitude, longitude: s.longitude })),
    )
      .then((r) => {
        if (!cancelled) setRoute(r);
      })
      .catch((err) => {
        console.warn("[RoutePlan] Directions API failed:", err.message);
        if (!cancelled) setRoute(null);
      })
      .finally(() => {
        if (!cancelled) setLoadingRoute(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, stops, driverLocation, allCoordsMissing]);

  // Compute camera config from stops + driver position + focus state.
  // Focus has priority: when a card is tapped the camera centres on that
  // stop. Otherwise we fit bounds around stops + driver, with sensible
  // fallbacks when coords collapse or are missing entirely.
  const cameraConfig = useMemo(() => {
    if (stops.length === 0) return null;

    // FOCUSED — overrides bounds. Driver tapped a sequence card.
    if (focusedStopId) {
      const focused = stops.find((s) => s.id === focusedStopId);
      if (focused && !focused.isFallback) {
        return {
          kind: "center" as const,
          center: [focused.longitude, focused.latitude] as [number, number],
          zoom: 15,
        };
      }
    }

    const lngs: number[] = [];
    const lats: number[] = [];
    if (!allCoordsMissing) {
      for (const s of stops) {
        lngs.push(s.longitude);
        lats.push(s.latitude);
      }
    }
    if (driverLocation) {
      lngs.push(driverLocation.longitude);
      lats.push(driverLocation.latitude);
    }
    // Fallback: zoom to the (possibly collapsed) fallback location at a wide
    // metro view so the warning overlay reads.
    if (lngs.length === 0) {
      return {
        kind: "center" as const,
        center: [FALLBACK_LNG, FALLBACK_LAT] as [number, number],
        zoom: 10,
      };
    }

    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const lngSpread = maxLng - minLng;
    const latSpread = maxLat - minLat;

    // Bounds collapse to a single point (≈ < 100m). Use a centred zoom instead
    // — Mapbox doesn't render bounds with zero area meaningfully.
    if (lngSpread < 0.001 && latSpread < 0.001) {
      return {
        kind: "center" as const,
        center: [
          (minLng + maxLng) / 2,
          (minLat + maxLat) / 2,
        ] as [number, number],
        zoom: 12,
      };
    }

    return {
      kind: "bounds" as const,
      ne: [maxLng, maxLat] as [number, number],
      sw: [minLng, minLat] as [number, number],
    };
  }, [stops, driverLocation, allCoordsMissing, focusedStopId]);

  // Straight-line fallback when Directions API is unavailable AND we have
  // valid coords. With missing coords, don't draw anything (would be a 0-length
  // line at the fallback point — visually useless).
  const fallbackLine = useMemo<[number, number][]>(
    () => (allCoordsMissing ? [] : stops.map((s) => [s.longitude, s.latitude])),
    [stops, allCoordsMissing],
  );
  const routeCoords = route?.geometry.coordinates ?? fallbackLine;

  const openStopAction = (stop: Stop) => {
    const action = actionForStop(stop.status);
    if (action.disabled) return;

    // Build the delivery payload — DriverDepotPickup and DriverNavigation both
    // accept this shape; DriverNavigation also accepts an explicit destination.
    const delivery = {
      id: stop.id,
      orderId: stop.id,
      orderNumber: stop.order_number,
      customerName: stop.customer,
      address: stop.address,
      total: stop.total,
      items: 0,
      coordinates: stop.isFallback
        ? undefined
        : { latitude: stop.latitude, longitude: stop.longitude },
    };

    onClose();
    if (action.screen === "DriverNavigation") {
      navigation.navigate("DriverNavigation", {
        delivery,
        orderId: stop.id,
        destination: stop.isFallback
          ? undefined
          : {
              latitude: stop.latitude,
              longitude: stop.longitude,
              label: `${stop.customer} — ${stop.order_number}`,
              address: stop.address,
            },
      });
    } else {
      navigation.navigate(action.screen, { delivery });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[s.container, { backgroundColor: colors.background.primary }]}>
        <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

        {/* Top bar */}
        <View
          style={[
            s.topBar,
            {
              paddingTop: topInset + 8,
              backgroundColor: colors.background.primary,
              borderBottomColor: colors.gold.border,
            },
          ]}
        >
          <TouchableOpacity
            onPress={onClose}
            style={s.closeBtn}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel="Close route plan"
            accessibilityRole="button"
          >
            <Icon name="close" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[s.title, { color: colors.text.primary }]}>Route Plan</Text>
            <Text style={[s.subtitle, { color: colors.gold.muted }]}>
              {stops.length} {stops.length === 1 ? "stop" : "stops"}
              {route
                ? ` · ${formatDistance(route.distance)} · ${formatDuration(route.duration)}`
                : ""}
            </Text>
          </View>
          <View
            style={[
              s.sortToggle,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.05)",
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => setSortMode("optimal")}
              style={[
                s.sortChip,
                sortMode === "optimal" && { backgroundColor: colors.gold.primary },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  s.sortChipText,
                  {
                    color:
                      sortMode === "optimal"
                        ? colors.background.primary
                        : colors.gold.muted,
                  },
                ]}
              >
                Optimal
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSortMode("scheduled")}
              style={[
                s.sortChip,
                sortMode === "scheduled" && { backgroundColor: colors.gold.primary },
              ]}
              accessibilityRole="button"
            >
              <Text
                style={[
                  s.sortChipText,
                  {
                    color:
                      sortMode === "scheduled"
                        ? colors.background.primary
                        : colors.gold.muted,
                  },
                ]}
              >
                Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Mapbox map */}
        <View style={s.mapWrap}>
          {stops.length > 0 ? (
            <Mapbox.MapView
              style={s.map}
              styleURL={
                isDark ? Mapbox.StyleURL.Dark : Mapbox.StyleURL.Street
              }
              logoEnabled={false}
              attributionEnabled={false}
              compassEnabled={false}
              scaleBarEnabled={false}
            >
              {cameraConfig?.kind === "bounds" && (
                <Mapbox.Camera
                  ref={cameraRef}
                  bounds={{
                    ne: cameraConfig.ne,
                    sw: cameraConfig.sw,
                    // Markers + distance pills extend up + down; pad generously
                    // so neither the highest stop nor the driver dot near the
                    // bottom edge gets clipped on bounds-fit zoom.
                    paddingTop: 100,
                    paddingBottom: 100,
                    paddingLeft: 80,
                    paddingRight: 80,
                  }}
                  animationMode="flyTo"
                  animationDuration={800}
                />
              )}
              {cameraConfig?.kind === "center" && (
                <Mapbox.Camera
                  ref={cameraRef}
                  centerCoordinate={cameraConfig.center}
                  zoomLevel={cameraConfig.zoom}
                  animationMode="flyTo"
                  animationDuration={800}
                />
              )}

              {/* Route polyline — only when we have real coords */}
              {!allCoordsMissing && routeCoords.length > 1 && (
                <Mapbox.ShapeSource
                  id="routeSource"
                  shape={{
                    type: "Feature",
                    properties: {},
                    geometry: {
                      type: "LineString",
                      coordinates: routeCoords,
                    },
                  }}
                >
                  <Mapbox.LineLayer
                    id="routeLine"
                    style={{
                      lineColor: colors.gold.primary,
                      lineWidth: 5,
                      lineCap: "round",
                      lineJoin: "round",
                      lineOpacity: 0.95,
                    }}
                  />
                </Mapbox.ShapeSource>
              )}

              {/* Numbered stop markers — MarkerView renders custom React views
                  reliably on both platforms (PointAnnotation's child rendering
                  is buggy on Android with LinearGradient). Number + leg
                  distance pill so the driver can read the plan at a glance:
                  "stop #2 is 1.4 km from stop #1". */}
              {!allCoordsMissing &&
                // Render focused marker LAST so it always wins z-order over
                // sibling markers when coordinates coincide (e.g. multiple
                // orders to the same address). Without this, an overlapping
                // marker hides the highlighted one.
                stops
                  .map((stp, i) => ({ stp, i }))
                  .sort((a, b) =>
                    a.stp.id === focusedStopId
                      ? 1
                      : b.stp.id === focusedStopId
                        ? -1
                        : 0,
                  )
                  .map(({ stp, i }) => {
                    const isFocused = focusedStopId === stp.id;
                    return (
                      <Mapbox.MarkerView
                        key={stp.id}
                        coordinate={[stp.longitude, stp.latitude]}
                        anchor={{ x: 0.5, y: 1 }}
                      >
                        <View style={s.markerWrap} pointerEvents="none">
                          {/* Halo ring shown only when focused — pulls the eye
                              to the selected stop without an explicit animation. */}
                          {isFocused && <View style={s.markerHalo} />}
                          <LinearGradient
                            colors={[...gradients.gold]}
                            style={[
                              s.markerInner,
                              isFocused && s.markerInnerFocused,
                            ]}
                          >
                            <Text
                              style={[
                                s.markerText,
                                isFocused && s.markerTextFocused,
                              ]}
                            >
                              {i + 1}
                            </Text>
                          </LinearGradient>
                          {legDistanceText[i] && (
                            <View style={s.markerDistancePill}>
                              <Text style={s.markerDistanceText}>
                                {legDistanceText[i]}
                              </Text>
                            </View>
                          )}
                        </View>
                      </Mapbox.MarkerView>
                    );
                  })}

              {/* Explicit driver marker — vehicle icon + soft pulse halo so
                  the puck reads as "live, this is me, in [vehicle]". Replaces
                  the generic blue dot; the native UserLocation puck below
                  still draws when permission granted (we keep both — the
                  native one updates in real-time via the GPS provider, this
                  one is the styled overlay tied to the single-shot fix). */}
              {driverLocation && (
                <Mapbox.MarkerView
                  coordinate={[driverLocation.longitude, driverLocation.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={s.driverMarkerWrap} pointerEvents="none">
                    <Animated.View
                      style={[
                        s.driverPulse,
                        {
                          transform: [{ scale: pulseScale }],
                          opacity: pulseOpacity,
                        },
                      ]}
                    />
                    <View style={s.driverVehicleChip}>
                      <Icon
                        name={vehicleIcon as any}
                        size={16}
                        color="#FFF"
                      />
                    </View>
                  </View>
                </Mapbox.MarkerView>
              )}

              <Mapbox.UserLocation visible animated showsUserHeadingIndicator />
            </Mapbox.MapView>
          ) : (
            <View
              style={[
                s.emptyMap,
                { backgroundColor: colors.background.card },
              ]}
            >
              <Icon name="map-outline" size={56} color={colors.gold.muted} />
              <Text style={[s.emptyTitle, { color: colors.text.primary }]}>
                No deliveries today
              </Text>
              <Text style={[s.emptySub, { color: colors.text.muted }]}>
                Stops will appear here when orders are assigned to you
              </Text>
            </View>
          )}
          {loadingRoute && (
            <View style={s.loadingBadge}>
              <ActivityIndicator size="small" color="#050403" />
              <Text style={s.loadingText}>Optimising route…</Text>
            </View>
          )}
          {allCoordsMissing && (
            <View style={s.warnBanner}>
              <Icon name="warning-outline" size={16} color="#050403" />
              <Text style={s.warnText}>
                Delivery addresses missing GPS coordinates — map shows fallback
                location only
              </Text>
            </View>
          )}
        </View>

        {/* Stops list */}
        <ScrollView
          style={[s.list, { backgroundColor: colors.background.secondary }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing.lg }}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[s.listHeading, { color: colors.text.primary }]}>
            Delivery sequence
          </Text>
          {stops.length === 0 ? (
            <Text
              style={[
                s.emptySub,
                {
                  color: colors.text.muted,
                  paddingHorizontal: spacing.lg,
                  paddingVertical: spacing.md,
                },
              ]}
            >
              Nothing scheduled yet.
            </Text>
          ) : (
            stops.map((stp, i) => {
              const action = actionForStop(stp.status);
              const isFocused = focusedStopId === stp.id;
              return (
                <TouchableOpacity
                  key={stp.id}
                  activeOpacity={0.85}
                  accessibilityRole="button"
                  accessibilityLabel={`Show stop ${i + 1} on map`}
                  // Tap the card body to focus / unfocus on the map. The
                  // Start-Navigation TouchableOpacity inside still fires
                  // independently — its onPress doesn't bubble.
                  onPress={() =>
                    setFocusedStopId((prev) => (prev === stp.id ? null : stp.id))
                  }
                  style={[
                    s.stopCard,
                    {
                      backgroundColor: colors.background.card,
                      // Focused card lights up its border in primary gold;
                      // unfocused stays subtle so the focused one stands out.
                      borderColor: isFocused
                        ? colors.gold.primary
                        : colors.gold.border,
                      borderWidth: isFocused ? 2 : 1,
                    },
                  ]}
                >
                  <LinearGradient colors={[...gradients.gold]} style={s.stopBadge}>
                    <Text style={s.stopBadgeText}>{i + 1}</Text>
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <View style={s.stopHeaderRow}>
                      <Text
                        style={[s.stopOrder, { color: colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {stp.order_number}
                      </Text>
                      <Text style={[s.stopTotal, { color: colors.gold.primary }]}>
                        R {stp.total.toFixed(2)}
                      </Text>
                    </View>
                    <Text
                      style={[s.stopCustomer, { color: colors.text.secondary }]}
                      numberOfLines={1}
                    >
                      {stp.customer || "Customer"}
                    </Text>
                    <Text
                      style={[s.stopAddr, { color: colors.text.muted }]}
                      numberOfLines={2}
                    >
                      {stp.address}
                    </Text>
                    {action.hint && (
                      <Text
                        style={[s.stopHint, { color: colors.text.muted }]}
                        numberOfLines={1}
                      >
                        {action.hint}
                      </Text>
                    )}
                    <TouchableOpacity
                      onPress={() => openStopAction(stp)}
                      style={[s.navBtn, action.disabled && { opacity: 0.4 }]}
                      disabled={action.disabled}
                      accessibilityRole="button"
                      accessibilityLabel={`${action.label} for ${stp.customer}`}
                    >
                      <LinearGradient
                        colors={[...gradients.gold]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={s.navBtnGradient}
                      >
                        <Icon name={action.icon as any} size={14} color="#050403" />
                        <Text style={s.navBtnText}>{action.label}</Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get("window");

const s = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: 10,
    borderBottomWidth: 1,
    gap: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "700" },
  subtitle: { fontSize: 12, marginTop: 2 },
  sortToggle: { flexDirection: "row", padding: 2, borderRadius: 18 },
  sortChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  sortChipText: { fontSize: 11, fontWeight: "700" },
  // Almost-square map gives the bounds-fit camera enough vertical room to
  // pull all stops + driver + distance labels onto one screen without the
  // padding cropping anything off. Was 0.85 — too letterbox for 3+ stops.
  mapWrap: { height: width * 1.0, width: "100%" },
  map: { width: "100%", height: "100%" },
  loadingBadge: {
    position: "absolute",
    top: 12,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(212,175,55,0.95)",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  loadingText: { color: "#050403", fontSize: 12, fontWeight: "700" },
  warnBanner: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,165,0,0.95)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  warnText: { color: "#050403", fontSize: 12, fontWeight: "700", flex: 1 },
  emptyMap: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", maxWidth: 280 },
  list: { flex: 1 },
  listHeading: {
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  stopCard: {
    flexDirection: "row",
    gap: 12,
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  stopBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBadgeText: { color: "#050403", fontWeight: "800", fontSize: 14 },
  stopHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  stopOrder: { fontSize: 14, fontWeight: "700", flex: 1, marginRight: 8 },
  stopTotal: { fontSize: 13, fontWeight: "700" },
  stopCustomer: { fontSize: 13, marginTop: 4 },
  stopAddr: { fontSize: 12, marginTop: 2 },
  stopHint: { fontSize: 11, marginTop: 4, fontStyle: "italic" },
  navBtn: { alignSelf: "flex-start", marginTop: 10, borderRadius: 18, overflow: "hidden" },
  navBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  navBtnText: { fontSize: 12, fontWeight: "800", color: "#050403" },
  markerWrap: { alignItems: "center", justifyContent: "flex-end", gap: 3 },
  markerDistancePill: {
    backgroundColor: "rgba(5,4,3,0.92)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    minWidth: 36,
    alignItems: "center",
  },
  markerDistanceText: {
    color: "#F5E6A3",
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.3,
    fontVariant: ["tabular-nums"],
  },
  markerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  // Focused marker grows + gets a darker gold outline + drop shadow so it
  // stands out from sibling markers without needing animation libs.
  markerInnerFocused: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderColor: "#050403",
    shadowColor: "#D4AF37",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 12,
    elevation: 10,
  },
  // Soft semi-transparent ring around the focused marker — visual pulse
  // without an animation, since the eye reads concentric rings as "ping".
  markerHalo: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(212,175,55,0.22)",
    borderWidth: 1,
    borderColor: "rgba(212,175,55,0.55)",
    top: -10,
  },
  markerText: { color: "#050403", fontWeight: "800", fontSize: 14 },
  markerTextFocused: { fontSize: 18 },
  driverMarkerWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  // Soft expanding halo that pulses to show the driver is live.
  driverPulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
  },
  // Solid chip with the vehicle icon — reads as "the driver is here, in X".
  driverVehicleChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    // Lifts the chip above the pulsing halo.
    elevation: 4,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
});
