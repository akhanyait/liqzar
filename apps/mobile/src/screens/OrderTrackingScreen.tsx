import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  Platform,
  Linking,
  Share,
  Animated,
  ScrollView,
  Alert,
} from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import { supabase } from "../lib/supabase";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography } from "../theme";
import { useDriverLiveLocation } from "../hooks/useDriverLiveLocation";
import * as Clipboard from "expo-clipboard";

const { width, height } = Dimensions.get("window");

interface TrackingData {
  driver_lat: number;
  driver_lng: number;
  status: string;
  driver_name: string;
  eta_minutes: number;
  driver_phone: string;
  driver_photo: string;
  driver_rating: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_color: string;
  vehicle_plate: string;
  delivery_pin: string;
}

// Mock route polyline (Johannesburg area)
const MOCK_ROUTE_COORDS = [
  { latitude: -26.192, longitude: 28.038 },
  { latitude: -26.194, longitude: 28.04 },
  { latitude: -26.196, longitude: 28.042 },
  { latitude: -26.1985, longitude: 28.0435 },
  { latitude: -26.2, longitude: 28.045 },
  { latitude: -26.202, longitude: 28.046 },
  { latitude: -26.2041, longitude: 28.0473 },
];

const ORDER_STATUSES: Record<string, { label: string; icon: string }> = {
  pending: { label: "Order received", icon: "receipt-outline" },
  confirmed: { label: "Order confirmed", icon: "checkmark-circle-outline" },
  preparing: { label: "Preparing your order", icon: "time-outline" },
  ready: { label: "Ready for pickup", icon: "bag-check-outline" },
  driver_assigned: { label: "Driver assigned", icon: "person-outline" },
  picked_up: { label: "Driver is on the way", icon: "car-outline" },
  en_route: { label: "Driver is en route", icon: "navigate-outline" },
  delivered: { label: "Delivered", icon: "checkmark-done-outline" },
};

const PROGRESS_STEPS = [
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "picked_up", label: "Picked Up" },
  { key: "en_route", label: "En Route" },
  { key: "delivered", label: "Delivered" },
];

const STORE_LOCATION = {
  latitude: -26.2041,
  longitude: 28.0473,
  title: "LIQZAR Store",
};

const INITIAL_REGION = {
  latitude: -26.2041,
  longitude: 28.0473,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#1d1d1d" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  {
    featureType: "road",
    elementType: "geometry.fill",
    stylers: [{ color: "#2c2c2c" }],
  },
  {
    featureType: "road",
    elementType: "geometry.stroke",
    stylers: [{ color: "#212121" }],
  },
  {
    featureType: "water",
    elementType: "geometry",
    stylers: [{ color: "#000000" }],
  },
  {
    featureType: "poi",
    elementType: "geometry",
    stylers: [{ color: "#1a1a1a" }],
  },
];

