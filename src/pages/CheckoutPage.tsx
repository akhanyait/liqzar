import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  MapPin,
  Clock,
  CreditCard,
  ChevronRight,
  CheckCircle2,
  Truck,
  ShieldCheck,
  CalendarDays,
  Smartphone,
  Building2,
  Zap,
  AlertCircle,
  Calendar,
  Search,
  Info,
  Navigation,
  Edit3,
  X,
  MapPinOff,
  LocateFixed,
  Loader2,
} from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import {
  getDeliveryOptions,
  getScheduledSlots,
  validateDeliverySelection,
  getDeliveryFee,
  getZoneInfo,
  isSameDayAvailable,
  determineDeliveryZone,
  SAME_DAY_RADIUS_KM,
  SAME_DAY_CUTOFF_HOUR,
  DeliveryOption,
  ScheduledSlot,
} from "@/lib/delivery-scheduling";
import {
  getSuburbSuggestions,
  resolveAddress,
  validateAddress as validateSAAddress,
  autoFillFromPostalCode,
  getDeliveryZoneDescription,
  SA_PROVINCES,
  SuburbSuggestion,
  StructuredAddress,
} from "@/lib/address-intelligence";
import { useDeliveryNotifications } from "@/hooks/useDeliveryNotifications";
import {
  AddressPicker,
  AddressData,
} from "@/components/delivery/AddressPicker";
import { useCustomerOrders } from "@/hooks/useOrders";
import { useAuth } from "@/context/AuthContext";
import { initiatePaymentWithOrder, OrderDataForPayment } from "@/lib/payment-gateway";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/seo/SEO";

/* ── Types ── */
interface Address {
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  coordinates?: { lat: number; lng: number };
  deliveryZone?: "same-day" | "in-house" | "outsourced";
}

interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
}

/* ── Data ── */
const paymentMethods: PaymentMethod[] = [
  {
    id: "instant_eft",
    name: "Pay by Bank",
    icon: "🏦",
    description: "Instant EFT — powered by Ozow",
  },
  {
    id: "cash_on_delivery",
    name: "Cash on Delivery",
    icon: "💵",
    description: "Pay cash to your driver at the door",
  },
];

/* Per-method redirect info */
const paymentMethodInfo: Record<string, { label: string; detail: string; color: string }> = {
  instant_eft: {
    label: "Secure Pay by Bank (Ozow)",
    detail: "You'll be redirected to Ozow to pick your bank and authorise the transfer. Funds reflect instantly once approved.",
    color: "green",
  },
  cash_on_delivery: {
    label: "Pay on Delivery",
    detail: "Have the exact cash amount ready. Your driver will bring a receipt. No card machine available on delivery.",
    color: "gray",
  },
};


/* ── Step indicator ── */
const StepIndicator = ({
  step,
  currentStep,
  label,
}: {
  step: number;
  currentStep: number;
  label: string;
}) => {
  const done = currentStep > step;
  const active = currentStep === step;
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
          done
            ? "gold-gradient text-primary-foreground shadow-md"
            : active
              ? "border-2 border-primary text-primary bg-primary/5 shadow-sm"
              : "border border-border/60 text-muted-foreground bg-secondary/50"
        }`}
      >
        {done ? <CheckCircle2 className="w-4 h-4" /> : step}
      </div>
      <span
        className={`text-[10px] font-semibold uppercase tracking-wide transition-colors hidden sm:block ${
          active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </span>
    </div>
  );
};

/* ── Input field ── */
const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = true,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  type?: string;
  required?: boolean;
  error?: string;
}) => (
  <div>
    <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
      {label} {required && <span className="text-destructive normal-case font-normal">*</span>}
    </label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={200}
      className={`w-full h-11 px-3.5 rounded-xl bg-secondary/70 border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all ${
        error ? "border-destructive/60 bg-destructive/5" : "border-border/60 hover:border-border"
      }`}
    />
    {error && <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
      <span className="inline-block w-1 h-1 rounded-full bg-destructive" />{error}
    </p>}
  </div>
);

