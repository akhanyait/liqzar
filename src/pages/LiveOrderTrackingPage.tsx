import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  animate,
  useDragControls,
} from "framer-motion";
import {
  ArrowLeft,
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Package,
  Truck,
  CheckCircle,
  ChevronUp,
  ChevronDown,
  Send,
  Navigation,
  Star,
  X,
  Plus,
  Edit3,
  PhoneCall,
  Locate,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { useCustomerSync, formatMessageTime } from "@/hooks/useDeliverySync";
import InAppMapNavigation from "@/components/InAppMapNavigation";
import { supabase } from "@/integrations/supabase/client";
import PayNowButton from "@/components/PayNowButton";
import { useDriverLiveLocation } from "@/hooks/useDriverLiveLocation";
import { ShareTripButton } from "@/components/ShareTripButton";
import { useDeliveryChat } from "@/hooks/useDeliveryChat";
import ProofOfDeliveryCard from "@/components/ProofOfDeliveryCard";

// Map DB order.status → visual tracker step.
const statusDbToStep: Record<string, string> = {
  confirmed: "confirmed",
  preparing: "preparing",
  ready: "preparing",
  driver_assigned: "picked_up",
  picked_up: "picked_up",
  en_route: "en_route",
  delivered: "delivered",
};

// Mock order data - in production, fetch from Supabase
const mockActiveOrder = {
  id: "LX-2026-0912",
  status: "en_route",
  placedAt: "14 Mar 2026, 14:32",
  estimatedDelivery: "15:15 - 15:30",
  etaMinutes: 18,
  address: "42 Rivonia Road, Sandton, 2196",
  items: [
    { name: "Johnnie Walker Blue Label", qty: 1, price: 3499.0 },
    { name: "Moët & Chandon Brut", qty: 2, price: 899.0 },
    { name: "Glenfiddich 18 Year", qty: 1, price: 1299.0 },
  ],
  subtotal: 6596.0,
  deliveryFee: 49.99,
  total: 6645.99,
  deliveryInstructions: "",
  driver: {
    id: "drv-001",
    name: "Sipho Ndlovu",
    phone: "+27 82 123 4567",
    photo:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
    rating: 4.9,
    deliveries: 1247,
    vehicle: "White Toyota Corolla",
    licensePlate: "GP 123 ABC",
    currentLocation: { lat: -26.095, lng: 28.052 },
  },
  destinationLocation: { lat: -26.1076, lng: 28.0567 },
};

const statusSteps = [
  { key: "confirmed", label: "Confirmed", icon: CheckCircle },
  { key: "preparing", label: "Preparing", icon: Package },
  { key: "picked_up", label: "Picked Up", icon: Package },
  { key: "en_route", label: "On the Way", icon: Truck },
  { key: "arriving", label: "Arriving", icon: MapPin },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

const getStatusIndex = (status: string) => {
  const map: Record<string, number> = {
    confirmed: 0,
    preparing: 1,
    picked_up: 2,
    en_route: 3,
    arriving: 4,
    delivered: 5,
  };
  return map[status] ?? 0;
};

interface ChatMessage {
  id: string;
  from: "customer" | "driver" | "system";
  text: string;
  time: string;
  read: boolean;
}

const LiveOrderTrackingPage = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { impact, notification } = useHaptics();

  // Real-time sync with driver
  const {
    deliveryUpdate,
    messages: syncMessages,
    driverLocation,
    sendMessage: sendSyncMessage,
  } = useCustomerSync(orderId || "LX-2026-0912");

  const [order, setOrder] = useState(mockActiveOrder);
  const [paymentState, setPaymentState] = useState<{
    awaitingPayment: boolean;
    realOrderId: string | null;
  }>({ awaitingPayment: false, realOrderId: null });

  // Fetch real order + driver + vehicle from Supabase. Replaces the mock
  // driver card so the customer actually sees who is delivering their order.
  // Also maps DB status → visual step + sets up the PayNow banner.
  useEffect(() => {
    if (!orderId) return;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(orderId)) return;
    let cancelled = false;
    (async () => {
      const { data: orderRow } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, assigned_driver_id, delivery_address, total, delivery_fee, subtotal, estimated_delivery, delivery_instructions",
        )
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled || !orderRow) return;

      setPaymentState({
        awaitingPayment:
          orderRow.payment_status === "awaiting_payment" ||
          orderRow.payment_status === "pending" ||
          orderRow.payment_status === "failed",
        realOrderId: orderRow.id,
      });

      // Resolve destination coords from delivery_address.coordinates if present.
      const addr: any = orderRow.delivery_address || {};
      const destCoords =
        addr.coordinates && typeof addr.coordinates.lat === "number"
          ? { lat: addr.coordinates.lat, lng: addr.coordinates.lng }
          : null;

      // Resolve driver + vehicle once we know a driver has been assigned.
      let driverPatch: Partial<typeof mockActiveOrder.driver> | null = null;
      let assignmentLoc: { lat: number; lng: number } | null = null;
      if (orderRow.assigned_driver_id) {
        const [profileRes, assignmentRes] = await Promise.all([
          supabase
            .from("driver_profiles")
            .select("id, full_name, phone, rating, profile_picture_url, total_deliveries")
            .eq("user_id", orderRow.assigned_driver_id)
            .maybeSingle(),
          supabase
            .from("driver_assignments")
            .select("current_location, eta_minutes")
            .eq("order_id", orderId)
            .maybeSingle(),
        ]);

        const profile = profileRes.data;
        let vehicleLabel = "";
        let plate = "";
        if (profile?.id) {
          const { data: vehicle } = await supabase
            .from("driver_vehicles")
            .select("make_model, license_plate")
            .eq("driver_id", profile.id)
            .maybeSingle();
          vehicleLabel = vehicle?.make_model || "";
          plate = vehicle?.license_plate || "";
        }

        driverPatch = {
          id: orderRow.assigned_driver_id,
          name: profile?.full_name || "Driver",
          phone: profile?.phone || "",
          photo:
            profile?.profile_picture_url ||
            "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face",
          rating: Number(profile?.rating ?? 5),
          deliveries: Number(profile?.total_deliveries ?? 0),
          vehicle: vehicleLabel,
          licensePlate: plate,
        };

        const loc = assignmentRes.data?.current_location as
          | { lat?: number; lng?: number }
          | null;
        if (loc?.lat && loc?.lng) {
          assignmentLoc = { lat: loc.lat, lng: loc.lng };
        }
      }

      if (cancelled) return;
      setOrder((prev) => ({
        ...prev,
        id: orderRow.order_number || prev.id,
        status: statusDbToStep[orderRow.status] ?? prev.status,
        address: [addr.addressLine1, addr.suburb, addr.city]
          .filter(Boolean)
          .join(", ") || prev.address,
        total: Number(orderRow.total ?? prev.total),
        subtotal: Number(orderRow.subtotal ?? prev.subtotal),
        deliveryFee: Number(orderRow.delivery_fee ?? prev.deliveryFee),
        deliveryInstructions:
          orderRow.delivery_instructions ?? prev.deliveryInstructions,
        destinationLocation: destCoords || prev.destinationLocation,
        driver: driverPatch
          ? { ...prev.driver, ...driverPatch, currentLocation: assignmentLoc || prev.driver.currentLocation }
          : prev.driver,
      }));
      if (!driverPatch) {
        // Customer reached tracking page but driver not yet assigned.
        // Leave the status mapped to the actual DB status; the driver card
        // will fall back to a subtle "Awaiting driver" treatment.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  const [showChat, setShowChat] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    order.deliveryInstructions,
  );
  const [instructionsDraft, setInstructionsDraft] = useState(
    order.deliveryInstructions,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      from: "system",
      text: "You can now chat with your driver",
      time: "14:35",
      read: true,
    },
    {
      id: "2",
      from: "driver",
      text: "Hi! I've picked up your order and I'm on my way",
      time: "14:36",
      read: true,
    },
  ]);
  const [newMessage, setNewMessage] = useState("");
  const [etaSeconds, setEtaSeconds] = useState(order.etaMinutes * 60);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Update order state when we receive real-time updates from driver
  useEffect(() => {
    if (deliveryUpdate) {
      setOrder((prev) => ({
        ...prev,
        status:
          deliveryUpdate.status === "en_route"
            ? "en_route"
            : deliveryUpdate.status === "arrived"
              ? "arriving"
              : deliveryUpdate.status === "delivered"
                ? "delivered"
                : deliveryUpdate.status === "picked"
                  ? "picked_up"
                  : prev.status,
        driver: {
          ...prev.driver,
          name: deliveryUpdate.driverName || prev.driver.name,
          photo: deliveryUpdate.driverPhoto || prev.driver.photo,
          rating: deliveryUpdate.driverRating || prev.driver.rating,
          phone: deliveryUpdate.driverPhone || prev.driver.phone,
          currentLocation:
            deliveryUpdate.currentLocation || prev.driver.currentLocation,
        },
        etaMinutes: parseInt(deliveryUpdate.eta) || prev.etaMinutes,
      }));

      if (deliveryUpdate.eta) {
        const etaMins = parseInt(deliveryUpdate.eta);
        if (!isNaN(etaMins)) setEtaSeconds(etaMins * 60);
      }
      if (deliveryUpdate.status === "arrived") notification("success");
    }
  }, [deliveryUpdate, notification]);

  // Merge synced messages with local messages
  useEffect(() => {
    if (syncMessages.length > 0) {
      const newMsgs: ChatMessage[] = syncMessages
        .filter((sm) => !messages.find((m) => m.id === sm.id))
        .map((sm) => ({
          id: sm.id,
          from:
            sm.from === "driver"
              ? "driver"
              : sm.from === "customer"
                ? "customer"
                : "system",
          text: sm.text,
          time: formatMessageTime(sm.timestamp),
          read: sm.read,
        }));

      if (newMsgs.length > 0) {
        setMessages((prev) => [...prev, ...newMsgs]);
        notification("success");
      }
    }
  }, [syncMessages, notification]);

  useEffect(() => {
    if (driverLocation) {
      setOrder((prev) => ({
        ...prev,
        driver: {
          ...prev.driver,
          currentLocation: {
            lat: driverLocation.lat,
            lng: driverLocation.lng,
          },
        },
      }));
    }
  }, [driverLocation]);

  // Supabase-backed delivery chat (cross-device)
  const {
    messages: supaMessages,
    sendMessage: supaSendMessage,
    markAllRead: supaMarkAllRead,
  } = useDeliveryChat(paymentState.realOrderId || undefined);
  useEffect(() => {
    if (!supaMessages.length) return;
    setMessages((prev) => {
      const existing = new Set(prev.map((m) => m.id));
      const additions = supaMessages
        .filter((m) => !existing.has(m.id))
        .map((m) => ({
          id: m.id,
          from:
            m.sender_role === "driver"
              ? ("driver" as const)
              : m.sender_role === "customer"
                ? ("customer" as const)
                : ("system" as const),
          text: m.body,
          time: new Date(m.created_at).toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          read: !!m.read_at,
        }));
      return additions.length ? [...prev, ...additions] : prev;
    });
  }, [supaMessages]);
  useEffect(() => {
    if (showChat) supaMarkAllRead();
  }, [showChat, supaMarkAllRead]);

  // Supabase-backed live location
  const { location: supaDriverLocation, stale: supaLocationStale } =
    useDriverLiveLocation(paymentState.realOrderId || undefined);
  useEffect(() => {
    if (!supaDriverLocation) return;
    setOrder((prev) => ({
      ...prev,
      driver: {
        ...prev.driver,
        currentLocation: {
          lat: supaDriverLocation.lat,
          lng: supaDriverLocation.lng,
        },
      },
      etaMinutes:
        typeof supaDriverLocation.eta_minutes === "number"
          ? supaDriverLocation.eta_minutes
          : prev.etaMinutes,
    }));
  }, [supaDriverLocation]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Realtime: subscribe to this order's DB row. When status OR the
  // assigned_driver_id changes we re-hydrate the driver/vehicle card so the
  // customer sees the newly assigned driver immediately.
  const [orderRefetchTick, setOrderRefetchTick] = useState(0);
  useEffect(() => {
    if (!orderId) return;
    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        orderId,
      );
    const filter = isUuid ? `id=eq.${orderId}` : `order_number=eq.${orderId}`;

    const channel = supabase
      .channel(`order-track-${orderId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter },
        (payload) => {
          const row = payload.new as {
            status?: string;
            assigned_driver_id?: string | null;
            estimated_delivery?: string | null;
          };
          if (!row?.status) return;
          const step = statusDbToStep[row.status] ?? row.status;
          setOrder((prev) => ({ ...prev, status: step }));
          if (row.estimated_delivery) {
            const mins = Math.max(
              0,
              Math.round(
                (new Date(row.estimated_delivery).getTime() - Date.now()) /
                  60000,
              ),
            );
            if (mins > 0) setEtaSeconds(mins * 60);
          }
          if (row.status === "delivered") notification("success");
          // Re-hydrate driver + vehicle when admin (re)assigns the order.
          setOrderRefetchTick((t) => t + 1);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orderId, notification]);

  // Trigger the enriched fetch again whenever the order row changes above.
  useEffect(() => {
    if (orderRefetchTick === 0) return;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!orderId || !UUID_RE.test(orderId)) return;
    let cancelled = false;
    (async () => {
      const { data: orderRow } = await supabase
        .from("orders")
        .select("assigned_driver_id")
        .eq("id", orderId)
        .maybeSingle();
      if (cancelled || !orderRow?.assigned_driver_id) return;
      const { data: profile } = await supabase
        .from("driver_profiles")
        .select("id, full_name, phone, rating, profile_picture_url, total_deliveries")
        .eq("user_id", orderRow.assigned_driver_id)
        .maybeSingle();
      if (cancelled || !profile) return;
      const { data: vehicle } = await supabase
        .from("driver_vehicles")
        .select("make_model, license_plate")
        .eq("driver_id", profile.id)
        .maybeSingle();
      if (cancelled) return;
      setOrder((prev) => ({
        ...prev,
        driver: {
          ...prev.driver,
          id: orderRow.assigned_driver_id!,
          name: profile.full_name || "Driver",
          phone: profile.phone || prev.driver.phone,
          photo: profile.profile_picture_url || prev.driver.photo,
          rating: Number(profile.rating ?? 5),
          deliveries: Number(profile.total_deliveries ?? 0),
          vehicle: vehicle?.make_model || prev.driver.vehicle,
          licensePlate: vehicle?.license_plate || prev.driver.licensePlate,
        },
      }));
    })();
    return () => {
      cancelled = true;
    };
  }, [orderRefetchTick, orderId]);

  // Simulate driver movement only if not receiving real-time updates
  useEffect(() => {
    if (driverLocation || supaDriverLocation) return;
    const interval = setInterval(() => {
      setOrder((prev) => ({
        ...prev,
        driver: {
          ...prev.driver,
          currentLocation: {
            lat: prev.driver.currentLocation.lat - 0.0002,
            lng: prev.driver.currentLocation.lng + 0.0001,
          },
        },
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, [driverLocation, supaDriverLocation]);

  const formatEta = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins} min` : `${secs} sec`;
  };

  const handleSendMessage = useCallback(() => {
    if (!newMessage.trim()) return;
    impact("light");
    sendSyncMessage(newMessage, "customer_001", "Customer");
    if (paymentState.realOrderId) {
      supaSendMessage(newMessage).catch((err) =>
        console.warn("[chat] supabase send failed", err),
      );
    }
    const msg: ChatMessage = {
      id: Date.now().toString(),
      from: "customer",
      text: newMessage,
      time: new Date().toLocaleTimeString("en-ZA", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      read: false,
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
    setTimeout(() => {
      notification("success");
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          from: "driver",
          text: "Got it! Will do 👍",
          time: new Date().toLocaleTimeString("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          read: false,
        },
      ]);
    }, 2000);
  }, [
    newMessage,
    impact,
    notification,
    sendSyncMessage,
    supaSendMessage,
    paymentState.realOrderId,
  ]);

  const handleSaveInstructions = () => {
    setDeliveryInstructions(instructionsDraft);
    setShowInstructions(false);
    notification("success");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now().toString(),
        from: "system",
        text: `Delivery instructions updated: "${instructionsDraft}"`,
        time: new Date().toLocaleTimeString("en-ZA", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        read: true,
      },
    ]);
  };

  const handleCall = () => {
    impact("medium");
    if (paymentState.realOrderId) {
      navigate(`/call/${paymentState.realOrderId}`);
      return;
    }
    window.location.href = `tel:${order.driver.phone}`;
  };

  const statusIndex = getStatusIndex(order.status);

  // ── Bottom-sheet snap logic ──────────────────────────────────────
  // Three snap points as distances from the bottom of the viewport.
  // peek = driver card just visible above bottom nav.
  // mid  = driver card + actions + progress visible.
  // full = sheet occupies 92% of viewport.
  const [sheetHeight, setSheetHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight * 0.92 : 800,
  );
  useEffect(() => {
    const onResize = () => setSheetHeight(window.innerHeight * 0.92);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const SNAP = {
    full: 0,
    mid: sheetHeight * 0.42,
    peek: sheetHeight * 0.68,
  };
  const [snapIdx, setSnapIdx] = useState<0 | 1 | 2>(1); // start at mid
  const y = useMotionValue(SNAP.mid);

  useEffect(() => {
    const target = snapIdx === 0 ? SNAP.full : snapIdx === 1 ? SNAP.mid : SNAP.peek;
    const controls = animate(y, target, {
      type: "spring",
      damping: 32,
      stiffness: 420,
      mass: 0.9,
    });
    return () => controls.stop();
  }, [snapIdx, SNAP.full, SNAP.mid, SNAP.peek, y]);

  const snapToNearest = useCallback(() => {
    const current = y.get();
    const points = [SNAP.full, SNAP.mid, SNAP.peek];
    let closest = points[0];
    let idx: 0 | 1 | 2 = 0;
    points.forEach((p, i) => {
      if (Math.abs(p - current) < Math.abs(closest - current)) {
        closest = p;
        idx = i as 0 | 1 | 2;
      }
    });
    setSnapIdx(idx);
  }, [SNAP.full, SNAP.mid, SNAP.peek, y]);

  const cycleSheet = () => {
    impact("light");
    setSnapIdx((cur) => ((cur + 1) % 3) as 0 | 1 | 2);
  };

  const dragControls = useDragControls();

  const [routeInfo, setRouteInfo] = useState({ duration: "", distance: "" });
  const handleRouteCalculated = (duration: string, distance: string) => {
    setRouteInfo({ duration, distance });
  };

  const isArriving = order.status === "arriving" || etaSeconds < 180;
  const statusLabel =
    order.status === "delivered"
      ? "Delivered"
      : isArriving
        ? "Arriving now"
        : order.status === "en_route"
          ? "On the way"
          : order.status === "picked_up"
            ? "Driver picked up"
            : order.status === "preparing"
              ? "Being prepared"
              : "Order confirmed";

  return (
    <div className="fixed inset-0 bg-background overflow-hidden">
      {/* ── Full-bleed map ────────────────────────────────────────── */}
      <div className="absolute inset-0 z-0">
        <InAppMapNavigation
          driverLocation={order.driver.currentLocation}
          driverHeading={0}
          destination={order.destinationLocation}
          destinationLabel={order.address}
          onRouteUpdated={handleRouteCalculated}
          className="w-full h-full"
          minimal
          bottomPadding={sheetHeight * 0.5}
        />
      </div>

      {/* ── Top: back + order badge + recenter ────────────────────── */}
      <div
        className="absolute top-0 left-0 right-0 z-20 flex items-start justify-between gap-2 px-4"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)" }}
      >
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-lg flex items-center justify-center text-foreground"
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>

        <div className="bg-card/95 backdrop-blur-xl rounded-full px-4 py-2 border border-border shadow-lg flex flex-col items-center">
          <p className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground font-semibold leading-none">
            Order
          </p>
          <p className="text-xs font-bold text-foreground mt-0.5 leading-none">
            {order.id}
          </p>
        </div>

        <motion.button
          whileTap={{ scale: 0.94 }}
          aria-label="Recenter on driver"
          className="w-11 h-11 rounded-full bg-card/95 backdrop-blur-xl border border-border shadow-lg flex items-center justify-center text-foreground"
          onClick={() => {
            // Recenter handled inside the map component via its internal controls.
            // Soft no-op kept as a visible affordance; users can drag the map freely.
          }}
        >
          <Locate className="w-5 h-5 text-primary" />
        </motion.button>
      </div>

      {/* ── ETA hero card, floats on map ──────────────────────────── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, type: "spring", damping: 22 }}
        className="absolute left-1/2 -translate-x-1/2 z-20"
        style={{ top: "calc(env(safe-area-inset-top) + 4.5rem)" }}
      >
        <div className="bg-card/95 backdrop-blur-2xl rounded-2xl px-5 py-3 border-2 border-primary shadow-2xl min-w-[180px]">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                order.status === "delivered"
                  ? "bg-emerald-500"
                  : "bg-primary animate-pulse"
              }`}
            />
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-primary">
              {statusLabel}
            </p>
          </div>
          <p className="text-3xl font-black text-center text-foreground tabular-nums leading-none">
            {formatEta(etaSeconds)}
          </p>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5 font-medium">
            ETA · {order.estimatedDelivery}
          </p>
          {routeInfo.duration && (
            <p className="text-[10px] text-muted-foreground/70 text-center mt-0.5">
              {routeInfo.distance} away
            </p>
          )}
        </div>
      </motion.div>

      {/* ── Awaiting payment banner — stacks above sheet ──────────── */}
      {paymentState.awaitingPayment && paymentState.realOrderId && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="absolute left-4 right-4 z-20 rounded-2xl border border-amber-500/50 bg-amber-500/10 backdrop-blur-2xl p-3 shadow-xl"
          style={{ top: "calc(env(safe-area-inset-top) + 12rem)" }}
        >
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
            Payment required
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Complete payment to continue your delivery.
          </p>
          <div className="mt-3">
            <PayNowButton
              orderId={paymentState.realOrderId}
              label="Pay Now"
              className="w-full"
            />
          </div>
        </motion.div>
      )}

      {/* ── Draggable bottom sheet ────────────────────────────────── */}
      <motion.div
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: SNAP.full, bottom: SNAP.peek }}
        dragElastic={0.06}
        dragMomentum={false}
        style={{ y, height: sheetHeight }}
        onDragEnd={snapToNearest}
        className="absolute bottom-0 left-0 right-0 z-30 bg-card rounded-t-[28px] border-t border-border shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.25)] flex flex-col touch-none"
      >
        {/* Handle (drag to resize, tap to cycle) */}
        <div
          onPointerDown={(e) => dragControls.start(e)}
          onClick={cycleSheet}
          className="flex flex-col items-center justify-center py-3 shrink-0 cursor-grab active:cursor-grabbing select-none"
          role="button"
          aria-label="Drag to resize sheet, tap to cycle"
        >
          <div className="w-12 h-1.5 bg-muted-foreground/25 rounded-full" />
        </div>

        {/* Content — scrollable, native gesture (pan-y) */}
        <div
          className="flex-1 overflow-y-auto overscroll-contain px-4 pb-8 touch-pan-y"
        >
          {/* Progress Steps */}
          <div className="mb-5 pt-1">
            <div className="flex justify-between items-center relative">
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-secondary" />
              <div
                className="absolute top-4 left-4 h-0.5 bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                style={{
                  width: `calc(${(statusIndex / (statusSteps.length - 1)) * 100}% - ${(statusIndex / (statusSteps.length - 1)) * 2}rem)`,
                }}
              />
              {statusSteps.map((step, i) => {
                const Icon = step.icon;
                const isComplete = i <= statusIndex;
                const isCurrent = i === statusIndex;
                return (
                  <div
                    key={step.key}
                    className="flex flex-col items-center z-10"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                        isComplete
                          ? "bg-primary text-primary-foreground shadow-[0_0_0_4px_rgba(212,175,55,0.18)]"
                          : "bg-secondary text-muted-foreground"
                      } ${isCurrent ? "ring-4 ring-primary/25 scale-110" : ""}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </div>
                    <span
                      className={`text-[9px] mt-1.5 text-center max-w-[54px] font-medium ${
                        isComplete
                          ? "text-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Driver card — hero */}
          <motion.div
            whileTap={{ scale: 0.99 }}
            className="bg-gradient-to-br from-card to-secondary/20 rounded-2xl border border-border p-4 mb-3"
          >
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 rounded-full p-[2px] bg-gradient-to-br from-primary to-primary/50">
                  <img
                    src={order.driver.photo}
                    alt={order.driver.name}
                    className="w-full h-full rounded-full object-cover border-2 border-card"
                  />
                </div>
                <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-card flex items-center justify-center">
                  <Navigation className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground truncate font-display">
                    {order.driver.name}
                  </h3>
                  <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/15 text-primary shrink-0">
                    <Star className="w-3 h-3 fill-current" />
                    <span className="text-xs font-bold tabular-nums">
                      {order.driver.rating}
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {order.driver.vehicle}
                </p>
                <div className="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded border border-border bg-secondary/50">
                  <span className="text-[10px] font-bold tracking-widest text-foreground">
                    {order.driver.licensePlate}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 mt-4">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  impact("light");
                  setShowChat(true);
                }}
                className="flex-1 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center gap-2 font-semibold text-sm shadow-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Message
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.94 }}
                onClick={handleCall}
                aria-label="Call driver"
                className="w-11 h-11 rounded-full border border-primary/40 bg-primary/10 text-primary flex items-center justify-center"
              >
                <Phone className="w-5 h-5" />
              </motion.button>
              {paymentState.realOrderId && (
                <ShareTripButton orderId={paymentState.realOrderId} />
              )}
            </div>

            {supaDriverLocation && supaLocationStale && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Reconnecting to driver's live
                location…
              </p>
            )}
          </motion.div>

          {/* Proof of delivery — renders once driver uploads it */}
          {paymentState.realOrderId && (
            <div className="mb-3">
              <ProofOfDeliveryCard orderId={paymentState.realOrderId} />
            </div>
          )}

          {/* White-glove editorial — visible only to concierge-handled orders */}
          {(order as any).is_white_glove && order.status !== "delivered" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent px-4 py-5"
            >
              <div className="h-px w-10 bg-primary mx-auto" />
              <p className="text-[10px] tracking-[0.3em] text-primary font-semibold mt-3 uppercase text-center">
                White Glove Service
              </p>
              <p className="mt-2 text-sm text-foreground italic text-center leading-relaxed px-2">
                A dedicated concierge is personally overseeing this order — hand-delivered,
                white-glove handled, and presented with care.
              </p>
              <div className="h-px w-10 bg-primary mx-auto mt-4" />
            </motion.div>
          )}

          {/* Editorial delivered moment — mirrors mobile delivered card */}
          {order.status === "delivered" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mb-3 rounded-2xl border border-primary/30 bg-primary/5 px-4 py-5"
            >
              <div className="h-px w-10 bg-primary mx-auto" />
              <p className="text-[10px] tracking-[0.3em] text-primary font-semibold mt-3 uppercase text-center">
                Delivered With Care
              </p>
              <p className="mt-2 text-sm text-muted-foreground italic text-center leading-relaxed px-2">
                Thank you for letting LIQZAR pour your moment. Your bottle was handled by a vetted courier and verified at the door.
              </p>
              <div className="mt-3 flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-primary bg-primary/10 border border-primary/40 rounded-full">
                  <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                  Age & ID verified on delivery
                </span>
              </div>
              <div className="h-px w-10 bg-primary mx-auto mt-4" />
            </motion.div>
          )}

          {/* Delivery Instructions */}
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowInstructions(true)}
            className="w-full bg-card rounded-2xl border border-border p-4 text-left mb-3 hover:border-primary/40 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Edit3 className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Delivery Instructions
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {deliveryInstructions || "Add instructions for driver"}
                  </p>
                </div>
              </div>
              <Plus className="w-5 h-5 text-muted-foreground shrink-0" />
            </div>
          </motion.button>

          {/* Delivery Address */}
          <div className="bg-card rounded-2xl border border-border p-4 mb-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Delivery Address
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {order.address}
                </p>
              </div>
            </div>
          </div>

          {/* Order Details */}
          <motion.button
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowDetails(!showDetails)}
            className="w-full bg-card rounded-2xl border border-border p-4 text-left"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  <Package className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-foreground">
                    Order Details
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {order.items.length} items · R
                    {order.total.toLocaleString()}
                  </p>
                </div>
              </div>
              {showDetails ? (
                <ChevronUp className="w-5 h-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="w-5 h-5 text-muted-foreground" />
              )}
            </div>

            <AnimatePresence>
              {showDetails && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="pt-4 mt-4 border-t border-border space-y-3">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-foreground">
                          {item.qty}× {item.name}
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                          R{(item.price * item.qty).toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="pt-3 border-t border-border space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span className="text-muted-foreground tabular-nums">
                          R{order.subtotal.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery</span>
                        <span className="text-muted-foreground tabular-nums">
                          {order.deliveryFee === 0
                            ? "Free"
                            : `R${order.deliveryFee.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-border flex justify-between font-bold">
                        <span>Total</span>
                        <span className="tabular-nums">
                          R{order.total.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      </motion.div>

      {/* ── Chat Sheet ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showChat && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowChat(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl max-h-[85vh] flex flex-col"
            >
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <img
                    src={order.driver.photo}
                    alt={order.driver.name}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-bold text-foreground">
                      {order.driver.name}
                    </p>
                    <p className="text-xs text-emerald-500 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Online
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleCall}
                    className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center"
                    aria-label="Call driver"
                  >
                    <PhoneCall className="w-5 h-5 text-white" />
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={() => setShowChat(false)}
                    className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center"
                    aria-label="Close chat"
                  >
                    <X className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from === "customer" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                        msg.from === "customer"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : msg.from === "system"
                            ? "bg-secondary text-muted-foreground text-center text-xs w-full"
                            : "bg-secondary text-foreground rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm">{msg.text}</p>
                      <p
                        className={`text-[10px] mt-1 ${
                          msg.from === "customer"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        }`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              <div className="px-4 py-2 border-t border-border">
                <div className="flex gap-2 overflow-x-auto scrollbar-none pb-2">
                  {["I'm at the gate", "Thanks!", "Please wait", "Call me"].map(
                    (quick) => (
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        key={quick}
                        onClick={() => setNewMessage(quick)}
                        className="flex-shrink-0 px-3 py-1.5 rounded-full bg-secondary text-xs font-medium"
                      >
                        {quick}
                      </motion.button>
                    ),
                  )}
                </div>
              </div>
              <div className="p-4 border-t border-border">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 h-12 px-4 rounded-full bg-secondary border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={handleSendMessage}
                    disabled={!newMessage.trim()}
                    aria-label="Send"
                    className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50"
                  >
                    <Send className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delivery Instructions Sheet ─────────────────────────── */}
      <AnimatePresence>
        {showInstructions && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowInstructions(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6"
            >
              <h3 className="text-lg font-bold text-foreground mb-1 font-display">
                Delivery Instructions
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Help your driver find you easier
              </p>
              <textarea
                value={instructionsDraft}
                onChange={(e) => setInstructionsDraft(e.target.value)}
                placeholder="e.g., Ring the bell at unit 5, code is 1234, leave at the door..."
                className="w-full h-32 p-4 rounded-xl bg-secondary border-none text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
              <div className="flex gap-3 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowInstructions(false)}
                  className="flex-1 h-12 rounded-xl"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSaveInstructions}
                  className="flex-1 h-12 rounded-xl bg-primary"
                >
                  Save & Send to Driver
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LiveOrderTrackingPage;
