import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  PointAnnotation,
  UserLocation,
  StyleURL,
} from "@rnmapbox/maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { borderRadius } from "../../theme";
import {
  getDrivingDirections,
  formatDistance,
  formatDuration,
  maneuverIcon,
  type DirectionsRoute,
  type DirectionsStep,
} from "../../services/MapboxDirections";

// Haversine distance in metres.
function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Single LIQZAR depot for now. When multi-depot is introduced this should
// come from app config or the order record (e.g. order.fulfillment_depot_id
// resolved against a depots table).
const DEPOT = {
  name: "LIQZAR Central Depot",
  address: "12 Buitengracht St, Cape Town, 8001",
  latitude: -33.9215,
  longitude: 18.4184,
};

export default function DriverDepotPickup() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();

  const cameraRef = useRef<Camera>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  const delivery = route.params?.delivery;

  // Live driver GPS — same pattern as DriverNavigation.
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  } | null>(null);
  const [locDenied, setLocDenied] = useState(false);

  // Mapbox Directions state.
  const [directions, setDirections] = useState<DirectionsRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // Initial GPS fix.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setLocDenied(true);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;
        setDriverLocation({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          heading: loc.coords.heading ?? undefined,
        });
      } catch (e) {
        console.warn("[DriverDepotPickup] initial location error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Continuously watch position once navigating.
  useEffect(() => {
    if (!navigating) return;
    let cancelled = false;
    (async () => {
      try {
        const sub = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 5,
            timeInterval: 2000,
          },
          (loc) => {
            if (cancelled) return;
            setDriverLocation({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading ?? undefined,
            });
          },
        );
        watchSub.current = sub;
      } catch (e) {
        console.warn("[DriverDepotPickup] watchPosition failed", e);
      }
    })();
    return () => {
      cancelled = true;
      watchSub.current?.remove();
      watchSub.current = null;
    };
  }, [navigating]);

  // Re-fetch route on ~100m movement (rounded), not every GPS tick.
  const routeAnchorKey = driverLocation
    ? `${Math.round(driverLocation.latitude * 1000)},${Math.round(driverLocation.longitude * 1000)}`
    : null;

  // Fetch Mapbox Directions driver → depot.
  useEffect(() => {
    if (!driverLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getDrivingDirections([
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: DEPOT.latitude, longitude: DEPOT.longitude },
        ]);
        if (cancelled) return;
        if (r) {
          setDirections(r);
          setRouteError(null);
        } else {
          setRouteError("No route available");
        }
      } catch (e: any) {
        if (cancelled) return;
        console.warn("[DriverDepotPickup] directions error", e);
        setRouteError(e?.message ?? "Routing failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigating, routeAnchorKey]);

  // Auto-advance step when within 30m of the step end.
  useEffect(() => {
    if (!navigating || !driverLocation || !directions) return;
    const step = directions.steps[currentStepIdx];
    if (!step || !step.geometry.length) return;
    const lastCoord = step.geometry[step.geometry.length - 1];
    const endPoint = { latitude: lastCoord[1], longitude: lastCoord[0] };
    const d = distanceMeters(driverLocation, endPoint);
    if (d < 30) {
      if (currentStepIdx < directions.steps.length - 1) {
        setCurrentStepIdx((i) => i + 1);
      } else {
        // Last step — auto-arrive when within 40m of the depot.
        const arrivalDist = distanceMeters(driverLocation, DEPOT);
        if (arrivalDist < 40) setArrived(true);
      }
    }
  }, [driverLocation, navigating, directions, currentStepIdx]);

  const handleStartNavigation = useCallback(() => {
    if (!driverLocation) {
      Alert.alert(
        "Location Required",
        "We need your GPS location to navigate to the depot. Please enable location access in Settings.",
      );
      return;
    }
    setNavigating(true);
    setCurrentStepIdx(0);
    setArrived(false);
    // Camera → follow mode.
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: 17,
      pitch: 55,
      heading: driverLocation.heading ?? 0,
      animationDuration: 800,
    });
  }, [driverLocation]);

  const handleRecenter = useCallback(() => {
    if (!driverLocation) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: navigating ? 17 : 14,
      pitch: navigating ? 55 : 0,
      heading: navigating ? (driverLocation.heading ?? 0) : 0,
      animationDuration: 600,
    });
  }, [driverLocation, navigating]);

  const handleFitRoute = useCallback(() => {
    if (!directions || !driverLocation) return;
    const coords = directions.geometry.coordinates;
    let minLng = coords[0][0], maxLng = coords[0][0];
    let minLat = coords[0][1], maxLat = coords[0][1];
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    cameraRef.current?.fitBounds(
      [minLng, minLat],
      [maxLng, maxLat],
      [140, 60, 320, 60],
      900,
    );
  }, [directions, driverLocation]);

  // Frame the whole route once on first load.
  useEffect(() => {
    if (directions && !navigating) handleFitRoute();
  }, [directions, navigating, handleFitRoute]);

  const handleArrivedConfirm = useCallback(() => {
    navigation.navigate("DriverScanVerify", { delivery });
  }, [navigation, delivery]);

  // Display values from real Mapbox data.
  const remainingDistText = directions ? formatDistance(directions.distance) : "—";
  const etaText = directions ? formatDuration(directions.duration) : "—";
  const currentStep: DirectionsStep | undefined = directions?.steps[currentStepIdx];
  const nextStep: DirectionsStep | undefined = directions?.steps[currentStepIdx + 1];

  const routeFeature = useMemo(() => {
    if (!directions) return null;
    return {
      type: "Feature" as const,
      properties: {},
      geometry: directions.geometry,
    };
  }, [directions]);

  const centerCoord: [number, number] = driverLocation
    ? [driverLocation.longitude, driverLocation.latitude]
    : [DEPOT.longitude, DEPOT.latitude];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Full-screen Mapbox map */}
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={isDark ? StyleURL.Dark : StyleURL.Street}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        scaleBarEnabled={false}
        pitchEnabled
        rotateEnabled
      >
        <Camera
          ref={cameraRef}
          defaultSettings={{
            centerCoordinate: centerCoord,
            zoomLevel: 13,
          }}
        />

        {/* Live driver puck */}
        {!locDenied && (
          <UserLocation
            visible
            showsUserHeadingIndicator
            androidRenderMode="gps"
          />
        )}

        {/* Route polyline — blue, double-layered for outline */}
        {routeFeature && (
          <ShapeSource id="depotRouteSource" shape={routeFeature as any}>
            <LineLayer
              id="depotRouteOutline"
              style={{
                lineColor: "#1E40AF",
                lineWidth: 9,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.9,
              }}
            />
            <LineLayer
              id="depotRouteLine"
              style={{
                lineColor: "#3B82F6",
                lineWidth: 6,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
        )}

        {/* Depot pin */}
        <PointAnnotation
          id="depot"
          coordinate={[DEPOT.longitude, DEPOT.latitude]}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={st.depotMarkerWrap}>
            <LinearGradient
              colors={[colors.status.info, "#2563EB"]}
              style={st.depotMarkerPin}
            >
              <Icon name="business" size={16} color={colors.white} />
            </LinearGradient>
            <View style={st.depotMarkerArrow} />
          </View>
        </PointAnnotation>
      </MapView>

      {/* Top bar: Back + ETA + Recenter */}
      <View style={[st.topBar, { top: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <View
            style={[
              st.topBtn,
              {
                backgroundColor: isDark ? "rgba(5,4,3,0.85)" : "rgba(255,255,255,0.92)",
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </View>
        </TouchableOpacity>

        <View
          style={[
            st.etaBanner,
            {
              backgroundColor: isDark ? "rgba(5,4,3,0.85)" : "rgba(255,255,255,0.92)",
              borderColor: colors.gold.border,
            },
          ]}
        >
          <Icon name="time-outline" size={16} color={colors.status.info} />
          <Text style={[st.etaText, { color: colors.text.primary }]}>{etaText}</Text>
          <View style={[st.etaDivider, { backgroundColor: colors.gold.border }]} />
          <Icon name="navigate-outline" size={16} color={colors.status.info} />
          <Text style={[st.etaText, { color: colors.text.primary }]}>{remainingDistText}</Text>
        </View>

        <TouchableOpacity onPress={handleRecenter}>
          <View
            style={[
              st.topBtn,
              {
                backgroundColor: isDark ? "rgba(5,4,3,0.85)" : "rgba(255,255,255,0.92)",
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Icon name="locate-outline" size={22} color={colors.status.info} />
          </View>
        </TouchableOpacity>
      </View>

      {/* Permission warning */}
      {locDenied && (
        <View
          style={[
            st.warningBanner,
            { top: insets.top + 66, backgroundColor: "#F59E0B" },
          ]}
        >
          <Icon name="warning-outline" size={18} color="#000" />
          <Text style={st.warningText}>
            Location access denied — enable it in Settings to navigate to the depot.
          </Text>
        </View>
      )}

      {/* Routing error banner */}
      {routeError && !locDenied && (
        <View
          style={[
            st.warningBanner,
            { top: insets.top + 66, backgroundColor: "#EF4444" },
          ]}
        >
          <Icon name="alert-circle-outline" size={18} color="#FFF" />
          <Text style={[st.warningText, { color: "#FFF" }]}>
            Routing unavailable — {routeError}
          </Text>
        </View>
      )}

      {/* Turn-by-turn card */}
      {navigating && !arrived && currentStep && (
        <View
          style={[
            st.directionCard,
            { top: insets.top + 66 },
            {
              backgroundColor: isDark ? "rgba(13,11,8,0.95)" : "rgba(255,255,255,0.97)",
              borderColor: colors.gold.border,
            },
          ]}
        >
          <View style={[st.dirIcon, { backgroundColor: colors.status.info + "18" }]}>
            <Icon
              name={maneuverIcon(currentStep.maneuverType, currentStep.maneuverModifier) as any}
              size={26}
              color={colors.status.info}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.dirInstruction, { color: colors.text.primary }]} numberOfLines={2}>
              {currentStep.instruction}
            </Text>
            <Text style={{ color: colors.text.dim, fontSize: 13 }}>
              {formatDistance(currentStep.distance)}
              {nextStep ? `  •  then ${nextStep.instruction.split(" ").slice(0, 4).join(" ")}…` : ""}
            </Text>
          </View>
        </View>
      )}

      {/* Arrived banner */}
      {arrived && (
        <View
          style={[
            st.arrivedBanner,
            { top: insets.top + 66, backgroundColor: "rgba(16,185,129,0.95)" },
          ]}
        >
          <Icon name="checkmark-circle" size={22} color={colors.white} />
          <Text style={st.arrivedText}>You've arrived at the depot</Text>
        </View>
      )}

      {/* Bottom card */}
      <View
        style={[
          st.bottomCard,
          {
            backgroundColor: isDark ? "rgba(13,11,8,0.97)" : "rgba(255,255,255,0.98)",
            borderColor: colors.gold.border,
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        {/* Depot info row */}
        <View style={st.depotRow}>
          <View style={[st.depotIconCircle, { backgroundColor: colors.status.info + "18" }]}>
            <Icon name="business-outline" size={22} color={colors.status.info} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.depotName, { color: colors.text.primary }]}>
              {DEPOT.name}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>
              {DEPOT.address}
            </Text>
          </View>
          {delivery?.orderNumber && (
            <View style={[st.orderBadge, { backgroundColor: colors.gold.primary + "18" }]}>
              <Text style={{ color: colors.gold.primary, fontSize: 12, fontWeight: "800" }}>
                #{delivery.orderNumber}
              </Text>
            </View>
          )}
        </View>

        {/* Order summary strip */}
        <View
          style={[
            st.orderStrip,
            {
              backgroundColor: isDark ? "rgba(212,175,55,0.06)" : "rgba(212,175,55,0.04)",
              borderColor: colors.gold.border,
            },
          ]}
        >
          <View style={st.stripItem}>
            <Icon name="cube-outline" size={14} color={colors.text.dim} />
            <Text style={{ color: colors.text.dim, fontSize: 12 }}>
              {delivery?.items || 0} items
            </Text>
          </View>
          <View style={st.stripItem}>
            <Icon name="person-outline" size={14} color={colors.text.dim} />
            <Text style={{ color: colors.text.dim, fontSize: 12 }}>
              {delivery?.customerName || "Customer"}
            </Text>
          </View>
          <Text
            style={{ color: colors.gold.primary, fontWeight: "800", fontSize: 15, marginLeft: "auto" }}
          >
            R{delivery?.total ? Math.round(delivery.total).toLocaleString('en-ZA') : "0"}
          </Text>
        </View>

        {/* Primary action */}
        {!navigating && !arrived && (
          <TouchableOpacity onPress={handleStartNavigation} activeOpacity={0.85} disabled={!driverLocation}>
            <LinearGradient
              colors={
                driverLocation
                  ? [colors.status.info, "#2563EB"]
                  : ["#9CA3AF", "#6B7280"]
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="navigate" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>
                {driverLocation ? "Start Navigation to Depot" : "Getting GPS fix…"}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {navigating && !arrived && (
          <TouchableOpacity onPress={handleRecenter} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.status.info, "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="locate-outline" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>Recenter on me</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {arrived && (
          <TouchableOpacity onPress={handleArrivedConfirm} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.status.success, "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="scan-outline" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>Arrived — Scan & Verify Items</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  topBar: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    zIndex: 10,
  },
  topBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  etaBanner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
  },
  etaText: { fontSize: 14, fontWeight: "700" },
  etaDivider: { width: 1, height: 18, marginHorizontal: 4 },
  depotMarkerWrap: { alignItems: "center" },
  depotMarkerPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  depotMarkerArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#2563EB",
    marginTop: -2,
  },
  directionCard: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    gap: 12,
    zIndex: 10,
  },
  dirIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  dirInstruction: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  warningBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    zIndex: 9,
  },
  warningText: { color: "#000", fontSize: 13, fontWeight: "600", flex: 1 },
  arrivedBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    zIndex: 9,
  },
  arrivedText: { color: "#FFF", fontSize: 14, fontWeight: "800", flex: 1 },
  bottomCard: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    padding: 20,
  },
  depotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  depotIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  depotName: { fontSize: 16, fontWeight: "800", marginBottom: 1 },
  orderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
  },
  orderStrip: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 14,
    marginBottom: 14,
  },
  stripItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  primaryBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  primaryBtnText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
});