/* ── Main ── */
const CheckoutPage = () => {
  const navigate = useNavigate();
  const {
    items,
    subtotal,
    vatAmount,
    deliveryFee: cartDeliveryFee,
    discountAmount,
    total,
    clearCart,
    totalItems,
  } = useCart();

  const { addNotification } = useDeliveryNotifications();
  const { createOrder } = useCustomerOrders();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  // Address picker state
  const [showAddressPicker, setShowAddressPicker] = useState(false);

  // Address with structured fields
  const [address, setAddress] = useState<Address>({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    addressLine3: "",
    suburb: "",
    city: "",
    province: "",
    postalCode: "",
    country: "South Africa",
  });
  const [addressErrors, setAddressErrors] = useState<Partial<Address>>({});

  // Delivery options based on resolved address
  const [deliveryOptions, setDeliveryOptions] = useState<DeliveryOption[]>([]);
  const [scheduledSlots, setScheduledSlots] = useState<ScheduledSlot[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string>("");
  const [selectedScheduleDate, setSelectedScheduleDate] = useState("");
  const [selectedScheduleSlot, setSelectedScheduleSlot] = useState("");

  // Same-day restriction dialog
  const [showRestrictionDialog, setShowRestrictionDialog] = useState(false);
  const [restrictionReason, setRestrictionReason] = useState<string>("");

  // Payment
  const [selectedPayment, setSelectedPayment] = useState("instant_eft");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  // Age verification state (SA law requires 18+ for alcohol purchase)
  const [ageVerified, setAgeVerified] = useState(false);
  const [showAgeDialog, setShowAgeDialog] = useState(false);

  // Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Address autocomplete state
  interface NominatimResult {
    place_id: number;
    display_name: string;
    address: {
      house_number?: string; road?: string; pedestrian?: string;
      suburb?: string; neighbourhood?: string; village?: string; quarter?: string;
      city?: string; town?: string; municipality?: string;
      state?: string; postcode?: string;
    };
  }
  const [addressSuggestions, setAddressSuggestions] = useState<NominatimResult[]>([]);
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
  const [addressSearchLoading, setAddressSearchLoading] = useState(false);
  const addressSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddress = useCallback((text: string) => {
    updateAddress("addressLine1", text);
    if (addressSearchTimer.current) clearTimeout(addressSearchTimer.current);
    if (text.length < 4) {
      setAddressSuggestions([]);
      setShowAddressSuggestions(false);
      return;
    }
    addressSearchTimer.current = setTimeout(async () => {
      setAddressSearchLoading(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=za&addressdetails=1&limit=5`,
          { headers: { "Accept-Language": "en" } },
        );
        const data: NominatimResult[] = await resp.json();
        if (data?.length) {
          setAddressSuggestions(data);
          setShowAddressSuggestions(true);
        } else {
          setAddressSuggestions([]);
          setShowAddressSuggestions(false);
        }
      } catch { /* silent */ } finally {
        setAddressSearchLoading(false);
      }
    }, 400);
   
  }, []);

  const selectAddressSuggestion = useCallback((item: NominatimResult) => {
    const a = item.address ?? {};
    const streetLine = [a.house_number, a.road ?? a.pedestrian].filter(Boolean).join(" ");
    setAddress((prev) => ({
      ...prev,
      addressLine1: streetLine || item.display_name.split(",")[0].trim(),
      suburb: a.suburb ?? a.neighbourhood ?? a.quarter ?? a.village ?? "",
      city: a.city ?? a.town ?? a.municipality ?? "",
      province: a.state ?? "",
      postalCode: a.postcode ?? "",
      country: "South Africa",
    }));
    setAddressSuggestions([]);
    setShowAddressSuggestions(false);
  }, []);

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location unavailable", description: "Your browser doesn't support location services.", variant: "destructive" });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const coords = { lat, lng };
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`,
            { headers: { "Accept-Language": "en" } },
          );
          const data = await res.json();
          const a = data.address ?? {};
          // Compute delivery options from real GPS coordinates
          const options = getDeliveryOptions(coords);
          setDeliveryOptions(options);
          if (options.length > 0) {
            const defOpt =
              options.find((o) => o.id === "standard" && o.available) ??
              options.find((o) => o.id === "next-day" && o.available) ??
              options.find((o) => o.available);
            if (defOpt && !selectedDelivery) setSelectedDelivery(defOpt.id);
          }
          const slots = getScheduledSlots();
          setScheduledSlots(slots);
          const zoneInfo = getZoneInfo(coords);
          setAddress((prev) => ({
            ...prev,
            addressLine1: `${a.house_number ?? ""} ${a.road ?? a.pedestrian ?? ""}`.trim(),
            suburb: a.suburb ?? a.neighbourhood ?? a.village ?? a.quarter ?? "",
            city: a.city ?? a.town ?? a.municipality ?? "",
            province: a.state ?? "",
            postalCode: a.postcode ?? "",
            country: "South Africa",
            coordinates: coords,
            deliveryZone: zoneInfo?.type,
          }));
          toast({ title: "📍 Location detected", description: "Address filled from your location. Please verify the details." });
        } catch {
          const zoneInfo = getZoneInfo(coords);
          setAddress((prev) => ({ ...prev, coordinates: coords, deliveryZone: zoneInfo?.type }));
          toast({ title: "Got your coordinates", description: "Please complete the address fields below." });
        } finally {
          setIsLocating(false);
        }
      },
      (err) => {
        setIsLocating(false);
        if (err.code === err.PERMISSION_DENIED) {
          toast({ title: "Location permission denied", description: "Please allow location access in your browser settings, then try again.", variant: "destructive" });
        } else {
          toast({ title: "Could not get location", description: "Please enter your address manually.", variant: "destructive" });
        }
      },
      { timeout: 10000, maximumAge: 60000 },
    );
  };

  // Handle address selection from picker
  const handleAddressSelected = (selectedAddress: AddressData) => {
    // Get delivery options directly from coordinates
    const coords = selectedAddress.coordinates;
    let zoneType: "same-day" | "in-house" | "outsourced" | undefined;

    if (coords) {
      // Get delivery options based on coordinates
      const options = getDeliveryOptions(coords);
      setDeliveryOptions(options);

      // Auto-select: prefer next-day, fall back to first available
      if (options.length > 0 && !selectedDelivery) {
        const defOpt = options.find((o) => o.id === "next-day" && o.available) ?? options.find((o) => o.available);
        if (defOpt) setSelectedDelivery(defOpt.id);
      }

      // Get scheduled slots
      const slots = getScheduledSlots();
      setScheduledSlots(slots);

      // Get zone info for display
      const zoneInfo = getZoneInfo(coords);
      zoneType = zoneInfo?.type;
    }

    setAddress((prev) => ({
      ...prev,
      addressLine1: selectedAddress.addressLine1 || prev.addressLine1,
      addressLine2: selectedAddress.addressLine2 || prev.addressLine2,
      addressLine3: selectedAddress.addressLine3 || prev.addressLine3,
      suburb: selectedAddress.suburb,
      city: selectedAddress.city,
      province: selectedAddress.province,
      postalCode: selectedAddress.postalCode || prev.postalCode,
      coordinates: coords,
      deliveryZone: zoneType,
    }));

    setShowAddressPicker(false);
  };

  // Ensure delivery options are populated whenever step 2 is entered
  useEffect(() => {
    if (step !== 2) return;
    if (deliveryOptions.length > 0 && selectedDelivery) return; // already set

    // Resolve coords — from state, or attempt suburb lookup, or use Joburg default
    let coords = address.coordinates;

    if (!coords && address.suburb) {
      const resolved = resolveAddress({
        suburb: address.suburb,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
      });
      if (resolved?.coordinates) {
        coords = resolved.coordinates;
        const zoneInfo = getZoneInfo(resolved.coordinates);
        setAddress((prev) => ({
          ...prev,
          coordinates: resolved.coordinates ?? undefined,
          deliveryZone: zoneInfo?.type,
        }));
      }
    }

    // Last-resort fallback: Johannesburg CBD — gives next-day + scheduled options
    if (!coords) {
      coords = { lat: -26.2041, lng: 28.0473 };
    }

    const options = getDeliveryOptions(coords);
    if (options.length === 0) return;

    setDeliveryOptions(options);

    // Auto-select next-day (reliable), or first available
    if (!selectedDelivery) {
      const def =
        options.find((o) => o.id === "next-day" && o.available) ??
        options.find((o) => o.available);
      if (def) setSelectedDelivery(def.id);
    }

    if (scheduledSlots.length === 0) {
      setScheduledSlots(getScheduledSlots());
    }
  }, [step, address.coordinates, address.suburb]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-fill from postal code
  useEffect(() => {
    if (address.postalCode.length === 4 && !address.province) {
      const autoFill = autoFillFromPostalCode(address.postalCode);
      if (autoFill) {
        setAddress((prev) => ({
          ...prev,
          province: autoFill.province,
          city: autoFill.city || prev.city,
        }));
      }
    }
  }, [address.postalCode, address.province]);

  // Resolve address and get delivery options when suburb changes
  useEffect(() => {
    if (address.suburb && address.suburb.length >= 3 && !address.coordinates) {
      setIsResolvingAddress(true);
      const resolved = resolveAddress({
        suburb: address.suburb,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
      });

      if (resolved && resolved.coordinates) {
        // Get delivery options directly from coordinates
        const options = getDeliveryOptions(resolved.coordinates);
        setDeliveryOptions(options);

        // Auto-select first available option
        if (options.length > 0 && !selectedDelivery) {
          setSelectedDelivery(options[0].id);
        }

        // Get scheduled slots for scheduled delivery
        const slots = getScheduledSlots();
        setScheduledSlots(slots);

        // Get zone info
        const zoneInfo = getZoneInfo(resolved.coordinates);

        setAddress((prev) => ({
          ...prev,
          coordinates: resolved.coordinates ?? undefined,
          deliveryZone: zoneInfo?.type,
        }));
      }
      setIsResolvingAddress(false);
    }
  }, [
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
    address.coordinates,
  ]);

  const updateAddress = (field: keyof Address, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
    setAddressErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  /* ── Delivery fee from selected option ── */
  const chosenOption = deliveryOptions.find((o) => o.id === selectedDelivery);
  // Use zone-based delivery fee if available, else fall back to first available option's fee, then cart fee
  const checkoutDeliveryFee =
    chosenOption?.fee ??
    deliveryOptions.find((o) => o.available)?.fee ??
    cartDeliveryFee;
  const checkoutTotal = Math.max(
    0,
    subtotal + checkoutDeliveryFee - discountAmount,
  );

  /* ── Estimated delivery time ── */
  const getEstimatedDelivery = () => {
    if (!chosenOption) return "";
    if (chosenOption.id === "same-day") {
      return `Today by ${chosenOption.estimatedDelivery}`;
    }
    if (chosenOption.id === "next-day") {
      return `Tomorrow by ${chosenOption.estimatedDelivery}`;
    }
    if (
      chosenOption.id === "scheduled" &&
      selectedScheduleDate &&
      selectedScheduleSlot
    ) {
      const slot = scheduledSlots
        .find((s) => s.date === selectedScheduleDate)
        ?.slots.find((sl) => sl.id === selectedScheduleSlot);
      return slot ? `${selectedScheduleDate}, ${slot.label}` : "Scheduled";
    }
    return chosenOption.estimatedDelivery;
  };

  /* ── Delivery Zone Description ── */
  const deliveryZoneInfo = address.deliveryZone
    ? getDeliveryZoneDescription(address.deliveryZone)
    : null;

  /* ── Validation ── */
  const validateAddressFields = (): boolean => {
    const errors: Partial<Address> = {};
    const missingFields: string[] = [];

    if (!address.fullName.trim()) {
      errors.fullName = "Required";
      missingFields.push("Full Name");
    }
    if (!address.phone.trim() || address.phone.trim().length < 10) {
      errors.phone = "Valid phone required";
      missingFields.push("Phone Number");
    }
    // Street address is now optional since we use address picker
    if (!address.suburb.trim()) {
      errors.suburb = "Suburb required for delivery";
      missingFields.push("Delivery Address");
    }
    if (!address.city.trim()) {
      errors.city = "Required";
      missingFields.push("City");
    }
    if (!address.province) {
      errors.province = "Required";
      missingFields.push("Province");
    }
    if (!address.postalCode.trim() || address.postalCode.trim().length < 4) {
      errors.postalCode = "Valid postal code required";
      missingFields.push("Postal Code");
    }

    // Show helpful toast if validation fails
    if (missingFields.length > 0) {
      toast({
        title: "Please fill in required fields",
        description:
          missingFields.slice(0, 3).join(", ") +
          (missingFields.length > 3 ? "..." : ""),
        variant: "destructive",
      });
      // Scroll to top to show contact details
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    // Validate using SA address intelligence (only if basic validation passes)
    if (missingFields.length === 0 && address.suburb) {
      const saValidation = validateSAAddress({
        suburb: address.suburb,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
      });

      if (!saValidation.isValid) {
        saValidation.errors.forEach((err) => {
          toast({ title: err, variant: "destructive" });
        });
        setAddressErrors(errors);
        return false;
      }
    }

    setAddressErrors(errors);
    return missingFields.length === 0;
  };

  const handleNext = () => {
    if (step === 1 && !validateAddressFields()) return;

    // Populate delivery options when moving to step 2
    if (step === 1 && address.coordinates) {
      const options = getDeliveryOptions(address.coordinates);
      if (options.length > 0) {
        setDeliveryOptions(options);
        if (!selectedDelivery) {
          const def =
            options.find((o) => o.id === "next-day" && o.available) ??
            options.find((o) => o.available);
          if (def) setSelectedDelivery(def.id);
        }
        if (scheduledSlots.length === 0) setScheduledSlots(getScheduledSlots());
      }
    }

    if (step === 2) {
      if (!selectedDelivery) {
        toast({
          title: "Please select a delivery option",
          variant: "destructive",
        });
        return;
      }
      if (
        selectedDelivery === "scheduled" &&
        (!selectedScheduleDate || !selectedScheduleSlot)
      ) {
        toast({
          title: "Please select a delivery date and time slot",
          variant: "destructive",
        });
        return;
      }
      // Validate delivery selection
      if (address.coordinates) {
        const validation = validateDeliverySelection(
          selectedDelivery === "same-day"
            ? "same-day"
            : selectedDelivery === "next-day"
              ? "next-day"
              : "scheduled",
          address.coordinates,
          // Pass through the user's selected schedule values — without these,
          // scheduledDate is always undefined inside the validator and the
          // "scheduled" branch errors with "Please select a delivery date"
          // even when the user has clearly picked one.
          selectedScheduleDate,
          selectedScheduleSlot,
        );
        if (!validation.valid) {
          toast({ title: validation.message, variant: "destructive" });
          // Auto-adjust to valid option if needed
          if (validation.suggestedOption) {
            setSelectedDelivery(validation.suggestedOption);
            toast({
              title: `Adjusted to ${validation.suggestedOption.replace("-", " ")} delivery`,
            });
          }
          return;
        }
      }
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  const handlePlaceOrder = async (ageJustVerified = false) => {
    if (isPlacingOrder) return;
    if (!selectedPayment) {
      toast({ title: "Please select a payment method", variant: "destructive" });
      return;
    }

    // Age verification (SA law — 18+)
    if (!ageVerified && !ageJustVerified) {
      setShowAgeDialog(true);
      return;
    }

    const isCOD = selectedPayment === "cash_on_delivery";

    // Online payments REQUIRE a logged-in user (Supabase order + Ozow gateway)
    if (!isCOD && !user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to pay securely online.",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    // Live stock re-check — prevents charging the customer for items that
    // went out of stock while they were filling in checkout details.
    try {
      const productIds = items.map(({ product }) => product.id);
      const { data: liveProducts, error: stockError } = await supabase
        .from("products")
        .select("id, name, in_stock, stock_quantity")
        .in("id", productIds);

      if (stockError) throw stockError;

      const liveMap = new Map((liveProducts ?? []).map((p) => [p.id, p]));
      const issues: string[] = [];
      for (const { product, quantity } of items) {
        const live = liveMap.get(product.id);
        if (!live || !live.in_stock) {
          issues.push(`${product.name} is no longer available`);
        } else if (typeof live.stock_quantity === "number" && live.stock_quantity < quantity) {
          issues.push(`${product.name}: only ${live.stock_quantity} left (you have ${quantity})`);
        }
      }

      if (issues.length > 0) {
        toast({
          title: "Stock changed — please review your cart",
          description: issues.slice(0, 3).join(" · "),
          variant: "destructive",
        });
        navigate("/cart");
        return;
      }
    } catch (err) {
      console.error("[Checkout] Stock re-check failed:", err);
      // Non-blocking: if Supabase is unreachable, let the order attempt proceed.
      // The server-side createOrder + payment EF will be the final authority.
    }

    setIsPlacingOrder(true);

    const orderItems = items.map(({ product, quantity }) => ({
      product_id: product.id,
      product_name: product.name,
      product_image: product.image || product.image_url || "",
      quantity,
      unit_price: product.price,
      subtotal: product.price * quantity,
    }));

    const deliveryAddress = {
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2,
      addressLine3: address.addressLine3,
      suburb: address.suburb,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      coordinates: address.coordinates,
      deliveryZone: address.deliveryZone,
    };

    let orderId = `LX-2026-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    // ── Online Payment — order + payment created server-side via EF ─────────
    // This bypasses RLS entirely (service role in EF), so it works regardless
    // of whether the user has a real Supabase session or is in test-mode auth.
    if (!isCOD && user) {
      // Resolve the real UUID — prefer Supabase auth; fall back to context id if UUID
      const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      let resolvedUserId: string | null = null;
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser?.id) resolvedUserId = authUser.id;
      } catch { /* ignore */ }
      if (!resolvedUserId && user.id && UUID_RE.test(user.id)) {
        resolvedUserId = user.id;
      }

      if (!resolvedUserId) {
        setIsPlacingOrder(false);
        toast({
          title: "Sign in required",
          description: "Please sign out and sign in again to complete your order.",
          variant: "destructive",
        });
        return;
      }

      const orderData: OrderDataForPayment = {
        user_id: resolvedUserId,
        items: orderItems,
        subtotal,
        vat_amount: vatAmount,
        delivery_fee: checkoutDeliveryFee,
        discount_amount: discountAmount,
        total: checkoutTotal,
        delivery_method: selectedDelivery || "standard",
        delivery_zone: address.deliveryZone,
        scheduled_date: selectedScheduleDate || undefined,
        scheduled_slot: selectedScheduleSlot || undefined,
        delivery_address: deliveryAddress as Record<string, unknown>,
        payment_method: selectedPayment,
        customer_notes: undefined,
        delivery_instructions: undefined,
      };

      const appOrigin =
        (import.meta.env.VITE_APP_ORIGIN as string | undefined) ||
        window.location.origin;
      const paymentResult = await initiatePaymentWithOrder(orderData, {
        returnUrl: `${appOrigin}/payment/success`,
        cancelUrl: `${appOrigin}/payment/cancel`,
        customerPhone: user?.phone,
      });

      if (!paymentResult.success) {
        setIsPlacingOrder(false);
        toast({
          title: "Payment failed",
          description: paymentResult.error || "Please try again.",
          variant: "destructive",
        });
        return;
      }

      // Use the order number returned from the EF
      if (paymentResult.orderNumber) orderId = paymentResult.orderNumber;

      if (paymentResult.redirectUrl) {
        // Redirect to Ozow hosted checkout — page navigates away
        window.location.href = paymentResult.redirectUrl;
        return;
      }

      setIsPlacingOrder(false);
      toast({ title: "Payment initiated", description: "Processing your payment…" });
      clearCart();
      return;
    }

    // ── Cash on Delivery path ────────────────────────────────────────────────
    if (user) {
      try {
        const supabaseOrder = await createOrder({
          items: orderItems,
          subtotal,
          vat_amount: vatAmount,
          delivery_fee: checkoutDeliveryFee,
          discount_amount: discountAmount,
          total: checkoutTotal,
          delivery_method: selectedDelivery || "standard",
          delivery_zone: address.deliveryZone,
          scheduled_date: selectedScheduleDate || undefined,
          scheduled_slot: selectedScheduleSlot || undefined,
          delivery_address: deliveryAddress,
          payment_method: "cash_on_delivery",
          customer_notes: undefined,
          delivery_instructions: undefined,
        });
        if (supabaseOrder) {
          orderId = supabaseOrder.order_number;
          toast({
            title: "Order placed! 🎉",
            description: `Order ${orderId} confirmed. Pay cash to your driver.`,
          });
        }
      } catch (err) {
        console.error("[Checkout] COD createOrder failed:", err);
        toast({
          title: "Order failed",
          description: err instanceof Error ? err.message : "Could not place your order. Please try again.",
          variant: "destructive",
        });
        setIsPlacingOrder(false);
        return;
      }
    }

    // LiveOrderETAWidget is now Supabase-backed; no localStorage needed.
    // Clear legacy key from any previous runs so stale data can't leak through.
    localStorage.removeItem("liqzar-active-order");

    const orderHistoryEntry = {
      id: orderId,
      date: new Date().toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" }),
      dateISO: new Date().toISOString(),
      status: "processing" as const,
      items: items.map(({ product, quantity }) => ({
        name: product.name,
        qty: quantity,
        price: product.price,
        image: product.image || product.image_url || "",
      })),
      subtotal,
      vatAmount,
      deliveryFee: checkoutDeliveryFee,
      discount: discountAmount,
      total: checkoutTotal,
      address: `${address.addressLine1}, ${address.suburb}, ${address.city}`,
      fullAddress: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        suburb: address.suburb,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
      },
      deliveryType: selectedDelivery,
      scheduledDate: selectedScheduleDate || null,
      scheduledSlot: selectedScheduleSlot || null,
      paymentMethod: selectedPayment,
    };

    try {
      const existingOrders = JSON.parse(localStorage.getItem("liqzar-orders") || "[]");
      localStorage.setItem("liqzar-orders", JSON.stringify([orderHistoryEntry, ...existingOrders]));
    } catch (e) {
      console.error("Failed to save order history", e);
    }

    const deliveryType =
      selectedDelivery === "same-day" ? "scheduled_same_day" :
      selectedDelivery === "next-day" ? "scheduled_next_day" : "scheduled_date";

    addNotification("order_confirmed", orderId);
    setTimeout(() => {
      addNotification(deliveryType, orderId, { date: selectedScheduleDate, slot: selectedScheduleSlot });
    }, 2000);

    setIsPlacingOrder(false);
    setOrderPlaced(true);
    clearCart();
  };

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="pb-28 overflow-x-hidden">
        <div className="sticky top-[calc(env(safe-area-inset-top,0px)+3.5rem)] md:top-[calc(env(safe-area-inset-top,0px)+5.75rem)] z-30 glass-card border-b border-glass-border p-4 flex items-center gap-3">
          <Link to="/cart" className="w-8 h-8 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </Link>
          <h1 className="font-serif text-lg font-bold text-foreground">
            Checkout
          </h1>
        </div>
        <div className="container px-4 text-center py-20">
          <p className="font-serif text-xl text-foreground mb-2">
            Your cart is empty
          </p>
          <Link
            to="/"
            className="inline-flex gold-gradient text-primary-foreground px-6 py-3 rounded-xl font-semibold mt-4"
          >
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  /* ── Order Confirmation ── */
  if (orderPlaced) {
    return (
      <div className="pb-28 overflow-x-hidden">
        <div className="container px-4 py-16 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", damping: 15 }}
          >
            <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-10 h-10 text-primary-foreground" />
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="font-serif text-3xl font-bold text-foreground mb-2">
              Order Placed!
            </h1>
            <p className="text-muted-foreground mb-2">
              Thank you for your order
            </p>
            <div className="glass-card rounded-xl p-4 max-w-sm mx-auto mt-6 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Truck className="w-4 h-4 text-primary" />
                <span className="text-foreground font-medium">
                  Estimated Delivery
                </span>
              </div>
              <p className="text-primary font-serif font-bold">
                {getEstimatedDelivery()}
              </p>
              <p className="text-xs text-muted-foreground">
                {address.addressLine1}, {address.city}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link
                to="/orders"
                className="gold-gradient text-primary-foreground px-6 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              >
                <Truck className="w-4 h-4" />
                Track Order
              </Link>
              <Link
                to="/"
                className="bg-secondary text-foreground px-6 py-3 rounded-xl font-semibold text-sm"
              >
                Continue Shopping
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-28 overflow-x-hidden">
      <SEO title="Checkout" path="/checkout" noindex description="Secure checkout — LIQZAR" />
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 glass-card border-b border-glass-border px-4 py-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => (step > 1 ? setStep(step - 1) : navigate("/cart"))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-secondary/60 hover:bg-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-serif text-lg font-bold text-foreground leading-none">
              Secure Checkout
            </h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">256-bit SSL encrypted</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 border border-green-500/20">
            <ShieldCheck className="w-3 h-3 text-green-600" />
            <span className="text-[10px] text-green-600 font-semibold">Secure</span>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between px-2">
          <StepIndicator step={1} currentStep={step} label="Address" />
          <div className="flex-1 h-px mx-3 relative overflow-hidden rounded-full bg-border">
            <div
              className="h-full gold-gradient transition-all duration-500 rounded-full"
              style={{ width: step > 1 ? "100%" : "0%" }}
            />
          </div>
          <StepIndicator step={2} currentStep={step} label="Delivery" />
          <div className="flex-1 h-px mx-3 relative overflow-hidden rounded-full bg-border">
            <div
              className="h-full gold-gradient transition-all duration-500 rounded-full"
              style={{ width: step > 2 ? "100%" : "0%" }}
            />
          </div>
          <StepIndicator step={3} currentStep={step} label="Payment" />
        </div>
      </div>

      <div className="container px-4 mt-6 md:flex md:gap-6">
        {/* ── Main Content ── */}
        <div className="flex-1">
          <AnimatePresence mode="wait">
            {/* ════════ STEP 1: Address ════════ */}
            {step === 1 && (
              <motion.div
                key="address"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-4"
              >
                <div className="glass-card p-5 rounded-2xl border border-border/40">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MapPin className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-serif font-bold text-foreground leading-none">Delivery Address</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Where should we bring your order?</p>
                    </div>
                  </div>

                  {/* Contact Details */}
                  <div className="grid grid-cols-1 gap-4 mb-5">
                    <Field
                      label="Full Name"
                      value={address.fullName}
                      onChange={(v) => updateAddress("fullName", v)}
                      placeholder="John Doe"
                      error={addressErrors.fullName}
                    />
                    <Field
                      label="Phone Number"
                      value={address.phone}
                      onChange={(v) => updateAddress("phone", v)}
                      placeholder="082 123 4567"
                      type="tel"
                      error={addressErrors.phone}
                    />
                  </div>

                  {/* Address Section — inline, no popup */}
                  <div className="border-t border-border pt-4 space-y-4">
                    {/* Use My Location CTA */}
                    <div>
                      <label className="text-xs font-medium text-muted-foreground block mb-2">
                        Delivery Location <span className="text-destructive">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleUseMyLocation}
                        disabled={isLocating}
                        className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-all ${
                          isLocating
                            ? "border-primary/30 bg-primary/5 cursor-wait"
                            : address.suburb
                            ? "border-green-500/30 bg-green-500/5 hover:bg-green-500/10"
                            : "border-primary/30 bg-primary/5 hover:bg-primary/10 hover:border-primary/50 active:scale-[0.99]"
                        } disabled:opacity-70`}
                      >
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          address.suburb ? "bg-green-500/15" : "bg-primary/15"
                        }`}>
                          {isLocating
                            ? <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            : address.suburb
                            ? <MapPin className="w-4 h-4 text-green-600" />
                            : <LocateFixed className="w-4 h-4 text-primary" />
                          }
                        </div>
                        <div className="flex-1 text-left">
                          <p className={`text-sm font-medium ${address.suburb ? "text-green-700 dark:text-green-400" : "text-foreground"}`}>
                            {isLocating
                              ? "Detecting your location…"
                              : address.suburb
                              ? `${address.suburb}, ${address.city}`
                              : "Use my current location"
                            }
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {isLocating
                              ? "Getting GPS coordinates…"
                              : address.suburb
                              ? "Location detected — tap to update"
                              : "Your browser will ask permission to access your location"
                            }
                          </p>
                        </div>
                        <ChevronRight className={`w-4 h-4 flex-shrink-0 ${address.suburb ? "text-green-500/50" : "text-muted-foreground/40"}`} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-border" />
                      <span className="text-[11px] text-muted-foreground font-medium px-1">or enter manually</span>
                      <div className="h-px flex-1 bg-border" />
                    </div>
                    {/* Address Search with Nominatim Autocomplete */}
                    <div className="relative">
                      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                        Street Address <span className="normal-case font-normal text-muted-foreground/50">(optional)</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={address.addressLine1}
                          onChange={(e) => searchAddress(e.target.value)}
                          onBlur={() => setTimeout(() => setShowAddressSuggestions(false), 200)}
                          onFocus={() => addressSuggestions.length > 0 && setShowAddressSuggestions(true)}
                          placeholder="Start typing your street address…"
                          maxLength={200}
                          className="w-full h-11 px-3.5 pr-9 rounded-xl bg-secondary/70 border border-border/60 hover:border-border text-foreground placeholder:text-muted-foreground/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all"
                        />
                        {addressSearchLoading && (
                          <Loader2 className="absolute right-3 top-3 w-4 h-4 text-muted-foreground animate-spin" />
                        )}
                      </div>

                      {/* Suggestions dropdown */}
                      {showAddressSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 glass-card border border-border rounded-xl shadow-xl overflow-hidden">
                          {addressSuggestions.map((s, i) => {
                            const parts = s.display_name.split(", ");
                            const main = parts.slice(0, 2).join(", ");
                            const sub = parts.slice(2, 5).join(", ");
                            return (
                              <button
                                key={s.place_id}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => selectAddressSuggestion(s)}
                                className={`w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-primary/5 transition-colors ${i > 0 ? "border-t border-border/50" : ""}`}
                              >
                                <MapPin className="w-3.5 h-3.5 text-primary flex-shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-foreground truncate">{main}</p>
                                  {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field
                        label="Suburb"
                        value={address.suburb}
                        onChange={(v) => updateAddress("suburb", v)}
                        placeholder="Jukskei Park"
                        error={addressErrors.suburb}
                      />
                      <Field
                        label="City"
                        value={address.city}
                        onChange={(v) => updateAddress("city", v)}
                        placeholder="Randburg"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground mb-1.5 block uppercase tracking-wide">
                          Province <span className="text-destructive font-normal normal-case">*</span>
                        </label>
                        <select
                          value={address.province}
                          onChange={(e) => updateAddress("province", e.target.value)}
                          className="w-full h-11 px-3.5 rounded-xl bg-secondary/70 border border-border/60 hover:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40 transition-all appearance-none"
                        >
                          <option value="">Select…</option>
                          {SA_PROVINCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>
                      <Field
                        label="Postal Code"
                        value={address.postalCode}
                        onChange={(v) => updateAddress("postalCode", v)}
                        placeholder="2188"
                        required={false}
                      />
                    </div>
                  </div>

                  {/* Additional Address Details */}
                  {address.suburb && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-4 space-y-3"
                    >
                      <Field
                        label="Unit / Apartment / Floor"
                        value={address.addressLine2}
                        onChange={(v) => updateAddress("addressLine2", v)}
                        placeholder="e.g. Unit 4B, Block C"
                        required={false}
                      />
                      <Field
                        label="Delivery Instructions (Optional)"
                        value={address.addressLine3}
                        onChange={(v) => updateAddress("addressLine3", v)}
                        placeholder="e.g. Ring doorbell, leave at gate"
                        required={false}
                      />
                    </motion.div>
                  )}

                  {/* Delivery Zone Indicator */}
                  {address.suburb && deliveryZoneInfo && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`mt-4 p-3 rounded-xl border ${
                        address.deliveryZone === "same-day"
                          ? "bg-green-500/10 border-green-500/30"
                          : address.deliveryZone === "in-house"
                            ? "bg-blue-500/10 border-blue-500/30"
                            : "bg-amber-500/10 border-amber-500/30"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Truck
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                            address.deliveryZone === "same-day"
                              ? "text-green-500"
                              : address.deliveryZone === "in-house"
                                ? "text-blue-500"
                                : "text-amber-500"
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            {deliveryZoneInfo.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {deliveryZoneInfo.description}
                          </p>
                          {isResolvingAddress && (
                            <p className="text-xs text-primary mt-1">
                              Verifying delivery zone...
                            </p>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ════════ STEP 2: Delivery Schedule ════════ */}
            {step === 2 && (
              <motion.div
                key="delivery"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-4"
              >
                <div className="glass-card p-5 rounded-2xl border border-border/40">
                  <div className="flex items-center gap-2.5 mb-5">
                    <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-serif font-bold text-foreground leading-none">Delivery Option</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Choose when to receive your order</p>
                    </div>
                  </div>

                  {/* Zone Info — slim status strip, not a selectable card */}
                  {address.coordinates && (
                    <div className="mb-5">
                      {(() => {
                        const zoneInfo = getZoneInfo(address.coordinates);
                        if (!zoneInfo) return null;
                        const stripColors = {
                          "same-day": "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
                          "in-house": "bg-primary/8 text-primary",
                          outsourced: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                        };
                        const icons = {
                          "same-day": "⚡",
                          "in-house": "🚗",
                          outsourced: "📦",
                        };
                        return (
                          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${stripColors[zoneInfo.type]}`}>
                            <span className="text-sm">{icons[zoneInfo.type]}</span>
                            <span>{zoneInfo.badge}</span>
                            <span className="opacity-70 font-normal">·</span>
                            <span className="opacity-70 font-normal">{zoneInfo.description}</span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Delivery Options List */}
                  <div className="space-y-3">
                    {deliveryOptions.length === 0 ? (
                      <div className="text-center py-8">
                        {address.coordinates ? (
                          <>
                            <Loader2 className="w-6 h-6 text-primary animate-spin mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">Computing delivery options…</p>
                          </>
                        ) : (
                          <>
                            <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">
                              Enter your delivery address to see available options
                            </p>
                          </>
                        )}
                      </div>
                    ) : (
                      <>
                        {/* Find cheapest and fastest options */}
                        {(() => {
                          const availableOptions = deliveryOptions.filter(
                            (o) => o.available,
                          );
                          const cheapestOption = availableOptions.reduce(
                            (prev, curr) =>
                              prev.fee <= curr.fee ? prev : curr,
                            availableOptions[0],
                          );
                          const fastestOption =
                            deliveryOptions.find((o) => o.id === "same-day") ||
                            availableOptions[0];

                          return deliveryOptions.map((option) => {
                            const isSelected = selectedDelivery === option.id;
                            const isCheapest =
                              option.id === cheapestOption?.id &&
                              option.available;
                            const isFastest = option.id === "same-day";

                            // Calculate delivery date
                            const getDeliveryDate = () => {
                              const now = new Date();
                              if (option.id === "same-day") {
                                return `Today, ${now.toLocaleDateString("en-ZA", { day: "numeric", month: "long", year: "numeric" })}`;
                              } else if (option.id === "next-day") {
                                const tomorrow = new Date(now);
                                tomorrow.setDate(tomorrow.getDate() + 1);
                                return `${tomorrow.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
                              } else {
                                const scheduled = new Date(now);
                                scheduled.setDate(scheduled.getDate() + 2);
                                return `${scheduled.toLocaleDateString("en-ZA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}`;
                              }
                            };

                            // Handle click for same-day when not available
                            const handleOptionClick = () => {
                              if (
                                option.id === "same-day" &&
                                !option.available
                              ) {
                                // Show restriction dialog
                                setRestrictionReason(
                                  option.unavailableReason ||
                                    `Same-day delivery is only available within ${SAME_DAY_RADIUS_KM}km and for orders placed before ${SAME_DAY_CUTOFF_HOUR}:00 PM`,
                                );
                                setShowRestrictionDialog(true);
                                return;
                              }
                              if (option.available) {
                                setSelectedDelivery(option.id);
                              }
                            };

                            const isRecommended = option.id === "next-day" && option.available;

                            return (
                              <button
                                key={option.id}
                                onClick={handleOptionClick}
                                className={`w-full rounded-xl border-2 transition-all duration-200 text-left overflow-hidden ${
                                  isSelected
                                    ? "border-primary bg-primary/8 shadow-sm"
                                    : option.id === "same-day" && !option.available
                                      ? "border-border/60 bg-muted/30 cursor-pointer opacity-60"
                                      : "border-border/60 bg-card hover:border-primary/40 hover:shadow-sm"
                                }`}
                              >
                                {/* Badge Header */}
                                {(isFastest || isCheapest || isRecommended) && (
                                  <div
                                    className={`px-4 py-1 text-[10px] font-bold uppercase tracking-wider ${
                                      isRecommended && isSelected
                                        ? "bg-primary text-primary-foreground"
                                        : isRecommended
                                          ? "bg-primary/15 text-primary"
                                          : isFastest && option.available
                                            ? "bg-primary text-primary-foreground"
                                            : isFastest && !option.available
                                              ? "bg-muted-foreground/40 text-white"
                                              : "bg-blue-600/15 text-blue-700 dark:text-blue-400"
                                    }`}
                                  >
                                    {isRecommended ? "RECOMMENDED" : isFastest ? "FASTEST" : "CHEAPEST"}
                                  </div>
                                )}

                                {/* Option Content */}
                                <div className="p-4 flex items-center gap-4">
                                  {/* Radio Button */}
                                  <div
                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? "border-primary bg-primary"
                                        : option.id === "same-day" &&
                                            !option.available
                                          ? "border-muted-foreground/50"
                                          : "border-muted-foreground"
                                    }`}
                                  >
                                    {isSelected && (
                                      <div className="w-2 h-2 rounded-full bg-white" />
                                    )}
                                  </div>

                                  {/* Details */}
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className={`text-sm font-semibold ${
                                        option.id === "same-day" &&
                                        !option.available
                                          ? "text-muted-foreground"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {getDeliveryDate()}
                                    </p>
                                    <p
                                      className={`text-xs ${
                                        option.id === "same-day" &&
                                        !option.available
                                          ? "text-muted-foreground/70"
                                          : "text-muted-foreground"
                                      }`}
                                    >
                                      {option.label}
                                    </p>

                                    {/* LIQZAR+ Badge for free delivery */}
                                    {option.fee === 0 && option.available && (
                                      <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-primary/30 bg-primary/10">
                                        <span className="text-[10px] text-primary font-medium">
                                          FREE WITH LIQZAR+
                                        </span>
                                        <Info className="w-3 h-3 text-primary" />
                                      </div>
                                    )}

                                    {/* Unavailable reason */}
                                    {option.id === "same-day" &&
                                      !option.available && (
                                        <p className="text-[10px] text-amber-600 mt-1">
                                          Tap to see why this option is
                                          unavailable
                                        </p>
                                      )}
                                  </div>

                                  {/* Price */}
                                  <div className="text-right flex-shrink-0">
                                    <span
                                      className={`text-base font-bold ${
                                        option.id === "same-day" &&
                                        !option.available
                                          ? "text-muted-foreground"
                                          : "text-foreground"
                                      }`}
                                    >
                                      R {Math.round(option.fee).toLocaleString('en-ZA')}
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          });
                        })()}
                      </>
                    )}
                  </div>

                  {/* Scheduled date and time selection */}
                  <AnimatePresence>
                    {selectedDelivery === "scheduled" &&
                      scheduledSlots.length > 0 && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-4 pt-4 border-t border-border">
                            <p className="text-xs font-medium text-muted-foreground mb-3">
                              Select delivery date
                            </p>
                            <div className="flex gap-2 overflow-x-auto pb-2">
                              {scheduledSlots.map((day) => (
                                <button
                                  key={day.date}
                                  onClick={() => {
                                    setSelectedScheduleDate(day.date);
                                    setSelectedScheduleSlot("");
                                  }}
                                  className={`flex-shrink-0 px-4 py-2 rounded-xl text-center transition-all ${
                                    selectedScheduleDate === day.date
                                      ? "gold-gradient text-primary-foreground"
                                      : "glass-card text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  <p className="text-xs font-medium">
                                    {day.dayLabel}
                                  </p>
                                  <p className="text-[10px]">{day.date}</p>
                                </button>
                              ))}
                            </div>

                            {selectedScheduleDate && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Select time slot
                                </p>
                                <div className="grid grid-cols-2 gap-2">
                                  {scheduledSlots
                                    .find(
                                      (s) => s.date === selectedScheduleDate,
                                    )
                                    ?.slots.map((slot) => (
                                      <button
                                        key={slot.id}
                                        onClick={() =>
                                          setSelectedScheduleSlot(slot.id)
                                        }
                                        disabled={!slot.available}
                                        className={`p-2 rounded-lg text-xs transition-all ${
                                          selectedScheduleSlot === slot.id
                                            ? "gold-gradient text-primary-foreground"
                                            : slot.available
                                              ? "glass-card text-muted-foreground hover:text-foreground"
                                              : "bg-muted text-muted-foreground/50 cursor-not-allowed"
                                        }`}
                                      >
                                        {slot.label}
                                      </button>
                                    ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                  </AnimatePresence>
                </div>

                {/* Delivery address preview */}
                <div className="glass-card p-4 rounded-xl flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">
                      {address.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {address.addressLine1}
                      {address.addressLine2
                        ? `, ${address.addressLine2}`
                        : ""}, {address.suburb}, {address.city},{" "}
                      {address.province}, {address.postalCode}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep(1)}
                    className="text-xs text-primary font-medium"
                  >
                    Edit
                  </button>
                </div>

                {/* Same-Day Restriction Dialog */}
                <AnimatePresence>
                  {showRestrictionDialog && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
                      onClick={() => setShowRestrictionDialog(false)}
                    >
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-sm glass-card rounded-2xl overflow-hidden"
                      >
                        {/* Header */}
                        <div className="bg-amber-500 p-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                            <MapPinOff className="w-5 h-5 text-white" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-white">
                              Same-Day Unavailable
                            </h3>
                            <p className="text-xs text-white/80">
                              Delivery restriction
                            </p>
                          </div>
                          <button
                            onClick={() => setShowRestrictionDialog(false)}
                            className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>

                        {/* Content */}
                        <div className="p-5">
                          <div className="flex items-start gap-3 mb-4">
                            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-foreground leading-relaxed">
                              {restrictionReason}
                            </p>
                          </div>

                          {/* Info boxes */}
                          <div className="space-y-2 mb-5">
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary">
                              <Navigation className="w-4 h-4 text-primary" />
                              <span className="text-xs text-muted-foreground">
                                Same-day zone: Within{" "}
                                <strong className="text-foreground">
                                  {SAME_DAY_RADIUS_KM}km
                                </strong>{" "}
                                of store
                              </span>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary">
                              <Clock className="w-4 h-4 text-primary" />
                              <span className="text-xs text-muted-foreground">
                                Order cutoff: Before{" "}
                                <strong className="text-foreground">
                                  {SAME_DAY_CUTOFF_HOUR}:00 PM
                                </strong>
                              </span>
                            </div>
                          </div>

                          <Button
                            onClick={() => setShowRestrictionDialog(false)}
                            className="w-full gold-gradient text-primary-foreground"
                          >
                            Choose Another Option
                          </Button>
                        </div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ════════ STEP 3: Payment ════════ */}
            {step === 3 && (
              <motion.div
                key="payment"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className="space-y-4"
              >
                <div className="glass-card p-5 rounded-2xl border border-border/40">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-serif font-bold text-foreground leading-none">Payment Method</h2>
                        <p className="text-[11px] text-muted-foreground mt-0.5">Secured by Ozow</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/80 border border-border/40">
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                      <span className="text-[10px] text-muted-foreground font-medium">SSL</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {paymentMethods.map((method) => {
                      const selected = selectedPayment === method.id;
                      const iconBg = {
                        card: selected ? "bg-blue-500/15" : "bg-blue-500/8",
                        instant_eft: selected ? "bg-emerald-500/15" : "bg-emerald-500/8",
                        snapscan: selected ? "bg-amber-500/15" : "bg-amber-500/8",
                        cash_on_delivery: selected ? "bg-secondary" : "bg-secondary/60",
                      }[method.id] ?? "bg-secondary";

                      return (
                        <button
                          key={method.id}
                          onClick={() => setSelectedPayment(method.id)}
                          className={`w-full p-4 rounded-xl border-2 transition-all text-left flex items-center gap-3.5 active:scale-[0.99] ${
                            selected
                              ? "border-primary bg-primary/5 shadow-[0_0_0_4px_hsl(var(--primary)/0.08)]"
                              : "border-border/50 bg-card hover:border-primary/30 hover:bg-primary/3"
                          }`}
                        >
                          {/* Icon */}
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-all ${iconBg}`}>
                            {method.icon}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`font-semibold text-sm leading-none ${selected ? "text-primary" : "text-foreground"}`}>
                                {method.name}
                              </p>
                              {method.id === "card" && (
                                <span className="text-[9px] font-bold text-muted-foreground/60 tracking-wider uppercase">
                                  VISA · MC · AMEX
                                </span>
                              )}
                              {method.id === "cash_on_delivery" && (
                                <span className="text-[9px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">
                                  NO Fee
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                              {method.description}
                            </p>
                          </div>

                          {/* Radio */}
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                              selected
                                ? "border-primary bg-primary"
                                : "border-muted-foreground/25 bg-transparent"
                            }`}
                          >
                            {selected && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Payment trust strip */}
                  <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-center gap-4 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      <ShieldCheck className="w-3 h-3 text-green-500" />
                      256-bit SSL
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      🔒 Ozow Verified
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                      🔐 PCI DSS Compliant
                    </span>
                  </div>
                </div>

                {/* Per-method info banner */}
                {selectedPayment && paymentMethodInfo[selectedPayment] && (
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={selectedPayment}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className={`mt-3 flex items-start gap-2.5 p-3 rounded-xl ${
                        paymentMethodInfo[selectedPayment].color === "blue"
                          ? "bg-blue-500/5 border border-blue-500/20"
                          : paymentMethodInfo[selectedPayment].color === "green"
                            ? "bg-emerald-500/5 border border-emerald-500/20"
                            : paymentMethodInfo[selectedPayment].color === "amber"
                              ? "bg-amber-500/5 border border-amber-500/20"
                              : "bg-secondary/50 border border-border/40"
                      }`}
                    >
                      <Info className={`w-4 h-4 flex-shrink-0 mt-0.5 ${
                        paymentMethodInfo[selectedPayment].color === "blue" ? "text-blue-500" :
                        paymentMethodInfo[selectedPayment].color === "green" ? "text-emerald-500" :
                        paymentMethodInfo[selectedPayment].color === "amber" ? "text-amber-500" :
                        "text-muted-foreground"
                      }`} />
                      <div>
                        <p className={`text-[11px] font-semibold mb-0.5 ${
                          paymentMethodInfo[selectedPayment].color === "blue" ? "text-blue-700 dark:text-blue-400" :
                          paymentMethodInfo[selectedPayment].color === "green" ? "text-emerald-700 dark:text-emerald-400" :
                          paymentMethodInfo[selectedPayment].color === "amber" ? "text-amber-700 dark:text-amber-400" :
                          "text-foreground"
                        }`}>
                          {paymentMethodInfo[selectedPayment].label}
                        </p>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          {paymentMethodInfo[selectedPayment].detail}
                        </p>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                )}

                {/* Delivery & address summary */}
                <div className="glass-card p-4 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {address.fullName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {address.addressLine1}, {address.suburb}, {address.city}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(1)}
                      className="text-[10px] text-primary font-medium"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="border-t border-border pt-3 flex items-start gap-3">
                    <Truck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">
                        {chosenOption?.label} Delivery
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {getEstimatedDelivery()}
                      </p>
                    </div>
                    <button
                      onClick={() => setStep(2)}
                      className="text-[10px] text-primary font-medium"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Order Summary Sidebar ── */}
          <div className="md:w-80 mt-6 md:mt-0 shrink-0">
          <div className="glass-card p-5 rounded-2xl md:sticky md:top-36 space-y-4 border border-border/40 shadow-sm">
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-foreground flex-1">Order Summary</h3>
              <span className="text-xs text-muted-foreground bg-secondary rounded-full px-2 py-0.5">{totalItems} {totalItems === 1 ? "item" : "items"}</span>
            </div>

            {/* Items preview */}
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {items.map(({ product, quantity }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <img
                    src={product.image || product.image_url || "/placeholder.svg"}
                    alt={product.name}
                    className="w-10 h-12 rounded-lg object-cover bg-secondary"
                    onError={(e) => { (e.target as HTMLImageElement).src = "/placeholder.svg"; }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Qty: {quantity}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-foreground">
                    R{(product.price * quantity).toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              ))}
            </div>

            {/* Price breakdown */}
            <div className="space-y-2 pt-3 border-t border-border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Subtotal ({totalItems})
                </span>
                <span className="text-foreground">R{subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Incl. VAT (15%)</span>
                <span className="text-muted-foreground">
                  R{vatAmount.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span
                  className={
                    checkoutDeliveryFee === 0
                      ? "text-primary font-medium"
                      : "text-foreground"
                  }
                >
                  {checkoutDeliveryFee === 0
                    ? "Free"
                    : `R${checkoutDeliveryFee.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-primary">Discount</span>
                  <span className="text-primary font-medium">
                    -R{discountAmount.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-serif font-bold text-foreground">
                  Total
                </span>
                <span className="font-serif text-2xl font-bold gold-text">
                  R{checkoutTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </span>
              </div>
            </div>

            {/* Action button */}
            {step < 3 ? (
              <Button
                onClick={handleNext}
                className="w-full gold-gradient text-primary-foreground font-semibold h-12 rounded-xl hover:opacity-90 transition-opacity premium-shadow gap-2"
              >
                Continue
                <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={handlePlaceOrder}
                disabled={!selectedPayment || isPlacingOrder}
                className="w-full gold-gradient text-primary-foreground font-semibold h-12 rounded-xl hover:opacity-90 transition-opacity premium-shadow gap-2 disabled:opacity-50"
              >
                {isPlacingOrder ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {selectedPayment === "cash_on_delivery"
                      ? "Placing Order…"
                      : "Redirecting to Ozow…"}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {selectedPayment === "cash_on_delivery"
                      ? `Confirm COD Order — R${checkoutTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`
                      : `Pay R${checkoutTotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})} with Ozow`}
                  </>
                )}
              </Button>
            )}

            <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground">
              <ShieldCheck className="w-3 h-3" />
              <span>256-bit SSL encrypted checkout</span>
            </div>
          </div>
        </div>
      </div>

      {/* Address picker replaced by inline form — no popup */}

      {/* Age Verification Dialog (SA law requires 18+ for alcohol purchase) */}
      <AnimatePresence>
        {showAgeDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
            onClick={() => setShowAgeDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm glass-card rounded-2xl overflow-hidden"
            >
              <div className="bg-primary p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-white">Age Verification Required</h3>
                  <p className="text-xs text-white/80">South African law</p>
                </div>
                <button
                  onClick={() => setShowAgeDialog(false)}
                  className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="p-5">
                <div className="flex items-start gap-3 mb-5">
                  <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">
                    By South African law, you must be 18 years or older to purchase
                    alcohol. Do you confirm that you are 18 or older?
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setShowAgeDialog(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    I'm Under 18
                  </Button>
                  <Button
                    onClick={() => {
                      setAgeVerified(true);
                      setShowAgeDialog(false);
                      handlePlaceOrder(true);
                    }}
                    className="flex-1 gold-gradient text-primary-foreground"
                  >
                    I Confirm I'm 18+
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CheckoutPage;
