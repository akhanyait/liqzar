import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

const { width } = Dimensions.get("window");

interface AIMessage {
  id: string;
  type: "user" | "ai" | "insight";
  text: string;
  timestamp: string;
  data?: any;
}

interface InsightCard {
  id: string;
  icon: string;
  title: string;
  subtitle: string;
  color: string;
  value?: string;
  type: "route" | "demand" | "earnings" | "tip" | "safety";
}

const QUICK_PROMPTS = [
  { icon: "navigate-outline", text: "Optimize my route", color: "#3B82F6" },
  { icon: "trending-up-outline", text: "Demand forecast", color: "#10B981" },
  { icon: "cash-outline", text: "Earnings projection", color: "#D4AF37" },
  { icon: "flash-outline", text: "Quick tips", color: "#F59E0B" },
];

const LIVE_INSIGHTS: InsightCard[] = [
  {
    id: "1",
    icon: "flame-outline",
    title: "High Demand Zone",
    subtitle: "CBD & Waterfront areas -- check Heat Map for details",
    color: "#EF4444",
    value: "Hot",
    type: "demand",
  },
  {
    id: "2",
    icon: "navigate-outline",
    title: "Route Optimization",
    subtitle: "Use the navigation screen for optimized routes",
    color: "#3B82F6",
    type: "route",
  },
  {
    id: "3",
    icon: "trending-up-outline",
    title: "Earnings Goal",
    subtitle: "Check your Earnings tab for detailed breakdown",
    color: "#10B981",
    type: "earnings",
  },
  {
    id: "4",
    icon: "shield-checkmark-outline",
    title: "Safety Tip",
    subtitle: "Always verify customer ID for alcohol deliveries",
    color: "#F59E0B",
    type: "safety",
  },
];

