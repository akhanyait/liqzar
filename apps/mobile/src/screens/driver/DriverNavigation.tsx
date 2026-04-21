import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Linking,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

/**
 * Routing data below is SIMULATED. There is no real routing API integration.
 * All coordinates, routes, and directions are hardcoded Cape Town data.
 */
const IS_MOCK_ROUTING = true;

// Depot start point
const DEPOT_LOC = { latitude: -33.9215, longitude: 18.4184 };

// Mock customer locations based on address
const CUSTOMER_LOCATIONS: Record<string, { latitude: number; longitude: number }> = {
  "42 Nelson Mandela Blvd, Cape Town": { latitude: -33.9249, longitude: 18.4241 },
  "18 Long Street, CBD": { latitude: -33.9218, longitude: 18.4171 },
  "7 Kloof Street, Gardens": { latitude: -33.9282, longitude: 18.4103 },
};

// Realistic route from depot to customer (Cape Town streets)
const getRoute = (destLat: number, destLng: number) => {
  const coords = [
    { latitude: DEPOT_LOC.latitude, longitude: DEPOT_LOC.longitude },
    { latitude: -33.9218, longitude: 18.4190 },
    { latitude: -33.9222, longitude: 18.4198 },
    { latitude: -33.9228, longitude: 18.4208 },
    { latitude: -33.9233, longitude: 18.4218 },
    { latitude: -33.9238, longitude: 18.4225 },
    { latitude: -33.9242, longitude: 18.4232 },
    { latitude: destLat, longitude: destLng },
  ];
  return coords;
};

// Mock turn-by-turn for customer delivery
const getDirections = (address: string) => [
  { instruction: "Head east on Buitengracht St", distance: "150m", icon: "arrow-up-outline" },
  { instruction: "Turn left onto Wale St", distance: "300m", icon: "arrow-back-outline" },
  { instruction: "Continue onto Adderley St", distance: "250m", icon: "arrow-up-outline" },
  { instruction: `Turn right toward ${address.split(",")[0]}`, distance: "200m", icon: "arrow-forward-outline" },
  { instruction: `Arrive at ${address.split(",")[0]}`, distance: "", icon: "flag-outline" },
];

