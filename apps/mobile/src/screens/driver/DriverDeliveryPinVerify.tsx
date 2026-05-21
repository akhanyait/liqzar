import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Alert,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import BrandMark from "../../components/BrandMark";
import { useTheme } from "../../contexts/ThemeContext";
import { useOrders } from "../../contexts/OrderContext";
import { useAuth } from "../../contexts/AuthContext";
import { ComplianceService } from "../../services/ComplianceService";
import { PaymentService } from "../../services/PaymentService";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");
const PIN_LENGTH = 4;

export default function DriverDeliveryPinVerify() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { colors, isDark } = useTheme();
  const { verifyDeliveryPin, markDelivered, updateOrderStatus } = useOrders();
  const { user } = useAuth();

  const delivery = route.params?.delivery;
  const orderId = delivery?.orderId || delivery?.id;

  // ── Compliance pre-check gate ──────────────────────────────────────────────
  // SA Liquor Act requires ID verification, age verification, and sobriety check
  // at every handoff. This step runs before PIN entry.
  const [complianceStep, setComplianceStep] = useState<"check" | "pin">("check");
  const [idVerified, setIdVerified] = useState<boolean | null>(null);
  const [isAdult, setIsAdult] = useState<boolean | null>(null);
  const [appearsSober, setAppearsSober] = useState<boolean | null>(null);
  const [complianceLoading, setComplianceLoading] = useState(false);

  const handleComplianceSubmit = async () => {
    if (idVerified === null || isAdult === null || appearsSober === null) {
      Alert.alert("Required", "Please answer all compliance questions before proceeding.");
      return;
    }

    // Always run the full compliance check regardless of local boolean state.
    // This ensures compliance_verified is written to the order on the happy path
    // (required by OrderWorkflowEngine before the delivered transition is allowed)
    // and that every outcome — pass or fail — is logged to the audit trail.
    setComplianceLoading(true);
    try {
      const driverId = user?.id || "unknown";
      const result = await ComplianceService.performHandoffCheck({
        orderId,
        driverId,
        recipientName: delivery?.customerName || "Recipient",
        idVerified: idVerified ?? false,
        recipientIsAdult: isAdult ?? false,
        recipientAppearsSober: appearsSober ?? false,
      });

      if (result.auditLogFailed) {
        console.error(
          `[DriverDeliveryPinVerify] Compliance audit log failed for order ${orderId}. ` +
          `Blocking delivery to protect audit trail integrity. [DEF-003]`,
        );
        Alert.alert(
          "Audit Log Error",
          "This compliance event could not be recorded. " +
          "Delivery is blocked until the audit trail is restored. " +
          "Please contact dispatch immediately.",
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
        return; // [DEF-003] MUST NOT advance to PIN entry with a broken audit trail.
      }

      if (result.passed) {
        // compliance_verified is now true on the order — proceed to PIN entry
        setComplianceStep("pin");
        return;
      }

      // Handle payment action for failed deliveries
      if (result.paymentAction === "refund_required") {
        const refundReason = result.blockingReason || "Delivery refused — compliance failure";
        const refunded = await PaymentService.requestRefund(orderId, refundReason);
        Alert.alert(
          "Delivery Refused",
          refunded
            ? `${result.blockingReason}\n\nA refund has been initiated for the customer.`
            : `${result.blockingReason}\n\nRefund initiation failed — please contact dispatch to process manually.`,
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
      } else if (result.paymentAction === "hold") {
        Alert.alert(
          "Delivery Cannot Proceed",
          `${result.blockingReason}\n\nFunds have been placed on hold. Contact dispatch to reschedule.`,
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
      } else {
        Alert.alert(
          "Delivery Refused",
          result.blockingReason || "Delivery cannot proceed.",
          [{ text: "OK", onPress: () => navigation.popToTop() }],
        );
      }
    } catch (err) {
      console.error("[DriverDeliveryPinVerify] Compliance check error:", err);
      Alert.alert("Error", "Failed to process compliance check. Contact dispatch.");
    } finally {
      setComplianceLoading(false);
    }
  };
  // ── End compliance gate ────────────────────────────────────────────────────

  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(""));
  const [activeIndex, setActiveIndex] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  // [DEF-006] Initialise to 0/true (most restrictive) until DB confirms the real state.
  // The useEffect below immediately syncs from DB when the PIN step becomes active.
  // Using 0/true as defaults prevents a stale "3 attempts remaining" flash on remount.
  const [attemptsRemaining, setAttemptsRemaining] = useState(0);
  const [locked, setLocked] = useState(true);
  const [lockStateLoading, setLockStateLoading] = useState(true);

  // [DEF-006] Sync PIN lock state from the database whenever the PIN step becomes active.
  // React state resets on unmount so a driver who used 2 attempts, killed the app,
  // and reopened would otherwise see "3 attempts remaining" instead of the true count.
  useEffect(() => {
    if (!orderId || complianceStep !== "pin") return;

    let cancelled = false;
    setLockStateLoading(true);

    supabase
      .rpc("get_pin_status", { p_order_id: orderId })
      .then(({ data, error: rpcErr }) => {
        if (cancelled) return;
        if (rpcErr) {
          // RPC unavailable — fail open with 1 attempt to avoid permanently blocking
          // a valid delivery, but log for investigation.
          console.error("[DriverDeliveryPinVerify] get_pin_status RPC failed:", rpcErr);
          setAttemptsRemaining(1);
          setLocked(false);
        } else if (data) {
          setAttemptsRemaining(data.attempts_remaining ?? 0);
          setLocked(data.locked ?? false);
        }
        setLockStateLoading(false);
      });

    return () => { cancelled = true; };
  }, [orderId, complianceStep]);

  const shakeAnim = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(0)).current;

  const handleDigitPress = (digit: string) => {
    if (locked || verifying || verified) return;
    if (activeIndex >= PIN_LENGTH) return;

    const newPin = [...pin];
    newPin[activeIndex] = digit;
    setPin(newPin);
    setError("");

    if (activeIndex === PIN_LENGTH - 1) {
      // All digits entered — auto verify
      const fullPin = newPin.join("");
      handleVerify(fullPin);
    } else {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleBackspace = () => {
    if (locked || verifying || verified) return;
    if (activeIndex === 0 && pin[0] === "") return;

    const newIdx =
      pin[activeIndex] !== "" ? activeIndex : Math.max(0, activeIndex - 1);
    const newPin = [...pin];
    newPin[newIdx] = "";
    setPin(newPin);
    setActiveIndex(newIdx);
    setError("");
  };

  const handleVerify = async (fullPin: string) => {
    setVerifying(true);
    setError("");

    try {
      const result = await verifyDeliveryPin(orderId, fullPin);

      if (result.verified) {
        setVerified(true);
        // Success animation
        Animated.spring(successScale, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }).start();

        // Mark as delivered in backend
        await markDelivered(orderId);

        // Navigate to trip summary after brief delay
        setTimeout(() => {
          navigation.navigate("DriverTripSummary" as never, { delivery: { ...delivery, orderId } } as never);
        }, 1500);
      } else {
        // Error shake animation
        Animated.sequence([
          Animated.timing(shakeAnim, {
            toValue: 15,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -15,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 10,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: -10,
            duration: 60,
            useNativeDriver: true,
          }),
          Animated.timing(shakeAnim, {
            toValue: 0,
            duration: 60,
            useNativeDriver: true,
          }),
        ]).start();

        setAttemptsRemaining(result.attemptsRemaining ?? attemptsRemaining - 1);

        if (
          result.locked ||
          (result.attemptsRemaining !== undefined &&
            result.attemptsRemaining <= 0)
        ) {
          setLocked(true);
          setError("Maximum attempts exceeded. Contact support.");
        } else {
          setError(result.error || "Incorrect PIN. Try again.");
        }

        // Reset PIN input
        setPin(Array(PIN_LENGTH).fill(""));
        setActiveIndex(0);
      }

      setVerifying(false);
    } catch {
      setVerifying(false);
      setError("Network error. Please try again.");
      setPin(Array(PIN_LENGTH).fill(""));
      setActiveIndex(0);
    }
  };

  const handleContactSupport = () => {
    Alert.alert("Contact Support", "Call dispatch to resolve this delivery.", [
      { text: "Cancel", style: "cancel" },
      { text: "Call Dispatch", onPress: () => {} },
    ]);
  };

  const handleCustomerUnavailable = () => {
    Alert.alert(
      "Report Delivery Issue",
      "Select a reason for the failed delivery:",
      [
        {
          text: "Customer Unavailable",
          style: "destructive",
          onPress: async () => {
            try {
              await updateOrderStatus(orderId, "delivery_failed", { reason: "Customer Unavailable" });
            } catch (e) {
              console.warn("[DriverDeliveryPinVerify] Failed to update status:", e);
            }
            navigation.popToTop();
          },
        },
        {
          text: "Damaged Goods",
          style: "destructive",
          onPress: async () => {
            try {
              await updateOrderStatus(orderId, "delivery_failed", { reason: "Damaged Goods" });
            } catch (e) {
              console.warn("[DriverDeliveryPinVerify] Failed to update status:", e);
            }
            navigation.popToTop();
          },
        },
        {
          text: "Wrong Address",
          style: "destructive",
          onPress: async () => {
            try {
              await updateOrderStatus(orderId, "delivery_failed", { reason: "Wrong Address" });
            } catch (e) {
              console.warn("[DriverDeliveryPinVerify] Failed to update status:", e);
            }
            navigation.popToTop();
          },
        },
        { text: "Cancel", style: "cancel" },
      ],
    );
  };

  const KEYPAD = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["", "0", "back"],
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 20,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="Go back"
            accessibilityRole="button"
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              Verify Delivery
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {/* Customer Info */}
      <View
        style={[
          st.customerCard,
          {
            backgroundColor: colors.background.card,
            borderColor: colors.gold.border,
          },
        ]}
      >
        <View style={st.customerRow}>
          <View
            style={[
              st.customerAvatar,
              {
                backgroundColor: isDark
                  ? "rgba(212,175,55,0.1)"
                  : "rgba(212,175,55,0.08)",
              },
            ]}
          >
            <Icon name="person" size={24} color={colors.gold.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[st.customerName, { color: colors.text.primary }]}>
              {delivery?.customerName || "Customer"}
            </Text>
            <Text style={{ color: colors.text.muted, fontSize: 13 }}>
              Order #{delivery?.orderNumber}
            </Text>
          </View>
        </View>
      </View>

      {/* ── Compliance Gate (shown before PIN entry) ─────────────────────── */}
      {complianceStep === "check" && (
        <View style={[st.pinSection, { gap: 0 }]}>
          <Text style={[st.pinInstruction, { color: colors.text.primary, fontWeight: "700", fontSize: 16, marginBottom: 4 }]}>
            Compliance Check
          </Text>
          <Text style={{ color: colors.text.muted, fontSize: 13, textAlign: "center", marginBottom: 24 }}>
            SA Liquor Act — confirm all items before delivering
          </Text>

          {[
            { key: "id", label: "Did you verify recipient's ID?", value: idVerified, setter: setIdVerified },
            { key: "age", label: "Is the recipient 18 or older?", value: isAdult, setter: setIsAdult },
            { key: "sober", label: "Does the recipient appear sober?", value: appearsSober, setter: setAppearsSober },
          ].map((item) => (
            <View
              key={item.key}
              style={[st.complianceRow, { backgroundColor: colors.background.card, borderColor: colors.border }]}
            >
              <Text style={[st.complianceLabel, { color: colors.text.primary }]}>
                {item.label}
              </Text>
              <View style={st.complianceButtons}>
                <TouchableOpacity
                  onPress={() => item.setter(true)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} Yes`}
                  style={[
                    st.complianceBtn,
                    item.value === true
                      ? { backgroundColor: "#10B981", borderColor: "#10B981" }
                      : { borderColor: colors.border },
                  ]}
                >
                  <Text style={[st.complianceBtnText, { color: item.value === true ? "#fff" : colors.text.muted }]}>
                    Yes
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => item.setter(false)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.label} No`}
                  style={[
                    st.complianceBtn,
                    item.value === false
                      ? { backgroundColor: "#EF4444", borderColor: "#EF4444" }
                      : { borderColor: colors.border },
                  ]}
                >
                  <Text style={[st.complianceBtnText, { color: item.value === false ? "#fff" : colors.text.muted }]}>
                    No
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}

          <TouchableOpacity
            onPress={handleComplianceSubmit}
            disabled={complianceLoading || idVerified === null || isAdult === null || appearsSober === null}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Submit compliance check"
            style={{
              marginTop: 24,
              width: "100%",
              opacity: idVerified === null || isAdult === null || appearsSober === null ? 0.5 : 1,
            }}
          >
            <LinearGradient
              colors={["#D4AF37", "#B8962E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.supportBtn}
            >
              {complianceLoading ? (
                <ActivityIndicator color="#000" />
              ) : (
                <>
                  <Icon name="checkmark-circle" size={20} color="#000" />
                  <Text style={[st.supportBtnText, { color: "#000" }]}>
                    {idVerified && isAdult && appearsSober
                      ? "Continue to PIN Entry"
                      : "Submit & Refuse Delivery"}
                  </Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* ── PIN Entry (shown after compliance gate passes) ─────────────────── */}
      {complianceStep === "pin" && lockStateLoading && (
        <View style={[st.pinSection, { justifyContent: "center" }]}>
          <ActivityIndicator size="large" color="#D4AF37" />
          <Text style={{ color: "#D4AF37", marginTop: 12, fontSize: 14 }}>
            Checking verification status...
          </Text>
        </View>
      )}
      {complianceStep === "pin" && !lockStateLoading && (
      <View style={st.pinSection}>{verified ? (
          <Animated.View
            style={[
              st.successContainer,
              { transform: [{ scale: successScale }] },
            ]}
          >
            <View style={st.successCircle}>
              <Icon name="checkmark" size={48} color={colors.white} />
            </View>
            <Text style={[st.successText, { color: colors.text.primary }]}>
              PIN Verified!
            </Text>
            <Text
              style={{
                color: colors.text.muted,
                fontSize: 14,
                textAlign: "center",
              }}
            >
              Delivery confirmed successfully
            </Text>
          </Animated.View>
        ) : (
          <>
            <Text style={[st.pinInstruction, { color: colors.text.muted }]}>
              Enter the 4-digit PIN shown on customer's app
            </Text>

            {/* PIN Boxes */}
            <Animated.View
              style={[st.pinBoxRow, { transform: [{ translateX: shakeAnim }] }]}
            >
              {pin.map((digit, i) => (
                <View
                  key={i}
                  style={[
                    st.pinBox,
                    {
                      borderColor: error
                        ? colors.status.error
                        : i === activeIndex
                          ? colors.gold.primary
                          : digit
                            ? colors.gold.primary
                            : colors.border,
                      backgroundColor: digit
                        ? isDark
                          ? "rgba(212,175,55,0.08)"
                          : "rgba(212,175,55,0.05)"
                        : colors.background.card,
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.pinDigit,
                      { color: digit ? colors.gold.primary : colors.text.dim },
                    ]}
                  >
                    {digit || (i === activeIndex ? "·" : "")}
                  </Text>
                </View>
              ))}
            </Animated.View>

            {/* Error / Attempts */}
            {error ? (
              <Text style={st.errorText}>{error}</Text>
            ) : (
              <Text
                style={{
                  color: colors.text.dim,
                  fontSize: 12,
                  textAlign: "center",
                  marginTop: 8,
                }}
              >
                {attemptsRemaining} attempt{attemptsRemaining !== 1 ? "s" : ""}{" "}
                remaining
              </Text>
            )}

            {/* Keypad */}
            {!locked && (
              <View style={st.keypad}>
                {KEYPAD.map((row, rowIdx) => (
                  <View key={rowIdx} style={st.keypadRow}>
                    {row.map((key) => (
                      <TouchableOpacity
                        key={key || "empty"}
                        style={[
                          st.keypadKey,
                          {
                            backgroundColor: key
                              ? isDark
                                ? "rgba(255,255,255,0.05)"
                                : "rgba(0,0,0,0.03)"
                              : "transparent",
                          },
                          !key && { opacity: 0 },
                        ]}
                        onPress={() => {
                          if (key === "back") handleBackspace();
                          else if (key) handleDigitPress(key);
                        }}
                        disabled={!key || verifying}
                        activeOpacity={0.6}
                        accessibilityLabel={key === "back" ? "Delete digit" : key ? 'Enter digit ' + key : undefined}
                        accessibilityRole={key ? "button" : undefined}
                      >
                        {key === "back" ? (
                          <Icon
                            name="backspace-outline"
                            size={24}
                            color={colors.text.primary}
                          />
                        ) : (
                          <Text
                            style={[
                              st.keypadText,
                              { color: colors.text.primary },
                            ]}
                          >
                            {key}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {/* Locked state: Contact support */}
            {locked && (
              <TouchableOpacity
                onPress={handleContactSupport}
                activeOpacity={0.85}
                style={{ marginTop: 24, width: "100%" }}
              >
                <LinearGradient
                  colors={[colors.status.error, "#DC2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={st.supportBtn}
                >
                  <Icon name="call" size={20} color={colors.white} />
                  <Text style={st.supportBtnText}>Contact Support</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            {/* Customer not available */}
            <TouchableOpacity
              onPress={handleCustomerUnavailable}
              style={{ marginTop: 16 }}
            >
              <Text
                style={{
                  color: colors.text.muted,
                  fontSize: 14,
                  textDecorationLine: "underline",
                }}
              >
                Customer not available
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      )}

      {verifying && (
        <View style={st.loadingOverlay}>
          <Text style={{ color: colors.gold.primary, fontSize: 16, fontWeight: "700" }}>
            Verifying...
          </Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  customerCard: {
    marginHorizontal: spacing.md,
    marginTop: 16,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 16,
  },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  customerName: { fontSize: 17, fontWeight: "700", marginBottom: 2 },
  pinSection: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingTop: 32,
  },
  pinInstruction: { fontSize: 15, textAlign: "center", marginBottom: 24 },
  pinBoxRow: { flexDirection: "row", gap: 14 },
  pinBox: {
    width: 64,
    height: 72,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  pinDigit: { fontSize: 32, fontWeight: "800" },
  errorText: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 10,
    textAlign: "center",
  },
  keypad: { marginTop: 32, width: "100%" },
  keypadRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 16,
    marginBottom: 12,
  },
  keypadKey: {
    width: 72,
    height: 56,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  keypadText: { fontSize: 26, fontWeight: "600" },
  supportBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  supportBtnText: { color: "#FFF", fontSize: 17, fontWeight: "800" },
  successContainer: { alignItems: "center", gap: 16, paddingTop: 40 },
  successCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#10B981",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  successText: { fontSize: 28, fontWeight: "800" },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(5,4,3,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  // Compliance gate styles
  complianceRow: {
    width: "100%",
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    gap: 10,
  },
  complianceLabel: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  complianceButtons: { flexDirection: "row", gap: 10 },
  complianceBtn: {
    flex: 1,
    height: 40,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  complianceBtnText: { fontSize: 15, fontWeight: "700" },
});
