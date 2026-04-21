import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from "react-native-maps";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as Location from "expo-location";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

/**
 * Routing data below is SIMULATED. There is no real routing API integration.
 * All coordinates, routes, and directions are hardcoded Cape Town data.
 */
const IS_MOCK_ROUTING = true;

// Mock depot location (Cape Town CBD depot)
const DEPOT = {
  name: "LIQZAR Central Depot",
  address: "12 Buitengracht St, Cape Town, 8001",
  latitude: -33.9215,
  longitude: 18.4184,
};

// Simulated route from driver to depot (realistic Cape Town streets)
const ROUTE_TO_DEPOT = [
  { latitude: -33.9165, longitude: 18.4230 },
  { latitude: -33.9170, longitude: 18.4222 },
  { latitude: -33.9178, longitude: 18.4215 },
  { latitude: -33.9185, longitude: 18.4210 },
  { latitude: -33.9190, longitude: 18.4205 },
  { latitude: -33.9195, longitude: 18.4200 },
  { latitude: -33.9200, longitude: 18.4195 },
  { latitude: -33.9205, longitude: 18.4190 },
  { latitude: -33.9210, longitude: 18.4186 },
  { latitude: DEPOT.latitude, longitude: DEPOT.longitude },
];

// Mock turn-by-turn directions
const DIRECTIONS = [
  { instruction: "Head south on Strand St", distance: "200m", icon: "arrow-up-outline" },
  { instruction: "Turn right onto Buitengracht St", distance: "350m", icon: "arrow-forward-outline" },
  { instruction: "Continue for 400m", distance: "400m", icon: "arrow-up-outline" },
  { instruction: "Arrive at LIQZAR Central Depot", distance: "", icon: "flag-outline" },
];

export default function DriverDepotPickup() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const mapRef = useRef<MapView>(null);
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  const delivery = route.params?.delivery;
  const [driverLocation, setDriverLocation] = useState(ROUTE_TO_DEPOT[0]);
  const [currentStep, setCurrentStep] = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [arrivedAtDepot, setArrivedAtDepot] = useState(false);

  // Pulse animation for the navigate button
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

  // Request location permission
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        // Use real location if close enough to Cape Town, else use mock
        if (Math.abs(loc.coords.latitude - DEPOT.latitude) < 1) {
          setDriverLocation({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
        }
      }
    })();
  }, []);

  const handleStartNavigation = () => {
    setNavigating(true);
    setCurrentStep(0);
    // Fit map to show entire route
    mapRef.current?.fitToCoordinates(ROUTE_TO_DEPOT, {
      edgePadding: { top: 120, right: 60, bottom: 300, left: 60 },
      animated: true,
    });
  };

  const handleNextDirection = () => {
    if (currentStep < DIRECTIONS.length - 2) {
      setCurrentStep((p) => p + 1);
      // Animate driver position along route
      const nextIdx = Math.min(currentStep + 2, ROUTE_TO_DEPOT.length - 1);
      setDriverLocation(ROUTE_TO_DEPOT[nextIdx]);
      mapRef.current?.animateToRegion(
        {
          latitude: ROUTE_TO_DEPOT[nextIdx].latitude,
          longitude: ROUTE_TO_DEPOT[nextIdx].longitude,
          latitudeDelta: 0.006,
          longitudeDelta: 0.006,
        },
        500,
      );
    } else {
      // Arrived at depot
      setArrivedAtDepot(true);
      setDriverLocation(ROUTE_TO_DEPOT[ROUTE_TO_DEPOT.length - 1]);
    }
  };

  const handleRecenter = () => {
    mapRef.current?.animateToRegion(
      {
        latitude: driverLocation.latitude,
        longitude: driverLocation.longitude,
        latitudeDelta: 0.008,
        longitudeDelta: 0.008,
      },
      400,
    );
  };

  const handleArrivedConfirm = () => {
    navigation.navigate("DriverScanVerify", { delivery });
  };

  const remainingDistance = navigating
    ? `${((DIRECTIONS.length - currentStep) * 0.25).toFixed(1)} km`
    : "1.0 km";
  const eta = navigating
    ? `${Math.max(1, (DIRECTIONS.length - currentStep) * 2)} min`
    : "4 min";

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
          latitude: (driverLocation.latitude + DEPOT.latitude) / 2,
          longitude: (driverLocation.longitude + DEPOT.longitude) / 2,
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

        {/* Depot marker */}
        <Marker
          coordinate={{ latitude: DEPOT.latitude, longitude: DEPOT.longitude }}
          anchor={{ x: 0.5, y: 1 }}
        >
          <View style={st.depotMarkerWrap}>
            <LinearGradient colors={[colors.status.info, "#2563EB"]} style={st.depotMarkerPin}>
              <Icon name="business" size={16} color={colors.white} />
            </LinearGradient>
            <View style={st.depotMarkerArrow} />
          </View>
        </Marker>

        {/* Route polyline */}
        <Polyline
          coordinates={ROUTE_TO_DEPOT}
          strokeColor={colors.status.info}
          strokeWidth={5}
          lineCap="round"
          lineJoin="round"
        />
      </MapView>

      {/* Top bar: Back + ETA */}
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
          <Text style={[st.etaText, { color: colors.text.primary }]}>{remainingDistance}</Text>
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

      {/* Direction Card (shown when navigating) */}
      {navigating && !arrivedAtDepot && (
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
              name={DIRECTIONS[currentStep]?.icon || "arrow-up-outline"}
              size={24}
              color={colors.status.info}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.dirInstruction, { color: colors.text.primary }]}>
              {DIRECTIONS[currentStep]?.instruction}
            </Text>
            {DIRECTIONS[currentStep]?.distance ? (
              <Text style={{ color: colors.text.dim, fontSize: 13 }}>
                {DIRECTIONS[currentStep].distance}
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
          {delivery && (
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

        {/* Action Button */}
        {!navigating && !arrivedAtDepot && (
          <TouchableOpacity onPress={handleStartNavigation} activeOpacity={0.85}>
            <LinearGradient
              colors={[colors.status.info, "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.primaryBtn}
            >
              <Icon name="navigate" size={22} color={colors.white} />
              <Text style={st.primaryBtnText}>Start Navigation to Depot</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {navigating && !arrivedAtDepot && (
          <TouchableOpacity onPress={handleNextDirection} activeOpacity={0.85}>
            <Animated.View style={{ opacity: pulseAnim }}>
              <LinearGradient
                colors={["#8B5CF6", "#7C3AED"]}
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

        {arrivedAtDepot && (
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
  depotMarkerWrap: {
    alignItems: "center",
  },
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
  depotName: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 1,
  },
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
