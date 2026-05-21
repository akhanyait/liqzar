import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Icon from "../components/Icon";
import BrandMark from "../components/BrandMark";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useNavigation, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { spacing, borderRadius } from "../theme";

// ─── Types ───────────────────────────────────────────────

interface DeliverySlot {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  is_available: boolean;
  current_orders: number;
  max_orders: number;
}

interface SavedAddress {
  id: string;
  label: string;
  street: string;
  city: string;
  province: string;
  postal_code: string;
  is_default?: boolean;
}

interface DayOption {
  id: string;
  label: string;
  sublabel: string;
  date: string;
}

const buildDays = (): DayOption[] => {
  const days: DayOption[] = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const label =
      i === 0 ? "Today" : i === 1 ? "Tomorrow" : dayNames[d.getDay()];
    days.push({
      id: `day-${i}`,
      label,
      sublabel: `${d.getDate()} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d.getMonth()]}`,
      date: d.toISOString().split('T')[0],
    });
  }
  return days;
};

// ─── Component ───────────────────────────────────────────────

export default function ScheduleDeliveryScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const orderId = route.params?.orderId;

  const days = buildDays();

  const [selectedDay, setSelectedDay] = useState(days[0].id);
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot | null>(null);
  const [deliveryType, setDeliveryType] = useState<"standard" | "express">("standard");
  const [priorityEnabled, setPriorityEnabled] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [availableSlots, setAvailableSlots] = useState<DeliverySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [loadingAddresses, setLoadingAddresses] = useState(true);

  const cardBg = colors.background.card;
  const screenBg = colors.background.primary;
  const cardBorder = colors.gold.border;
  const gold = colors.gold.primary;
  const textPrimary = colors.text.primary;
  const textMuted = colors.text.muted;

  useEffect(() => {
    fetchAddresses();
  }, []);

  useEffect(() => {
    const day = days.find(d => d.id === selectedDay);
    if (day) {
      fetchSlots(day.date);
    }
  }, [selectedDay]);

  const fetchAddresses = async () => {
    try {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        setLoadingAddresses(false);
        return;
      }
      const { data } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', userId)
        .order('is_default', { ascending: false });
      setAddresses(data || []);
      if (data?.[0]) setSelectedAddress(data[0]);
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const fetchSlots = async (date: string) => {
    setLoadingSlots(true);
    try {
      const { data } = await supabase
        .from('delivery_slots')
        .select('*')
        .eq('date', date)
        .eq('is_available', true)
        .order('start_time', { ascending: true });

      setAvailableSlots(data || []);
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedSlot) {
      Alert.alert("Select a time", "Please choose a delivery time slot.");
      return;
    }
    try {
      const selectedDate = days.find(d => d.id === selectedDay)?.date;

      // Create scheduled delivery record
      await supabase.from('scheduled_deliveries').insert({
        order_id: orderId,
        slot_id: selectedSlot.id,
        scheduled_date: selectedDate,
        scheduled_start_time: selectedSlot.start_time,
        scheduled_end_time: selectedSlot.end_time,
        delivery_type: deliveryType === 'express' ? 'express' : 'standard',
        special_instructions: instructions,
      });

      // Update slot current_orders count
      if (selectedSlot) {
        await supabase
          .from('delivery_slots')
          .update({ current_orders: (selectedSlot.current_orders || 0) + 1 })
          .eq('id', selectedSlot.id);
      }

      Alert.alert('Scheduled!', `Delivery scheduled for ${selectedDate} at ${selectedSlot.start_time}`, [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const getSlotPeriod = (startTime: string): string => {
    const hour = parseInt(startTime.split(':')[0], 10);
    if (hour < 12) return 'morning';
    if (hour < 17) return 'afternoon';
    return 'evening';
  };

  const groupSlotsByPeriod = () => {
    const groups: Record<string, DeliverySlot[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };
    availableSlots.forEach(slot => {
      const period = getSlotPeriod(slot.start_time);
      groups[period].push(slot);
    });
    return groups;
  };

  const renderSlotGroup = (
    title: string,
    iconName: any,
    slots: DeliverySlot[],
  ) => {
    if (slots.length === 0) return null;
    return (
      <View style={{ marginBottom: 16 }}>
        <View style={st.slotGroupHeader}>
          <Icon name={iconName} size={16} color={gold} />
          <Text style={[st.slotGroupTitle, { color: textPrimary }]}>{title}</Text>
        </View>
        <View style={st.slotsGrid}>
          {slots.map((slot) => {
            const isSelected = selectedSlot?.id === slot.id;
            return (
              <TouchableOpacity
                key={slot.id}
                onPress={() => setSelectedSlot(slot)}
                style={[
                  st.slotChip,
                  {
                    backgroundColor: isSelected ? gold : cardBg,
                    borderColor: isSelected ? gold : cardBorder,
                  },
                ]}
              >
                <Text
                  style={[
                    st.slotChipText,
                    {
                      color: isSelected ? "#000" : textPrimary,
                    },
                  ]}
                >
                  {slot.start_time} - {slot.end_time}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  const slotGroups = groupSlotsByPeriod();

  // ─── Render ──────────────────────────────────────────────

  return (
    <View style={[st.root, { backgroundColor: screenBg }]}>
      {/* Header */}
      <LinearGradient
        colors={isDark ? ["#1a1510", "#0d0b08"] : ["#FFFFFF", "#F9F8F5"]}
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
            <Icon name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
          <View style={{ alignItems: "center" }}>
            <BrandMark size="xs" />
            <Text style={[st.headerTitle, { color: textPrimary }]}>
              Schedule Delivery
            </Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        {/* ── Date Picker ── */}
        <View style={{ paddingTop: 20 }}>
          <Text
            style={[
              st.sectionTitle,
              { color: textPrimary, paddingHorizontal: 16 },
            ]}
          >
            Select Date
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
          >
            {days.map((day) => {
              const isSelected = selectedDay === day.id;
              return (
                <TouchableOpacity
                  key={day.id}
                  onPress={() => {
                    setSelectedDay(day.id);
                    setSelectedSlot(null);
                  }}
                  style={[
                    st.dayCard,
                    {
                      backgroundColor: isSelected ? gold : cardBg,
                      borderColor: isSelected ? gold : cardBorder,
                    },
                  ]}
                >
                  <Text
                    style={[
                      st.dayLabel,
                      { color: isSelected ? "#000" : textPrimary },
                    ]}
                  >
                    {day.label}
                  </Text>
                  <Text
                    style={[
                      st.daySublabel,
                      { color: isSelected ? "#000" : textMuted },
                    ]}
                  >
                    {day.sublabel}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* ── Time Slots ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 24 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Select Time
          </Text>
          {loadingSlots ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <ActivityIndicator size="small" color={gold} />
              <Text style={{ fontSize: 12, color: textMuted, marginTop: 8 }}>Loading available slots...</Text>
            </View>
          ) : availableSlots.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Icon name="time-outline" size={32} color={colors.gold.glow} />
              <Text style={{ fontSize: 13, color: textMuted, marginTop: 8 }}>No slots available for this date</Text>
            </View>
          ) : (
            <>
              {renderSlotGroup("Morning", "sunny-outline", slotGroups.morning)}
              {renderSlotGroup("Afternoon", "partly-sunny-outline", slotGroups.afternoon)}
              {renderSlotGroup("Evening", "moon-outline", slotGroups.evening)}
            </>
          )}
        </View>

        {/* ── Delivery Address ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Delivery Address
          </Text>
          <View
            style={[
              st.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            {loadingAddresses ? (
              <ActivityIndicator size="small" color={gold} />
            ) : selectedAddress ? (
              <View style={st.addressRow}>
                <View style={st.addressIcon}>
                  <Icon name="location" size={20} color={gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[st.addressLabel, { color: textPrimary }]}>
                    {selectedAddress.label}
                  </Text>
                  <Text style={[st.addressStreet, { color: textMuted }]}>
                    {selectedAddress.street}
                  </Text>
                  <Text style={{ fontSize: 12, color: textMuted }}>
                    {selectedAddress.city}, {selectedAddress.province} {selectedAddress.postal_code}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => {
                  // Cycle through addresses
                  const currentIdx = addresses.findIndex(a => a.id === selectedAddress.id);
                  const nextIdx = (currentIdx + 1) % addresses.length;
                  setSelectedAddress(addresses[nextIdx]);
                }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: gold }}>
                    Change
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                <Text style={{ fontSize: 13, color: textMuted }}>No addresses saved</Text>
                <TouchableOpacity onPress={() => navigation.navigate('SavedAddresses')} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: gold }}>Add Address</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── Delivery Instructions ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Delivery Instructions
          </Text>
          <TextInput
            style={[
              st.instructionInput,
              {
                backgroundColor: cardBg,
                borderColor: cardBorder,
                color: textPrimary,
              },
            ]}
            placeholder="E.g. Ring the bell, leave at the gate..."
            placeholderTextColor={textMuted}
            value={instructions}
            onChangeText={setInstructions}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* ── Delivery Speed Toggle ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 20 }}>
          <Text style={[st.sectionTitle, { color: textPrimary }]}>
            Delivery Speed
          </Text>
          <View style={st.speedRow}>
            <TouchableOpacity
              onPress={() => setDeliveryType("standard")}
              style={[
                st.speedCard,
                {
                  backgroundColor: deliveryType === "standard" ? gold : cardBg,
                  borderColor: deliveryType === "standard" ? gold : cardBorder,
                },
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name="bicycle-outline"
                size={22}
                color={deliveryType === "standard" ? "#000" : gold}
              />
              <Text
                style={[
                  st.speedTitle,
                  {
                    color: deliveryType === "standard" ? "#000" : textPrimary,
                  },
                ]}
              >
                Standard
              </Text>
              <Text
                style={[
                  st.speedSub,
                  {
                    color: deliveryType === "standard" ? "#000" : textMuted,
                  },
                ]}
              >
                60 min
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setDeliveryType("express")}
              style={[
                st.speedCard,
                {
                  backgroundColor: deliveryType === "express" ? gold : cardBg,
                  borderColor: deliveryType === "express" ? gold : cardBorder,
                },
              ]}
              activeOpacity={0.8}
            >
              <Icon
                name="flash-outline"
                size={22}
                color={deliveryType === "express" ? "#000" : gold}
              />
              <Text
                style={[
                  st.speedTitle,
                  {
                    color: deliveryType === "express" ? "#000" : textPrimary,
                  },
                ]}
              >
                Express
              </Text>
              <Text
                style={[
                  st.speedSub,
                  {
                    color: deliveryType === "express" ? "#000" : textMuted,
                  },
                ]}
              >
                30 min
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Pricing Info ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={[
              st.card,
              { backgroundColor: cardBg, borderColor: cardBorder },
            ]}
          >
            <View style={st.priceRow}>
              <Text style={{ fontSize: 13, color: textMuted }}>
                Standard delivery
              </Text>
              <Text style={[st.priceValue, { color: textPrimary }]}>
                Free over R150
              </Text>
            </View>
            <View style={[st.priceRow, { marginTop: 8 }]}>
              <Text style={{ fontSize: 13, color: textMuted }}>
                Express delivery
              </Text>
              <Text style={[st.priceValue, { color: textPrimary }]}>R35</Text>
            </View>
          </View>
        </View>

        {/* ── Priority Delivery ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={[
              st.card,
              {
                backgroundColor: colors.gold.faint,
                borderColor: gold,
              },
            ]}
          >
            <View style={st.priorityRow}>
              <View style={{ flex: 1 }}>
                <View style={st.priorityTitleRow}>
                  <Icon name="diamond-outline" size={16} color={gold} />
                  <Text style={[st.priorityTitle, { color: gold }]}>
                    Priority Delivery
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: textMuted, marginTop: 4 }}>
                  Guaranteed within 30 min -- R55
                </Text>
              </View>
              <Switch
                value={priorityEnabled}
                onValueChange={setPriorityEnabled}
                trackColor={{ false: isDark ? "#333" : "#DDD", true: gold }}
                thumbColor={colors.white}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <View
        style={[
          st.bottomBar,
          {
            paddingBottom: insets.bottom + 12,
            backgroundColor: screenBg,
            borderTopColor: cardBorder,
          },
        ]}
      >
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handleConfirm}
          style={{ flex: 1 }}
        >
          <LinearGradient
            colors={[colors.gold.primary, colors.gold.dark]}
            style={st.confirmBtn}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Icon name="checkmark-circle-outline" size={20} color="#000" />
            <Text style={st.confirmBtnText}>Confirm Schedule</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────

const st = StyleSheet.create({
  root: { flex: 1 },
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
  sectionTitle: { fontSize: 17, fontWeight: "700", marginBottom: 14 },

  // Card base
  card: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },

  // Day picker
  dayCard: {
    width: 76,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: { fontSize: 13, fontWeight: "700" },
  daySublabel: { fontSize: 11, marginTop: 2 },

  // Time slots
  slotGroupHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  slotGroupTitle: { fontSize: 14, fontWeight: "700" },
  slotsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  slotChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  slotChipText: { fontSize: 13, fontWeight: "600" },

  // Address
  addressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.xl,
    backgroundColor: "rgba(212,175,55,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  addressLabel: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  addressStreet: { fontSize: 13 },

  // Instructions
  instructionInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 14,
    fontSize: 14,
    minHeight: 80,
  },

  // Speed
  speedRow: { flexDirection: "row", gap: 12 },
  speedCard: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  speedTitle: { fontSize: 15, fontWeight: "800" },
  speedSub: { fontSize: 12 },

  // Pricing
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priceValue: { fontSize: 14, fontWeight: "700" },

  // Priority
  priorityRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorityTitle: { fontSize: 15, fontWeight: "800" },

  // Bottom bar
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  confirmBtn: {
    height: 56,
    borderRadius: borderRadius.full,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  confirmBtnText: { fontSize: 16, fontWeight: "800", color: "#000" },
});