export default function DriverNavigation() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { markEnRoute, updateOrderStatus } = useOrders();
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const delivery = route.params?.delivery;
  const orderId = delivery?.orderId || delivery?.id;
  const address = delivery?.address || "42 Nelson Mandela Blvd, Cape Town";
  const customerLoc = CUSTOMER_LOCATIONS[address] || { latitude: -33.9249, longitude: 18.4241 };
  const routeCoords = React.useMemo(
    () => getRoute(customerLoc.latitude, customerLoc.longitude),
    [customerLoc.latitude, customerLoc.longitude],
  );
  const directions = React.useMemo(() => getDirections(address), [address]);

  const [driverLocation, setDriverLocation] = useState(DEPOT_LOC);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [arrived, setArrived] = useState(false);

  // Pulse animation
  useEffect(() => {
    if (!navigating) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 1000, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [navigating]);

  // Get real location if available
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        if (Math.abs(loc.coords.latitude - DEPOT_LOC.latitude) < 1) {
          setDriverLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      }
    })();
  }, []);

  const handleStartNavigation = async () => {
    setNavigating(true);
    setCurrentStep(0);
    // Mark order as en_route in backend (non-blocking: navigation simulation proceeds even if this fails)
    if (orderId) {
      try {
        await markEnRoute(orderId, Math.max(1, directions.length * 2));
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        Alert.alert(
          "Status Update Notice",
          `Could not update order status to en-route. You can still navigate to the customer.\n\nReason: ${message}`,
        );
      }
    } else {
      console.warn("DriverNavigation: orderId is undefined, skipping markEnRoute");
    }
    mapRef.current?.fitToCoordinates(routeCoords, {
      edgePadding: { top: 150, right: 60, bottom: 320, left: 60 },
      animated: true,
    });
  };

  const handleNextDirection = () => {
    if (currentStep < directions.length - 2) {
      const nextStep = currentStep + 1;
      setCurrentStep(nextStep);
      // Move driver along route
      const routeIdx = Math.min(
        Math.round(((nextStep + 1) / directions.length) * routeCoords.length),
        routeCoords.length - 1,
      );
      setDriverLocation(routeCoords[routeIdx]);
      mapRef.current?.animateToRegion(
        {
          latitude: routeCoords[routeIdx].latitude,
          longitude: routeCoords[routeIdx].longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    } else {
      // Arrived at customer
      setArrived(true);
      setDriverLocation(routeCoords[routeCoords.length - 1]);
      mapRef.current?.animateToRegion(
        {
          latitude: customerLoc.latitude,
          longitude: customerLoc.longitude,
          latitudeDelta: 0.004,
          longitudeDelta: 0.004,
        },
        500,
      );
    }
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.006,
        longitudeDelta: 0.006,
      },
      400,
    );
  };

  const handleCallCustomer = () => {
    const phone = delivery?.customerPhone;
    if (phone) {
      const telUrl = `tel:${phone}`;
      Linking.canOpenURL(telUrl)
        .then((supported) => {
          if (supported) {
            Linking.openURL(telUrl);
          } else {
            Alert.alert("Cannot Place Call", `Unable to open dialer for ${phone}.`);
          }
        })
        .catch(() => {
          Alert.alert("Cannot Place Call", `Unable to open dialer for ${phone}.`);
        });
    } else {
      Alert.alert("No Phone Number", "Customer phone number is not available.");
    }
  };

  const handleDelivered = () => {
    // Navigate to PIN verification screen instead of direct delivery confirmation
    navigation.navigate("DriverDeliveryPinVerify", { delivery: { ...delivery, orderId } });
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
              if (orderId) {
                await updateOrderStatus(orderId, "delivery_failed", { reason: "Vehicle Breakdown" });
              }
            } catch (e) {
              console.warn("[DriverNavigation] Failed to update status:", e);
            }
            Alert.alert("Issue Reported", "Dispatch has been notified of your vehicle breakdown.");
            navigation.goBack();
          },
        },
        {
          text: "Road Blocked",
          onPress: async () => {
            try {
              if (orderId) {
                await updateOrderStatus(orderId, "delivery_failed", { reason: "Road Blocked" });
              }
            } catch (e) {
              console.warn("[DriverNavigation] Failed to update status:", e);
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
              if (orderId) {
                await updateOrderStatus(orderId, "delivery_failed", { reason: "Emergency" });
              }
            } catch (e) {
              console.warn("[DriverNavigation] Failed to update status:", e);
            }
            Alert.alert("Issue Reported", "Dispatch has been notified of your emergency.");
            navigation.goBack();
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const remainingDist = navigating
    ? `${((directions.length - currentStep) * 0.2).toFixed(1)} km`
    : delivery?.distance || "3.2 km";
  const eta = navigating
    ? `${Math.max(1, (directions.length - currentStep) * 2)} min`
    : delivery?.estimatedTime || "12 min";

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Demo mode banner */}
      {IS_MOCK_ROUTING && (
        <View style={{ position: "absolute", top: insets.top + 10, left: 16, right: 16, zIndex: 999, backgroundColor: "#FFA50090", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12, alignItems: "center" }}>
          <Text style={{ color: "#000", fontSize: 12, fontWeight: "600" }}>
            Demo Mode — Simulated Route (no real routing API)
          </Text>
        </View>
      )}
      {/* Full-screen Map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={{
          latitude: (DEPOT_LOC.latitude + customerLoc.latitude) / 2,
          longitude: (DEPOT_LOC.longitude + customerLoc.longitude) / 2,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {/* Driver marker */}
        <Marker coordinate={driverLocation} anchor={{ x: 0.5, y: 0.5 }}>
          <View style={st.driverMarker}>
            <Icon name="car" size={18} color={colors.white} />
          </View>
        </Marker>

        {/* Customer marker */}
        <Marker coordinate={customerLoc} anchor={{ x: 0.5, y: 1 }}>
          <View style={st.customerMarkerWrap}>
            <LinearGradient colors={[colors.gold.primary, colors.gold.dark]} style={st.customerPin}>
              <Icon name="person" size={16} color={colors.white} />
            </LinearGradient>
            <View style={st.customerPinArrow} />
          </View>
        </Marker>

        {/* Route polyline */}
        <Polyline
          coordinates={routeCoords}
          strokeColor={colors.status.info}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
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
          <Text style={[st.etaText, { color: colors.text.primary }]}>{eta}</Text>
          <View style={[st.etaDivider, { backgroundColor: colors.gold.border }]} />
          <Icon name="navigate-outline" size={16} color={colors.status.info} />
          <Text style={[st.etaText, { color: colors.text.primary }]}>{remainingDist}</Text>
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

      {/* Direction Card */}
      {navigating && !arrived && (
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
              name={directions[currentStep]?.icon || "arrow-up-outline"}
              size={24}
              color={colors.status.info}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.dirInstruction, { color: colors.text.primary }]}>
              {directions[currentStep]?.instruction}
            </Text>
            {directions[currentStep]?.distance ? (
              <Text style={{ color: colors.text.dim, fontSize: 13 }}>
                {directions[currentStep].distance}
              </Text>
            ) : null}
          </View>
          <TouchableOpacity
            onPress={handleNextDirection}
            style={[st.nextStepBtn, { backgroundColor: colors.status.info }]}
          >
            <Icon name="chevron-forward" size={20} color={colors.white} />
          </TouchableOpacity>
        </View>
      )}

      {/* Arrived banner */}
      {arrived && (
        <View
          style={[
            st.arrivedBanner,
            { top: insets.top + 66 },
            {
              backgroundColor: isDark ? "rgba(16,185,129,0.95)" : "rgba(16,185,129,0.95)",
            },
          ]}
        >
          <Icon name="checkmark-circle" size={22} color={colors.white} />
          <Text style={st.arrivedText}>You've arrived at the customer</Text>
        </View>
      )}

      {/* Bottom Card */}
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
        {/* Customer row */}
        <View style={st.customerRow}>
          <View style={[st.customerAvatar, { backgroundColor: colors.gold.primary + "18" }]}>
            <Icon name="person" size={22} color={colors.gold.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.customerName, { color: colors.text.primary }]}>
              {delivery?.customerName || "Customer"}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 12 }} numberOfLines={1}>
              {address}
            </Text>
          </View>
          <TouchableOpacity onPress={handleCallCustomer}>
            <View style={[st.callBtn, { backgroundColor: colors.status.success }]}>
              <Icon name="call" size={18} color={colors.white} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Order info */}
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
            <Icon name="receipt-outline" size={14} color={colors.text.dim} />
            <Text style={{ color: colors.text.dim, fontSize: 12 }}>
              #{delivery?.orderNumber || "N/A"}
            </Text>
          </View>
          <Text
            style={{ color: colors.gold.primary, fontWeight: "800", fontSize: 15, marginLeft: "auto" }}
          >
            R{delivery?.total ? Math.round(delivery.total).toLocaleString('en-ZA') : "0"}
          </Text>
        </View>

        {/* Actions */}
        {!navigating && !arrived && (
          <TouchableOpacity onPress={handleStartNavigation} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.status.info, "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="navigate" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>Start Navigation to Customer</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {navigating && !arrived && (
          <TouchableOpacity onPress={handleNextDirection} activeOpacity={0.85}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <LinearGradient
                colors={[colors.status.info, "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={st.primaryBtn}
              >
                <Icon name="navigate-outline" size={22} color={colors.white} />
                <Text style={st.primaryBtnText}>Navigating... Tap for next step</Text>
              </LinearGradient>
            </Animated.View>
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
  etaText: {
    fontSize: 14,
    fontWeight: "700",
  },
  etaDivider: {
    width: 1,
    height: 18,
    marginHorizontal: 4,
  },
  driverMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  customerMarkerWrap: {
    alignItems: "center",
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
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  dirInstruction: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  nextStepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
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
  arrivedText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
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
  customerName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 1,
  },
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
  stripItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  primaryBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  primaryBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