export default function DriverAIAssistant() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const scrollRef = useRef<ScrollView>(null);
  const pulseAnim = useRef(new Animated.Value(0.7)).current;

  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [showInsights, setShowInsights] = useState(true);

  // Pulse animation for AI thinking
  useEffect(() => {
    if (!isThinking) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [isThinking]);

  const getAssistantResponse = async (message: string): Promise<string> => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const lowerMsg = message.toLowerCase();

      if (lowerMsg.includes("earning") || lowerMsg.includes("pay") || lowerMsg.includes("money")) {
        const { data } = await supabase
          .from("delivery_assignments")
          .select("id")
          .eq("driver_id", userId)
          .eq("status", "delivered")
          .gte(
            "created_at",
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          );
        const count = data?.length || 0;
        const estimated = count * 25;
        return `You've completed ${count} deliveries this week, earning approximately R${estimated} in base fees. Check your Earnings tab for the full breakdown including tips. Keep up the great work!`;
      }

      if (lowerMsg.includes("rating") || lowerMsg.includes("review")) {
        const { data } = await supabase
          .from("delivery_ratings")
          .select("driver_rating")
          .eq("driver_id", userId);
        const avg = data?.length
          ? (
              data.reduce((s: number, r: any) => s + (r.driver_rating || 0), 0) /
              data.length
            ).toFixed(1)
          : "No ratings yet";
        return `Your current average rating is ${avg}. Tips to improve: be punctual, communicate clearly, and handle items with care. You can view detailed reviews in your Ratings tab.`;
      }

      if (lowerMsg.includes("deliver") || lowerMsg.includes("order")) {
        const { data } = await supabase
          .from("delivery_assignments")
          .select("id, status")
          .eq("driver_id", userId)
          .eq("status", "delivered");
        const total = data?.length || 0;
        return `You've completed ${total} total deliveries. Great progress! Check your Dashboard for any active orders waiting for pickup or delivery.`;
      }

      if (lowerMsg.includes("route") || lowerMsg.includes("navigate") || lowerMsg.includes("direction")) {
        return "For route optimization, I recommend:\n\n1. Check your active orders on the Dashboard\n2. Use the Navigation screen for turn-by-turn directions\n3. Check the Heat Map to see where demand is highest\n\nBatching nearby deliveries can save time and fuel.";
      }

      if (lowerMsg.includes("tip") || lowerMsg.includes("advice") || lowerMsg.includes("help")) {
        return "Here are some tips to maximize your earnings:\n\n1. Stay in high-demand areas during peak hours (11am-1pm, 5pm-8pm)\n2. Send customers a friendly 'On my way!' message for better tips\n3. Keep your acceptance rate above 85% for priority access\n4. Handle bottles with care -- good reviews lead to more orders\n5. Check the Heat Map regularly for surge zones";
      }

      if (lowerMsg.includes("demand") || lowerMsg.includes("busy") || lowerMsg.includes("surge")) {
        const { data: orders } = await supabase
          .from("orders")
          .select("id")
          .gte(
            "created_at",
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          );
        const todayOrders = orders?.length || 0;
        return `There have been ${todayOrders} orders in the last 24 hours. Peak hours are typically 11am-1pm for lunch and 5pm-8pm for evening orders. Check the Heat Map for real-time demand zones in your area.`;
      }

      // Default contextual response
      return "I can help with your earnings, ratings, deliveries, and route optimization. Try asking me about:\n\n- Your weekly earnings\n- Your current rating\n- Delivery tips and advice\n- Demand and busy areas\n- Route optimization\n\nWhat would you like to know?";
    } catch (error) {
      return "I can help with your earnings, ratings, deliveries, and route optimization. What would you like to know?";
    }
  };

  const handleSend = async (text?: string) => {
    const msg = text || inputText.trim();
    if (!msg) return;

    setShowInsights(false);
    const userMsg: AIMessage = {
      id: `u-${Date.now()}`,
      type: "user",
      text: msg,
      timestamp: "now",
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsThinking(true);

    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

    try {
      const response = await getAssistantResponse(msg);
      const aiMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        type: "ai",
        text: response,
        timestamp: "now",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errorMsg: AIMessage = {
        id: `ai-${Date.now()}`,
        type: "ai",
        text: "Sorry, I encountered an error. Please try again.",
        timestamp: "now",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsThinking(false);
      setTimeout(
        () => scrollRef.current?.scrollToEnd({ animated: true }),
        100,
      );
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1a1020", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
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
          <View style={st.headerCenter}>
            <View style={[st.aiDot, { backgroundColor: colors.status.success }]} />
            <Text style={[st.headerTitle, { color: colors.text.primary }]}>
              AI Copilot
            </Text>
            <View
              style={{
                marginLeft: 6,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 10,
                backgroundColor: colors.gold.primary + "22",
                borderWidth: 1,
                borderColor: colors.gold.border,
              }}
            >
              <Text
                style={{
                  fontSize: 9,
                  fontWeight: "700",
                  letterSpacing: 0.5,
                  color: colors.gold.primary,
                }}
              >
                PREVIEW
              </Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => setShowInsights((p) => !p)}
            style={[st.backBtn, { backgroundColor: colors.status.warning + "15" }]}
          >
            <Icon name="bulb-outline" size={20} color={colors.status.warning} />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: spacing.md, paddingBottom: 20 }}
        >
          {/* Live Insights Cards */}
          {showInsights && messages.length === 0 && (
            <>
              <View style={st.insightsHeader}>
                <Icon name="sparkles" size={18} color={colors.status.warning} />
                <Text
                  style={[st.insightsTitle, { color: colors.text.primary }]}
                >
                  Live Insights
                </Text>
              </View>
              {LIVE_INSIGHTS.map((insight) => (
                <TouchableOpacity
                  key={insight.id}
                  style={[
                    st.insightCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      st.insightIcon,
                      { backgroundColor: insight.color + "15" },
                    ]}
                  >
                    <Icon name={insight.icon} size={20} color={insight.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[st.insightTitle, { color: colors.text.primary }]}
                    >
                      {insight.title}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: colors.text.muted,
                        lineHeight: 17,
                      }}
                    >
                      {insight.subtitle}
                    </Text>
                  </View>
                  {insight.value && (
                    <View
                      style={[
                        st.insightValuePill,
                        { backgroundColor: insight.color + "18" },
                      ]}
                    >
                      <Text
                        style={{
                          color: insight.color,
                          fontSize: 12,
                          fontWeight: "800",
                        }}
                      >
                        {insight.value}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}

              <View
                style={[st.divider, { backgroundColor: colors.gold.border }]}
              />

              <Text style={[st.askLabel, { color: colors.text.dim }]}>
                ASK AI COPILOT
              </Text>
            </>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <View
              key={msg.id}
              style={[
                st.messageBubble,
                msg.type === "user"
                  ? st.userBubble
                  : msg.type === "insight"
                    ? [
                        st.insightBubble,
                        {
                          backgroundColor: isDark
                            ? "rgba(212,175,55,0.06)"
                            : "rgba(212,175,55,0.04)",
                          borderColor: colors.gold.border,
                        },
                      ]
                    : [
                        st.aiBubble,
                        {
                          backgroundColor: colors.background.card,
                          borderColor: colors.gold.border,
                        },
                      ],
              ]}
            >
              {msg.type === "ai" && (
                <View style={st.aiMsgHeader}>
                  <View
                    style={[st.aiAvatarSmall, { backgroundColor: colors.status.warning + "18" }]}
                  >
                    <Icon name="sparkles" size={12} color={colors.status.warning} />
                  </View>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.status.warning,
                      fontWeight: "700",
                    }}
                  >
                    AI COPILOT
                  </Text>
                </View>
              )}
              {msg.type === "insight" && (
                <View style={st.aiMsgHeader}>
                  <Icon
                    name="analytics-outline"
                    size={14}
                    color={colors.gold.primary}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.gold.primary,
                      fontWeight: "700",
                    }}
                  >
                    ANALYSIS
                  </Text>
                </View>
              )}
              <Text
                style={[
                  st.messageText,
                  {
                    color: msg.type === "user" ? colors.white : colors.text.primary,
                  },
                ]}
              >
                {msg.text}
              </Text>
            </View>
          ))}

          {/* AI Thinking */}
          {isThinking && (
            <Animated.View
              style={[
                st.thinkingBubble,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                  opacity: pulseAnim,
                },
              ]}
            >
              <View
                style={[st.aiAvatarSmall, { backgroundColor: colors.status.warning + "18" }]}
              >
                <Icon name="sparkles" size={12} color={colors.status.warning} />
              </View>
              <Text style={{ color: colors.text.muted, fontSize: 13 }}>
                Analyzing...
              </Text>
            </Animated.View>
          )}

          {/* Quick Prompts */}
          {messages.length === 0 && (
            <View style={st.quickPrompts}>
              {QUICK_PROMPTS.map((prompt, i) => (
                <TouchableOpacity
                  key={i}
                  style={[
                    st.quickPrompt,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                  onPress={() => handleSend(prompt.text)}
                  activeOpacity={0.75}
                >
                  <Icon name={prompt.icon} size={18} color={prompt.color} />
                  <Text
                    style={[st.quickPromptText, { color: colors.text.primary }]}
                  >
                    {prompt.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Follow-up prompts after conversation */}
          {messages.length > 0 && !isThinking && (
            <View style={st.followUpRow}>
              {QUICK_PROMPTS.filter(
                (p) => !messages.some((m) => m.text === p.text),
              )
                .slice(0, 2)
                .map((prompt, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[
                      st.followUpChip,
                      { borderColor: colors.gold.border },
                    ]}
                    onPress={() => handleSend(prompt.text)}
                  >
                    <Icon name={prompt.icon} size={14} color={prompt.color} />
                    <Text style={{ color: colors.text.muted, fontSize: 12 }}>
                      {prompt.text}
                    </Text>
                  </TouchableOpacity>
                ))}
            </View>
          )}
        </ScrollView>

        {/* Input Bar */}
        <View
          style={[
            st.inputBar,
            {
              backgroundColor: colors.background.card,
              borderTopColor: colors.gold.border,
              paddingBottom: insets.bottom || 12,
            },
          ]}
        >
          <View
            style={[
              st.inputWrapper,
              {
                backgroundColor: isDark
                  ? "rgba(255,255,255,0.06)"
                  : "rgba(0,0,0,0.04)",
                borderColor: colors.gold.border,
              },
            ]}
          >
            <Icon name="sparkles-outline" size={18} color={colors.gold.muted} />
            <TextInput
              style={[st.input, { color: colors.text.primary }]}
              placeholder="Ask AI anything..."
              placeholderTextColor={colors.text.dim}
              value={inputText}
              onChangeText={setInputText}
              onSubmitEditing={() => handleSend()}
              returnKeyType="send"
            />
          </View>
          <TouchableOpacity
            onPress={() => handleSend()}
            disabled={!inputText.trim()}
          >
            <LinearGradient
              colors={
                inputText.trim()
                  ? [colors.gold.primary, colors.gold.dark]
                  : ["#55555550", "#55555550"]
              }
              style={st.sendBtn}
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
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  aiDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800" },
  insightsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  insightsTitle: { fontSize: 16, fontWeight: "700" },
  insightCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  insightIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  insightTitle: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  insightValuePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  divider: { height: 1, marginVertical: 16 },
  askLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  messageBubble: {
    marginBottom: 10,
    padding: 14,
    borderRadius: borderRadius.lg,
    maxWidth: "88%",
  },
  userBubble: {
    backgroundColor: "#3B82F6",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  insightBubble: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderBottomLeftRadius: 4,
    maxWidth: "95%",
  },
  aiMsgHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  aiAvatarSmall: {
    width: 20,
    height: 20,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  messageText: { fontSize: 14, lineHeight: 21 },
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginBottom: 10,
  },
  quickPrompts: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  quickPrompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    width: (width - spacing.md * 2 - 8) / 2,
  },
  quickPromptText: { fontSize: 13, fontWeight: "600", flex: 1 },
  followUpRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  followUpChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 46,
    gap: 8,
  },
  input: { flex: 1, fontSize: 14 },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: "center",
    alignItems: "center",
  },
});
