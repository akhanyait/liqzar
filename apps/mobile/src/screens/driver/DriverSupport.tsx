import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Icon } from "../../components/Icon";
import { useTheme } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { spacing, borderRadius } from "../../theme";

interface FAQItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FAQItem[] = [
  {
    question: "How do I accept an order?",
    answer:
      'When a new order is available, you will receive a notification with the order details. Tap the notification or go to your Dashboard to view it. Press the "Accept" button to confirm. You have 60 seconds to accept before the order is assigned to another driver.',
  },
  {
    question: "What if the customer is not available?",
    answer:
      'If the customer does not respond after arrival, wait for 5 minutes and try calling them through the app. If they are still unreachable, use the "Customer Unavailable" option in the delivery screen. The order will be returned to the depot and the customer will be notified.',
  },
  {
    question: "How are earnings calculated?",
    answer:
      "Your earnings include a base delivery fee, a distance-based component, and any tips from customers. Surge pricing may apply during peak hours. You can view a detailed breakdown of each delivery's earnings in the Earnings section of the app.",
  },
  {
    question: "How do I update my vehicle info?",
    answer:
      "Vehicle information updates must be submitted through the LIQZAR Driver portal or by contacting dispatch support. Changes require verification and typically take 24-48 hours to process. Ensure your vehicle documents are up to date.",
  },
];

const ISSUE_TYPES = [
  "Order Issue",
  "App Bug",
  "Payment Issue",
  "Safety Concern",
  "Other",
];

