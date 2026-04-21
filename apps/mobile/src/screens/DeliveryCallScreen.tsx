import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import { useRoute, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Icon from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { useCallToken } from "../hooks/useCallToken";

/**
 * DeliveryCallScreen — opens the Daily.co room in the system in-app browser
 * (full camera/mic support) and returns to the app when the user dismisses
 * it. The actual WebRTC session runs inside Safari/Chrome.
 */
export default function DeliveryCallScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const orderId: string = route.params?.orderId;
  const { request } = useCallToken();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!orderId) {
        navigation.goBack();
        return;
      }
      const token = await request(orderId);
      if (cancelled) return;
      if (!token) {
        Alert.alert(
          "Call unavailable",
          "Video calls are not set up on this account yet.",
          [{ text: "OK", onPress: () => navigation.goBack() }],
        );
        return;
      }
      const sep = token.roomUrl.includes("?") ? "&" : "?";
      const url = `${token.roomUrl}${sep}t=${encodeURIComponent(token.token)}`;
      try {
        await WebBrowser.openBrowserAsync(url, {
          dismissButtonStyle: "done",
          enableBarCollapsing: false,
        });
      } catch {
        await Linking.openURL(url);
      } finally {
        if (!cancelled) navigation.goBack();
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  return (
    <View
      style={[
        st.root,
        { backgroundColor: colors.background.primary, paddingTop: insets.top },
      ]}
    >
      <View style={st.center}>
        <ActivityIndicator size="large" color={colors.gold.primary} />
        <Text style={[st.label, { color: colors.text.primary }]}>
          Connecting call…
        </Text>
        <Text style={[st.hint, { color: colors.text.muted }]}>
          The call will open in your browser with camera & microphone.
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={[st.cancelBtn, { borderColor: colors.text.dim }]}
      >
        <Icon name="close" size={20} color={colors.text.primary} />
        <Text style={{ color: colors.text.primary, fontWeight: "600" }}>
          Cancel
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 24 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  label: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 13, textAlign: "center", maxWidth: 280 },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderWidth: 1,
    borderRadius: 999,
    marginBottom: 24,
  },
});
