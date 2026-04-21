import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../components/Icon";
import { useTheme } from "../contexts/ThemeContext";
import { spacing, borderRadius } from "../theme";
import { useDeliveryChat, DeliveryMessage } from "../hooks/useDeliveryChat";
import { useAuth } from "../contexts/AuthContext";

/**
 * DeliveryChatScreen — customer ↔ driver chat for an in-flight order.
 * Backed by `delivery_messages` (migration 014) via `useDeliveryChat`.
 */
const DeliveryChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId as string | undefined;
  const { colors } = useTheme();
  const { user } = useAuth();

  const { messages, loading, sendMessage, markAllRead, senderRole } =
    useDeliveryChat(orderId);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList<DeliveryMessage>>(null);

  useEffect(() => {
    markAllRead();
  }, [messages.length, markAllRead]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const onSend = useCallback(async () => {
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await sendMessage(draft);
      setDraft("");
    } catch {
      // error toasted elsewhere; keep draft so user can retry
    } finally {
      setSending(false);
    }
  }, [draft, sending, sendMessage]);

  const renderItem = ({ item }: { item: DeliveryMessage }) => {
    const isMe = item.sender_id === user?.id;
    const isSystem = item.sender_role === "system";
    if (isSystem) {
      return (
        <View style={styles.systemRow}>
          <Text style={[styles.systemText, { color: colors.text.muted }]}>
            {item.body}
          </Text>
        </View>
      );
    }
    return (
      <View
        style={[
          styles.bubbleRow,
          { justifyContent: isMe ? "flex-end" : "flex-start" },
        ]}
      >
        <View
          style={[
            styles.bubble,
            {
              backgroundColor: isMe ? colors.primary : colors.background.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.bubbleText,
              { color: isMe ? "#1c1810" : colors.text.primary },
            ]}
          >
            {item.body}
          </Text>
          <Text
            style={[
              styles.bubbleTime,
              { color: isMe ? "rgba(28,24,16,0.65)" : colors.text.muted },
            ]}
          >
            {new Date(item.created_at).toLocaleTimeString("en-ZA", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    );
  };

  if (!orderId) {
    return (
      <SafeAreaView
        style={[styles.safe, { backgroundColor: colors.background.primary }]}
      >
        <Text style={{ color: colors.text.primary, padding: spacing.lg }}>
          No order selected.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background.primary }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          { borderBottomColor: colors.border, backgroundColor: colors.background.card },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityLabel="Back"
        >
          <Icon name="chevron-back" size={22} color={colors.text.primary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.text.primary }]}>
            {senderRole === "driver" ? "Customer" : "Your Driver"}
          </Text>
          <Text style={[styles.headerSub, { color: colors.text.muted }]}>
            Live delivery chat
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: spacing.md, gap: 8 }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Icon
                  name="chatbubbles-outline"
                  size={40}
                  color={colors.text.muted}
                />
                <Text style={[styles.emptyText, { color: colors.text.muted }]}>
                  Say hi to your driver — they'll see your message live.
                </Text>
              </View>
            }
          />
        )}

        <View
          style={[
            styles.composer,
            { borderTopColor: colors.border, backgroundColor: colors.background.card },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Type a message…"
            placeholderTextColor={colors.text.muted}
            style={[
              styles.input,
              {
                backgroundColor: colors.background.primary,
                color: colors.text.primary,
                borderColor: colors.border,
              },
            ]}
            multiline
            maxLength={2000}
          />
          <TouchableOpacity
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={[
              styles.sendBtn,
              {
                backgroundColor:
                  draft.trim() && !sending ? colors.primary : colors.background.primary,
                opacity: draft.trim() && !sending ? 1 : 0.5,
              },
            ]}
            accessibilityLabel="Send message"
          >
            <Icon name="send" size={18} color="#1c1810" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 2 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: spacing.sm,
  },
  emptyText: { fontSize: 13, textAlign: "center", paddingHorizontal: 40 },
  bubbleRow: { flexDirection: "row" },
  bubble: {
    maxWidth: "78%",
    padding: 10,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
  },
  bubbleText: { fontSize: 14, lineHeight: 19 },
  bubbleTime: { fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  systemRow: { alignItems: "center", paddingVertical: 4 },
  systemText: { fontSize: 11, fontStyle: "italic" },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.sm,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    fontSize: 14,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default DeliveryChatScreen;