export default function DriverSupport() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { colors, isDark, shadows } = useTheme();

  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [issueDescription, setIssueDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const handleSubmitReport = async () => {
    if (!selectedIssue) {
      Alert.alert("Missing Info", "Please select an issue type.");
      return;
    }
    if (!issueDescription.trim()) {
      Alert.alert("Missing Info", "Please describe the issue.");
      return;
    }
    setSubmitting(true);
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      const { error } = await supabase.from("support_tickets").insert({
        ticket_number: `DRV-${Date.now()}`,
        user_id: userId,
        category: selectedIssue.toLowerCase().replace(/\s+/g, "_"),
        subject: selectedIssue,
        description: issueDescription,
        priority: "medium",
      });
      if (error) {
        Alert.alert("Error", "Failed to submit report. Please try again.");
      } else {
        Alert.alert(
          "Submitted",
          "Your issue has been reported. Our team will review it.",
        );
        setSelectedIssue(null);
        setIssueDescription("");
      }
    } catch (error) {
      Alert.alert("Error", "Failed to submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCallDispatch = () => {
    Linking.openURL("tel:+27800123456");
  };

  const handleEmailSupport = () => {
    Linking.openURL("mailto:support@liqzar.co.za");
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background.primary }}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#0f1628", "#0a0f1f"] : ["#FFFFFF", "#F9F8F5"]}
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 16,
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
            Help & Support
          </Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Quick Help FAQ */}
        <View style={{ marginTop: 20 }}>
          <Text
            style={[
              st.sectionLabel,
              { color: colors.text.dim, paddingHorizontal: spacing.md },
            ]}
          >
            QUICK HELP
          </Text>
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {FAQ_ITEMS.map((faq, i) => {
              const isExpanded = expandedFaq === i;
              return (
                <View
                  key={i}
                  style={[
                    st.faqCard,
                    {
                      backgroundColor: colors.background.card,
                      borderColor: colors.gold.border,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={st.faqRow}
                    onPress={() => toggleFaq(i)}
                    activeOpacity={0.75}
                  >
                    <Text
                      style={[st.faqQuestion, { color: colors.text.primary }]}
                    >
                      {faq.question}
                    </Text>
                    <Icon
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.text.dim}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <View
                      style={[
                        st.faqAnswerWrap,
                        { borderTopColor: colors.gold.border },
                      ]}
                    >
                      <Text
                        style={[st.faqAnswer, { color: colors.text.muted }]}
                      >
                        {faq.answer}
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Contact Support */}
        <View style={{ marginTop: 20 }}>
          <Text
            style={[
              st.sectionLabel,
              { color: colors.text.dim, paddingHorizontal: spacing.md },
            ]}
          >
            CONTACT SUPPORT
          </Text>
          <View style={{ paddingHorizontal: spacing.md, gap: 4 }}>
            {/* Call Dispatch */}
            <TouchableOpacity
              style={[
                st.contactCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
              onPress={handleCallDispatch}
              activeOpacity={0.75}
            >
              <View style={[st.contactIcon, { backgroundColor: `${colors.status.success}15` }]}>
                <Icon name="call-outline" size={20} color={colors.status.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.contactLabel, { color: colors.text.primary }]}>
                  Call Dispatch
                </Text>
                <Text style={{ fontSize: 12, color: colors.text.muted }}>
                  Speak directly with dispatch team
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.text.dim} />
            </TouchableOpacity>

            {/* Chat with Support */}
            <TouchableOpacity
              style={[
                st.contactCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
              onPress={() => navigation.navigate("DriverChat")}
              activeOpacity={0.75}
            >
              <View style={[st.contactIcon, { backgroundColor: `${colors.status.info}15` }]}>
                <Icon name="chatbubbles-outline" size={20} color={colors.status.info} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.contactLabel, { color: colors.text.primary }]}>
                  Chat with Support
                </Text>
                <Text style={{ fontSize: 12, color: colors.text.muted }}>
                  Message our support agents
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.text.dim} />
            </TouchableOpacity>

            {/* Email Support */}
            <TouchableOpacity
              style={[
                st.contactCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
              onPress={handleEmailSupport}
              activeOpacity={0.75}
            >
              <View style={[st.contactIcon, { backgroundColor: "#8B5CF615" }]}>
                <Icon name="mail-outline" size={20} color="#8B5CF6" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[st.contactLabel, { color: colors.text.primary }]}>
                  Email Support
                </Text>
                <Text style={{ fontSize: 12, color: colors.text.muted }}>
                  support@liqzar.co.za
                </Text>
              </View>
              <Icon name="chevron-forward" size={18} color={colors.text.dim} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Report an Issue */}
        <View style={{ marginTop: 20 }}>
          <Text
            style={[
              st.sectionLabel,
              { color: colors.text.dim, paddingHorizontal: spacing.md },
            ]}
          >
            REPORT AN ISSUE
          </Text>
          <View style={{ paddingHorizontal: spacing.md }}>
            <View
              style={[
                st.reportCard,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              {/* Issue Type Selector */}
              <Text style={[st.reportLabel, { color: colors.text.primary }]}>
                Issue Type
              </Text>
              <View style={st.issueTypesRow}>
                {ISSUE_TYPES.map((type) => {
                  const isSelected = selectedIssue === type;
                  return (
                    <TouchableOpacity
                      key={type}
                      onPress={() => setSelectedIssue(type)}
                      style={[
                        st.issueTypeBtn,
                        {
                          backgroundColor: isSelected
                            ? colors.gold.primary
                            : colors.background.tertiary,
                          borderColor: isSelected
                            ? colors.gold.primary
                            : colors.gold.border,
                        },
                      ]}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "600",
                          color: isSelected ? "#000" : colors.text.muted,
                        }}
                      >
                        {type}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Description */}
              <Text
                style={[
                  st.reportLabel,
                  { color: colors.text.primary, marginTop: 14 },
                ]}
              >
                Description
              </Text>
              <TextInput
                style={[
                  st.descInput,
                  {
                    color: colors.text.primary,
                    backgroundColor: colors.background.tertiary,
                    borderColor: colors.gold.border,
                  },
                ]}
                placeholder="Describe the issue in detail..."
                placeholderTextColor={colors.text.dim}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={issueDescription}
                onChangeText={setIssueDescription}
              />

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmitReport}
                activeOpacity={0.8}
                disabled={submitting}
              >
                <LinearGradient
                  colors={[colors.gold.primary, colors.gold.dark]}
                  style={[st.submitBtn, submitting && { opacity: 0.6 }]}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color="#000" />
                  ) : (
                    <Text style={st.submitBtnText}>Submit Report</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Emergency */}
        <View style={{ paddingHorizontal: spacing.md, marginTop: 20 }}>
          <TouchableOpacity
            style={st.emergencyCard}
            onPress={() => Linking.openURL("tel:10111")}
            activeOpacity={0.75}
          >
            <View style={st.emergencyIcon}>
              <Icon name="call-outline" size={22} color="#FFF" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={st.emergencyTitle}>Emergency Contact</Text>
              <Text style={st.emergencySubtitle}>
                For immediate safety concerns
              </Text>
            </View>
            <Icon
              name="chevron-forward"
              size={18}
              color="rgba(255,255,255,0.6)"
            />
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerTitle: { fontSize: 20, fontWeight: "800" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  faqCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  faqQuestion: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
    marginRight: 10,
  },
  faqAnswerWrap: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  faqAnswer: {
    fontSize: 13,
    lineHeight: 20,
  },
  contactCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  contactLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 1,
  },
  reportCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
  },
  reportLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  issueTypesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  issueTypeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
  },
  descInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: 12,
    fontSize: 14,
    minHeight: 100,
  },
  submitBtn: {
    height: 48,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 14,
  },
  submitBtnText: {
    color: "#000",
    fontSize: 15,
    fontWeight: "800",
  },
  emergencyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: borderRadius.md,
    backgroundColor: "#DC2626",
    gap: 12,
  },
  emergencyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  emergencyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFF",
    marginBottom: 2,
  },
  emergencySubtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.7)",
  },
});
