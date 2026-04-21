import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Image,
  Linking,
  Modal,
  FlatList,
} from "react-native";
import * as Location from "expo-location";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing, borderRadius, typography } from "../theme";
import { Icon } from "../components/Icon";
import { useAuth } from "../contexts/AuthContext";
import { useCart } from "../contexts/CartContext";
import { useTheme } from "../contexts/ThemeContext";
import { useOrders } from "../contexts/OrderContext";
import { useNavigation } from "@react-navigation/native";
import { formatCurrency, formatRand } from "../utils/currency";
import { supabase } from "../lib/supabase";
import { PaymentService } from "../services/PaymentService";
import { ComplianceService } from "../services/ComplianceService";
import { haptics } from "../utils/haptics";

type DeliveryMethod = "standard" | "express" | "free";
type PaymentMethod = "instant_eft" | "cash";

const DELIVERY_OPTIONS: {
  key: DeliveryMethod;
  label: string;
  price: number;
  description: string;
  icon: string;
}[] = [
  {
    key: "standard",
    label: "Same-Day Delivery",
    price: 9.99,
    description: "Arrives today \u00b7 2\u20133 hour window",
    icon: "bicycle-outline",
  },
  {
    key: "express",
    label: "Priority Concierge",
    price: 29.99,
    description: "Under 90 minutes \u00b7 door-to-door",
    icon: "flash-outline",
  },
  {
    key: "free",
    label: "Complimentary Delivery",
    price: 0,
    description: "On orders over R1,500",
    icon: "gift-outline",
  },
];

const PAYMENT_OPTIONS: {
  key: PaymentMethod;
  label: string;
  icon: string;
  description: string;
}[] = [
  {
    key: "instant_eft",
    label: "Pay by Bank",
    icon: "swap-horizontal-outline",
    description: "Instant bank transfer — secured by Ozow",
  },
  {
    key: "cash",
    label: "Cash on Delivery",
    icon: "cash-outline",
    description: "Pay cash to your driver at the door",
  },
];

const STEPS = [
  { number: 1, label: "Address" },
  { number: 2, label: "Payment" },
  { number: 3, label: "Review" },
];

