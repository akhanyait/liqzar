import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
let ImagePicker: any = null;
try {
  ImagePicker = require("expo-image-picker");
} catch {
  // Native module not available in this build
}
let Location: any = null;
try {
  Location = require("expo-location");
} catch {
  // Native module not available in this build
}
import Icon from "../../components/Icon";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

/* ───────── COMPONENT ───────── */

export default function DriverPhotoProof() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();

  const orderId = route.params?.orderId || route.params?.delivery?.orderId;
  const customerName = route.params?.customerName || route.params?.delivery?.customerName || "";
  const customerAddress = route.params?.customerAddress || route.params?.delivery?.address || "";

  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [gpsLocation, setGpsLocation] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [requirements, setRequirements] = useState([
    { id: "req-1", label: "Show package at door", checked: false },
    { id: "req-2", label: "Visible address number", checked: false },
    { id: "req-3", label: "Clear lighting", checked: false },
  ]);

  useEffect(() => {
    getLocation();
  }, []);

  const getLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === "granted") {
        const loc = await Location.getCurrentPositionAsync({});
        setGpsLocation({
          lat: loc.coords.latitude,
          lng: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
      }
    } catch (error) {
      console.error("Error getting location:", error);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Camera access is required");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setRequirements((prev) => prev.map((r) => ({ ...r, checked: true })));
    }
  };

  const submitProof = async () => {
    if (!photoUri) {
      Alert.alert("Photo Required", "Please take a delivery photo first.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to submit proof.");
      return;
    }
    setSubmitting(true);
    try {
      // Path convention enforced by RLS: {driverId}/{orderId}/{filename}
      const fileName = `${user.id}/${orderId}/${Date.now()}.jpg`;
      const response = await fetch(photoUri);
      const blob = await response.blob();
      const { error: uploadError } = await supabase.storage
        .from("delivery-proofs")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) throw uploadError;

      // Bucket is PRIVATE — issue a signed URL the customer/driver can open.
      const { data: signed } = await supabase.storage
        .from("delivery-proofs")
        .createSignedUrl(fileName, 60 * 60 * 24 * 30); // 30 days

      const { error: insertErr } = await supabase.from("proof_of_delivery").insert({
        order_id: orderId,
        driver_id: user.id,
        photo_url: signed?.signedUrl ?? null,
        photo_storage_path: fileName,
        gps_latitude: gpsLocation?.lat,
        gps_longitude: gpsLocation?.lng,
        gps_accuracy: gpsLocation?.accuracy,
        recipient_name: recipientName,
        notes: deliveryNotes,
      });
      if (insertErr) throw insertErr;

      // Advance the order to delivered so the customer sees completion.
      await supabase
        .from("orders")
        .update({ status: "delivered", delivered_at: new Date().toISOString() })
        .eq("id", orderId);

      Alert.alert("Success", "Delivery proof submitted", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to submit proof");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
          paddingHorizontal: 16,
        }}
      >
        <View style={st.headerRow}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <Text style={[st.headerTitle, { color: colors.text.primary }]}>
            Proof of Delivery
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      >
        {/* Order Info Card */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <View style={st.orderRow}>
            <Icon
              name="receipt-outline"
              size={20}
              color={colors.gold.primary}
            />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                Order
              </Text>
              <Text
                style={{
                  fontSize: 16,
                  fontWeight: "800",
                  color: colors.text.primary,
                }}
              >
                #{orderId || "N/A"}
              </Text>
            </View>
          </View>
          {customerName ? (
            <View style={st.infoLine}>
              <Icon name="person-outline" size={16} color={colors.text.muted} />
              <Text
                style={{
                  fontSize: 14,
                  color: colors.text.primary,
                  marginLeft: 8,
                }}
              >
                {customerName}
              </Text>
            </View>
          ) : null}
          {customerAddress ? (
            <View style={st.infoLine}>
              <Icon
                name="location-outline"
                size={16}
                color={colors.text.muted}
              />
              <Text
                style={{
                  fontSize: 13,
                  color: colors.text.muted,
                  marginLeft: 8,
                  flex: 1,
                }}
              >
                {customerAddress}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Camera Preview Area */}
        <View
          style={[
            st.cameraPreview,
            {
              backgroundColor: isDark ? "#111" : "#1a1a1a",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          {photoUri ? (
            <Image
              source={{ uri: photoUri }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          ) : (
            <View style={st.cameraPlaceholder}>
              <Icon
                name="camera-outline"
                size={56}
                color="rgba(255,255,255,0.3)"
              />
              <Text style={st.cameraPlaceholderText}>Camera Preview</Text>
            </View>
          )}
        </View>

        {/* Take Photo Button */}
        {!photoUri ? (
          <TouchableOpacity
            onPress={takePhoto}
            activeOpacity={0.85}
            style={{ marginBottom: 16 }}
          >
            <LinearGradient
              colors={[colors.status.info, "#2563EB"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={st.takePhotoBtn}
            >
              <Icon name="camera" size={22} color={colors.white} />
              <Text style={st.takePhotoBtnText}>Take Photo</Text>
            </LinearGradient>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={() => setPhotoUri(null)}
            style={[
              st.retakeBtn,
              {
                borderColor: isDark
                  ? "rgba(212,175,55,0.15)"
                  : "rgba(212,175,55,0.25)",
              },
            ]}
          >
            <Icon
              name="camera-reverse-outline"
              size={18}
              color={colors.gold.primary}
            />
            <Text
              style={{
                color: colors.gold.primary,
                fontWeight: "600",
                fontSize: 14,
              }}
            >
              Retake Photo
            </Text>
          </TouchableOpacity>
        )}

        {/* Photo Requirements Checklist */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Photo Requirements
          </Text>
          {requirements.map((req) => (
            <View key={req.id} style={st.requirementRow}>
              <View
                style={[
                  st.checkCircle,
                  {
                    backgroundColor: req.checked ? colors.status.success : "transparent",
                    borderColor: req.checked ? colors.status.success : colors.text.dim,
                  },
                ]}
              >
                {req.checked && (
                  <Icon name="checkmark" size={14} color={colors.white} />
                )}
              </View>
              <Text
                style={{
                  fontSize: 14,
                  color: req.checked ? colors.text.primary : colors.text.muted,
                  marginLeft: 10,
                }}
              >
                {req.label}
              </Text>
            </View>
          ))}
        </View>

        {/* Recipient Name */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Recipient Name
          </Text>
          <TextInput
            style={[
              st.notesInput,
              {
                backgroundColor: colors.background.primary,
                borderColor: isDark
                  ? "rgba(212,175,55,0.1)"
                  : "rgba(212,175,55,0.2)",
                color: colors.text.primary,
                minHeight: 44,
              },
            ]}
            placeholder="Name of person who received delivery..."
            placeholderTextColor={colors.text.dim}
            value={recipientName}
            onChangeText={setRecipientName}
          />
        </View>

        {/* Delivery Notes */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Delivery Notes
          </Text>
          <TextInput
            style={[
              st.notesInput,
              {
                backgroundColor: colors.background.primary,
                borderColor: isDark
                  ? "rgba(212,175,55,0.1)"
                  : "rgba(212,175,55,0.2)",
                color: colors.text.primary,
              },
            ]}
            placeholder="Add delivery notes..."
            placeholderTextColor={colors.text.dim}
            multiline
            value={deliveryNotes}
            onChangeText={setDeliveryNotes}
          />
        </View>

        {/* GPS Location Pin */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <View style={st.gpsRow}>
            <View
              style={[
                st.gpsPinBg,
                {
                  backgroundColor: gpsLocation
                    ? "rgba(16,185,129,0.12)"
                    : "rgba(245,158,11,0.12)",
                },
              ]}
            >
              <Icon
                name="location"
                size={20}
                color={gpsLocation ? colors.status.success : colors.status.warning}
              />
            </View>
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "700",
                  color: gpsLocation ? colors.status.success : colors.status.warning,
                }}
              >
                {gpsLocation ? "Location Verified" : "Getting location..."}
              </Text>
              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                {gpsLocation
                  ? `Lat: ${gpsLocation.lat.toFixed(4)}, Lng: ${gpsLocation.lng.toFixed(4)} (accuracy: ${gpsLocation.accuracy?.toFixed(0)}m)`
                  : "Waiting for GPS signal"}
              </Text>
            </View>
            {!gpsLocation && (
              <TouchableOpacity onPress={getLocation}>
                <Icon
                  name="refresh-outline"
                  size={20}
                  color={colors.text.muted}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Signature Pad Area */}
        <View
          style={[
            st.card,
            {
              backgroundColor: isDark ? "#1a1510" : "#F5F3EF",
              borderColor: isDark
                ? "rgba(212,175,55,0.15)"
                : "rgba(212,175,55,0.25)",
            },
          ]}
        >
          <Text
            style={{
              fontSize: 15,
              fontWeight: "700",
              color: colors.text.primary,
              marginBottom: 10,
            }}
          >
            Customer Signature
          </Text>
          <View
            style={[
              st.signatureBox,
              {
                borderColor: isDark
                  ? "rgba(212,175,55,0.2)"
                  : "rgba(212,175,55,0.35)",
                backgroundColor: colors.background.primary,
              },
            ]}
          >
            <Icon name="pencil-outline" size={28} color={colors.text.dim} />
            <Text
              style={{ fontSize: 13, color: colors.text.dim, marginTop: 6 }}
            >
              Customer signature
            </Text>
            <Text style={{ fontSize: 11, color: colors.text.dim }}>
              Tap here to sign
            </Text>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={submitProof}
          activeOpacity={0.85}
          disabled={submitting}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={[colors.gold.primary, "#E8960F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[st.submitBtn, submitting && { opacity: 0.6 }]}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Icon name="checkmark-done-outline" size={22} color={colors.white} />
            )}
            <Text style={st.submitBtnText}>
              {submitting
                ? "Submitting..."
                : "Submit Proof & Complete Delivery"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

/* ───────── STYLES ───────── */

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

  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  cameraPreview: {
    height: 300,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  cameraPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
  },
  cameraPlaceholderText: {
    color: "rgba(255,255,255,0.3)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 8,
  },

  takePhotoBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  takePhotoBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "800",
  },
  retakeBtn: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },

  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },

  notesInput: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: 12,
    minHeight: 80,
    fontSize: 14,
    textAlignVertical: "top",
  },

  gpsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  gpsPinBg: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },

  signatureBox: {
    height: 120,
    borderRadius: borderRadius.sm,
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },

  submitBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
  },
  submitBtnText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
