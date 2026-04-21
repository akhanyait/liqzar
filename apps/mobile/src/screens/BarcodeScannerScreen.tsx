import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera/next";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import { productsApi } from "../services/api";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius, typography } from "../theme";

const { width, height } = Dimensions.get("window");
const SCAN_AREA_SIZE = width * 0.7;

export default function BarcodeScannerScreen() {
  const navigation = useNavigation<any>();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [searching, setSearching] = useState(false);
  const notFoundOpacity = useRef(new Animated.Value(0)).current;
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  // Animated scan line
  useEffect(() => {
    const animation = Animated.loop(
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
    animation.start();
    return () => animation.stop();
  }, []);

  // Auto-dismiss "not found" toast
  useEffect(() => {
    if (notFound) {
      Animated.sequence([
        Animated.timing(notFoundOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.delay(2500),
        Animated.timing(notFoundOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setNotFound(false);
        setScanned(false);
      });
    }
  }, [notFound]);

  const handleBarCodeScanned = async ({
    type,
    data,
  }: {
    type: string;
    data: string;
  }) => {
    if (scanned || searching) return;
    setScanned(true);
    setSearching(true);

    try {
      const products = await productsApi.getProducts({ search: data });

      if (products && products.length > 0) {
        navigation.navigate("ProductDetail", { productId: products[0].id });
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.log("Barcode search error:", error);
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  };

  // Permission not yet determined
  if (!permission) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background.primary }]}>
        <View style={styles.permissionContent}>
          <View style={[styles.permissionIconContainer, { backgroundColor: colors.gold.faint, borderColor: colors.gold.border }]}>
            <Icon name="camera-outline" size={48} color={colors.gold.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.text.primary }]}>Camera Access</Text>
          <Text style={[styles.permissionText, { color: colors.text.muted }]}>
            Loading camera permissions...
          </Text>
        </View>
      </View>
    );
  }

  // Permission denied - show request screen
  if (!permission.granted) {
    return (
      <View style={[styles.permissionContainer, { backgroundColor: colors.background.primary }]}>
        <TouchableOpacity
          style={[styles.closeButtonPermission, { backgroundColor: colors.background.card, borderColor: colors.gold.border }]}
          onPress={() => navigation.goBack()}
        >
          <Icon name="close" size={24} color={colors.text.primary} />
        </TouchableOpacity>

        <View style={styles.permissionContent}>
          <View style={[styles.permissionIconContainer, { backgroundColor: colors.gold.faint, borderColor: colors.gold.border }]}>
            <Icon name="camera-outline" size={48} color={colors.gold.primary} />
          </View>
          <Text style={[styles.permissionTitle, { color: colors.text.primary }]}>Camera Access Required</Text>
          <Text style={[styles.permissionText, { color: colors.text.muted }]}>
            LIQZAR needs camera access to scan product barcodes and find
            products instantly.
          </Text>
          <TouchableOpacity
            style={[styles.grantButton, shadows.gold]}
            onPress={requestPermission}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[colors.gold.primary, colors.gold.dark]}
              style={styles.grantButtonGradient}
            >
              <Icon
                name="camera-outline"
                size={20}
                color={colors.text.inverse}
              />
              <Text style={[styles.grantButtonText, { color: colors.text.inverse }]}>Grant Access</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const scanLineTranslate = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCAN_AREA_SIZE - 4],
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      {/* Camera View */}
      <CameraView
        style={styles.camera}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: [
            "ean13",
            "ean8",
            "upc_a",
            "upc_e",
            "code128",
            "code39",
            "code93",
            "qr",
          ],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      >
        {/* Dark overlay with transparent scan area */}
        <View style={styles.overlay}>
          {/* Top overlay */}
          <View style={styles.overlayTop}>
            <Text style={[styles.scanText, { color: colors.text.primary }]}>Scan a product barcode</Text>
            {searching && (
              <Text style={[styles.searchingText, { color: colors.gold.primary }]}>Searching product...</Text>
            )}
          </View>

          {/* Middle row: left overlay | scan area | right overlay */}
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />

            {/* Scan Area */}
            <View style={styles.scanArea}>
              {/* Gold corner brackets */}
              {/* Top-left */}
              <View style={[styles.corner, styles.cornerTopLeft, { backgroundColor: colors.gold.primary }]} />
              <View style={[styles.cornerH, styles.cornerHTopLeft, { backgroundColor: colors.gold.primary }]} />

              {/* Top-right */}
              <View style={[styles.corner, styles.cornerTopRight, { backgroundColor: colors.gold.primary }]} />
              <View style={[styles.cornerH, styles.cornerHTopRight, { backgroundColor: colors.gold.primary }]} />

              {/* Bottom-left */}
              <View style={[styles.corner, styles.cornerBottomLeft, { backgroundColor: colors.gold.primary }]} />
              <View style={[styles.cornerH, styles.cornerHBottomLeft, { backgroundColor: colors.gold.primary }]} />

              {/* Bottom-right */}
              <View style={[styles.corner, styles.cornerBottomRight, { backgroundColor: colors.gold.primary }]} />
              <View style={[styles.cornerH, styles.cornerHBottomRight, { backgroundColor: colors.gold.primary }]} />

              {/* Animated scan line */}
              <Animated.View
                style={[
                  styles.scanLine,
                  { backgroundColor: colors.gold.primary, transform: [{ translateY: scanLineTranslate }] },
                ]}
              />
            </View>

            <View style={styles.overlaySide} />
          </View>

          {/* Bottom overlay */}
          <View style={styles.overlayBottom} />
        </View>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <View style={[styles.closeButtonInner, { borderColor: colors.gold.border }]}>
            <Icon name="close" size={24} color={colors.text.primary} />
          </View>
        </TouchableOpacity>

        {/* Torch Toggle */}
        <View style={styles.bottomControls}>
          <TouchableOpacity
            style={[
              styles.torchButton,
              { borderColor: colors.gold.border },
              torch && { backgroundColor: colors.gold.primary, borderColor: colors.gold.primary },
            ]}
            onPress={() => setTorch((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Icon
              name={torch ? "flash" : "flash-outline"}
              size={24}
              color={torch ? colors.text.inverse : colors.gold.primary}
            />
            <Text style={[styles.torchText, { color: colors.gold.primary }, torch && { color: colors.text.inverse }]}>
              {torch ? "Torch On" : "Torch"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Not Found Toast */}
        {notFound && (
          <Animated.View
            style={[styles.notFoundToast, { opacity: notFoundOpacity }]}
          >
            <View style={[styles.notFoundContent, { backgroundColor: colors.background.card, borderColor: "rgba(245, 158, 11, 0.3)" }, shadows.card]}>
              <Icon
                name="alert-circle-outline"
                size={22}
                color={colors.status.warning}
              />
              <Text style={[styles.notFoundText, { color: colors.text.primary }]}>
                Product not found. Try scanning again.
              </Text>
            </View>
          </Animated.View>
        )}
      </CameraView>
    </View>
  );
}

const CORNER_SIZE = 30;
const CORNER_WIDTH = 4;
const OVERLAY_COLOR = "rgba(5, 4, 3, 0.75)";

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  // Permission screens
  permissionContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  closeButtonPermission: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: spacing.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  permissionContent: {
    alignItems: "center",
    paddingHorizontal: spacing.xl,
  },
  permissionIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
    borderWidth: 1,
  },
  permissionTitle: {
    ...typography.h2,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  permissionText: {
    ...typography.body,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  grantButton: {
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  grantButtonGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  grantButtonText: {
    ...typography.button,
  },
  // Overlay
  overlay: {
    flex: 1,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingBottom: spacing.lg,
  },
  scanText: {
    ...typography.h4,
    textAlign: "center",
  },
  searchingText: {
    ...typography.bodySmall,
    marginTop: spacing.xs,
  },
  overlayMiddle: {
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  // Scan Area
  scanArea: {
    width: SCAN_AREA_SIZE,
    height: SCAN_AREA_SIZE,
    position: "relative",
  },
  // Vertical corner pieces
  corner: {
    position: "absolute",
    width: CORNER_WIDTH,
    height: CORNER_SIZE,
  },
  // Horizontal corner pieces
  cornerH: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_WIDTH,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
  },
  cornerHTopLeft: {
    top: 0,
    left: 0,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
  },
  cornerHTopRight: {
    top: 0,
    right: 0,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
  },
  cornerHBottomLeft: {
    bottom: 0,
    left: 0,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
  },
  cornerHBottomRight: {
    bottom: 0,
    right: 0,
  },
  // Animated scan line
  scanLine: {
    position: "absolute",
    left: CORNER_WIDTH,
    right: CORNER_WIDTH,
    height: 2,
    opacity: 0.7,
  },
  // Close button
  closeButton: {
    position: "absolute",
    top: Platform.OS === "ios" ? 56 : 40,
    right: spacing.md,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(5, 4, 3, 0.6)",
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  // Bottom controls
  bottomControls: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 60 : 40,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  torchButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(5, 4, 3, 0.6)",
    borderWidth: 1,
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  torchText: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  // Not found toast
  notFoundToast: {
    position: "absolute",
    top: Platform.OS === "ios" ? 110 : 90,
    left: spacing.lg,
    right: spacing.lg,
  },
  notFoundContent: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm,
  },
  notFoundText: {
    ...typography.bodySmall,
    flex: 1,
  },
});
