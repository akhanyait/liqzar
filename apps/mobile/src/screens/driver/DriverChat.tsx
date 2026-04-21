import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

interface ChatMessage {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  channel_id: string;
}

interface ChatChannel {
  id: string;
  type: string;
  name: string;
  avatar: string;
  lastMessage: string;
  unread: number;
  online: boolean;
  orderNumber?: string;
  participant_1?: string;
  participant_2?: string;
}

const QUICK_REPLIES = [
  "On my way!",
  "I'm here",
  "5 minutes away",
  "Please come outside",
  "Can't find address",
];

const OFFICE_QUICK_REPLIES = [
  "Need assistance",
  "Customer not available",
  "Address issue",
  "Order damaged",
  "Need a break",
];

export default function DriverChat() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);

  const initialChannel = route.params?.channelId || null;
  const [activeChannel, setActiveChannel] = useState<string | null>(
    initialChannel,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [filter, setFilter] = useState<"all" | "customer" | "office">("all");

  const currentChannel = channels.find((c) => c.id === activeChannel);
  const filteredChannels =
    filter === "all" ? channels : channels.filter((c) => c.type === filter);

  const totalUnread = channels.reduce((s, c) => s + c.unread, 0);

  useEffect(() => {
    fetchChannels();
  }, []);

  useEffect(() => {
    if (activeChannel) {
      fetchMessages(activeChannel);
      // Mark as read
      setChannels((prev) =>
        prev.map((c) => (c.id === activeChannel ? { ...c, unread: 0 } : c)),
      );

      // Subscribe to real-time messages
      const channel = supabase
        .channel(`chat:${activeChannel}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `channel_id=eq.${activeChannel}`,
          },
          (payload: any) => {
            setMessages((prev) => [...prev, payload.new as ChatMessage]);
            setTimeout(
              () => scrollRef.current?.scrollToEnd({ animated: true }),
              100,
            );
          },
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChannel]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { data } = await supabase
        .from("chat_channels")
        .select("*, chat_messages(message, created_at, sender_id)")
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .eq("is_active", true)
        .order("updated_at", { ascending: false });

      const mapped: ChatChannel[] = (data || []).map((ch: any) => {
        const lastMsg =
          ch.chat_messages && ch.chat_messages.length > 0
            ? ch.chat_messages[ch.chat_messages.length - 1]
            : null;
        return {
          id: ch.id,
          type: ch.channel_type || "customer",
          name: ch.name || "Chat",
          avatar:
            ch.channel_type === "office" ? "headset" : "person",
          lastMessage: lastMsg?.message || "No messages yet",
          unread: 0,
          online: true,
          orderNumber: ch.order_number,
          participant_1: ch.participant_1,
          participant_2: ch.participant_2,
        };
      });
      setChannels(mapped);
    } catch (error) {
      console.error("Error fetching channels:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async (channelId: string) => {
    try {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("channel_id", channelId)
        .order("created_at", { ascending: true });
      setMessages(data || []);
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: false }),
        100,
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  const handleSend = async () => {
    if (!inputText.trim() || !activeChannel) return;

    const text = inputText.trim();
    setInputText("");

    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      await supabase.from("chat_messages").insert({
        channel_id: activeChannel,
        sender_id: userId,
        message: text,
      });

      setChannels((prev) =>
        prev.map((c) =>
          c.id === activeChannel ? { ...c, lastMessage: text } : c,
        ),
      );

      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleQuickReply = (text: string) => {
    setInputText(text);
    setTimeout(() => {
      handleSend();
    }, 200);
  };

  // ─── Channel List View ───
  if (!activeChannel) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
        {/* Header */}
        <LinearGradient
          colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
          style={{
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            paddingHorizontal: spacing.md,
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
              Messages
            </Text>
            <View style={st.backBtn}>
              {totalUnread > 0 && (
                <View style={st.unreadBadge}>
                  <Text style={st.unreadBadgeText}>{totalUnread}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Filter tabs */}
          <View style={st.filterRow}>
            {(["all", "customer", "office"] as const).map((f) => {
              const isActive = filter === f;
              const label =
                f === "all"
                  ? "All"
                  : f === "customer"
                    ? "Customers"
                    : "Back Office";
              return (
                <TouchableOpacity
                  key={f}
                  style={[
                    st.filterTab,
                    {
                      backgroundColor: isActive
                        ? colors.gold.primary + "18"
                        : "transparent",
                      borderColor: isActive
                        ? colors.gold.primary
                        : colors.gold.border,
                    },
                  ]}
                  onPress={() => setFilter(f)}
                >
                  <Text
                    style={[
                      st.filterText,
                      {
                        color: isActive
                          ? colors.gold.primary
                          : colors.text.muted,
                      },
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </LinearGradient>

        {loading ? (
          <View
            style={{
              flex: 1,
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
              Loading conversations...
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {filteredChannels.length === 0 ? (
              <View
                style={{
                  alignItems: "center",
                  paddingVertical: 40,
                }}
              >
                <Icon
                  name="chatbubbles-outline"
                  size={48}
                  color={colors.text.dim}
                />
                <Text
                  style={{
                    fontSize: 16,
                    fontWeight: "600",
                    color: colors.text.muted,
                    marginTop: 12,
                  }}
                >
                  No conversations
                </Text>
              </View>
            ) : (
              filteredChannels.map((channel) => (
                <TouchableOpacity
                  key={channel.id}
                  style={[
                    st.channelRow,
                    {
                      backgroundColor:
                        channel.unread > 0
                          ? isDark
                            ? "rgba(212,175,55,0.04)"
                            : "rgba(212,175,55,0.03)"
                          : "transparent",
                      borderBottomColor: colors.gold.border,
                    },
                  ]}
                  onPress={() => setActiveChannel(channel.id)}
                  activeOpacity={0.75}
                >
                  <View style={{ position: "relative" }}>
                    <View
                      style={[
                        st.channelAvatar,
                        {
                          backgroundColor:
                            channel.type === "customer"
                              ? "#3B82F618"
                              : "#8B5CF618",
                        },
                      ]}
                    >
                      <Icon
                        name={channel.avatar}
                        size={22}
                        color={
                          channel.type === "customer" ? colors.status.info : "#8B5CF6"
                        }
                      />
                    </View>
                    {channel.online && <View style={st.onlineDot} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={st.channelNameRow}>
                      <Text
                        style={[
                          st.channelName,
                          { color: colors.text.primary },
                        ]}
                      >
                        {channel.name}
                      </Text>
                      {channel.orderNumber && (
                        <Text
                          style={{ fontSize: 11, color: colors.gold.muted }}
                        >
                          #{channel.orderNumber}
                        </Text>
                      )}
                    </View>
                    <Text
                      style={[
                        st.channelLastMsg,
                        {
                          color:
                            channel.unread > 0
                              ? colors.text.primary
                              : colors.text.muted,
                          fontWeight: channel.unread > 0 ? "600" : "400",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {channel.lastMessage}
                    </Text>
                  </View>
                  {channel.unread > 0 && (
                    <View style={st.channelUnread}>
                      <Text style={st.channelUnreadText}>
                        {channel.unread}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    );
  }

  // ─── Chat View ───
  const quickReplies =
    currentChannel?.type === "office" ? OFFICE_QUICK_REPLIES : QUICK_REPLIES;

  const isDriverMessage = (msg: ChatMessage) => msg.sender_id === user?.id;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Chat Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          paddingHorizontal: spacing.md,
        }}
      >
        <View style={st.chatHeaderRow}>
          <TouchableOpacity
            onPress={() => setActiveChannel(null)}
            style={st.backBtn}
          >
            <Icon name="arrow-back" size={22} color={colors.text.primary} />
          </TouchableOpacity>
          <View style={st.chatHeaderInfo}>
            <Text style={[st.chatHeaderName, { color: colors.text.primary }]}>
              {currentChannel?.name}
            </Text>
            <View style={st.chatHeaderStatus}>
              <View
                style={[
                  st.chatOnlineDot,
                  {
                    backgroundColor: currentChannel?.online
                      ? colors.status.success
                      : "#6B7280",
                  },
                ]}
              />
              <Text style={{ fontSize: 12, color: colors.text.muted }}>
                {currentChannel?.online ? "Online" : "Offline"}
              </Text>
              {currentChannel?.orderNumber && (
                <Text style={{ fontSize: 12, color: colors.gold.muted }}>
                  {" "}
                  · #{currentChannel.orderNumber}
                </Text>
              )}
            </View>
          </View>
          {currentChannel?.type === "customer" && (
            <TouchableOpacity
              style={[st.callBtnSmall, { backgroundColor: colors.status.success }]}
              onPress={() => {}}
            >
              <Icon name="call" size={18} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 8 }}
        >
          {/* Date separator */}
          <View style={st.dateSep}>
            <Text style={[st.dateSepText, { color: colors.text.dim }]}>
              Today
            </Text>
          </View>

          {messages.map((msg) => {
            const isDriver = isDriverMessage(msg);
            const timestamp = new Date(msg.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            });
            return (
              <View
                key={msg.id}
                style={[
                  st.msgRow,
                  { justifyContent: isDriver ? "flex-end" : "flex-start" },
                ]}
              >
                <View
                  style={[
                    st.msgBubble,
                    isDriver
                      ? {
                          backgroundColor: colors.status.info,
                          borderBottomRightRadius: 4,
                        }
                      : {
                          backgroundColor: colors.background.card,
                          borderColor: colors.gold.border,
                          borderWidth: 1,
                          borderBottomLeftRadius: 4,
                        },
                  ]}
                >
                  <Text
                    style={[
                      st.msgText,
                      { color: isDriver ? colors.white : colors.text.primary },
                    ]}
                  >
                    {msg.message}
                  </Text>
                  <View style={st.msgMeta}>
                    <Text
                      style={{
                        fontSize: 10,
                        color: isDriver
                          ? "rgba(255,255,255,0.6)"
                          : colors.text.dim,
                      }}
                    >
                      {timestamp}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Quick Replies */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 40 }}
          contentContainerStyle={{ paddingHorizontal: spacing.md, gap: 8 }}
        >
          {quickReplies.map((reply, i) => (
            <TouchableOpacity
              key={i}
              style={[st.quickReplyChip, { borderColor: colors.gold.border }]}
              onPress={() => handleQuickReply(reply)}
            >
              <Text
                style={{
                  color: colors.gold.primary,
                  fontSize: 12,
                  fontWeight: "600",
                }}
              >
                {reply}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            st.chatInputBar,
            {
              backgroundColor: colors.background.card,
              borderTopColor: colors.gold.border,
              paddingBottom: insets.bottom || 12,
            },
          ]}
        >
          <View
            style={[
              st.chatInputWrapper,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
                borderColor: colors.gold.border,
              },
            ]}
          >
            <TextInput
              style={[st.chatInput, { color: colors.text.primary }]}
              placeholder={`Message ${currentChannel?.name}...`}
              placeholderTextColor={colors.text.dim}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity onPress={handleSend} disabled={!inputText.trim()}>
            <LinearGradient
              colors={
                inputText.trim()
                  ? [colors.status.info, "#2563EB"]
                  : ["#55555550", "#55555550"]
              }
              style={st.chatSendBtn}
            >
              <Icon
                name="send"
                size={18}
                color={inputText.trim() ? colors.white : colors.text.dim}
              />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800" },
  unreadBadge: {
    backgroundColor: "#EF4444",
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  unreadBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  filterRow: {
    flexDirection: "row",
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  filterText: { fontSize: 13, fontWeight: "600" },
  channelRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
  },
  channelAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: "#050403",
  },
  channelNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 2,
  },
  channelName: { fontSize: 15, fontWeight: "700" },
  channelLastMsg: { fontSize: 13 },
  channelUnread: {
    backgroundColor: "#3B82F6",
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  channelUnreadText: { color: "#FFF", fontSize: 11, fontWeight: "800" },
  chatHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chatHeaderInfo: { flex: 1 },
  chatHeaderName: { fontSize: 16, fontWeight: "800" },
  chatHeaderStatus: { flexDirection: "row", alignItems: "center", gap: 4 },
  chatOnlineDot: { width: 8, height: 8, borderRadius: 4 },
  callBtnSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
  },
  dateSep: {
    alignItems: "center",
    marginVertical: 12,
  },
  dateSepText: { fontSize: 12, fontWeight: "600" },
  msgRow: {
    flexDirection: "row",
    marginBottom: 8,
  },
  msgBubble: {
    maxWidth: "80%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.lg,
  },
  msgText: { fontSize: 14, lineHeight: 20 },
  msgMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  quickReplyChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
  },
  chatInputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  chatInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.full,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
  },
  chatInput: { flex: 1, fontSize: 14 },
  chatSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
});
