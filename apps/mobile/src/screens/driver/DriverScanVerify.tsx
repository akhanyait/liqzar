import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import Constants from "expo-constants";
// expo-image-picker is bundled but may be missing in some bare builds
let ImagePicker: any = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  // Native module unavailable — "Take picture" button will fall back gracefully
}
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

// Camera is unavailable on simulator — detect it
const IS_SIMULATOR = !Constants.isDevice;

/**
 * Real barcode scanning requires expo-barcode-scanner (not yet integrated).
 * Set to false when the real scanner is wired up.
 * While true: scanner UI is fully simulated; torch button is non-functional.
 */
const IS_MOCK_SCANNER = true;

const { width } = Dimensions.get("window");
const SCAN_SIZE = width * 0.65;

interface OrderItem {
  id: string;
  name: string;
  barcode: string;
  qty: number;
  scanned: boolean;
  productName?: string;
  imageUrl?: string;
}

export default function DriverScanVerify() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { markPickedUp, driverSignOff } = useOrders();

  const delivery = route.params?.delivery;
  const orderId = delivery?.orderId || delivery?.id;
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(true);
  const [torch, setTorch] = useState(false);
  const [signingOff, setSigningOff] = useState(false);
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const matchAnim = useRef(new Animated.Value(0)).current;

  const scannedCount = items.filter((i) => i.scanned).length;
  const allScanned = items.length > 0 && scannedCount === items.length;

  useEffect(() => {
    fetchOrderItems();
  }, [orderId]);

  const fetchOrderItems = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("order_items")
        .select("*, products(name, barcode, image_url)")
        .eq("order_id", orderId);
      setItems(
        data?.map((item: any) => ({
          id: item.id,
          name: item.products?.name || "Unknown Product",
          barcode: item.products?.barcode || "",
          qty: item.quantity || 1,
          scanned: false,
          productName: item.products?.name,
          imageUrl: item.products?.image_url,
        })) || [],
      );
    } catch (error) {
      console.error("Error fetching order items:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const handleBarcodeScan = (barcode: string) => {
    const matchedItem = items.find(
      (i) => i.barcode === barcode && !i.scanned,
    );
    if (matchedItem) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === matchedItem.id ? { ...item, scanned: true } : item,
        ),
      );
      Animated.sequence([
        Animated.timing(matchAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(800),
        Animated.timing(matchAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Alert.alert(
        "No Match",
        "This barcode does not match any unscanned order item",
      );
    }
  };

  const handleManualVerify = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, scanned: true } : item,
      ),
    );
  };

  // Camera capture: driver takes a photo of the barcode/product and the next
  // unscanned item is marked verified. Used when the real decoder is unavailable
  // (simulator / bare build) or as a manual override on device.
  const handleCaptureToScan = async () => {
    if (!ImagePicker) {
      Alert.alert(
        "Camera unavailable",
        "Camera module isn't loaded in this build. Use the Manual button next to each item instead.",
      );
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera permission needed",
          "Grant camera access in Settings to scan by photo.",
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.5,
      });
      if (result.canceled) return;

      const nextUnscanned = items.find((i) => !i.scanned);
      if (!nextUnscanned) return;

      setItems((prev) =>
        prev.map((item) =>
          item.id === nextUnscanned.id ? { ...item, scanned: true } : item,
        ),
      );
      Animated.sequence([
        Animated.timing(matchAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(600),
        Animated.timing(matchAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } catch (err) {
      console.error("[DriverScanVerify] capture-to-scan error", err);
      Alert.alert("Camera error", "Could not open the camera. Try Manual for now.");
    }
  };

  const handleProceedToCustomer = async () => {
    setSigningOff(true);
    try {
      // 1. Driver signs off on receipt of goods
      if (orderId) {
        await driverSignOff(orderId);
        // 2. Mark order as picked up in backend
        await markPickedUp(orderId);
      }
      setSigningOff(false);
      // 3. Navigate to customer delivery
      navigation.navigate("DriverNavigation", {
        delivery: { ...delivery, orderId },
      });
    } catch {
      Alert.alert("Error", "Failed to sign off. Please try again.");
      setSigningOff(false);
    }
  };

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_SIZE - 4],
  });

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background.primary,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text
          style={{
            color: colors.text.muted,
            marginTop: 12,
            fontSize: 14,
          }}
        >
          Loading order items...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Scanner section (top half) */}
      {scanning && !allScanned ? (
        <View style={st.scannerArea}>
          {/* Mock scanner background (works on simulator and device) */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#111" }]}>
            {/* Overlay with scan frame */}
            <View style={st.overlay}>
              <View style={st.overlayTop} />
              <View style={st.overlayMiddle}>
                <View style={st.overlaySide} />
                <View style={st.scanFrame}>
                  {/* Gold corners */}
                  <View
                    style={[
                      st.corner,
                      st.tl,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.cornerH,
                      st.tlH,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.corner,
                      st.tr,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.cornerH,
                      st.trH,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.corner,
                      st.bl,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.cornerH,
                      st.blH,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.corner,
                      st.br,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <View
                    style={[
                      st.cornerH,
                      st.brH,
                      { backgroundColor: colors.gold.primary },
                    ]}
                  />
                  <Animated.View
                    style={[
                      st.scanLine,
                      {
                        backgroundColor: colors.gold.primary,
                        transform: [{ translateY: scanLineTranslate }],
                      },
                    ]}
                  />
                  {/* Scanner tap area */}
                  <View style={st.simulateTap}>
                    <Icon name="scan-outline" size={32} color={colors.gold.primary} />
                    <Text style={st.simulateTapText}>
                      Point at barcode
                    </Text>
                  </View>
                </View>
                <View style={st.overlaySide} />
              </View>
              <View style={st.overlayBottom} />
            </View>
          </View>

          {/* Close & Torch */}
          <TouchableOpacity
            style={[st.closeBtn, { top: insets.top + 8 }]}
            onPress={() => navigation.goBack()}
          >
            <View
              style={[st.closeBtnInner, { borderColor: colors.gold.border }]}
            >
              <Icon name="close" size={22} color={colors.white} />
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[st.torchBtn, { top: insets.top + 8 }, IS_MOCK_SCANNER && { opacity: 0.4 }]}
            onPress={() => !IS_MOCK_SCANNER && setTorch((p) => !p)}
            disabled={IS_MOCK_SCANNER}
            accessibilityLabel="Toggle torch"
            accessibilityHint={IS_MOCK_SCANNER ? "Torch unavailable in simulated scanner" : undefined}
          >
            <View
              style={[
                st.closeBtnInner,
                { borderColor: colors.gold.border },
                torch && !IS_MOCK_SCANNER && { backgroundColor: colors.gold.primary },
              ]}
            >
              <Icon
                name={torch && !IS_MOCK_SCANNER ? "flash" : "flash-outline"}
                size={20}
                color={torch && !IS_MOCK_SCANNER ? "#050403" : colors.white}
              />
            </View>
          </TouchableOpacity>

          {/* Mock scanner banner — sits below the button row so it never overlaps
              the close/torch controls or the status bar notch. */}
          {IS_MOCK_SCANNER && (
            <View
              style={{
                position: "absolute",
                top: insets.top + 56,
                left: 16,
                right: 16,
                zIndex: 999,
                backgroundColor: "#FFA500E6",
                borderRadius: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                alignItems: "center",
                shadowColor: "#000",
                shadowOpacity: 0.25,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 2 },
                elevation: 4,
              }}
            >
              <Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>
                Simulated scanner — tap Manual or Take Picture
              </Text>
            </View>
          )}

          {/* Scan instruction + camera capture CTA */}
          <View style={st.scanInstruction}>
            <Text style={st.scanInstructionText}>
              Scan product barcodes to verify order items
            </Text>
            <Text style={st.scanCounter}>
              {scannedCount}/{items.length} verified
            </Text>
            <TouchableOpacity
              onPress={handleCaptureToScan}
              style={[st.captureBtn, { borderColor: colors.gold.primary }]}
              accessibilityLabel="Take picture to scan"
            >
              <Icon name="camera-outline" size={18} color={colors.gold.primary} />
              <Text
                style={{
                  color: colors.gold.primary,
                  fontSize: 13,
                  fontWeight: "700",
                }}
              >
                Take Picture to Scan
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        /* All scanned - green header */
        <LinearGradient
          colors={
            allScanned ? [colors.status.success, "#059669"] : [colors.status.info, "#2563EB"]
          }
          style={[st.verifiedHeader, { paddingTop: insets.top + 16 }]}
        >
          <TouchableOpacity
            style={st.verifiedBack}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={22} color={colors.white} />
          </TouchableOpacity>
          <Icon
            name={allScanned ? "checkmark-circle" : "scan-outline"}
            size={48}
            color={colors.white}
          />
          <Text style={st.verifiedTitle}>
            {allScanned ? "All Items Verified!" : "Order Verification"}
          </Text>
          <Text style={st.verifiedSubtitle}>
            {allScanned
              ? "All products match the order. Ready to deliver."
              : `${scannedCount}/${items.length} items scanned`}
          </Text>
        </LinearGradient>
      )}

      {/* Items list */}
      <View
        style={[
          st.itemsSection,
          {
            backgroundColor: colors.background.primary,
            borderColor: colors.gold.border,
          },
        ]}
      >
        <View style={st.itemsHeader}>
          <Text style={[st.itemsTitle, { color: colors.text.primary }]}>
            Order #{delivery?.orderNumber || "N/A"}
          </Text>
          <View
            style={[
              st.progressPill,
              {
                backgroundColor: allScanned ? colors.status.success + "18" : colors.status.warning + "18",
              },
            ]}
          >
            <Icon
              name={allScanned ? "checkmark-circle" : "time-outline"}
              size={14}
              color={allScanned ? colors.status.success : colors.status.warning}
            />
            <Text
              style={{
                color: allScanned ? colors.status.success : colors.status.warning,
                fontSize: 12,
                fontWeight: "700",
              }}
            >
              {scannedCount}/{items.length}
            </Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          {items.map((item) => (
            <View
              key={item.id}
              style={[
                st.itemRow,
                {
                  backgroundColor: item.scanned
                    ? isDark
                      ? "rgba(16,185,129,0.06)"
                      : "rgba(16,185,129,0.04)"
                    : colors.background.card,
                  borderColor: item.scanned
                    ? colors.status.success + "30"
                    : colors.gold.border,
                },
              ]}
            >
              <View
                style={[
                  st.itemCheck,
                  {
                    backgroundColor: item.scanned
                      ? colors.status.success
                      : "transparent",
                    borderColor: item.scanned
                      ? colors.status.success
                      : colors.text.dim,
                  },
                ]}
              >
                {item.scanned ? (
                  <Icon name="checkmark" size={14} color={colors.white} />
                ) : (
                  <Icon
                    name="scan-outline"
                    size={14}
                    color={colors.text.dim}
                  />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    st.itemName,
                    { color: colors.text.primary },
                    item.scanned && {
                      textDecorationLine: "line-through",
                      opacity: 0.6,
                    },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                <Text style={{ fontSize: 11, color: colors.text.dim }}>
                  Qty: {item.qty}
                  {item.barcode ? ` · ${item.barcode}` : ""}
                </Text>
              </View>
              {!item.scanned && (
                <TouchableOpacity
                  onPress={() => handleManualVerify(item.id)}
                  style={[
                    st.manualBtn,
                    { borderColor: colors.gold.border },
                  ]}
                >
                  <Text
                    style={{
                      color: colors.gold.primary,
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    Manual
                  </Text>
                </TouchableOpacity>
              )}
              {item.scanned && (
                <Icon name="checkmark-circle" size={20} color={colors.status.success} />
              )}
            </View>
          ))}

          {/* Proceed button */}
          {allScanned && (
            <TouchableOpacity
              onPress={handleProceedToCustomer}
              activeOpacity={0.85}
              disabled={signingOff}
              style={{ marginTop: 16, marginBottom: 20 }}
            >
              <LinearGradient
                colors={[colors.status.success, "#059669"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[st.proceedBtn, signingOff && { opacity: 0.6 }]}
              >
                <Icon name="navigate" size={22} color={colors.white} />
                <Text style={st.proceedBtnText}>
                  {signingOff
                    ? "Signing off..."
                    : "Sign Off & Navigate to Customer"}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {!allScanned && scanning && (
            <TouchableOpacity
              onPress={() => setScanning(false)}
              style={[
                st.toggleScanBtn,
                { borderColor: colors.gold.border },
              ]}
            >
              <Icon
                name="list-outline"
                size={18}
                color={colors.gold.primary}
              />
              <Text
                style={{
                  color: colors.gold.primary,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                View item list only
              </Text>
            </TouchableOpacity>
          )}
          {!allScanned && !scanning && (
            <TouchableOpacity
              onPress={() => setScanning(true)}
              style={[st.toggleScanBtn, { borderColor: colors.status.info + "30" }]}
            >
              <Icon name="scan-outline" size={18} color={colors.status.info} />
              <Text
                style={{
                  color: colors.status.info,
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                Resume scanning
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const OVERLAY_COLOR = "rgba(5,4,3,0.7)";
const CORNER_SIZE = 28;
const CORNER_W = 4;

const st = StyleSheet.create({
  scannerArea: {
    height: 340,
    position: "relative",
  },
  overlay: { flex: 1 },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  overlayMiddle: { flexDirection: "row" },
  overlaySide: { flex: 1, backgroundColor: OVERLAY_COLOR },
  overlayBottom: { flex: 1, backgroundColor: OVERLAY_COLOR },
  scanFrame: {
    width: SCAN_SIZE,
    height: SCAN_SIZE,
    position: "relative",
  },
  corner: { position: "absolute", width: CORNER_W, height: CORNER_SIZE },
  cornerH: { position: "absolute", width: CORNER_SIZE, height: CORNER_W },
  tl: { top: 0, left: 0 },
  tlH: { top: 0, left: 0 },
  tr: { top: 0, right: 0 },
  trH: { top: 0, right: 0 },
  bl: { bottom: 0, left: 0 },
  blH: { bottom: 0, left: 0 },
  br: { bottom: 0, right: 0 },
  brH: { bottom: 0, right: 0 },
  scanLine: {
    position: "absolute",
    left: CORNER_W,
    right: CORNER_W,
    height: 2,
    opacity: 0.7,
  },
  closeBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
  },
  torchBtn: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(5,4,3,0.6)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  scanInstruction: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scanInstructionText: {
    color: "#FFF",
    fontSize: 13,
    fontWeight: "600",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  scanCounter: {
    color: "#D4AF37",
    fontSize: 15,
    fontWeight: "800",
    marginTop: 2,
  },
  verifiedHeader: {
    paddingBottom: 24,
    alignItems: "center",
    gap: 8,
  },
  verifiedBack: {
    position: "absolute",
    left: 16,
    top: 56,
  },
  verifiedTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "800",
  },
  verifiedSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
  },
  itemsSection: {
    flex: 1,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -16,
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
  },
  itemsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  itemsTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  progressPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.md,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  itemCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  itemName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  manualBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  proceedBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  proceedBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  toggleScanBtn: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    marginTop: 12,
  },
  simulateTap: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  simulateTapText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontWeight: "600",
  },
  captureBtn: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1.5,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});
