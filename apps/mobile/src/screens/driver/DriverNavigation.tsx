import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Linking,
  Animated,
  Easing,
} from "react-native";
import {
  MapView,
  Camera,
  ShapeSource,
  LineLayer,
  MarkerView,
  UserLocation,
  StyleURL,
} from "@rnmapbox/maps";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { borderRadius } from "../../theme";
import {
  getDrivingDirections,
  formatDistance,
  formatDuration,
  maneuverIcon,
  friendlyDirectionsError,
  type DirectionsRoute,
  type DirectionsStep,
} from "../../services/MapboxDirections";

// Haversine distance in metres between two [lng, lat] points.
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

// Cape Town fallback when an order has no coordinates (shouldn't happen in prod,
// but avoids crashing the screen on legacy data).
const FALLBACK_DEST = { latitude: -33.9249, longitude: 18.4241 };

type VehicleType =
  | "scooter"
  | "car"
  | "bakkie"
  | "small_truck"
  | "medium_truck"
  | "large_truck";

const vehicleIconName = (t: VehicleType): string => {
  switch (t) {
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
};

export default function DriverNavigation() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { markEnRoute, updateOrderStatus, activeOrders } = useOrders();
  const { user } = useAuth();

  const cameraRef = useRef<Camera>(null);
  const watchSub = useRef<Location.LocationSubscription | null>(null);

  // Vehicle-aware driver puck (matches DepotPickup + RoutePlanModal).
  const [vehicleType, setVehicleType] = useState<VehicleType>("car");
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
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

  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
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
  }, [pulseAnim]);
  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.4],
  });
  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 0.5, 0],
  });

  // ── Resolve payload — two shapes:
  //   1. RoutePlanModal: { destination: { latitude, longitude, label, address }, orderId }
  //   2. Other callers:  { delivery: { ... } }
  const params = route.params || {};
  const delivery = params.delivery;
  const explicitDest = params.destination;
  const orderId: string | undefined = params.orderId || delivery?.orderId || delivery?.id;

  // Pull the live order from context to extract coordinates when only an id is passed.
  const orderRecord = useMemo(
    () => (orderId ? activeOrders.find((o) => o.id === orderId) : undefined),
    [activeOrders, orderId],
  );
  const addrCoords = (orderRecord as any)?.delivery_address?.coordinates;
  const destination = useMemo(() => {
    if (explicitDest?.latitude && explicitDest?.longitude) {
      return {
        latitude: explicitDest.latitude,
        longitude: explicitDest.longitude,
        label: explicitDest.label || delivery?.customerName || "Customer",
        address: explicitDest.address || delivery?.address || "",
      };
    }
    if (addrCoords?.lat && addrCoords?.lng) {
      return {
        latitude: addrCoords.lat,
        longitude: addrCoords.lng,
        label: delivery?.customerName || "Customer",
        address: delivery?.address || "",
      };
    }
    return {
      ...FALLBACK_DEST,
      label: delivery?.customerName || "Customer",
      address: delivery?.address || "Destination",
    };
  }, [explicitDest, addrCoords, delivery]);

  const customerName = delivery?.customerName || explicitDest?.label || "Customer";
  const customerPhone = delivery?.customerPhone || "";
  const orderNumber = delivery?.orderNumber || orderRecord?.order_number || "";
  const orderItems = delivery?.items ?? (orderRecord as any)?.order_items?.length ?? 0;
  const orderTotal = delivery?.total ?? orderRecord?.total ?? 0;

  // Order status gate. The 17-status state machine requires:
  //   ready → driver_assigned → picked_up → en_route → arrived → delivered
  // Start Navigation transitions picked_up → en_route, so we have to block it
  // when the order isn't picked up yet — otherwise the DB rejects the jump
  // (e.g. ready → en_route) and surfaces "Status Update Failed" to the driver.
  //
  // When orderRecord is missing (legacy callers that only pass an explicit
  // destination without an orderId, or destinations with no DB record), fall
  // back to the unguarded flow. The state-machine check is a no-op there.
  const orderStatus = orderRecord?.status as string | undefined;
  type NavMode = "start" | "resume" | "needs_pickup" | "needs_pin" | "unknown";
  const navMode: NavMode = useMemo(() => {
    if (!orderId || !orderStatus) return "start";
    switch (orderStatus) {
      case "picked_up":
        return "start";
      case "en_route":
        return "resume";
      case "ready":
      case "driver_assigned":
      case "preparing":
      case "pending":
        return "needs_pickup";
      case "arrived":
        return "needs_pin";
      default:
        return "unknown";
    }
  }, [orderId, orderStatus]);

  const goToDepotPickup = useCallback(() => {
    navigation.replace("DriverDepotPickup", {
      delivery: {
        ...(delivery || {}),
        id: orderId,
        orderId,
        orderNumber,
        customerName,
        address: destination.address,
        total: orderTotal,
        items: orderItems,
      },
    });
  }, [navigation, delivery, orderId, orderNumber, customerName, destination.address, orderTotal, orderItems]);

  const goToDeliveryPin = useCallback(() => {
    navigation.replace("DriverDeliveryPinVerify", {
      delivery: {
        ...(delivery || {}),
        orderId,
        orderNumber,
        customerName,
        customerPhone,
        address: destination.address,
        total: orderTotal,
        items: orderItems,
      },
    });
  }, [navigation, delivery, orderId, orderNumber, customerName, customerPhone, destination.address, orderTotal, orderItems]);

  // ── Live driver location
  const [driverLocation, setDriverLocation] = useState<{
    latitude: number;
    longitude: number;
    heading?: number;
  } | null>(null);
  const [locDenied, setLocDenied] = useState(false);

  // ── Mapbox Directions state
  const [directions, setDirections] = useState<DirectionsRoute | null>(null);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [navigating, setNavigating] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [currentStepIdx, setCurrentStepIdx] = useState(0);

  // 1) Get an initial location fix immediately, then start watching.
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
        console.warn("[DriverNavigation] initial location error", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // 2) Continuously watch position once we're in navigating mode.
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
        console.warn("[DriverNavigation] watchPosition failed", e);
      }
    })();
    return () => {
      cancelled = true;
      watchSub.current?.remove();
      watchSub.current = null;
    };
  }, [navigating]);

  // Re-fetch the route on ~100m driver movement (rounded) — not every GPS tick,
  // which would burn through the Directions API free tier.
  const routeAnchorKey = driverLocation
    ? `${Math.round(driverLocation.latitude * 1000)},${Math.round(driverLocation.longitude * 1000)}`
    : null;

  // 3) Fetch route from Mapbox Directions whenever we have both endpoints.
  useEffect(() => {
    if (!driverLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getDrivingDirections([
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          { latitude: destination.latitude, longitude: destination.longitude },
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
        console.warn("[DriverNavigation] directions error", e);
        setRouteError(friendlyDirectionsError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigating, destination.latitude, destination.longitude, routeAnchorKey]);

  // 4) Auto-advance step when driver gets within 30m of the step end point.
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
        // Last step — check arrival at destination
        const arrivalDist = distanceMeters(driverLocation, destination);
        if (arrivalDist < 40) setArrived(true);
      }
    }
  }, [driverLocation, navigating, directions, currentStepIdx, destination]);

  const handleStartNavigation = async () => {
    if (!driverLocation) {
      Alert.alert(
        "Location Required",
        "We need your GPS location to start turn-by-turn navigation. Please enable location access in Settings.",
      );
      return;
    }
    setNavigating(true);
    setCurrentStepIdx(0);
    setArrived(false);

    // Only transition picked_up → en_route. In "resume" mode the order is
    // already en_route (driver re-opened nav after backgrounding the app) so
    // the transition would be invalid; just kick off in-app nav. In any other
    // mode the Start button shouldn't have been rendered — guard anyway.
    if (orderId && navMode === "start") {
      const eta = directions ? Math.max(1, Math.round(directions.duration / 60)) : 10;
      try {
        await markEnRoute(orderId, eta);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn("[DriverNavigation] markEnRoute failed:", message);
      }
    }

    // Switch camera to follow mode
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: 17,
      pitch: 55,
      heading: driverLocation.heading ?? 0,
      animationDuration: 800,
    });
  };

  const handleRecenter = () => {
    if (!driverLocation) return;
    cameraRef.current?.setCamera({
      centerCoordinate: [driverLocation.longitude, driverLocation.latitude],
      zoomLevel: navigating ? 17 : 14,
      pitch: navigating ? 55 : 0,
      heading: navigating ? (driverLocation.heading ?? 0) : 0,
      animationDuration: 600,
    });
  };

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

  // Fit route once on first load.
  useEffect(() => {
    if (directions && !navigating) handleFitRoute();
  }, [directions, navigating, handleFitRoute]);

  const handleCallCustomer = () => {
    if (!customerPhone) {
      Alert.alert("No Phone Number", "Customer phone number is not available.");
      return;
    }
    const telUrl = `tel:${customerPhone}`;
    Linking.canOpenURL(telUrl)
      .then((supported) =>
        supported
          ? Linking.openURL(telUrl)
          : Alert.alert("Cannot Place Call", `Unable to open dialer for ${customerPhone}.`),
      )
      .catch(() =>
        Alert.alert("Cannot Place Call", `Unable to open dialer for ${customerPhone}.`),
      );
  };

  const handleDelivered = () => {
    navigation.navigate("DriverDeliveryPinVerify", {
      delivery: { ...(delivery || {}), orderId, customerName, customerPhone, address: destination.address, orderNumber, total: orderTotal, items: orderItems },
    });
  };

  const handleReportIssue = () => {
    Alert.alert(
      "Report Issue",
      "What problem are you experiencing?",
      [
        {
          text: "Vehicle Breakdown",
          style: "destructive",
          onPress: async () => {
            try {
              if (orderId) await updateOrderStatus(orderId, "delivery_failed", { reason: "Vehicle Breakdown" });
            } catch (e) {
              console.warn("[DriverNavigation] updateOrderStatus failed:", e);
            }
            Alert.alert("Issue Reported", "Dispatch has been notified of your vehicle breakdown.");
            navigation.goBack();
          },
        },
        {
          text: "Road Blocked",
          onPress: async () => {
            try {
              if (orderId) await updateOrderStatus(orderId, "delivery_failed", { reason: "Road Blocked" });
            } catch (e) {
              console.warn("[DriverNavigation] updateOrderStatus failed:", e);
            }
            Alert.alert("Issue Reported", "Dispatch has been notified of the road blockage.");
            navigation.goBack();
          },
        },
        {
          text: "Emergency",
          style: "destructive",
          onPress: async () => {
            try {
              if (orderId) await updateOrderStatus(orderId, "delivery_failed", { reason: "Emergency" });
            } catch (e) {
              console.warn("[DriverNavigation] updateOrderStatus failed:", e);
            }
            Alert.alert("Issue Reported", "Dispatch has been notified of your emergency.");
            navigation.goBack();
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  // Derived display values pulled from real directions data when available.
  const remainingDistText = directions ? formatDistance(directions.distance) : "—";
  const etaText = directions ? formatDuration(directions.duration) : "—";
  const currentStep: DirectionsStep | undefined = directions?.steps[currentStepIdx];
  const nextStep: DirectionsStep | undefined = directions?.steps[currentStepIdx + 1];

  // GeoJSON for the route polyline.
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
    : [destination.longitude, destination.latitude];

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
            zoomLevel: 14,
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

        {/* Route polyline */}
        {routeFeature && (
          <ShapeSource id="routeSource" shape={routeFeature as any}>
            <LineLayer
              id="routeOutline"
              style={{
                lineColor: "#1E40AF",
                lineWidth: 9,
                lineCap: "round",
                lineJoin: "round",
                lineOpacity: 0.9,
              }}
            />
            <LineLayer
              id="routeLine"
              style={{
                lineColor: "#3B82F6",
                lineWidth: 6,
                lineCap: "round",
                lineJoin: "round",
              }}
            />
          </ShapeSource>
        )}

        {/* Customer destination pin — MarkerView for reliable Android render */}
        <MarkerView
          coordinate={[destination.longitude, destination.latitude]}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={st.customerMarkerWrap} pointerEvents="none">
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              style={st.customerPin}
            >
              <Icon name="person" size={16} color={colors.white} />
            </LinearGradient>
            <View style={st.customerPinArrow} />
          </View>
        </MarkerView>

        {/* Vehicle-aware driver chip — same treatment as DepotPickup */}
        {driverLocation && (
          <MarkerView
            coordinate={[driverLocation.longitude, driverLocation.latitude]}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={st.driverMarkerWrap} pointerEvents="none">
              <Animated.View
                style={[
                  st.driverPulse,
                  {
                    transform: [{ scale: pulseScale }],
                    opacity: pulseOpacity,
                  },
                ]}
              />
              <View style={st.driverVehicleChip}>
                <Icon
                  name={vehicleIconName(vehicleType) as any}
                  size={16}
                  color="#FFF"
                />
              </View>
            </View>
          </MarkerView>
        )}
      </MapView>

      {/* Top bar */}
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

        <TouchableOpacity onPress={handleReportIssue}>
          <View
            style={[
              st.topBtn,
              {
                backgroundColor: isDark ? "rgba(5,4,3,0.85)" : "rgba(255,255,255,0.92)",
                borderColor: colors.status.error,
              },
            ]}
          >
            <Icon name="warning-outline" size={22} color={colors.status.error} />
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
          <Text style={st.warningText}>Location access denied — enable it in Settings to navigate.</Text>
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
          <Text style={[st.warningText, { color: "#FFF" }]}>Routing unavailable — {routeError}</Text>
        </View>
      )}

      {/* Maneuver card (turn-by-turn) */}
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
          <Text style={st.arrivedText}>You've arrived at the customer</Text>
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
        <View style={st.customerRow}>
          <View style={[st.customerAvatar, { backgroundColor: colors.gold.primary + "18" }]}>
            <Icon name="person" size={22} color={colors.gold.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.customerName, { color: colors.text.primary }]} numberOfLines={1}>
              {customerName}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>
              {destination.address}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCallCustomer}>
            <View style={[st.callBtn, { backgroundColor: colors.status.success }]}>
              <Icon name="call" size={18} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>

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
            <Text style={{ color: colors.text.dim, fontSize: 12 }}>{orderItems} items</Text>
          </View>
          <View style={st.stripItem}>
            <Icon name="receipt-outline" size={14} color={colors.text.dim} />
            <Text style={{ color: colors.text.dim, fontSize: 12 }}>#{orderNumber || "N/A"}</Text>
          </View>
          <Text
            style={{ color: colors.gold.primary, fontWeight: "800", fontSize: 15, marginLeft: "auto" }}
          >
            R{orderTotal ? Math.round(orderTotal).toLocaleString("en-ZA") : "0"}
          </Text>
        </View>

        {/* Primary action — branches on navMode so we never attempt an
            invalid state-machine transition (e.g. ready → en_route). */}
        {!navigating && !arrived && navMode === "needs_pickup" && (
          <>
            <View style={[st.gateBanner, { backgroundColor: "#F59E0B22", borderColor: "#F59E0B" }]}>
              <Icon name="information-circle-outline" size={18} color="#F59E0B" />
              <Text style={[st.gateText, { color: colors.text.primary }]}>
                You haven't picked up this order yet. Head to the depot first to
                collect the goods.
              </Text>
            </View>
            <TouchableOpacity onPress={goToDepotPickup} activeOpacity={0.85}>
              <LinearGradient
                colors={["#F59E0B", "#D97706"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.primaryBtn}
              >
                <Icon name="business-outline" size={22} color={colors.white} />
                <Text style={st.primaryBtnText}>Go to Depot Pickup</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {!navigating && !arrived && navMode === "needs_pin" && (
          <>
            <View style={[st.gateBanner, { backgroundColor: "#10B98122", borderColor: "#10B981" }]}>
              <Icon name="checkmark-circle-outline" size={18} color="#10B981" />
              <Text style={[st.gateText, { color: colors.text.primary }]}>
                You've already arrived at this customer. Verify the delivery PIN
                to complete the drop.
              </Text>
            </View>
            <TouchableOpacity onPress={goToDeliveryPin} activeOpacity={0.85}>
              <LinearGradient
                colors={[colors.status.success, "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.primaryBtn}
              >
                <Icon name="keypad" size={22} color={colors.white} />
                <Text style={st.primaryBtnText}>Verify Delivery PIN</Text>
              </LinearGradient>
            </TouchableOpacity>
          </>
        )}

        {!navigating && !arrived && (navMode === "start" || navMode === "resume" || navMode === "unknown") && (
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
                {!driverLocation
                  ? "Getting GPS fix…"
                  : navMode === "resume"
                    ? "Resume Navigation"
                    : "Start Navigation"}
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
          <TouchableOpacity onPress={handleDelivered} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.status.success, "#059669"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="checkmark-done" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>Confirm Delivered</Text>
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
  customerMarkerWrap: { alignItems: "center" },
  driverMarkerWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  driverPulse: {
    position: "absolute",
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
  },
  driverVehicleChip: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#3B82F6",
    borderWidth: 2.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
  },
  customerPin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  customerPinArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#B8962E",
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
    width: 48,
    height: 48,
    borderRadius: 24,
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: borderRadius.lg,
    zIndex: 10,
  },
  warningText: { color: "#000", fontSize: 13, fontWeight: "700", flex: 1 },
  arrivedBanner: {
    position: "absolute",
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 14,
    borderRadius: borderRadius.lg,
    zIndex: 10,
  },
  arrivedText: { color: "#FFF", fontSize: 16, fontWeight: "800" },
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
  customerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  customerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  customerName: { fontSize: 16, fontWeight: "800", marginBottom: 1 },
  callBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
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
  gateBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  gateText: { fontSize: 13, fontWeight: "600", flex: 1, lineHeight: 18 },
});