export default function CheckoutScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { items, total, itemCount, clearCart } = useCart();
  const { placeOrder, checkStock } = useOrders();
  const { colors, gradients, shadows, isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const isPlacingOrderRef = useRef(false);
  const [ageVerified, setAgeVerified] = useState(false);
  // Simple 18+ confirmation modal (SA Liquor Act compliance)
  const [showDobModal, setShowDobModal] = useState(false);

  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [postalCode, setPostalCode] = useState("");

  // ── Address / Location ─────────────────────────────────────────────────
  const GMAPS_KEY = "AIzaSyD-HS51JlYSqUoEoS_wDwg6M9uq5sry204";
  const [locationLoading, setLocationLoading] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<
    Array<{ place_id: string; description: string; main_text: string }>
  >([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const suggestionsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dismiss suggestions when address fields are filled
  useEffect(() => {
    if (city && province && postalCode) setShowSuggestions(false);
  }, [city, province, postalCode]);

  /** Ask for location permission then reverse-geocode to address fields */
  const detectMyLocation = useCallback(async () => {
    setLocationLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Location Access Needed",
          "LIQZAR needs your location to auto-fill your delivery address.",
          [
            { text: "Not Now", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }

      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      // Reverse geocode to structured address
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });

      if (geo) {
        const streetParts = [geo.streetNumber, geo.street].filter(Boolean);
        setStreet(streetParts.join(" "));
        setCity(geo.city ?? geo.subregion ?? "");
        setProvince(geo.region ?? "");
        setPostalCode(geo.postalCode ?? "");
        setShowSuggestions(false);
      } else {
        Alert.alert("Location Error", "Could not resolve your address. Please enter manually.");
      }
    } catch {
      Alert.alert("Location Error", "Could not access your location. Please enter manually.");
    } finally {
      setLocationLoading(false);
    }
  }, []);

  /** Debounced Google Places autocomplete fetch */
  const onStreetChange = useCallback(
    (text: string) => {
      setStreet(text);
      if (suggestionsTimer.current) clearTimeout(suggestionsTimer.current);
      if (text.length < 3) {
        setAddressSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      suggestionsTimer.current = setTimeout(async () => {
        setPlacesLoading(true);
        try {
          const resp = await fetch(
            `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(text)}&key=${GMAPS_KEY}&components=country:za&types=address&language=en`,
          );
          const data = await resp.json();
          if (data.status === "OK" && data.predictions?.length) {
            setAddressSuggestions(
              data.predictions.slice(0, 5).map((p: any) => ({
                place_id: p.place_id,
                description: p.description,
                main_text: p.structured_formatting?.main_text ?? p.description,
              })),
            );
            setShowSuggestions(true);
          } else {
            setAddressSuggestions([]);
            setShowSuggestions(false);
          }
        } catch {
          /* network failure — silent, user can still type manually */
        } finally {
          setPlacesLoading(false);
        }
      }, 380);
    },
    [GMAPS_KEY],
  );

  /** Fetch full address components from a selected Places suggestion */
  const selectSuggestion = useCallback(
    async (placeId: string, description: string) => {
      setShowSuggestions(false);
      setAddressSuggestions([]);
      setPlacesLoading(true);
      try {
        const resp = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GMAPS_KEY}&fields=address_components&language=en`,
        );
        const data = await resp.json();
        const comps: Array<{ long_name: string; short_name: string; types: string[] }> =
          data.result?.address_components ?? [];

        const get = (type: string) =>
          comps.find((c) => c.types.includes(type))?.long_name ?? "";

        const streetNum = get("street_number");
        const route = get("route");
        const suburb = get("sublocality_level_1") || get("sublocality");
        const locality = get("locality");
        const adminArea = get("administrative_area_level_1");
        const postal = get("postal_code");

        setStreet([streetNum, route, suburb].filter(Boolean).join(" ") || description.split(",")[0]);
        setCity(locality || suburb || "");
        setProvince(adminArea || "");
        setPostalCode(postal || "");
      } catch {
        // Fallback: parse description text if Places Details fails
        const parts = description.split(",").map((s) => s.trim());
        if (parts.length >= 1) setStreet(parts[0]);
        if (parts.length >= 2) setCity(parts[1]);
        if (parts.length >= 3) setProvince(parts[2]);
      } finally {
        setPlacesLoading(false);
      }
    },
    [GMAPS_KEY],
  );

  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>(
    total >= 150 ? "free" : "standard",
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("instant_eft");
  const [deliverySlot, setDeliverySlot] = useState<string>("asap");

  // Generate delivery slots based on current SA time (09:00\u201321:00 window).
  // Recomputes whenever delivery method changes.
  const deliverySlots = React.useMemo(() => {
    const now = new Date();
    const hour = now.getHours();
    const slots: { key: string; label: string; sub: string }[] = [];
    if (deliveryMethod === "express") {
      slots.push({ key: "asap", label: "ASAP", sub: "Under 90 min" });
      return slots;
    }
    slots.push({ key: "asap", label: "ASAP", sub: "2\u20133 hr window" });
    // Remaining today windows (2-hour buckets, after current hour + 2)
    const cutoff = Math.max(hour + 2, 11);
    const todayWindows = [
      [11, 13],
      [13, 15],
      [15, 17],
      [17, 19],
      [19, 21],
    ] as const;
    for (const [s, e] of todayWindows) {
      if (s >= cutoff && s < 21) {
        slots.push({ key: `today-${s}`, label: `${s}:00\u2013${e}:00`, sub: "Today" });
      }
    }
    // Tomorrow: 10\u201312, 14\u201316, 18\u201320
    slots.push({ key: "tmr-10", label: "10:00\u201312:00", sub: "Tomorrow" });
    slots.push({ key: "tmr-14", label: "14:00\u201316:00", sub: "Tomorrow" });
    slots.push({ key: "tmr-18", label: "18:00\u201320:00", sub: "Tomorrow" });
    // Future days 2\u20137 ahead \u2014 premium scheduling for gifts, events, sendoffs
    const dayFmt = (d: Date) =>
      d.toLocaleDateString("en-ZA", { weekday: "short", day: "numeric", month: "short" });
    for (let d = 2; d <= 7; d++) {
      const day = new Date();
      day.setDate(day.getDate() + d);
      const subLabel = dayFmt(day);
      slots.push({ key: `d${d}-10`, label: "10:00\u201312:00", sub: subLabel });
      slots.push({ key: `d${d}-14`, label: "14:00\u201316:00", sub: subLabel });
      slots.push({ key: `d${d}-18`, label: "18:00\u201320:00", sub: subLabel });
    }
    return slots;
  }, [deliveryMethod]);

  // Reset slot when method changes
  useEffect(() => {
    setDeliverySlot("asap");
  }, [deliveryMethod]);

  // ── Saved addresses (labelled book) ──
  const [savedAddresses, setSavedAddresses] = useState<Array<{
    id: string;
    label: string;
    street_address: string;
    city: string;
    province: string;
    postal_code: string;
  }>>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user?.id) return;
      try {
        const { data } = await supabase
          .from("saved_addresses")
          .select("id,label,street_address,city,province,postal_code,is_default")
          .eq("user_id", user.id)
          .order("is_default", { ascending: false })
          .order("created_at", { ascending: false });
        if (cancelled || !data) return;
        setSavedAddresses(data as any);
        const def = data.find((a: any) => a.is_default) || data[0];
        if (def && !street) {
          setSelectedSavedAddressId(def.id);
          setStreet(def.street_address);
          setCity(def.city);
          setProvince(def.province);
          setPostalCode(def.postal_code);
        }
      } catch {
        // Silent \u2014 picker just won't render.
      }
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  const applySavedAddress = (id: string) => {
    const a = savedAddresses.find((x) => x.id === id);
    if (!a) return;
    setSelectedSavedAddressId(id);
    setStreet(a.street_address);
    setCity(a.city);
    setProvince(a.province);
    setPostalCode(a.postal_code);
  };

  const labelIconFor = (label: string): string => {
    const l = label.toLowerCase();
    if (l.includes("home")) return "home-outline";
    if (l.includes("work") || l.includes("office")) return "briefcase-outline";
    if (l.includes("hotel")) return "bed-outline";
    return "bookmark-outline";
  };

  // ── Gift journey (first-class) ──────────────────────────────────────
  type WrapStyle = "none" | "signature" | "velvet" | "hamper";
  const [isGift, setIsGift] = useState(false);
  const [wrapStyle, setWrapStyle] = useState<WrapStyle>("signature");
  const [giftNote, setGiftNote] = useState("");
  const [shipToRecipient, setShipToRecipient] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientStreet, setRecipientStreet] = useState("");
  const [recipientCity, setRecipientCity] = useState("");

  const WRAP_OPTIONS: { key: WrapStyle; label: string; sub: string; fee: number; icon: string }[] = [
    { key: "none", label: "No wrap", sub: "Ship as-is", fee: 0, icon: "close-outline" },
    { key: "signature", label: "Signature", sub: "Gold ribbon + card", fee: 49, icon: "gift-outline" },
    { key: "velvet", label: "Velvet Box", sub: "Lined presentation box", fee: 149, icon: "cube-outline" },
    { key: "hamper", label: "Hamper", sub: "Curated basket", fee: 249, icon: "basket-outline" },
  ];

  const giftFee = isGift
    ? WRAP_OPTIONS.find((w) => w.key === wrapStyle)?.fee ?? 0
    : 0;

  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<{ code: string; discount: number; promoId: string; isFreeDelivery?: boolean } | null>(null);
  const [promoError, setPromoError] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoDiscount, setPromoDiscount] = useState(0);

  // G03: payment retry state — set when PaymentService.initiatePayment fails
  // after the order has already been created, so we can retry payment only
  const [failedPaymentOrderId, setFailedPaymentOrderId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string>("");

  // G06: delivery hours advisory (synchronous check — no async needed)
  const deliveryHoursCheck = ComplianceService.isWithinDeliveryHours();

  // Scale animation for place order button
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    haptics.medium();
    Animated.spring(scaleAnim, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);

    try {
      const code = promoCode.trim().toUpperCase();

      // Query promo from database
      const { data: promo, error } = await supabase
        .from("promo_codes")
        .select("*")
        .eq("code", code)
        .eq("is_active", true)
        .single();

      if (error || !promo) {
        Alert.alert("Invalid Code", "This promo code is not valid or has expired.");
        setPromoLoading(false);
        return;
      }

      // Check expiry
      if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
        Alert.alert("Expired", "This promo code has expired.");
        setPromoLoading(false);
        return;
      }

      // Check usage limit
      if (promo.max_uses && promo.used_count >= promo.max_uses) {
        Alert.alert("Limit Reached", "This promo code has reached its usage limit.");
        setPromoLoading(false);
        return;
      }

      // Check minimum order value
      if (promo.min_order_value && subtotal < promo.min_order_value) {
        Alert.alert("Minimum Not Met", `This code requires a minimum order of R${promo.min_order_value.toFixed(2)}.`);
        setPromoLoading(false);
        return;
      }

      // Calculate discount
      let discount = 0;
      if (promo.discount_type === "percentage") {
        discount = subtotal * (promo.discount_value / 100);
      } else if (promo.discount_type === "fixed") {
        discount = Math.min(promo.discount_value, subtotal);
      } else if (promo.discount_type === "free_delivery") {
        discount = deliveryFee;
      }

      const isFreeDelivery = promo.discount_type === "free_delivery";
      setAppliedPromo({ code, discount, promoId: promo.id, isFreeDelivery });
      setPromoDiscount(isFreeDelivery ? 0 : discount);
      setPromoCode("");
    } catch (err) {
      Alert.alert("Error", "Could not validate promo code. Please try again.");
    }

    setPromoLoading(false);
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    setPromoDiscount(0);
    setPromoError("");
  };

  const subtotal = total;
  const discountedSubtotal = Math.max(0, subtotal - promoDiscount);
  const isFreeDeliveryPromo = appliedPromo?.isFreeDelivery ?? false;
  const deliveryFee =
    isFreeDeliveryPromo
      ? 0
      : deliveryMethod === "free" && subtotal >= 150
        ? 0
        : (DELIVERY_OPTIONS.find((d) => d.key === deliveryMethod)?.price ?? 9.99);
  // SA retail prices are VAT-inclusive (15%). Extract VAT from total for reporting only.
  const orderTotal = discountedSubtotal + deliveryFee + giftFee;
  const vatAmount = Math.round((orderTotal / 1.15) * 0.15 * 100) / 100;

  const canPlaceOrder =
    street.trim() &&
    city.trim() &&
    province.trim() &&
    postalCode.trim() &&
    items.length > 0;

  // Determine current step for indicator
  const hasAddress = street.trim() && city.trim() && province.trim() && postalCode.trim();
  const currentStep = hasAddress ? (paymentMethod ? 3 : 2) : 1;

  /**
   * Open Ozow's hosted bank-auth page in an auth session.
   * The web bridge at /payment/return fires `liqzar://payment-return`
   * which auto-dismisses the browser. Then we poll the payment record
   * (the webhook is the source of truth) and branch navigation on status.
   */
  const openOzowAndResolve = async (
    url: string,
    paymentId: string | undefined,
    orderIdForNav: string,
  ) => {
    try {
      console.log("[Checkout] Opening Ozow URL:", url);
      await WebBrowser.openAuthSessionAsync(url, "liqzar://payment-return");
    } catch (browserErr: any) {
      console.warn("[Checkout] WebBrowser failed, falling back to Linking:", browserErr?.message);
      try {
        await Linking.openURL(url);
      } catch {
        /* ignore — user may have cancelled */
      }
    }

    // The webhook may still be in flight. Verify quickly; on any pending state,
    // hand off to order tracking where the live payment_status will update.
    if (paymentId) {
      try {
        const verify = await PaymentService.verifyPaymentStatus(paymentId);
        if (verify.status === "captured" || verify.status === "authorized") {
          setFailedPaymentOrderId(null);
          setPaymentError("");
          clearCart();
          navigation.navigate("OrderHistory");
          return;
        }
        if (verify.status === "failed" || verify.status === "cancelled") {
          setFailedPaymentOrderId(orderIdForNav);
          setPaymentError(verify.error || "Payment was not completed. You can retry below.");
          return;
        }
      } catch {
        /* fall through to default — tracker will reconcile */
      }
    }

    // Pending / awaiting webhook — show order so user can watch it settle
    clearCart();
    navigation.navigate("OrderHistory");
  };

  const handlePlaceOrder = async (ageJustVerified = false) => {
    if (!canPlaceOrder) {
      Alert.alert("Missing Information", "Please fill in all delivery address fields.");
      return;
    }
    if (!user?.id) {
      Alert.alert("Error", "You must be signed in to place an order.");
      return;
    }

    // Same-day delivery cutoff — express orders must be placed by 14:00 SAST
    if (deliveryMethod === "express") {
      const hour = new Date().getHours();
      if (hour >= 14) {
        Alert.alert(
          "Same-Day Cutoff Passed",
          "Express (same-day) delivery orders must be placed by 14:00. Please select Standard Delivery or try again tomorrow.",
        );
        return;
      }
    }

    // Age verification — simple 18+ confirm modal (SA Liquor Act, P0 requirement)
    if (!ageVerified && !ageJustVerified) {
      setShowDobModal(true);
      return;
    }

    // Guard against double-submit before setting loading
    if (isPlacingOrderRef.current) return;
    isPlacingOrderRef.current = true;
    setLoading(true);
    try {
      // Pre-flight stock check — avoids creating an order for unavailable items
      const stockCheck = await checkStock(
        items.map((i) => ({ product_id: i.id, quantity: i.quantity, product_name: i.name })),
      );
      if (!stockCheck.available) {
        const unavailable = stockCheck.items.filter((i) => !i.sufficient);
        const itemList = unavailable
          .map((i) => `• ${i.product_name} (need ${i.requested}, only ${i.available} available)`)
          .join("\n");
        Alert.alert(
          "Items Out of Stock",
          `The following items have insufficient stock:\n\n${itemList}\n\nPlease adjust your cart and try again.`,
        );
        return;
      }

      // Compose customer_notes from delivery slot + gift journey
      const noteLines: string[] = [];
      let scheduledForDate: string | null = null;
      let scheduledWindow: string | null = null;
      if (deliverySlot && deliverySlot !== "asap") {
        const slot = deliverySlots.find((s) => s.key === deliverySlot);
        if (slot) noteLines.push(`Preferred arrival: ${slot.sub} ${slot.label}`);
        // Derive structured scheduling metadata
        const m = deliverySlot.match(/^(tmr|d(\d+))-(\d+)$/);
        if (m) {
          const daysAhead = m[1] === "tmr" ? 1 : parseInt(m[2], 10);
          const hour = parseInt(m[3], 10);
          const windowMap: Record<number, string> = {
            10: "10:00-12:00",
            14: "14:00-16:00",
            18: "18:00-20:00",
          };
          if (windowMap[hour]) {
            const d = new Date();
            d.setDate(d.getDate() + daysAhead);
            scheduledForDate = d.toISOString().slice(0, 10);
            scheduledWindow = windowMap[hour];
          }
        }
      }
      if (isGift) {
        const wrap = WRAP_OPTIONS.find((w) => w.key === wrapStyle);
        noteLines.push(`🎁 GIFT ORDER · Wrap: ${wrap?.label ?? "Signature"}`);
        if (giftNote.trim()) {
          noteLines.push(`Gift note: "${giftNote.trim()}"`);
        }
        if (shipToRecipient && recipientName.trim()) {
          noteLines.push(
            `Deliver to: ${recipientName.trim()}${recipientPhone.trim() ? ` · ${recipientPhone.trim()}` : ""}`,
          );
        }
      }

      // Gift orders with a recipient override use the recipient's address
      const deliveryStreet = isGift && shipToRecipient && recipientStreet.trim()
        ? recipientStreet.trim()
        : street;
      const deliveryCity = isGift && shipToRecipient && recipientCity.trim()
        ? recipientCity.trim()
        : city;

      const result = await placeOrder({
        user_id: user.id,
        items: items.map((item) => ({
          product_id: item.id,
          product_name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
        })),
        delivery_address: {
          street: deliveryStreet,
          city: deliveryCity,
          province,
          postal_code: postalCode,
          country: "South Africa",
        },
        delivery_method: deliveryMethod,
        payment_method: paymentMethod,
        subtotal,
        delivery_fee: deliveryFee,
        vat_amount: vatAmount,
        total: orderTotal,
        discount_amount: promoDiscount,
        customer_notes: noteLines.length ? noteLines.join("\n") : undefined,
        scheduled_for_date: scheduledForDate,
        scheduled_window: scheduledWindow,
        gift: isGift
          ? {
              wrap_style: wrapStyle,
              wrap_fee: giftFee,
              note_length: giftNote.trim().length,
              has_note: giftNote.trim().length > 0,
              ship_to_recipient: shipToRecipient && recipientStreet.trim().length > 0,
            }
          : undefined,
      });

      if (!result.success) {
        // Handle stock unavailability specifically
        if ((result as any).unavailableItems?.length) {
          const unavailable = (result as any).unavailableItems;
          const itemList = unavailable
            .map((i: any) => `• ${i.product_name} (need ${i.requested}, only ${i.available} available)`)
            .join("\n");
          Alert.alert(
            "Items Out of Stock",
            `The following items have insufficient stock:\n\n${itemList}\n\nPlease adjust your cart and try again.`,
          );
          throw new Error("stock_unavailable");
        }
        throw new Error(result.error);
      }

      // Process payment
      const selectedPaymentMethod: "instant_eft" | "cash_on_delivery" =
        paymentMethod === "cash" ? "cash_on_delivery" : "instant_eft";
      const createdOrderId = (result as any).orderId || (result as any).order?.id;
      const paymentResult = await PaymentService.initiatePayment({
        orderId: createdOrderId,
        amount: orderTotal,
        paymentMethod: selectedPaymentMethod,
        customerEmail: user?.email,
      });

      if (!paymentResult.success) {
        // Order exists — surface a retry UI instead of just an Alert
        // so the user can retry without creating a duplicate order
        setFailedPaymentOrderId(createdOrderId);
        setPaymentError(paymentResult.error || "Payment failed. Please retry below.");
        return;
      }

      if (paymentResult.redirectUrl) {
        // Open Ozow hosted bank auth. openAuthSessionAsync auto-dismisses when
        // the web bridge fires our `liqzar://payment-return` deep link.
        await openOzowAndResolve(paymentResult.redirectUrl, paymentResult.paymentId, createdOrderId);
        return;
      }

      // Payment authorized — clear failed state if previously set
      setFailedPaymentOrderId(null);
      setPaymentError("");
      clearCart();
      haptics.success();

      Alert.alert(
        "Order Placed!",
        "Your order has been placed and payment is being processed. A delivery PIN will be sent to you — share it only with your driver upon delivery.",
        [
          {
            text: "Track Order",
            onPress: () => navigation.navigate("OrderHistory"),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert("Order Failed", error?.message || "Something went wrong. Please try again.");
    } finally {
      isPlacingOrderRef.current = false;
      setLoading(false);
    }
  };

  /** G03: Retry payment for an order that was created but payment failed */
  const handleRetryPayment = async () => {
    if (!failedPaymentOrderId) return;
    setLoading(true);
    try {
      const selectedPaymentMethod: "instant_eft" | "cash_on_delivery" =
        paymentMethod === "cash" ? "cash_on_delivery" : "instant_eft";
      const paymentResult = await PaymentService.initiatePayment({
        orderId: failedPaymentOrderId,
        amount: orderTotal,
        paymentMethod: selectedPaymentMethod,
        customerEmail: user?.email,
      });

      if (!paymentResult.success) {
        setPaymentError(paymentResult.error || "Retry failed. Please try again or contact support.");
        return;
      }

      if (paymentResult.redirectUrl) {
        await openOzowAndResolve(paymentResult.redirectUrl, paymentResult.paymentId, failedPaymentOrderId);
        return;
      }

      setFailedPaymentOrderId(null);
      setPaymentError("");
      clearCart();
      Alert.alert(
        "Payment Successful!",
        "Your order payment has been processed. A delivery PIN will be sent to you — share it only with your driver upon delivery.",
        [{ text: "Track Order", onPress: () => navigation.navigate("OrderHistory") }],
      );
    } catch (error: any) {
      setPaymentError(error?.message || "Payment retry failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── Render Helpers ──────────────────────────────────────────

  /**
   * User confirms they are 18+ — set age verified and proceed with order.
   */
  const handleDobConfirm = () => {
    setAgeVerified(true);
    setShowDobModal(false);
    handlePlaceOrder(true); // pass true to bypass age check on re-entry
  };

  const renderStepIndicator = () => (
    <View style={styles.stepContainer}>
      {STEPS.map((step, index) => {
        const isCompleted = currentStep > step.number;
        const isActive = currentStep === step.number;
        const isLast = index === STEPS.length - 1;

        return (
          <React.Fragment key={step.number}>
            <View style={styles.stepItem}>
              <View
                style={[
                  styles.stepCircle,
                  {
                    backgroundColor: isCompleted
                      ? colors.gold.primary
                      : isActive
                        ? colors.gold.faint
                        : "transparent",
                    borderColor: isCompleted || isActive
                      ? colors.gold.primary
                      : colors.gold.muted,
                  },
                ]}
              >
                {isCompleted ? (
                  <Icon name="checkmark" size={14} color={colors.text.inverse} />
                ) : (
                  <Text
                    style={[
                      styles.stepNumber,
                      {
                        color: isActive
                          ? colors.gold.primary
                          : colors.gold.muted,
                      },
                    ]}
                  >
                    {step.number}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepLabel,
                  {
                    color: isCompleted || isActive
                      ? colors.gold.primary
                      : colors.gold.muted,
                    fontWeight: isActive ? "700" : "500",
                  },
                ]}
              >
                {step.label}
              </Text>
            </View>
            {!isLast && (
              <View
                style={[
                  styles.stepLine,
                  {
                    backgroundColor: isCompleted
                      ? colors.gold.primary
                      : colors.gold.border,
                  },
                ]}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );

  const renderSectionTitle = (icon: string, title: string, trailing?: React.ReactNode) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <View
          style={[
            styles.sectionIconWrap,
            { backgroundColor: colors.gold.faint },
          ]}
        >
          <Icon name={icon} size={18} color={colors.gold.primary} />
        </View>
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text.primary }]}>
            {title}
          </Text>
          <View
            style={[
              styles.sectionAccentLine,
              { backgroundColor: colors.gold.primary },
            ]}
          />
        </View>
      </View>
      {trailing}
    </View>
  );

  const renderCard = (children: React.ReactNode, extraStyle?: object) => (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.background.card,
          borderColor: colors.gold.border,
        },
        shadows.card,
        extraStyle,
      ]}
    >
      {children}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* ── Premium Header ──────────────────────────────── */}
        <LinearGradient
          colors={[...gradients.header]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.header, { paddingTop: insets.top }]}
        >
          {renderStepIndicator()}
          <LinearGradient
            colors={[...gradients.gold]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.headerGoldBorder}
          />
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ── Delivery Address ────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("location-outline", "Delivery Address")}

            {/* Saved addresses book */}
            {savedAddresses.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 12 }}
              >
                {savedAddresses.map((a) => {
                  const selected = selectedSavedAddressId === a.id;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => { haptics.selection(); applySavedAddress(a.id); }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityLabel={`Use ${a.label} address`}
                      style={{
                        paddingVertical: 8,
                        paddingHorizontal: 12,
                        borderRadius: 14,
                        borderWidth: 1,
                        borderColor: selected ? colors.gold.primary : colors.gold.border,
                        backgroundColor: selected ? colors.gold.faint : "transparent",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Icon
                        name={labelIconFor(a.label) as any}
                        size={14}
                        color={selected ? colors.gold.primary : colors.text.muted}
                      />
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "700",
                          color: selected ? colors.gold.primary : colors.text.primary,
                          letterSpacing: 0.3,
                        }}
                      >
                        {a.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  onPress={() => navigation.navigate("SavedAddresses")}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Manage saved addresses"
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderStyle: "dashed",
                    borderColor: colors.gold.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Icon name="add" size={14} color={colors.text.muted} />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: colors.text.muted,
                      letterSpacing: 0.3,
                    }}
                  >
                    Manage
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            {/* Use My Location CTA */}
            <TouchableOpacity
              onPress={detectMyLocation}
              disabled={locationLoading}
              activeOpacity={0.75}
              style={[
                styles.locationBtn,
                {
                  backgroundColor: colors.gold.faint,
                  borderColor: colors.gold.border,
                },
              ]}
            >
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.gold.primary} />
              ) : (
                <Icon name="navigate" size={18} color={colors.gold.primary} />
              )}
              <Text style={[styles.locationBtnText, { color: colors.gold.primary }]}>
                {locationLoading ? "Detecting location…" : "Use My Current Location"}
              </Text>
            </TouchableOpacity>

            {renderCard(
              <View>
                {/* Street address with Google Places autocomplete */}
                <View style={[styles.inputGroup, { zIndex: 10 }]}>
                  <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>
                    Street Address
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: colors.background.secondary,
                        borderColor: showSuggestions
                          ? colors.gold.primary
                          : colors.gold.border,
                      },
                    ]}
                  >
                    <Icon
                      name="location-outline"
                      size={18}
                      color={colors.gold.muted}
                      style={styles.inputIcon}
                    />
                    <TextInput
                      style={[styles.input, { color: colors.text.primary, flex: 1 }]}
                      placeholder="Start typing your street address…"
                      placeholderTextColor={colors.text.dim}
                      value={street}
                      onChangeText={onStreetChange}
                      onBlur={() =>
                        setTimeout(() => setShowSuggestions(false), 200)
                      }
                      returnKeyType="next"
                      autoCorrect={false}
                    />
                    {placesLoading && (
                      <ActivityIndicator
                        size="small"
                        color={colors.gold.primary}
                        style={{ marginRight: 8 }}
                      />
                    )}
                  </View>

                  {/* Google Places suggestions dropdown */}
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <View
                      style={[
                        styles.suggestionsContainer,
                        {
                          backgroundColor: colors.background.card,
                          borderColor: colors.gold.border,
                        },
                      ]}
                    >
                      {addressSuggestions.map((s, idx) => (
                        <TouchableOpacity
                          key={s.place_id}
                          onPress={() => selectSuggestion(s.place_id, s.description)}
                          activeOpacity={0.7}
                          style={[
                            styles.suggestionItem,
                            {
                              borderBottomColor: colors.gold.border,
                              borderBottomWidth:
                                idx < addressSuggestions.length - 1
                                  ? StyleSheet.hairlineWidth
                                  : 0,
                            },
                          ]}
                        >
                          <Icon
                            name="location-outline"
                            size={14}
                            color={colors.gold.muted}
                            style={{ marginRight: 8 }}
                          />
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.suggestionMain,
                                { color: colors.text.primary },
                              ]}
                              numberOfLines={1}
                            >
                              {s.main_text}
                            </Text>
                            <Text
                              style={[
                                styles.suggestionSub,
                                { color: colors.text.muted },
                              ]}
                              numberOfLines={1}
                            >
                              {s.description}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                      <Text
                        style={[styles.poweredByGoogle, { color: colors.text.dim }]}
                      >
                        Powered by Google
                      </Text>
                    </View>
                  )}
                </View>

                {/* City + Province row */}
                <View style={styles.inputRow}>
                  <View style={[styles.inputGroup, { flex: 1, marginRight: spacing.sm }]}>
                    <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>
                      City
                    </Text>
                    <View
                      style={[
                        styles.inputWrap,
                        {
                          backgroundColor: colors.background.secondary,
                          borderColor: colors.gold.border,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.text.primary }]}
                        placeholder="Johannesburg"
                        placeholderTextColor={colors.text.dim}
                        value={city}
                        onChangeText={setCity}
                      />
                    </View>
                  </View>
                  <View style={[styles.inputGroup, { flex: 1 }]}>
                    <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>
                      Province
                    </Text>
                    <View
                      style={[
                        styles.inputWrap,
                        {
                          backgroundColor: colors.background.secondary,
                          borderColor: colors.gold.border,
                        },
                      ]}
                    >
                      <TextInput
                        style={[styles.input, { color: colors.text.primary }]}
                        placeholder="Gauteng"
                        placeholderTextColor={colors.text.dim}
                        value={province}
                        onChangeText={setProvince}
                      />
                    </View>
                  </View>
                </View>

                {/* Postal Code */}
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: colors.gold.muted }]}>
                    Postal Code
                  </Text>
                  <View
                    style={[
                      styles.inputWrap,
                      {
                        backgroundColor: colors.background.secondary,
                        borderColor: colors.gold.border,
                        width: 150,
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.input, { color: colors.text.primary }]}
                      placeholder="2000"
                      placeholderTextColor={colors.text.dim}
                      value={postalCode}
                      onChangeText={setPostalCode}
                      keyboardType="number-pad"
                      maxLength={5}
                    />
                  </View>
                </View>
              </View>,
            )}
          </View>

          {/* ── Delivery Method ─────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("car-outline", "Delivery Method")}
            {renderCard(
              <>
                {DELIVERY_OPTIONS.map((option) => {
                  const isDisabled = option.key === "free" && subtotal < 150;
                  const isSelected = deliveryMethod === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.optionRow,
                        {
                          borderColor: "transparent",
                          backgroundColor: "transparent",
                        },
                        isSelected && {
                          backgroundColor: colors.gold.faint,
                          borderColor: colors.gold.border,
                        },
                        isDisabled && styles.optionRowDisabled,
                      ]}
                      onPress={() => !isDisabled && setDeliveryMethod(option.key)}
                      disabled={isDisabled}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: colors.text.dim },
                          isSelected && { borderColor: colors.gold.primary },
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: colors.gold.primary },
                            ]}
                          />
                        )}
                      </View>
                      <View
                        style={[
                          styles.optionIconWrap,
                          {
                            backgroundColor: isSelected
                              ? colors.gold.faint
                              : colors.background.secondary,
                          },
                        ]}
                      >
                        <Icon
                          name={option.icon}
                          size={18}
                          color={
                            isDisabled
                              ? colors.text.dim
                              : isSelected
                                ? colors.gold.primary
                                : colors.text.muted
                          }
                        />
                      </View>
                      <View style={styles.optionInfo}>
                        <Text
                          style={[
                            styles.optionLabel,
                            { color: colors.text.primary },
                            isDisabled && { color: colors.text.dim },
                          ]}
                        >
                          {option.label}
                        </Text>
                        <Text
                          style={[
                            styles.optionDescription,
                            { color: colors.text.muted },
                            isDisabled && { color: colors.text.dim },
                          ]}
                        >
                          {option.description}
                          {isDisabled ? " (spend R150+)" : ""}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.optionPrice,
                          { color: colors.text.muted },
                          isSelected && { color: colors.gold.primary },
                        ]}
                      >
                        {option.price === 0
                          ? "FREE"
                          : formatCurrency(option.price)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </>,
            )}
          </View>

          {/* ── Delivery Time Slot ──────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("time-outline", "Arrival Window")}
            {renderCard(
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingVertical: 4 }}
              >
                {deliverySlots.map((s) => {
                  const selected = deliverySlot === s.key;
                  return (
                    <TouchableOpacity
                      key={s.key}
                      onPress={() => { haptics.selection(); setDeliverySlot(s.key); }}
                      activeOpacity={0.8}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`${s.sub} ${s.label}`}
                      style={{
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        borderRadius: 12,
                        borderWidth: 1,
                        borderColor: selected
                          ? colors.gold.primary
                          : colors.gold.border,
                        backgroundColor: selected
                          ? colors.gold.faint
                          : "transparent",
                        minWidth: 96,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: selected ? colors.gold.primary : colors.text.primary,
                          textAlign: "center",
                          letterSpacing: 0.2,
                        }}
                      >
                        {s.label}
                      </Text>
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "600",
                          color: colors.text.muted,
                          textAlign: "center",
                          marginTop: 2,
                          letterSpacing: 0.4,
                          textTransform: "uppercase",
                        }}
                      >
                        {s.sub}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>,
            )}
          </View>

          {/* ── Gift Journey ────────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("gift-outline", "Send as a Gift")}
            {renderCard(
              <View>
                {/* Toggle row */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    haptics.selection();
                    setIsGift((v) => !v);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    paddingVertical: 4,
                  }}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: isGift }}
                  accessibilityLabel="Send this order as a gift"
                >
                  <View style={{ flex: 1, paddingRight: 12 }}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text.primary }}>
                      Make this a gift
                    </Text>
                    <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>
                      Premium wrap, handwritten note, optional recipient delivery
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 44,
                      height: 26,
                      borderRadius: 13,
                      padding: 2,
                      backgroundColor: isGift ? colors.gold.primary : colors.gold.border,
                      justifyContent: "center",
                    }}
                  >
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "#fff",
                        alignSelf: isGift ? "flex-end" : "flex-start",
                      }}
                    />
                  </View>
                </TouchableOpacity>

                {isGift && (
                  <View style={{ marginTop: 16, gap: 16 }}>
                    {/* Wrap picker */}
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.gold.primary,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Presentation
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8 }}
                      >
                        {WRAP_OPTIONS.map((w) => {
                          const selected = wrapStyle === w.key;
                          return (
                            <TouchableOpacity
                              key={w.key}
                              onPress={() => {
                                haptics.selection();
                                setWrapStyle(w.key);
                              }}
                              activeOpacity={0.8}
                              style={{
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                borderRadius: 12,
                                borderWidth: 1,
                                borderColor: selected ? colors.gold.primary : colors.gold.border,
                                backgroundColor: selected ? colors.gold.faint : "transparent",
                                minWidth: 110,
                                alignItems: "center",
                              }}
                            >
                              <Icon
                                name={w.icon as any}
                                size={18}
                                color={selected ? colors.gold.primary : colors.text.muted}
                              />
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: selected ? colors.gold.primary : colors.text.primary,
                                  marginTop: 4,
                                  letterSpacing: 0.2,
                                }}
                              >
                                {w.label}
                              </Text>
                              <Text
                                style={{
                                  fontSize: 10,
                                  color: colors.text.muted,
                                  marginTop: 2,
                                  letterSpacing: 0.3,
                                }}
                              >
                                {w.fee === 0 ? "Free" : `+R${w.fee}`}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Handwritten note composer */}
                    <View>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "700",
                          color: colors.gold.primary,
                          letterSpacing: 1,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Handwritten Card
                      </Text>
                      <TextInput
                        value={giftNote}
                        onChangeText={(t) => setGiftNote(t.slice(0, 240))}
                        placeholder="A short message — we'll transcribe it onto the card."
                        placeholderTextColor={colors.text.muted}
                        multiline
                        numberOfLines={3}
                        style={{
                          borderWidth: 1,
                          borderColor: colors.gold.border,
                          borderRadius: 10,
                          padding: 12,
                          minHeight: 72,
                          fontSize: 14,
                          color: colors.text.primary,
                          textAlignVertical: "top",
                          fontStyle: "italic",
                        }}
                      />
                      <Text
                        style={{
                          fontSize: 10,
                          color: colors.text.muted,
                          marginTop: 4,
                          textAlign: "right",
                          letterSpacing: 0.3,
                        }}
                      >
                        {giftNote.length}/240
                      </Text>
                    </View>

                    {/* Ship-to-recipient toggle */}
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        haptics.selection();
                        setShipToRecipient((v) => !v);
                      }}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingVertical: 4,
                      }}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: shipToRecipient }}
                      accessibilityLabel="Deliver to a different recipient"
                    >
                      <View style={{ flex: 1, paddingRight: 12 }}>
                        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.text.primary }}>
                          Deliver to recipient (not me)
                        </Text>
                        <Text style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
                          Billing stays on your card, parcel goes to them
                        </Text>
                      </View>
                      <View
                        style={{
                          width: 40,
                          height: 22,
                          borderRadius: 11,
                          padding: 2,
                          backgroundColor: shipToRecipient ? colors.gold.primary : colors.gold.border,
                          justifyContent: "center",
                        }}
                      >
                        <View
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: 9,
                            backgroundColor: "#fff",
                            alignSelf: shipToRecipient ? "flex-end" : "flex-start",
                          }}
                        />
                      </View>
                    </TouchableOpacity>

                    {shipToRecipient && (
                      <View style={{ gap: 10 }}>
                        <TextInput
                          value={recipientName}
                          onChangeText={setRecipientName}
                          placeholder="Recipient full name"
                          placeholderTextColor={colors.text.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.gold.border,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 14,
                            color: colors.text.primary,
                          }}
                        />
                        <TextInput
                          value={recipientPhone}
                          onChangeText={setRecipientPhone}
                          placeholder="Recipient phone (for driver call)"
                          placeholderTextColor={colors.text.muted}
                          keyboardType="phone-pad"
                          style={{
                            borderWidth: 1,
                            borderColor: colors.gold.border,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 14,
                            color: colors.text.primary,
                          }}
                        />
                        <TextInput
                          value={recipientStreet}
                          onChangeText={setRecipientStreet}
                          placeholder="Recipient street address"
                          placeholderTextColor={colors.text.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.gold.border,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 14,
                            color: colors.text.primary,
                          }}
                        />
                        <TextInput
                          value={recipientCity}
                          onChangeText={setRecipientCity}
                          placeholder="Recipient city / suburb"
                          placeholderTextColor={colors.text.muted}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.gold.border,
                            borderRadius: 10,
                            padding: 12,
                            fontSize: 14,
                            color: colors.text.primary,
                          }}
                        />
                      </View>
                    )}

                    {/* "Arriving as" preview */}
                    <View
                      style={{
                        borderWidth: StyleSheet.hairlineWidth,
                        borderColor: colors.gold.primary,
                        borderRadius: 12,
                        padding: 14,
                        backgroundColor: "rgba(212,175,55,0.05)",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 10,
                          fontWeight: "700",
                          color: colors.gold.primary,
                          letterSpacing: 1.2,
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        Arriving As
                      </Text>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Icon
                          name={(WRAP_OPTIONS.find((w) => w.key === wrapStyle)?.icon ?? "gift-outline") as any}
                          size={22}
                          color={colors.gold.primary}
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.text.primary }}>
                            {WRAP_OPTIONS.find((w) => w.key === wrapStyle)?.label} presentation
                          </Text>
                          <Text style={{ fontSize: 11, color: colors.text.muted, marginTop: 2 }}>
                            {WRAP_OPTIONS.find((w) => w.key === wrapStyle)?.sub}
                            {giftNote.trim() ? " · With your handwritten note" : ""}
                            {shipToRecipient && recipientName.trim() ? ` · To ${recipientName.trim().split(" ")[0]}` : ""}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>
                )}
              </View>,
            )}
          </View>

          {/* ── Payment Method ──────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("wallet-outline", "Payment Method")}
            {renderCard(
              <>
                {PAYMENT_OPTIONS.map((option) => {
                  const isSelected = paymentMethod === option.key;
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.optionRow,
                        {
                          borderColor: "transparent",
                          backgroundColor: "transparent",
                        },
                        isSelected && {
                          backgroundColor: colors.gold.faint,
                          borderColor: colors.gold.border,
                        },
                      ]}
                      onPress={() => setPaymentMethod(option.key)}
                      activeOpacity={0.7}
                      accessibilityLabel={option.label}
                      accessibilityRole="radio"
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          { borderColor: colors.text.dim },
                          isSelected && { borderColor: colors.gold.primary },
                        ]}
                      >
                        {isSelected && (
                          <View
                            style={[
                              styles.radioInner,
                              { backgroundColor: colors.gold.primary },
                            ]}
                          />
                        )}
                      </View>
                      <View
                        style={[
                          styles.optionIconWrap,
                          {
                            backgroundColor: isSelected
                              ? colors.gold.faint
                              : colors.background.secondary,
                          },
                        ]}
                      >
                        <Icon
                          name={option.icon}
                          size={20}
                          color={isSelected ? colors.gold.primary : colors.text.muted}
                        />
                      </View>
                      <View style={styles.optionInfo}>
                        <Text style={[styles.optionLabel, { color: isSelected ? colors.gold.primary : colors.text.primary }]}>
                          {option.label}
                        </Text>
                        <Text style={[styles.optionDescription, { color: colors.text.muted }]}>
                          {option.description}
                        </Text>
                      </View>
                      {option.key !== "cash" && (
                        <Text style={[styles.optionDescription, { color: colors.gold.muted, fontWeight: "700", fontSize: 10 }]}>
                          YOCO
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </>,
            )}
          </View>

          {/* ── Order Items ─────────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("bag-outline", "Order Items")}
            {renderCard(
              <>
                {items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[
                      styles.orderItemRow,
                      index < items.length - 1 && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: colors.gold.border,
                      },
                    ]}
                  >
                    <Image
                      source={{ uri: item.image_url }}
                      style={[
                        styles.orderItemImage,
                        { backgroundColor: colors.background.secondary },
                      ]}
                    />
                    <View style={styles.orderItemInfo}>
                      <Text
                        style={[
                          styles.orderItemName,
                          { color: colors.text.primary },
                        ]}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                      <Text
                        style={[
                          styles.orderItemMeta,
                          { color: colors.text.muted },
                        ]}
                      >
                        Qty: {item.quantity}
                        {item.bottle_size ? ` - ${item.bottle_size}` : ""}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.orderItemPrice,
                        { color: colors.gold.primary },
                      ]}
                    >
                      {formatCurrency(item.price * item.quantity)}
                    </Text>
                  </View>
                ))}
                {items.length === 0 && (
                  <View style={styles.emptyItems}>
                    <Icon
                      name="bag-outline"
                      size={32}
                      color={colors.text.dim}
                    />
                    <Text
                      style={[styles.emptyItemsText, { color: colors.text.dim }]}
                    >
                      Your cart is empty
                    </Text>
                  </View>
                )}
              </>,
            )}
          </View>

          {/* ── Promo Code ──────────────────────────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("pricetag-outline", "Promo Code")}
            {renderCard(
              <>
                {appliedPromo ? (
                  <View
                    style={[
                      styles.appliedPromoRow,
                      {
                        backgroundColor: colors.gold.faint,
                        borderColor: colors.gold.border,
                      },
                    ]}
                  >
                    <View style={{ flex: 1 }}>
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Icon
                          name="checkmark-circle"
                          size={18}
                          color={colors.gold.primary}
                        />
                        <Text
                          style={[
                            styles.appliedPromoCode,
                            { color: colors.gold.primary },
                          ]}
                        >
                          {appliedPromo.code}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.appliedPromoLabel,
                          { color: colors.text.muted },
                        ]}
                      >
                        {appliedPromo.isFreeDelivery
                          ? "Free delivery"
                          : `-${formatCurrency(appliedPromo.discount)} off`}
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleRemovePromo}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Icon
                        name="close-circle"
                        size={22}
                        color={colors.text.muted}
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <View style={styles.promoInputRow}>
                      <View
                        style={[
                          styles.inputWrap,
                          {
                            flex: 1,
                            backgroundColor: colors.background.secondary,
                            borderColor: colors.gold.border,
                          },
                        ]}
                      >
                        <Icon
                          name="pricetag-outline"
                          size={16}
                          color={colors.gold.muted}
                          style={styles.inputIcon}
                        />
                        <TextInput
                          style={[styles.input, { color: colors.text.primary, flex: 1 }]}
                          placeholder="Enter promo code"
                          placeholderTextColor={colors.text.dim}
                          value={promoCode}
                          onChangeText={(t) => {
                            setPromoCode(t);
                            setPromoError("");
                          }}
                          autoCapitalize="characters"
                        />
                      </View>
                      <TouchableOpacity
                        onPress={handleApplyPromo}
                        disabled={promoLoading || !promoCode.trim()}
                        activeOpacity={0.7}
                      >
                        <LinearGradient
                          colors={
                            promoCode.trim()
                              ? [...gradients.gold]
                              : [colors.text.dim, colors.text.dim]
                          }
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={styles.promoApplyButton}
                        >
                          {promoLoading ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.text.inverse}
                            />
                          ) : (
                            <Text
                              style={[
                                styles.promoApplyText,
                                { color: colors.text.inverse },
                              ]}
                            >
                              Apply
                            </Text>
                          )}
                        </LinearGradient>
                      </TouchableOpacity>
                    </View>
                    {promoError ? (
                      <Text style={[styles.promoErrorText, { color: colors.status.error }]}>{promoError}</Text>
                    ) : null}
                  </>
                )}
              </>,
            )}
          </View>

          {/* ── Order Summary / Price Breakdown ─────────────── */}
          <View style={styles.section}>
            {renderSectionTitle("receipt-outline", "Order Summary")}
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.background.card,
                  borderColor: colors.gold.border,
                  overflow: "hidden",
                  padding: 0,
                },
                shadows.card,
              ]}
            >
              {/* Gold gradient top border */}
              <LinearGradient
                colors={[...gradients.goldShimmer]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.summaryGoldTopBorder}
              />

              <View style={{ padding: spacing.md }}>
                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.text.muted }]}
                  >
                    Subtotal ({itemCount} {itemCount === 1 ? "item" : "items"})
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {formatCurrency(subtotal)}
                  </Text>
                </View>

                {promoDiscount > 0 && (
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryLabelRow}>
                      <Icon name="pricetag-outline" size={14} color={colors.status.success} />
                      <Text style={[styles.summaryLabel, { color: colors.status.success }]}>
                        Promo ({appliedPromo?.code})
                      </Text>
                    </View>
                    <Text style={[styles.summaryValue, { color: colors.status.success }]}>
                      -{formatCurrency(promoDiscount)}
                    </Text>
                  </View>
                )}

                {isFreeDeliveryPromo && (
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryLabelRow}>
                      <Icon name="gift-outline" size={14} color={colors.status.success} />
                      <Text style={[styles.summaryLabel, { color: colors.status.success }]}>
                        Free Delivery Promo
                      </Text>
                    </View>
                    <Text style={[styles.summaryValue, { color: colors.status.success }]}>
                      Applied
                    </Text>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.text.muted }]}
                  >
                    Delivery
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      {
                        color:
                          deliveryFee === 0
                            ? colors.status.success
                            : colors.text.primary,
                      },
                    ]}
                  >
                    {deliveryFee === 0 ? "FREE" : formatCurrency(deliveryFee)}
                  </Text>
                </View>

                {isGift && giftFee > 0 && (
                  <View style={styles.summaryRow}>
                    <Text
                      style={[styles.summaryLabel, { color: colors.text.muted }]}
                    >
                      Gift wrap ({WRAP_OPTIONS.find((w) => w.key === wrapStyle)?.label})
                    </Text>
                    <Text
                      style={[
                        styles.summaryValue,
                        { color: colors.text.primary },
                      ]}
                    >
                      {formatCurrency(giftFee)}
                    </Text>
                  </View>
                )}

                <View style={styles.summaryRow}>
                  <Text
                    style={[styles.summaryLabel, { color: colors.text.muted }]}
                  >
                    VAT (15%)
                  </Text>
                  <Text
                    style={[
                      styles.summaryValue,
                      { color: colors.text.primary },
                    ]}
                  >
                    {formatCurrency(vatAmount)}
                  </Text>
                </View>

                {/* Divider */}
                <View
                  style={[
                    styles.summaryDivider,
                    { borderTopColor: colors.gold.border },
                  ]}
                />

                {/* Total row */}
                <View style={styles.summaryTotalRow}>
                  <Text
                    style={[styles.totalLabel, { color: colors.text.primary }]}
                  >
                    Total
                  </Text>
                  <Text
                    style={[styles.totalValue, { color: colors.gold.primary }]}
                  >
                    {formatCurrency(orderTotal)}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>

        {/* ── Place Order Button ───────────────────────────── */}
        <View
          style={[
            styles.footer,
            {
              backgroundColor: colors.background.elevated,
              borderTopColor: colors.gold.border,
            },
          ]}
        >
          {/* G03: Payment retry banner — shown when order exists but payment failed */}
          {!!failedPaymentOrderId && (
            <View
              style={{
                backgroundColor: isDark ? "#450A0A" : "#FEF2F2",
                borderRadius: 10,
                padding: 12,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "#FCA5A5",
              }}
            >
              <Text style={{ color: "#EF4444", fontSize: 13, fontWeight: "600", marginBottom: 8 }}>
                {paymentError || "Payment failed — your order was saved."}
              </Text>
              <TouchableOpacity
                onPress={handleRetryPayment}
                disabled={loading}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Retry payment"
              >
                <LinearGradient
                  colors={["#EF4444", "#DC2626"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: 48, borderRadius: 10, justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 8 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Icon name="refresh" size={18} color="#fff" />
                      <Text style={{ color: "#fff", fontSize: 16, fontWeight: "800" }}>Retry Payment</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* G06: Delivery hours advisory — SA Liquor Act: 09:00–21:00 */}
          {!deliveryHoursCheck.allowed && (
            <View
              style={{
                backgroundColor: isDark ? "#431407" : "#FFF7ED",
                borderRadius: 10,
                padding: 10,
                marginBottom: 10,
                borderWidth: 1,
                borderColor: "#FED7AA",
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 8,
              }}
              accessibilityRole="alert"
            >
              <Icon name="time-outline" size={16} color="#EA580C" style={{ marginTop: 1 }} />
              <Text style={{ color: "#EA580C", fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 }}>
                Alcohol deliveries are only permitted between{" "}
                {deliveryHoursCheck.startHour}:00 and {deliveryHoursCheck.endHour}:00.
                Your order will be queued for the next available delivery window.
              </Text>
            </View>
          )}
          {/* Trust signals — discreet row, premium reassurance */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-around",
              alignItems: "center",
              paddingVertical: 10,
              marginBottom: 8,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderBottomWidth: StyleSheet.hairlineWidth,
              borderColor: colors.gold.border,
            }}
            accessibilityRole="summary"
            accessibilityLabel="Order trust signals"
          >
            {[
              { icon: "shield-checkmark-outline", label: "Secure checkout" },
              { icon: "ribbon-outline", label: "Age verified" },
              { icon: "sparkles-outline", label: "Premium handling" },
            ].map((t) => (
              <View
                key={t.label}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <Icon name={t.icon as any} size={13} color={colors.gold.primary} />
                <Text
                  style={{
                    fontSize: 11,
                    fontWeight: "600",
                    color: colors.text.secondary,
                    letterSpacing: 0.2,
                  }}
                >
                  {t.label}
                </Text>
              </View>
            ))}
          </View>

          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              onPress={() => handlePlaceOrder()}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={loading || !canPlaceOrder || !!failedPaymentOrderId}
              activeOpacity={0.9}
              style={[!canPlaceOrder && styles.buttonDisabled]}
              accessibilityLabel="Place order"
              accessibilityRole="button"
            >
              <LinearGradient
                colors={
                  canPlaceOrder
                    ? [...gradients.gold]
                    : [colors.text.dim, colors.text.dim]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.placeOrderButton,
                  canPlaceOrder ? shadows.gold as any : undefined,
                ]}
              >
                {loading ? (
                  <ActivityIndicator
                    size="small"
                    color={colors.text.inverse}
                  />
                ) : (
                  <View style={styles.placeOrderContent}>
                    <View style={styles.placeOrderLeft}>
                      <Icon
                        name="checkmark-circle-outline"
                        size={22}
                        color={colors.text.inverse}
                      />
                      <Text
                        style={[
                          styles.placeOrderText,
                          { color: colors.text.inverse },
                        ]}
                      >
                        Place Order
                      </Text>
                    </View>
                    <View style={styles.placeOrderRight}>
                      <View
                        style={[
                          styles.placeOrderBadge,
                          { backgroundColor: "rgba(255,255,255,0.2)" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.placeOrderBadgeText,
                            { color: colors.text.inverse },
                          ]}
                        >
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.placeOrderTotal,
                          { color: colors.text.inverse },
                        ]}
                      >
                        {formatCurrency(orderTotal)}
                      </Text>
                    </View>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* ── Age Verification Modal ────────────────────────────────── */}
      <Modal
        visible={showDobModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDobModal(false)}
        statusBarTranslucent
      >
        <View style={styles.dobOverlay}>
          <View style={[styles.dobCard, { backgroundColor: colors.background.card, borderColor: colors.gold.border }]}>
            {/* Header */}
            <View style={styles.dobHeader}>
              <View style={[styles.dobIconWrap, { backgroundColor: colors.gold.faint }]}>
                <Icon name="shield-checkmark-outline" size={26} color={colors.gold.primary} />
              </View>
              <Text style={[styles.dobTitle, { color: colors.text.primary }]}>Age Verification</Text>
              <Text style={[styles.dobSubtitle, { color: colors.text.muted }]}>
                South African law requires you to be 18 or older to purchase alcohol.
              </Text>
            </View>

            {/* Action Buttons */}
            <View style={styles.dobActions}>
              <TouchableOpacity
                style={[styles.dobCancelBtn, { borderColor: colors.gold.border }]}
                onPress={() => setShowDobModal(false)}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
              >
                <Text style={[styles.dobCancelText, { color: colors.text.muted }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dobConfirmBtn}
                onPress={handleDobConfirm}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Confirm I am 18 or older"
              >
                <LinearGradient
                  colors={[...gradients.gold]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.dobConfirmGradient}
                >
                  <Text style={[styles.dobConfirmText, { color: colors.text.inverse }]}>I am 18 or older</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            {/* Legal note */}
            <Text style={[styles.dobLegalNote, { color: colors.text.dim }]}>
              By confirming, you declare that you are 18 years of age or older as required by the SA Liquor Act.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // ── Header & Step Indicator ─────────────────────────────────
  header: {
    paddingTop: spacing.md,
    paddingBottom: 0,
    paddingHorizontal: spacing.lg,
  },
  headerGoldBorder: {
    height: 2,
    width: "100%",
    opacity: 0.6,
  },
  stepContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingBottom: spacing.md,
  },
  stepItem: {
    alignItems: "center",
    gap: 4,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: "700",
  },
  stepLabel: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  stepLine: {
    height: 2,
    width: 40,
    borderRadius: 1,
    marginHorizontal: spacing.sm,
    marginBottom: 18,
  },

  // ── Scroll & Sections ───────────────────────────────────────
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl + spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm + 2,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  sectionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionTitle: {
    ...typography.h4,
  },
  sectionAccentLine: {
    height: 2,
    width: 24,
    borderRadius: 1,
    marginTop: 3,
  },
  changeLink: {
    ...typography.bodySmall,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // ── Location / Address autocomplete ─────────────────────────
  locationBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  locationBtnText: {
    ...typography.bodySmall,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  suggestionsContainer: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 999,
    borderWidth: 1,
    borderRadius: 12,
    marginTop: 4,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  suggestionMain: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  suggestionSub: {
    ...typography.caption,
    marginTop: 1,
  },
  poweredByGoogle: {
    ...typography.caption,
    textAlign: "right",
    paddingHorizontal: 14,
    paddingVertical: 6,
  },

  // ── Cards ───────────────────────────────────────────────────
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
  },

  // ── Input Fields ────────────────────────────────────────────
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.caption,
    marginBottom: spacing.xs + 2,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    fontWeight: "600",
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputIcon: {
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: Platform.OS === "ios" ? 13 : 10,
  },
  inputRow: {
    flexDirection: "row",
  },

  // ── Option Rows (Delivery) ──────────────────────────────────
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
    gap: spacing.sm,
    borderWidth: 1,
  },
  optionRowDisabled: {
    opacity: 0.4,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  optionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: borderRadius.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  optionInfo: {
    flex: 1,
  },
  optionLabel: {
    ...typography.body,
    fontWeight: "600",
  },
  optionDescription: {
    ...typography.caption,
    marginTop: 2,
  },
  optionPrice: {
    ...typography.body,
    fontWeight: "700",
  },

  // ── Payment Method Cards ────────────────────────────────────
  paymentCardsRow: {
    flexDirection: "row",
    gap: spacing.sm + 4,
  },
  paymentCard: {
    flex: 1,
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    padding: spacing.md,
    alignItems: "center",
  },
  paymentCardTop: {
    alignSelf: "flex-end",
    marginBottom: spacing.sm,
  },
  paymentIconWrap: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  paymentLabel: {
    ...typography.bodySmall,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  paymentDescription: {
    ...typography.caption,
    textAlign: "center",
  },

  // ── Order Items ─────────────────────────────────────────────
  orderItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm + 2,
  },
  orderItemImage: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.sm,
  },
  orderItemInfo: {
    flex: 1,
  },
  orderItemName: {
    ...typography.bodySmall,
    fontWeight: "600",
  },
  orderItemMeta: {
    ...typography.caption,
    marginTop: 2,
  },
  orderItemPrice: {
    ...typography.body,
    fontWeight: "700",
  },
  emptyItems: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyItemsText: {
    ...typography.bodySmall,
  },

  // ── Promo Code ──────────────────────────────────────────────
  promoInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  promoApplyButton: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    minWidth: 84,
  },
  promoApplyText: {
    ...typography.button,
    fontSize: 14,
  },
  promoErrorText: {
    fontSize: 13,
    marginTop: spacing.xs + 2,
    marginLeft: 4,
  },
  appliedPromoRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  appliedPromoCode: {
    ...typography.body,
    fontWeight: "700",
  },
  appliedPromoLabel: {
    ...typography.caption,
    marginTop: 2,
    marginLeft: 24,
  },

  // ── Order Summary / Price Breakdown ─────────────────────────
  summaryGoldTopBorder: {
    height: 3,
    width: "100%",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm + 2,
  },
  summaryLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  summaryLabel: {
    ...typography.body,
  },
  summaryValue: {
    ...typography.body,
    fontWeight: "600",
  },
  summaryDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginVertical: spacing.sm,
  },
  summaryTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  totalLabel: {
    ...typography.h3,
  },
  totalValue: {
    ...typography.h2,
    letterSpacing: -0.5,
  },

  // ── Footer & Place Order Button ─────────────────────────────
  footer: {
    padding: spacing.md,
    paddingBottom: Platform.OS === "ios" ? spacing.lg + 4 : spacing.md,
    borderTopWidth: 1,
  },
  placeOrderButton: {
    height: 60,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  placeOrderContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  placeOrderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  placeOrderRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  placeOrderBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  placeOrderBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  placeOrderText: {
    ...typography.button,
  },
  placeOrderTotal: {
    ...typography.button,
    fontSize: 18,
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // ── DOB Age Gate Modal ───────────────────────────────────────
  dobOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  dobCard: {
    width: "100%",
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1.5,
  },
  dobHeader: {
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  dobIconWrap: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  dobTitle: {
    ...typography.h3,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
  dobSubtitle: {
    ...typography.bodySmall,
    textAlign: "center",
    lineHeight: 20,
  },
  dobInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dobInputWrap: {
    flex: 1,
    alignItems: "center",
  },
  dobLabel: {
    ...typography.caption,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  dobInput: {
    width: "100%",
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    textAlign: "center",
    fontSize: 20,
    fontWeight: "700",
  },
  dobErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: spacing.md,
  },
  dobErrorText: {
    ...typography.bodySmall,
    flex: 1,
  },
  dobActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  dobCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  dobCancelText: {
    ...typography.button,
  },
  dobConfirmBtn: {
    flex: 2,
    borderRadius: borderRadius.md,
    overflow: "hidden",
  },
  dobConfirmGradient: {
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  dobConfirmText: {
    ...typography.button,
    fontWeight: "700",
  },
  dobLegalNote: {
    ...typography.caption,
    textAlign: "center",
    lineHeight: 16,
  },
});
