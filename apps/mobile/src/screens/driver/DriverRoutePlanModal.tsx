import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  StatusBar,
  ActivityIndicator,
} from "react-native";
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
  const addressStr =
    typeof addr === "string"
      ? addr
      : addr?.formatted_address || addr?.address || addr?.line_1 || "No address";
  const customer = addr?.recipient_name || addr?.name || "Customer";
  const coords = addr?.coordinates || addr?.location || addr?.geo;
  const lat = Number(coords?.latitude ?? coords?.lat ?? addr?.latitude ?? addr?.lat);
  const lng = Number(coords?.longitude ?? coords?.lng ?? addr?.longitude ?? addr?.lng);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
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
  const [sortMode, setSortMode] = useState<"optimal" | "scheduled">("optimal");
  const [route, setRoute] = useState<DirectionsRoute | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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

  // Compute camera bounds from stops + driver position. We include the driver
  // so the camera frames "where I am" + "where I'm going" together.
  const cameraConfig = useMemo(() => {
    if (stops.length === 0) return null;

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
  }, [stops, driverLocation, allCoordsMissing]);

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
              paddingTop: insets.top + 8,
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
              attributionEnabled
              compassEnabled
            >
              {cameraConfig?.kind === "bounds" && (
                <Mapbox.Camera
                  bounds={{
                    ne: cameraConfig.ne,
                    sw: cameraConfig.sw,
                    paddingTop: 80,
                    paddingBottom: 80,
                    paddingLeft: 60,
                    paddingRight: 60,
                  }}
                  animationMode="flyTo"
                  animationDuration={800}
                />
              )}
              {cameraConfig?.kind === "center" && (
                <Mapbox.Camera
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
                  is buggy on Android with LinearGradient). Only render when
                  coords are real; otherwise the warning overlay covers the
                  collapsed-to-fallback case. */}
              {!allCoordsMissing &&
                stops.map((stp, i) => (
                  <Mapbox.MarkerView
                    key={stp.id}
                    coordinate={[stp.longitude, stp.latitude]}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={s.markerWrap} pointerEvents="none">
                      <LinearGradient
                        colors={[...gradients.gold]}
                        style={s.markerInner}
                      >
                        <Text style={s.markerText}>{i + 1}</Text>
                      </LinearGradient>
                    </View>
                  </Mapbox.MarkerView>
                ))}

              {/* Explicit driver marker — separate from UserLocation puck so
                  the driver's position is clearly distinguishable from the
                  numbered stops even if the native location puck is hidden
                  by map style. */}
              {driverLocation && (
                <Mapbox.MarkerView
                  coordinate={[driverLocation.longitude, driverLocation.latitude]}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={s.driverMarkerWrap} pointerEvents="none">
                    <View style={s.driverMarkerRing} />
                    <View style={s.driverMarkerDot} />
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
              return (
                <View
                  key={stp.id}
                  style={[
                    s.stopCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
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
                      {stp.customer}
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
                </View>
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
  mapWrap: { height: width * 0.85, width: "100%" },
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
  markerWrap: { alignItems: "center", justifyContent: "center" },
  markerInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerText: { color: "#050403", fontWeight: "800", fontSize: 14 },
  driverMarkerWrap: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  driverMarkerRing: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(59,130,246,0.25)",
  },
  driverMarkerDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#3B82F6",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
});