export default function OrderTrackingScreen() {
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { orderId } = route.params;
  const { colors, gradients, shadows, isDark } = useTheme();

  const mapRef = useRef<MapView>(null);
  const [tracking, setTracking] = useState<TrackingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderStatus, setOrderStatus] = useState("preparing");

  // Supabase-backed live pin (migration 014). Cross-device, production path.
  const { location: liveLoc, stale: liveLocStale } =
    useDriverLiveLocation(orderId);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(400)).current;
  const etaFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => { anim.stop(); };
  }, []);

  // Slide bottom sheet up when tracking data arrives
  useEffect(() => {
    if (!loading) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 12,
        useNativeDriver: true,
      }).start();
      Animated.timing(etaFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  useEffect(() => {
    loadInitialTracking();
    const subscription = subscribeToTracking();

    return () => {
      subscription.then((sub) => sub?.unsubscribe());
    };
  }, [orderId]);

  // Merge Supabase live-location (migration 014) into the tracking state so
  // the moving pin follows the real driver, not the legacy delivery_tracking
  // column which doesn't match the production schema.
  useEffect(() => {
    if (!liveLoc) return;
    setLoading(false);
    setTracking((prev) => ({
      ...(prev || {
        status: "en_route",
        driver_name: "Driver",
        eta_minutes: 0,
        driver_phone: "",
        driver_photo: "",
        driver_rating: 0,
        vehicle_make: "",
        vehicle_model: "",
        vehicle_color: "",
        vehicle_plate: "",
        delivery_pin: "",
      }),
      driver_lat: liveLoc.lat,
      driver_lng: liveLoc.lng,
      eta_minutes: liveLoc.eta_minutes ?? prev?.eta_minutes ?? 0,
    }));
    if (mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: liveLoc.lat,
          longitude: liveLoc.lng,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        600,
      );
    }
  }, [liveLoc]);

  // Assemble tracking from the canonical schema:
  //   orders (status, assigned_driver_id, delivery_pin)
  //   driver_profiles (full_name, phone, rating, profile_picture_url)  joined on user_id
  //   driver_vehicles (make_model, license_plate, vehicle_type)        joined via driver_profiles.id
  //   driver_live_locations / driver_assignments.current_location      for lat/lng + eta
  //
  // When the order hasn't been assigned yet, we intentionally return null so
  // the UI shows the "Waiting for driver assignment" state — but once a driver
  // is assigned we stop waiting even before the first GPS ping arrives.
  const loadInitialTracking = async () => {
    try {
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .select("id, status, assigned_driver_id, delivery_pin, estimated_delivery")
        .eq("id", orderId)
        .maybeSingle();

      if (orderErr) {
        console.warn(`[OrderTracking] Failed to load order ${orderId}:`, orderErr);
        return;
      }
      if (!order) return;

      const status = order.status || "preparing";
      setOrderStatus(status);

      // No driver yet → remain in the "waiting" state (tracking stays null).
      if (!order.assigned_driver_id) return;

      const pin =
        (status === "en_route" || status === "picked_up") && order.delivery_pin
          ? String(order.delivery_pin)
          : "";

      // Resolve driver profile + vehicle in parallel. Fall back gracefully so
      // a misconfigured driver row doesn't trap the customer in waiting.
      const [profileRes, assignmentRes] = await Promise.all([
        supabase
          .from("driver_profiles")
          .select("id, full_name, phone, rating, profile_picture_url")
          .eq("user_id", order.assigned_driver_id)
          .maybeSingle(),
        supabase
          .from("driver_assignments")
          .select("current_location, eta_minutes")
          .eq("order_id", orderId)
          .maybeSingle(),
      ]);

      const profile = profileRes.data;
      let vehicleMake = "";
      let vehicleModel = "";
      let vehiclePlate = "";

      if (profile?.id) {
        const { data: vehicle } = await supabase
          .from("driver_vehicles")
          .select("make_model, license_plate, vehicle_type")
          .eq("driver_id", profile.id)
          .maybeSingle();
        if (vehicle?.make_model) {
          const [make, ...rest] = vehicle.make_model.split(" ");
          vehicleMake = make ?? "";
          vehicleModel = rest.join(" ");
        }
        vehiclePlate = vehicle?.license_plate ?? "";
      }

      const assignmentLoc = (assignmentRes.data?.current_location ?? null) as
        | { lat?: number; lng?: number }
        | null;

      setTracking({
        driver_lat: assignmentLoc?.lat ?? STORE_LOCATION.latitude,
        driver_lng: assignmentLoc?.lng ?? STORE_LOCATION.longitude,
        status,
        driver_name: profile?.full_name || "Driver",
        eta_minutes: assignmentRes.data?.eta_minutes ?? 0,
        driver_phone: profile?.phone || "",
        driver_photo: profile?.profile_picture_url || "",
        driver_rating: profile?.rating ?? 5,
        vehicle_make: vehicleMake,
        vehicle_model: vehicleModel,
        vehicle_color: "",
        vehicle_plate: vehiclePlate,
        delivery_pin: pin,
      });
    } catch (error) {
      console.error(`[OrderTracking] Failed to load tracking for order ${orderId}:`, error);
    } finally {
      setLoading(false);
    }
  };

  // Realtime: watch the order row for status/driver changes, and the assignment
  // row for ETA/current_location updates. The live-location pin is handled
  // separately via the useDriverLiveLocation hook (migration 014).
  const subscribeToTracking = async () => {
    const subscription = supabase
      .channel(`tracking-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${orderId}`,
        },
        () => {
          loadInitialTracking();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "driver_assignments",
          filter: `order_id=eq.${orderId}`,
        },
        () => {
          loadInitialTracking();
        },
      )
      .subscribe();

    return subscription;
  };

  const handleCallDriver = () => {
    if (tracking?.driver_phone) {
      Linking.openURL(`tel:${tracking.driver_phone}`);
    }
  };

  const handleChatDriver = () => {
    (navigation as any).navigate("DeliveryChat", { orderId });
  };

  const generateShareToken = () => {
    const bytes = new Uint8Array(24);
    // crypto.getRandomValues exists in RN via expo-crypto or via global;
    // fall back to Math.random if unavailable (share links are low-risk).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cryptoObj: any = (globalThis as any).crypto;
    if (cryptoObj?.getRandomValues) {
      cryptoObj.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++)
        bytes[i] = Math.floor(Math.random() * 256);
    }
    const b64 = btoa(String.fromCharCode(...Array.from(bytes)));
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const handleShareETA = async () => {
    try {
      const token = generateShareToken();
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sb: any = supabase;
      const { data: { user } } = await sb.auth.getUser();
      if (!user) {
        Alert.alert("Sign-in required", "Please sign in to share your trip.");
        return;
      }
      const { error } = await sb.from("order_share_tokens").insert({
        token,
        order_id: orderId,
        created_by: user.id,
        expires_at: expiresAt,
      });
      if (error) {
        console.warn("[share-trip] insert error", error);
        Alert.alert("Could not create share link", error.message);
        return;
      }
      const url = `https://liqzar.co.za/trip/${token}`;
      await Share.share({
        message: `Follow my LIQZAR delivery live: ${url}`,
        url,
      });
    } catch (e) {
      console.warn("[share-trip] failed", e);
    }
  };

  const statusInfo = ORDER_STATUSES[orderStatus] || ORDER_STATUSES.preparing;

  const renderStarRating = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalf = rating - fullStars >= 0.5;
    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars.push(
          <Icon key={i} name="star" size={14} color={colors.gold.primary} />,
        );
      } else if (i === fullStars && hasHalf) {
        stars.push(
          <Icon
            key={i}
            name="star-half"
            size={14}
            color={colors.gold.primary}
          />,
        );
      } else {
        stars.push(
          <Icon
            key={i}
            name="star-outline"
            size={14}
            color={colors.gold.muted}
          />,
        );
      }
    }
    return stars;
  };

  const currentStepIndex = PROGRESS_STEPS.findIndex(
    (s) => s.key === orderStatus,
  );
  const progressFraction =
    currentStepIndex >= 0
      ? currentStepIndex / (PROGRESS_STEPS.length - 1)
      : 0;

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background.primary }]}
    >
      {/* ── Full-screen Map ── */}
      <MapView
        ref={mapRef}
        style={styles.map}
        initialRegion={INITIAL_REGION}
        showsUserLocation
        showsMyLocationButton={false}
        customMapStyle={isDark ? darkMapStyle : undefined}
      >
        {/* Route Polyline */}
        {tracking && (
          <Polyline
            coordinates={MOCK_ROUTE_COORDS}
            strokeColor={colors.gold.primary}
            strokeWidth={4}
            lineDashPattern={[0]}
          />
        )}

        {/* Store Marker */}
        <Marker
          coordinate={{
            latitude: STORE_LOCATION.latitude,
            longitude: STORE_LOCATION.longitude,
          }}
          title={STORE_LOCATION.title}
        >
          <View
            style={[
              styles.storeMarker,
              {
                backgroundColor: colors.background.card,
                borderColor: colors.gold.primary,
              },
            ]}
          >
            <Icon
              name="storefront-outline"
              size={18}
              color={colors.gold.primary}
            />
          </View>
        </Marker>

        {/* Driver Marker with pulse */}
        {tracking && (
          <Marker
            coordinate={{
              latitude: tracking.driver_lat,
              longitude: tracking.driver_lng,
            }}
            title={`Driver: ${tracking.driver_name}`}
            description={`${tracking.vehicle_color} ${tracking.vehicle_make} ${tracking.vehicle_model} · ${tracking.vehicle_plate}`}
          >
            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <View
                style={[
                  styles.driverMarker,
                  { backgroundColor: colors.gold.primary },
                  shadows.gold,
                ]}
              >
                <Icon name="car-sport" size={20} color={colors.white} />
              </View>
            </Animated.View>
          </Marker>
        )}
      </MapView>

      {/* ── Floating Back Button ── */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <View
          style={[
            styles.backButtonInner,
            {
              backgroundColor: colors.background.card,
              borderColor: colors.gold.border,
            },
            shadows.card,
          ]}
        >
          <Icon name="arrow-back" size={22} color={colors.text.primary} />
        </View>
      </TouchableOpacity>

      {/* ── Floating Order Status Card (top) ── */}
      <Animated.View
        style={[
          styles.floatingOrderCard,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
            opacity: etaFadeAnim,
          },
          shadows.card,
        ]}
      >
        <View style={styles.floatingOrderInner}>
          <View
            style={[
              styles.floatingStatusDot,
              {
                backgroundColor:
                  orderStatus === "delivered"
                    ? colors.status.success
                    : colors.gold.primary,
              },
            ]}
          />
          <View style={styles.floatingOrderTextWrap}>
            <Text
              style={[styles.floatingOrderNumber, { color: colors.text.muted }]}
              numberOfLines={1}
            >
              #{orderId.slice(0, 8).toUpperCase()}
            </Text>
            <Text
              style={[
                styles.floatingStatusLabel,
                { color: colors.text.primary },
              ]}
              numberOfLines={1}
            >
              {statusInfo.label}
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* ── Floating ETA Card (on map) ── */}
      {tracking && (
        <Animated.View
          style={[
            styles.etaFloatingCard,
            {
              borderColor: colors.gold.primary,
              opacity: etaFadeAnim,
            },
            shadows.gold,
          ]}
        >
          <LinearGradient
            colors={[colors.background.card, colors.background.elevated]}
            style={styles.etaFloatingGradient}
          >
            <Text style={[styles.etaLabel, { color: colors.gold.muted }]}>
              ESTIMATED ARRIVAL
            </Text>
            <View style={styles.etaTimeRow}>
              <Text
                style={[styles.etaTimeValue, { color: colors.gold.primary }]}
              >
                {tracking.eta_minutes}
              </Text>
              <Text
                style={[styles.etaTimeUnit, { color: colors.gold.primary }]}
              >
                min
              </Text>
            </View>
            <Text style={[styles.etaRange, { color: colors.text.muted }]}>
              {tracking.eta_minutes - 3} - {tracking.eta_minutes + 2} mins
            </Text>
          </LinearGradient>
        </Animated.View>
      )}

      {/* ── Premium Bottom Sheet ── */}
      <Animated.View
        style={[
          styles.bottomSheet,
          {
            borderColor: colors.gold.border,
            transform: [{ translateY: slideAnim }],
          },
          shadows.dark,
        ]}
      >
        <LinearGradient
          colors={[colors.background.card, colors.background.primary]}
          style={styles.bottomSheetGradient}
        >
          {/* Handle Bar */}
          <View style={styles.handleBarWrap}>
            <View
              style={[styles.handleBar, { backgroundColor: colors.gold.muted }]}
            />
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.sheetContent}
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.gold.primary} />
                <Text
                  style={[styles.loadingText, { color: colors.text.muted }]}
                >
                  Loading tracking info...
                </Text>
              </View>
            ) : !tracking ? (
              /* ── Waiting for driver state ── */
              <View style={styles.waitingContainer}>
                <View
                  style={[
                    styles.waitingIconRing,
                    { borderColor: colors.gold.primary },
                  ]}
                >
                  <View
                    style={[
                      styles.waitingIconContainer,
                      { backgroundColor: colors.gold.faint },
                    ]}
                  >
                    <Icon
                      name="time-outline"
                      size={40}
                      color={colors.gold.primary}
                    />
                  </View>
                </View>
                <Text
                  style={[
                    styles.waitingTitle,
                    { color: colors.text.primary },
                  ]}
                >
                  Waiting for driver assignment
                </Text>
                <Text
                  style={[
                    styles.waitingSubtitle,
                    { color: colors.text.muted },
                  ]}
                >
                  Your order is being prepared. A driver will be assigned
                  shortly.
                </Text>
                <View
                  style={[
                    styles.orderIdRow,
                    {
                      backgroundColor: colors.background.elevated,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <Text
                    style={[styles.orderIdLabel, { color: colors.text.muted }]}
                  >
                    Order ID
                  </Text>
                  <Text
                    style={[
                      styles.orderIdValue,
                      { color: colors.gold.primary },
                    ]}
                  >
                    {orderId.slice(0, 8)}...
                  </Text>
                </View>
              </View>
            ) : (
              /* ── Active tracking state ── */
              <>
                {/* ── Gold Gradient Progress Bar ── */}
                <View style={styles.progressBarSection}>
                  <View
                    style={[
                      styles.progressBarTrack,
                      { backgroundColor: colors.background.elevated },
                    ]}
                  >
                    <LinearGradient
                      colors={gradients.goldShimmer as unknown as string[]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${Math.max(progressFraction * 100, 5)}%` as any,
                        },
                      ]}
                    />
                    {/* Step dots on track */}
                    {PROGRESS_STEPS.map((_, idx) => {
                      const left =
                        idx === 0
                          ? 0
                          : idx === PROGRESS_STEPS.length - 1
                            ? width - spacing.lg * 2 - 14
                            : ((width - spacing.lg * 2) /
                                (PROGRESS_STEPS.length - 1)) *
                                idx -
                              7;
                      const isActive = idx <= currentStepIndex;
                      return (
                        <View
                          key={idx}
                          style={[
                            styles.progressStepDot,
                            {
                              left,
                              backgroundColor: isActive
                                ? colors.gold.primary
                                : colors.background.elevated,
                              borderColor: isActive
                                ? colors.gold.light
                                : colors.gold.border,
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                  {/* Step labels */}
                  <View style={styles.progressLabelsRow}>
                    {PROGRESS_STEPS.map((step, idx) => {
                      const isActive = idx <= currentStepIndex;
                      return (
                        <Text
                          key={step.key}
                          style={[
                            styles.progressStepLabel,
                            {
                              color: isActive
                                ? colors.gold.primary
                                : colors.text.dim,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {step.label}
                        </Text>
                      );
                    })}
                  </View>
                </View>

                {/* ── Driver Info Card ── */}
                <View
                  style={[
                    styles.driverCard,
                    {
                      backgroundColor: colors.background.elevated,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <View style={styles.driverCardTop}>
                    {/* Avatar with gold ring */}
                    <View
                      style={[
                        styles.avatarRing,
                        { borderColor: colors.gold.primary },
                        shadows.goldSubtle,
                      ]}
                    >
                      <View
                        style={[
                          styles.driverAvatar,
                          { backgroundColor: colors.gold.faint },
                        ]}
                      >
                        <Icon
                          name="person-outline"
                          size={28}
                          color={colors.gold.primary}
                        />
                      </View>
                    </View>

                    {/* Driver details */}
                    <View style={styles.driverDetails}>
                      <Text
                        style={[
                          styles.driverName,
                          { color: colors.text.primary },
                        ]}
                      >
                        {tracking.driver_name}
                      </Text>
                      <View style={styles.driverRatingRow}>
                        {renderStarRating(tracking.driver_rating)}
                        <Text
                          style={[
                            styles.driverRatingText,
                            { color: colors.gold.primary },
                          ]}
                        >
                          {tracking.driver_rating}
                        </Text>
                      </View>
                      {/* Vehicle pill */}
                      <View
                        style={[
                          styles.vehiclePill,
                          {
                            backgroundColor: colors.gold.faint,
                            borderColor: colors.gold.border,
                          },
                        ]}
                      >
                        <Icon
                          name="car-sport-outline"
                          size={13}
                          color={colors.gold.muted}
                        />
                        <Text
                          style={[
                            styles.vehiclePillText,
                            { color: colors.text.muted },
                          ]}
                          numberOfLines={1}
                        >
                          {tracking.vehicle_color} {tracking.vehicle_make}{" "}
                          {tracking.vehicle_model}
                        </Text>
                        <View
                          style={[
                            styles.plateDivider,
                            { backgroundColor: colors.gold.border },
                          ]}
                        />
                        <Text
                          style={[
                            styles.vehiclePlate,
                            { color: colors.text.primary },
                          ]}
                        >
                          {tracking.vehicle_plate}
                        </Text>
                      </View>
                    </View>

                    {/* Contact Circular Buttons */}
                    <View style={styles.contactButtons}>
                      <TouchableOpacity
                        style={[
                          styles.contactCircle,
                          {
                            backgroundColor: colors.gold.faint,
                            borderColor: colors.gold.border,
                          },
                        ]}
                        onPress={handleCallDriver}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="call"
                          size={18}
                          color={colors.gold.primary}
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.contactCircle,
                          {
                            backgroundColor: colors.gold.faint,
                            borderColor: colors.gold.border,
                          },
                        ]}
                        onPress={handleChatDriver}
                        activeOpacity={0.7}
                      >
                        <Icon
                          name="chatbubble-ellipses"
                          size={18}
                          color={colors.gold.primary}
                        />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>

                {/* ── Action Pill Buttons ── */}
                <View style={styles.actionPillRow}>
                  {/* Share ETA - gold outline pill */}
                  <TouchableOpacity
                    style={[
                      styles.actionPillOutline,
                      { borderColor: colors.gold.primary },
                    ]}
                    onPress={handleShareETA}
                    activeOpacity={0.7}
                  >
                    <Icon
                      name="share-outline"
                      size={18}
                      color={colors.gold.primary}
                    />
                    <Text
                      style={[
                        styles.actionPillOutlineText,
                        { color: colors.gold.primary },
                      ]}
                    >
                      Share ETA
                    </Text>
                  </TouchableOpacity>

                  {/* Chat with Driver - gold filled pill */}
                  <TouchableOpacity
                    style={[styles.actionPillFilled]}
                    onPress={handleChatDriver}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={gradients.gold as unknown as string[]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.actionPillFilledGradient}
                    >
                      <Icon
                        name="chatbubble-ellipses-outline"
                        size={18}
                        color={colors.text.inverse}
                      />
                      <Text
                        style={[
                          styles.actionPillFilledText,
                          { color: colors.text.inverse },
                        ]}
                      >
                        Chat with Driver
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* ── Delivery PIN ── */}
                {orderStatus === "delivered" ? (
                  /* Delivery confirmation prompt */
                  <View
                    style={[
                      styles.deliveryConfirmCard,
                      {
                        backgroundColor: isDark
                          ? "rgba(16,185,129,0.08)"
                          : "rgba(16,185,129,0.05)",
                        borderColor: "#10B98140",
                      },
                    ]}
                  >
                    <View style={styles.deliveryConfirmIcon}>
                      <Icon
                        name="checkmark-circle"
                        size={36}
                        color={colors.status.success}
                      />
                    </View>
                    <Text
                      style={[
                        styles.deliveryConfirmTitle,
                        { color: colors.text.primary },
                      ]}
                    >
                      Order Delivered!
                    </Text>
                    <Text
                      style={{
                        color: colors.text.muted,
                        fontSize: 13,
                        textAlign: "center",
                        marginBottom: 14,
                      }}
                    >
                      Your driver has confirmed delivery. Please confirm you received your order.
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.85}
                      onPress={() => {
                        Alert.alert(
                          "Confirm Receipt",
                          "Did you receive your order?",
                          [
                            {
                              text: "Report Issue",
                              style: "destructive",
                              onPress: () => {
                                Alert.alert(
                                  "What went wrong?",
                                  "Select the issue you experienced:",
                                  [
                                    {
                                      text: "Wrong Items",
                                      onPress: async () => {
                                        try {
                                          await supabase
                                            .from("order_disputes")
                                            .insert({
                                              order_id: orderId,
                                              reason: "Wrong Items",
                                              status: "open",
                                              created_at: new Date().toISOString(),
                                            });
                                        } catch (e) {
                                          console.warn("[OrderTracking] Failed to create dispute:", e);
                                        }
                                        Alert.alert("Issue Reported", "We've logged your complaint about wrong items. Our support team will contact you shortly.");
                                      },
                                    },
                                    {
                                      text: "Damaged Items",
                                      onPress: async () => {
                                        try {
                                          await supabase
                                            .from("order_disputes")
                                            .insert({
                                              order_id: orderId,
                                              reason: "Damaged Items",
                                              status: "open",
                                              created_at: new Date().toISOString(),
                                            });
                                        } catch (e) {
                                          console.warn("[OrderTracking] Failed to create dispute:", e);
                                        }
                                        Alert.alert("Issue Reported", "We've logged your complaint about damaged items. Our support team will contact you shortly.");
                                      },
                                    },
                                    {
                                      text: "Incomplete Order",
                                      onPress: async () => {
                                        try {
                                          await supabase
                                            .from("order_disputes")
                                            .insert({
                                              order_id: orderId,
                                              reason: "Incomplete Order",
                                              status: "open",
                                              created_at: new Date().toISOString(),
                                            });
                                        } catch (e) {
                                          console.warn("[OrderTracking] Failed to create dispute:", e);
                                        }
                                        Alert.alert("Issue Reported", "We've logged your complaint about an incomplete order. Our support team will contact you shortly.");
                                      },
                                    },
                                    { text: "Cancel", style: "cancel" },
                                  ],
                                );
                              },
                            },
                            {
                              text: "Yes, Received",
                              onPress: () =>
                                (navigation as any).navigate("CustomerRating", {
                                  orderId,
                                  driverName: tracking.driver_name,
                                }),
                            },
                          ],
                        );
                      }}
                    >
                      <LinearGradient
                        colors={[colors.status.success, "#059669"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.confirmReceiptBtn}
                      >
                        <Icon name="checkmark" size={20} color={colors.white} />
                        <Text style={styles.confirmReceiptBtnText}>
                          Confirm Receipt
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                ) : (orderStatus === "en_route" || orderStatus === "picked_up") ? (
                  /* PIN display — only shown when en_route or picked_up */
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={() =>
                      (navigation as any).navigate("CustomerDeliveryPin", {
                        orderId,
                        orderNumber: orderId.slice(0, 8).toUpperCase(),
                        driverName: tracking.driver_name,
                      })
                    }
                  >
                    <View
                      style={[
                        styles.deliveryPinRow,
                        {
                          backgroundColor: colors.gold.faint,
                          borderColor:
                            orderStatus === "en_route" || orderStatus === "picked_up"
                              ? colors.gold.primary
                              : colors.gold.border,
                          borderWidth:
                            orderStatus === "en_route" || orderStatus === "picked_up"
                              ? 2
                              : 1,
                        },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Icon name="shield-checkmark" size={16} color={colors.gold.primary} />
                          <Text
                            style={[
                              styles.deliveryPinLabel,
                              { color: colors.text.muted },
                            ]}
                          >
                            Delivery PIN
                          </Text>
                        </View>
                        <Text
                          style={[
                            styles.deliveryPinHint,
                            { color: colors.text.dim },
                          ]}
                        >
                          {orderStatus === "en_route" || orderStatus === "picked_up"
                            ? "Show this PIN to your driver upon arrival"
                            : "Share this with your driver to confirm delivery"}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.pinBox,
                          {
                            backgroundColor: colors.background.primary,
                            borderColor: colors.gold.primary,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.pinText,
                            { color: colors.gold.primary },
                          ]}
                        >
                          {tracking.delivery_pin}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </ScrollView>
        </LinearGradient>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height,
  },

  /* ── Floating Back Button ── */
  backButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    left: spacing.md,
    zIndex: 10,
  },
  backButtonInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Floating Order Card (top) ── */
  floatingOrderCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: spacing.md,
    zIndex: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: width * 0.55,
  },
  floatingOrderInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  floatingStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  floatingOrderTextWrap: {
    flex: 1,
  },
  floatingOrderNumber: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  floatingStatusLabel: {
    fontSize: 13,
    fontWeight: "700",
    marginTop: 1,
  },

  /* ── Floating ETA Card (on map) ── */
  etaFloatingCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 112 : 96,
    right: spacing.md,
    zIndex: 9,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    overflow: "hidden",
  },
  etaFloatingGradient: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
  },
  etaLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.5,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  etaTimeRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  etaTimeValue: {
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: -1,
  },
  etaTimeUnit: {
    fontSize: 16,
    fontWeight: "600",
  },
  etaRange: {
    fontSize: 11,
    fontWeight: "500",
    marginTop: 2,
  },

  /* ── Map Markers ── */
  storeMarker: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Premium Bottom Sheet ── */
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: borderRadius.full,
    borderTopRightRadius: borderRadius.full,
    overflow: "hidden",
    borderWidth: 1,
    borderBottomWidth: 0,
    maxHeight: height * 0.52,
  },
  bottomSheetGradient: {
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === "ios" ? 40 : spacing.lg,
  },
  sheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  handleBarWrap: {
    alignItems: "center",
    paddingBottom: spacing.sm,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },

  /* ── Loading ── */
  loadingContainer: {
    alignItems: "center",
    paddingVertical: spacing.xl,
  },
  loadingText: {
    fontSize: 14,
    marginTop: spacing.sm,
  },

  /* ── Waiting State ── */
  waitingContainer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  waitingIconRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  waitingIconContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  waitingTitle: {
    ...typography.h4,
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  waitingSubtitle: {
    ...typography.bodySmall,
    textAlign: "center",
    marginBottom: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  orderIdRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    gap: spacing.sm,
  },
  orderIdLabel: {
    ...typography.caption,
  },
  orderIdValue: {
    ...typography.caption,
    fontWeight: "600",
  },

  /* ── Progress Bar ── */
  progressBarSection: {
    marginBottom: spacing.lg,
    marginTop: spacing.xs,
  },
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "visible",
    position: "relative",
  },
  progressBarFill: {
    height: 6,
    borderRadius: 3,
  },
  progressStepDot: {
    position: "absolute",
    top: -4,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
  },
  progressLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  progressStepLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textAlign: "center",
    width: (width - spacing.lg * 2) / PROGRESS_STEPS.length,
  },

  /* ── Driver Card ── */
  driverCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  driverCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  avatarRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2.5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  driverAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
  driverDetails: {
    flex: 1,
    paddingTop: 2,
  },
  driverName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  driverRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },
  driverRatingText: {
    fontSize: 13,
    fontWeight: "700",
    marginLeft: 4,
  },
  vehiclePill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    gap: 6,
  },
  vehiclePillText: {
    fontSize: 12,
    fontWeight: "500",
  },
  plateDivider: {
    width: 1,
    height: 14,
  },
  vehiclePlate: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.8,
  },

  /* ── Contact Circular Buttons ── */
  contactButtons: {
    gap: 10,
    alignItems: "center",
    paddingTop: 2,
  },
  contactCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },

  /* ── Action Pill Buttons ── */
  actionPillRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  actionPillOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
  },
  actionPillOutlineText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  actionPillFilled: {
    flex: 1,
    borderRadius: borderRadius.full,
    overflow: "hidden",
  },
  actionPillFilledGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: borderRadius.full,
  },
  actionPillFilledText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  /* ── Delivery PIN ── */
  deliveryPinRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  deliveryPinLabel: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  deliveryPinHint: {
    ...typography.caption,
    marginTop: 2,
  },
  pinBox: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    marginLeft: spacing.md,
  },
  pinText: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 4,
  },

  /* ── Delivery Confirmation ── */
  deliveryConfirmCard: {
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    padding: spacing.lg,
    alignItems: "center",
  },
  deliveryConfirmIcon: {
    marginBottom: 10,
  },
  deliveryConfirmTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  confirmReceiptBtn: {
    height: 48,
    borderRadius: borderRadius.xl,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
  },
  confirmReceiptBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
