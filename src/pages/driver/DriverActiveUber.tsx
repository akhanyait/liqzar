import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import {
  Navigation,
  Phone,
  Package,
  Clock,
  ChevronUp,
  ChevronDown,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  Send,
  X,
  Map,
  Route,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Zap,
  TrendingUp,
  MapPin,
  Camera,
  QrCode,
  ArrowRight,
  Sparkles,
  Shield,
  Star,
  RefreshCw,
  Menu,
  Bell,
  Settings,
  Coffee,
  Fuel,
  Battery,
  Wifi,
  ChevronRight,
  Play,
  Pause,
  SkipForward,
  Users,
  Headphones,
  Radio,
  Target,
  Award,
  Flame,
  ThumbsUp,
  Navigation2,
  ArrowLeft,
  Home,
  ScanLine,
  Pen,
  PackageCheck,
  Building2,
  User,
  FileText,
  PhoneCall,
  Clipboard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import InAppMapNavigation, {
  NavigationStep,
} from "@/components/InAppMapNavigation";
import {
  useAIRouteOptimizer,
  useDriverVoiceCommands,
} from "@/hooks/useDriverAI";
import { useDriverSync } from "@/hooks/useDeliverySync";
import { useHaptics } from "@/hooks/useNativeFeatures";
import {
  usePickupVerification,
  useDeliveryVerification,
  OrderItem,
} from "@/hooks/useInventoryVerification";
import {
  SignaturePad,
  SignatureDisplay,
} from "@/components/native/SignaturePad";
import ItemChecklist from "@/components/driver/ItemChecklist";
import { toast } from "@/hooks/use-toast";

interface Delivery {
  id: string;
  customer: string;
  customerPhoto?: string;
  address: string;
  addressLine2?: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  phone: string;
  items: OrderItem[];
  eta: string;
  etaMinutes: number;
  status:
    | "pending"
    | "picking"
    | "picked"
    | "en_route"
    | "arrived"
    | "delivering"
    | "delivered";
  priority: "high" | "medium" | "low";
  location: { lat: number; lng: number };
  distance: number;
  // Intelligence fields
  customerOrderCount?: number;
  customerRating?: number;
  preferredDeliveryTime?: string;
  buildingType?: "house" | "apartment" | "office" | "complex";
  parkingInfo?: string;
  accessInstructions?: string;
  trafficCondition?: "light" | "moderate" | "heavy";
  weatherAlert?: string;
  rating?: number;
  specialInstructions?: string;
  gateCode?: string;
  warehouseName?: string;
  warehouseAddress?: string;
}

interface ChatMessage {
  id: string;
  from: "driver" | "customer" | "admin" | "system";
  senderName?: string;
  text: string;
  time: string;
  read: boolean;
}

// Mock order items with barcodes for scanning
const mockOrderItems: OrderItem[] = [
  {
    id: "item1",
    productId: "JWB750",
    name: "Johnnie Walker Black Label 750ml",
    quantity: 2,
    price: 549.99,
    barcode: "5000267024004",
    category: "Whisky",
    size: "750ml",
    imageUrl:
      "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200",
  },
  {
    id: "item2",
    productId: "MC750",
    name: "Moët & Chandon Brut Imperial",
    quantity: 1,
    price: 899.0,
    barcode: "3185370000015",
    category: "Champagne",
    size: "750ml",
    imageUrl:
      "https://images.unsplash.com/photo-1594372365401-3b5ff14eaaed?w=200",
  },
  {
    id: "item3",
    productId: "GGV750",
    name: "Grey Goose Vodka",
    quantity: 1,
    price: 599.0,
    barcode: "5010677850001",
    category: "Vodka",
    size: "750ml",
    imageUrl:
      "https://images.unsplash.com/photo-1613063050888-c7383c19c0e9?w=200",
  },
];

const mockDeliveries: Delivery[] = [
  {
    id: "ORD-2401",
    customer: "Thabo Mokoena",
    customerPhoto: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thabo",
    address: "42 Rivonia Road",
    addressLine2: "Sandton Central Office Park, Building A, 3rd Floor",
    suburb: "Sandton",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    phone: "+27 82 123 4567",
    items: mockOrderItems,
    eta: "8 min",
    etaMinutes: 8,
    status: "pending",
    priority: "high",
    location: { lat: -26.1076, lng: 28.0567 },
    distance: 2.4,
    rating: 4.8,
    specialInstructions: "Please call when at gate",
    gateCode: "4521#",
    warehouseName: "LIQZAR Sandton DC",
    warehouseAddress: "15 Rivonia Rd, Sandton",
    // Intelligence data
    customerOrderCount: 12,
    customerRating: 4.9,
    preferredDeliveryTime: "Afternoon (12-5pm)",
    buildingType: "office",
    parkingInfo: "Visitor parking available at basement level B2",
    accessInstructions: "Use intercom at main entrance, ask for reception",
    trafficCondition: "moderate",
    weatherAlert: undefined,
  },
];

const statusLabels = {
  pending: "Pending Pickup",
  picking: "Verifying Items",
  picked: "Items Picked",
  en_route: "En Route",
  arrived: "At Location",
  delivering: "Confirming Delivery",
  delivered: "Delivered",
};

const statusColors = {
  pending: "bg-amber-500",
  picking: "bg-blue-500",
  picked: "bg-purple-500",
  en_route: "bg-orange-500",
  arrived: "bg-teal-500",
  delivering: "bg-green-500",
  delivered: "bg-gray-500",
};

const quickReplies = [
  "I'm at the gate",
  "On my way, 2 min",
  "Please share gate code",
  "I'll call you shortly",
];

const adminQuickMessages = [
  "Require assistance",
  "Running late",
  "Customer not available",
  "Need dispatch help",
];

const DriverActiveUber = () => {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState<Delivery[]>(mockDeliveries);
  const [activeDelivery, setActiveDelivery] = useState<Delivery>(
    mockDeliveries[0],
  );
  const [isOnline, setIsOnline] = useState(true);

  // UI State
  const [activeView, setActiveView] = useState<"map" | "items" | "chat">("map");
  const [showDeliveryList, setShowDeliveryList] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatTarget, setChatTarget] = useState<"customer" | "admin">(
    "customer",
  );
  const [showActions, setShowActions] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [signatureType, setSignatureType] = useState<
    "driver" | "customer"
  >("driver");
  const [showScanner, setShowScanner] = useState(false);
  const [currentScanIndex, setCurrentScanIndex] = useState(0);

  // Messages
  const [customerMessages, setCustomerMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      from: "system",
      text: "Chat started with customer",
      time: "Now",
      read: true,
    },
  ]);
  const [adminMessages, setAdminMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      from: "system",
      text: "Connected to dispatch",
      time: "Now",
      read: true,
    },
    {
      id: "2",
      from: "admin",
      senderName: "Dispatch",
      text: "You have 1 delivery assigned. Please proceed to warehouse for pickup.",
      time: "2 min ago",
      read: true,
    },
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [driverLocation, setDriverLocation] = useState({
    lat: -26.0875,
    lng: 28.0432,
  });
  const sheetRef = useRef<HTMLDivElement>(null);

  const { impact, notification } = useHaptics();
  const { insights, addInsight, dismissInsight, optimizeDeliveries } =
    useAIRouteOptimizer(driverLocation);
  const {
    isListening,
    startListening,
    stopListening,
    lastCommand,
    processCommand,
  } = useDriverVoiceCommands();

  // Real-time sync with customers
  const { sendDeliveryUpdate, sendChatMessage, updateLocation } = useDriverSync(
    "driver_001",
    "Sipho M.",
  );

  // Inventory verification hooks
  const pickupVerification = usePickupVerification(
    activeDelivery.id,
    "driver_001",
    "Sipho M.",
    activeDelivery.items,
  );

  const deliveryVerification = useDeliveryVerification(
    activeDelivery.id,
    "driver_001",
    "Sipho M.",
    pickupVerification.items,
  );

  // Update driver location periodically for customer tracking
  useEffect(() => {
    if (
      activeDelivery &&
      (activeDelivery.status === "en_route" ||
        activeDelivery.status === "arrived")
    ) {
      const interval = setInterval(() => {
        // Simulate movement towards destination
        const newLat = driverLocation.lat + (Math.random() - 0.5) * 0.0005;
        const newLng = driverLocation.lng + (Math.random() - 0.5) * 0.0005;
        setDriverLocation({ lat: newLat, lng: newLng });
        updateLocation(activeDelivery.id, newLat, newLng, 45, 30);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [
    activeDelivery?.status,
    driverLocation,
    updateLocation,
    activeDelivery?.id,
  ]);

  // Handle bottom sheet drag
  const handleDrag = (event: any, info: PanInfo) => {
    if (info.offset.y < -50) {
      setShowDeliveryList(true);
    } else if (info.offset.y > 50) {
      setShowDeliveryList(false);
    }
  };

  // Advance delivery status
  const advanceStatus = useCallback(() => {
    impact("medium");

    setActiveDelivery((prev) => {
      const statusOrder: Delivery["status"][] = [
        "pending",
        "picking",
        "picked",
        "en_route",
        "arrived",
        "delivering",
        "delivered",
      ];
      const currentIndex = statusOrder.indexOf(prev.status);
      const nextStatus =
        statusOrder[Math.min(currentIndex + 1, statusOrder.length - 1)];

      // Send real-time update to customer
      sendDeliveryUpdate({
        orderId: prev.id,
        status:
          nextStatus === "en_route"
            ? "en_route"
            : nextStatus === "arrived"
              ? "arrived"
              : nextStatus === "delivered"
                ? "delivered"
                : "picked",
        driverPhoto: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sipho",
        driverRating: 4.9,
        driverPhone: "+27 83 456 7890",
        currentLocation: driverLocation,
        eta: prev.eta,
        distance: prev.distance,
      });

      if (nextStatus === "picking") {
        addInsight(
          "optimization",
          "📦 Starting item verification at warehouse...",
          "high",
          undefined,
          undefined,
          5000,
        );
      } else if (nextStatus === "picked") {
        addInsight(
          "optimization",
          "✅ All items verified and signed for pickup!",
          "high",
          undefined,
          undefined,
          5000,
        );
      } else if (nextStatus === "arrived") {
        addInsight(
          "customer",
          "📍 Arrived at destination. Contact customer.",
          "high",
          undefined,
          undefined,
          8000,
        );
        notification("success");
      } else if (nextStatus === "delivered") {
        notification("success");
        addInsight(
          "optimization",
          "✅ Delivery complete! Great job.",
          "high",
          undefined,
          undefined,
          5000,
        );
      }

      return { ...prev, status: nextStatus };
    });
  }, [impact, notification, addInsight, sendDeliveryUpdate, driverLocation]);

  // Handle signature save
  const handleSignatureSave = (signature: string) => {
    if (signatureType === "driver" && activeDelivery.status === "picking") {
      // Driver signed for pickup
      pickupVerification.completePickup(
        signature,
        undefined,
        undefined,
        undefined,
        activeDelivery.warehouseName,
      );
      advanceStatus(); // Move to picked
      addInsight(
        "optimization",
        "✍️ Pickup signed. Ready for delivery!",
        "high",
        undefined,
        undefined,
        5000,
      );
    } else if (
      signatureType === "customer" &&
      activeDelivery.status === "delivering"
    ) {
      // Customer signed for delivery
      deliveryVerification.completeDelivery(
        signature,
        activeDelivery.customer,
        activeDelivery.phone,
        activeDelivery.address,
      );
      advanceStatus(); // Move to delivered
    }
    setShowSignature(false);
    notification("success");
  };

  // Open scanner for specific item
  const openScannerForItem = (itemIndex: number) => {
    setCurrentScanIndex(itemIndex);
    setShowScanner(true);
  };

  // Handle barcode scan
  const handleBarcodeScan = (barcode: string) => {
    const expectedItem = pickupVerification.items[currentScanIndex];

    // Check if barcode matches expected item
    if (expectedItem && expectedItem.barcode === barcode) {
      pickupVerification.verifyItemManually(expectedItem.id);
      notification("success");

      // Check if all items are now verified
      const remainingUnverified = pickupVerification.items.filter(
        (item, idx) => !item.verified && idx !== currentScanIndex,
      );

      if (remainingUnverified.length === 0) {
        // All items verified - show signature
        setShowScanner(false);
        toast({
          title: "✅ All Items Verified!",
          description: "Please sign to confirm pickup",
        });
        setTimeout(() => {
          setSignatureType("driver");
          setShowSignature(true);
        }, 500);
      } else {
        // Find next unverified item
        const nextUnverifiedIndex = pickupVerification.items.findIndex(
          (item, idx) => !item.verified && idx !== currentScanIndex,
        );
        if (nextUnverifiedIndex !== -1) {
          setCurrentScanIndex(nextUnverifiedIndex);
          toast({
            title: `✓ ${expectedItem.name}`,
            description: `Scan item ${pickupVerification.progress.verified + 1} of ${pickupVerification.progress.total}`,
          });
        }
      }
    } else {
      // Barcode doesn't match expected item
      toast({
        title: "Wrong Item",
        description: `Expected: ${expectedItem?.name || "Unknown"}`,
        variant: "destructive",
      });
      impact("heavy");
    }
  };

  // Send message
  const handleSendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || !activeDelivery) return;

      const newMsg: ChatMessage = {
        id: Date.now().toString(),
        from: "driver",
        text: text.trim(),
        time: "Now",
        read: false,
      };

      if (chatTarget === "customer") {
        setCustomerMessages((prev) => [...prev, newMsg]);
        sendChatMessage(activeDelivery.id, text.trim());
        // Simulate customer reply
        setTimeout(() => {
          setCustomerMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              from: "customer",
              senderName: activeDelivery.customer,
              text: [
                "Thanks! 👍",
                "Perfect, see you soon!",
                "Got it, thanks!",
                "No problem!",
              ][Math.floor(Math.random() * 4)],
              time: "Just now",
              read: false,
            },
          ]);
        }, 2000);
      } else {
        setAdminMessages((prev) => [...prev, newMsg]);
        // Simulate admin reply
        setTimeout(() => {
          setAdminMessages((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              from: "admin",
              senderName: "Dispatch",
              text: [
                "Noted, proceed.",
                "Understood.",
                "Thanks for the update.",
                "Will assist shortly.",
              ][Math.floor(Math.random() * 4)],
              time: "Just now",
              read: false,
            },
          ]);
        }, 1500);
      }

      setInputMessage("");
      impact("light");
    },
    [chatTarget, activeDelivery, sendChatMessage, impact],
  );

  // Handle voice commands
  useEffect(() => {
    if (lastCommand) {
      const result = processCommand(lastCommand);
      if (result) {
        switch (result.action) {
          case "call":
            if (activeDelivery) window.open(`tel:${activeDelivery.phone}`);
            break;
          case "message":
            setActiveView("chat");
            setChatTarget("customer");
            break;
          case "arrived":
            advanceStatus();
            break;
          case "next":
            // Move to next step
            advanceStatus();
            break;
        }
        toast({
          title: "Voice Command",
          description: `Executing: ${result.action}`,
        });
      }
    }
  }, [lastCommand, processCommand, activeDelivery, advanceStatus]);

  // Calculate stats
  const pendingCount = deliveries.filter(
    (d) => d.status !== "delivered",
  ).length;
  const completedCount = deliveries.filter(
    (d) => d.status === "delivered",
  ).length;

  // State for route info from Google Maps
  const [routeInfo, setRouteInfo] = useState({ duration: "", distance: "" });
  const [navigationSteps, setNavigationSteps] = useState<NavigationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const handleRouteCalculated = (
    duration: string,
    distance: string,
    steps?: NavigationStep[],
  ) => {
    setRouteInfo({ duration, distance });
    if (steps && steps.length > 0) {
      setNavigationSteps(steps);
    }
  };

  // Get current navigation instruction
  const currentStep = navigationSteps[currentStepIndex];
  const nextStep = navigationSteps[currentStepIndex + 1];

  // Get maneuver icon
  const getManeuverIcon = (maneuver?: string) => {
    switch (maneuver) {
      case "turn-left":
      case "turn-slight-left":
      case "turn-sharp-left":
        return "↰";
      case "turn-right":
      case "turn-slight-right":
      case "turn-sharp-right":
        return "↱";
      case "uturn-left":
      case "uturn-right":
        return "↩";
      case "roundabout-left":
      case "roundabout-right":
        return "↻";
      case "merge":
        return "⇢";
      case "fork-left":
      case "fork-right":
        return "";
      case "ramp-left":
      case "ramp-right":
        return "⤴";
      default:
        return "↑";
    }
  };

  // Map markers with enhanced labels
  const mapMarkers = [
    {
      lat: driverLocation.lat,
      lng: driverLocation.lng,
      label: "You",
      color: "green" as const,
      popup: "Your current location",
    },
    {
      lat: activeDelivery.location.lat,
      lng: activeDelivery.location.lng,
      label: activeDelivery.id,
      color: "orange" as const,
      popup: `${activeDelivery.customer} • ${activeDelivery.address}`,
    },
  ];

  const messages = chatTarget === "customer" ? customerMessages : adminMessages;
  const quickMessages =
    chatTarget === "customer" ? quickReplies : adminQuickMessages;

  // Full formatted address
  const fullAddress = `${activeDelivery.address}${activeDelivery.addressLine2 ? `, ${activeDelivery.addressLine2}` : ""}, ${activeDelivery.suburb}, ${activeDelivery.city}, ${activeDelivery.province} ${activeDelivery.postalCode}`;

  // Calculate arrival time
  const getArrivalTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + activeDelivery.etaMinutes);
    return now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top Header - Customer App Style */}
      <header className="fixed top-0 left-0 right-0 z-40 safe-area-top bg-header">
        <div className="bg-header">
          <div className="container flex items-center h-14 px-4 gap-4">
            {/* Back Button */}
            <button
              onClick={() => {
                impact("light");
                navigate("/driver");
              }}
              className="w-9 h-9 rounded-full bg-header-foreground/15 flex items-center justify-center"
            >
              <ArrowLeft className="w-5 h-5 text-header-foreground" />
            </button>

            {/* Title & Status */}
            <div className="flex-1">
              <h1 className="text-base font-bold text-header-foreground">
                Active Delivery
              </h1>
              <p className="text-xs text-header-foreground/70">
                {activeDelivery.id}
              </p>
            </div>

            {/* Online Toggle */}
            <button
              onClick={() => {
                setIsOnline(!isOnline);
                impact("medium");
              }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${
                isOnline
                  ? "bg-green-500 text-white"
                  : "bg-header-foreground/20 text-header-foreground/70"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${isOnline ? "bg-white animate-pulse" : "bg-header-foreground/50"}`}
              />
              <span className="text-xs font-bold">
                {isOnline ? "Online" : "Offline"}
              </span>
            </button>

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              {/* Admin/Dispatch Chat */}
              <button
                onClick={() => {
                  setActiveView("chat");
                  setChatTarget("admin");
                }}
                className="w-9 h-9 rounded-full bg-purple-500/80 flex items-center justify-center relative"
              >
                <Radio className="w-4 h-4 text-white" />
                {adminMessages.filter((m) => !m.read && m.from === "admin")
                  .length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">
                    {
                      adminMessages.filter((m) => !m.read && m.from === "admin")
                        .length
                    }
                  </span>
                )}
              </button>

              {/* Voice Control */}
              <button
                onClick={() => setShowVoiceModal(true)}
                className={`w-9 h-9 rounded-full flex items-center justify-center ${
                  isListening
                    ? "bg-red-500 animate-pulse"
                    : "bg-header-foreground/15"
                }`}
              >
                <Mic className="w-4 h-4 text-header-foreground" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with safe area padding */}
      <main className="flex-1 pt-14 pb-20 safe-area-top">
        {/* AI Insights Bar */}
        <AnimatePresence>
          {insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="px-4 py-2 flex gap-2 overflow-x-auto scrollbar-hide bg-gradient-to-r from-amber-500/10 to-orange-500/10"
            >
              {insights.slice(0, 3).map((insight) => (
                <motion.div
                  key={insight.id}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className="flex-shrink-0 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-xs text-foreground whitespace-nowrap">
                    {insight.message}
                  </span>
                  <button
                    onClick={() => dismissInsight(insight.id)}
                    className="text-muted-foreground"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* View Switcher Tabs */}
        <div className="px-4 py-2">
          <div className="bg-card rounded-2xl p-1 shadow-lg flex border border-border">
            {[
              { id: "map", label: "Map", icon: Navigation2 },
              { id: "items", label: "Items", icon: Package },
              { id: "chat", label: "Chat", icon: MessageSquare },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as typeof activeView)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl transition-colors ${
                  activeView === tab.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                <span className="text-sm font-medium">{tab.label}</span>
                {tab.id === "items" &&
                  !pickupVerification.allVerified &&
                  activeDelivery.status === "picking" && (
                    <span className="w-2 h-2 bg-amber-500 rounded-full" />
                  )}
                {tab.id === "chat" &&
                  (customerMessages.some(
                    (m) => !m.read && m.from !== "driver",
                  ) ||
                    adminMessages.some(
                      (m) => !m.read && m.from === "admin",
                    )) && <span className="w-2 h-2 bg-red-500 rounded-full" />}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 pb-20">
          {/* Map View */}
          {activeView === "map" && (
            <div
              className="relative flex flex-col"
              style={{ height: "100vh", minHeight: "100vh" }}
            >
              <InAppMapNavigation
                driverLocation={driverLocation}
                driverHeading={0}
                destination={activeDelivery.location}
                destinationLabel={activeDelivery.address}
                onRouteUpdated={(duration, distance, steps) =>
                  handleRouteCalculated(duration, distance, steps)
                }
                onArrived={() => {
                  if (activeDelivery.status === "en_route") {
                    const updated = {
                      ...activeDelivery,
                      status: "arrived" as const,
                    };
                    setActiveDelivery(updated);
                    notification();
                  }
                }}
                className="w-full h-full rounded-2xl shadow-2xl border border-zinc-800 overflow-hidden"
              />

              {/* Navigation Info Overlay - Full Address with ETA */}
              <div className="absolute top-4 left-4 right-4 z-10">
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card/90 backdrop-blur-md rounded-2xl shadow-lg border border-border overflow-hidden p-4"
                  style={{ maxHeight: "180px" }}
                >
                  {/* ETA Header */}
                  <div className="bg-primary/10 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                        <Navigation2 className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <p className="text-3xl font-bold text-foreground">
                          {activeDelivery.eta}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Arriving at {getArrivalTime()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">
                        {activeDelivery.distance} km
                      </p>
                      <div className="flex items-center gap-1 justify-end">
                        {activeDelivery.trafficCondition === "heavy" && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full">
                            Heavy Traffic
                          </span>
                        )}
                        {activeDelivery.trafficCondition === "moderate" && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-600 rounded-full">
                            Moderate
                          </span>
                        )}
                        {activeDelivery.trafficCondition === "light" && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-green-100 text-green-600 rounded-full">
                            Clear
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Full Address */}
                  <div className="p-4">
                    <div className="flex items-start gap-3">
                      <MapPin className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-bold text-foreground">
                          {activeDelivery.address}
                        </p>
                        {activeDelivery.addressLine2 && (
                          <p className="text-sm text-foreground/80">
                            {activeDelivery.addressLine2}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground">
                          {activeDelivery.suburb}, {activeDelivery.city},{" "}
                          {activeDelivery.province} {activeDelivery.postalCode}
                        </p>
                      </div>
                    </div>

                    {/* Route Progress */}
                    <div className="flex items-center gap-2 mt-3">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: "0%" }}
                          animate={{
                            width:
                              activeDelivery.status === "delivered"
                                ? "100%"
                                : activeDelivery.status === "arrived"
                                  ? "90%"
                                  : activeDelivery.status === "en_route"
                                    ? "50%"
                                    : "10%",
                          }}
                          className="h-full bg-primary rounded-full"
                        />
                      </div>
                      <span className="text-xs font-bold text-primary">
                        {activeDelivery.status === "delivered"
                          ? "100%"
                          : activeDelivery.status === "arrived"
                            ? "90%"
                            : activeDelivery.status === "en_route"
                              ? "50%"
                              : "10%"}
                      </span>
                    </div>
                  </div>

                  {/* Intelligence Bar */}
                  <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide">
                    {activeDelivery.customerOrderCount &&
                      activeDelivery.customerOrderCount > 5 && (
                        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/30">
                          <Star className="w-3 h-3 text-purple-600" />
                          <span className="text-[10px] font-medium text-purple-700 dark:text-purple-400">
                            VIP Customer
                          </span>
                        </div>
                      )}
                    {activeDelivery.buildingType && (
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30">
                        <Building2 className="w-3 h-3 text-blue-600" />
                        <span className="text-[10px] font-medium text-blue-700 dark:text-blue-400 capitalize">
                          {activeDelivery.buildingType}
                        </span>
                      </div>
                    )}
                    {activeDelivery.parkingInfo && (
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 dark:bg-green-900/30">
                        <Target className="w-3 h-3 text-green-600" />
                        <span className="text-[10px] font-medium text-green-700 dark:text-green-400">
                          Parking Available
                        </span>
                      </div>
                    )}
                    {activeDelivery.priority === "high" && (
                      <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 dark:bg-red-900/30">
                        <Zap className="w-3 h-3 text-red-600" />
                        <span className="text-[10px] font-medium text-red-700 dark:text-red-400">
                          Priority
                        </span>
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Turn-by-Turn Navigation Instructions */}
              {currentStep &&
                (activeDelivery.status === "en_route" ||
                  activeDelivery.status === "picked") && (
                  <div className="absolute bottom-24 left-4 right-4 z-10">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl shadow-lg overflow-hidden p-4"
                      style={{ maxHeight: "120px" }}
                    >
                      {/* Current Instruction */}
                      <div className="p-4 flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
                          <span className="text-4xl text-white">
                            {getManeuverIcon(currentStep.maneuver)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p
                            className="text-lg font-bold text-white leading-tight"
                            dangerouslySetInnerHTML={{
                              __html: currentStep.instruction
                                .replace(/<[^>]*>/g, " ")
                                .trim(),
                            }}
                          />
                          <p className="text-sm text-white/80 mt-1">
                            {currentStep.distance} • {currentStep.duration}
                          </p>
                        </div>
                      </div>

                      {/* Next Instruction Preview */}
                      {nextStep && (
                        <div className="bg-black/20 px-4 py-2.5 flex items-center gap-3">
                          <span className="text-lg text-white/70">
                            {getManeuverIcon(nextStep.maneuver)}
                          </span>
                          <p
                            className="text-sm text-white/70 flex-1"
                            dangerouslySetInnerHTML={{
                              __html: `Then: ${nextStep.instruction.replace(/<[^>]*>/g, " ").trim()}`,
                            }}
                          />
                          <span className="text-xs text-white/50">
                            {nextStep.distance}
                          </span>
                        </div>
                      )}
                    </motion.div>
                  </div>
                )}

              {/* Bottom Actions Row */}
              <div className="absolute bottom-4 left-4 right-4 z-10 flex items-center gap-2">
                {/* Recenter Button */}
                <button className="w-12 h-12 bg-card rounded-full shadow-lg flex items-center justify-center border border-border">
                  <Target className="w-5 h-5 text-foreground" />
                </button>

                {/* Skip to next step (for testing) */}
                {navigationSteps.length > 0 && (
                  <button
                    onClick={() =>
                      setCurrentStepIndex((prev) =>
                        Math.min(prev + 1, navigationSteps.length - 1),
                      )
                    }
                    className="flex-1 h-12 bg-card rounded-2xl shadow-lg flex items-center justify-center gap-2 border border-border"
                  >
                    <SkipForward className="w-5 h-5 text-foreground" />
                    <span className="text-foreground font-medium text-sm">
                      Next Step ({currentStepIndex + 1}/{navigationSteps.length}
                      )
                    </span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Items View - Inventory Verification */}
          {activeView === "items" && (
            <div className="h-full overflow-y-auto p-4 pb-80">
              {activeDelivery.status === "picking" ||
              activeDelivery.status === "pending" ? (
                <>
                  {/* Warehouse Info */}
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">
                        {activeDelivery.warehouseName || "Warehouse"}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {activeDelivery.warehouseAddress || "Pickup Location"}
                      </p>
                    </div>
                  </div>

                  <ItemChecklist
                    items={pickupVerification.items}
                    mode="pickup"
                    onVerifyItem={pickupVerification.verifyItemManually}
                    onReportIssue={pickupVerification.reportItemIssue}
                    onScanBarcode={openScannerForItem}
                    progress={pickupVerification.progress}
                    currentScanIndex={currentScanIndex}
                  />

                  {/* Sign Pickup Button */}
                  {pickupVerification.allVerified &&
                    !pickupVerification.driverSignature && (
                      <Button
                        onClick={() => {
                          setSignatureType("driver");
                          setShowSignature(true);
                        }}
                        className="w-full h-14 mt-4 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500"
                      >
                        <Pen className="w-5 h-5 mr-2" />
                        Sign for Pickup
                      </Button>
                    )}

                  {pickupVerification.driverSignature && (
                    <div className="mt-4">
                      <SignatureDisplay
                        signature={pickupVerification.driverSignature}
                        signerName="Sipho M."
                        role="driver"
                      />
                    </div>
                  )}
                </>
              ) : activeDelivery.status === "arrived" ||
                activeDelivery.status === "delivering" ? (
                <>
                  {/* Customer Info */}
                  <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-4 mb-4 flex items-center gap-3">
                    <img
                      src={activeDelivery.customerPhoto}
                      alt={activeDelivery.customer}
                      className="w-12 h-12 rounded-full"
                    />
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground">
                        {activeDelivery.customer}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {activeDelivery.address}
                      </p>
                    </div>
                    <button
                      onClick={() => window.open(`tel:${activeDelivery.phone}`)}
                      className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
                    >
                      <PhoneCall className="w-5 h-5 text-green-600" />
                    </button>
                  </div>

                  <ItemChecklist
                    items={deliveryVerification.items}
                    mode="delivery"
                    onVerifyItem={deliveryVerification.confirmItemDelivered}
                    onReportIssue={(id, issue, notes) =>
                      deliveryVerification.reportDiscrepancy(
                        id,
                        0,
                        issue,
                        notes,
                      )
                    }
                    onScanBarcode={openScannerForItem}
                    progress={{
                      total: deliveryVerification.progress.total,
                      verified: deliveryVerification.progress.delivered,
                      damaged: 0,
                      missing: deliveryVerification.progress.discrepancies,
                      percentage: deliveryVerification.progress.percentage,
                    }}
                    currentScanIndex={currentScanIndex}
                  />

                  {/* Customer Signature Button */}
                  {deliveryVerification.progress.delivered ===
                    deliveryVerification.progress.total && (
                    <Button
                      onClick={() => {
                        setSignatureType("customer");
                        setShowSignature(true);
                      }}
                      className="w-full h-14 mt-4 rounded-2xl bg-gradient-to-r from-green-500 to-teal-500"
                    >
                      <Pen className="w-5 h-5 mr-2" />
                      Customer Sign to Confirm
                    </Button>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <PackageCheck className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-xl font-bold">All Items Verified</h3>
                  <p className="text-muted-foreground">Proceed to next step</p>
                </div>
              )}
            </div>
          )}

          {/* Chat View */}
          {activeView === "chat" && (
            <div className="h-full flex flex-col">
              {/* Chat Target Toggle */}
              <div className="px-4 pt-4 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setChatTarget("customer")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
                      chatTarget === "customer"
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm font-medium">Customer</span>
                  </button>
                  <button
                    onClick={() => setChatTarget("admin")}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl transition-colors ${
                      chatTarget === "admin"
                        ? "bg-purple-100 dark:bg-purple-900/30 text-purple-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Radio className="w-4 h-4" />
                    <span className="text-sm font-medium">Dispatch</span>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 pb-60">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.from === "driver" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-2.5 rounded-2xl ${
                        msg.from === "driver"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : msg.from === "system"
                            ? "bg-muted/50 text-muted-foreground text-xs italic"
                            : msg.from === "admin"
                              ? "bg-purple-100 dark:bg-purple-900/30 text-foreground rounded-bl-md"
                              : "bg-muted text-foreground rounded-bl-md"
                      }`}
                    >
                      {msg.senderName && msg.from !== "driver" && (
                        <p className="text-xs font-medium opacity-70 mb-1">
                          {msg.senderName}
                        </p>
                      )}
                      <p className="text-sm">{msg.text}</p>
                      <p
                        className={`text-[10px] mt-1 ${msg.from === "driver" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                      >
                        {msg.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Bottom Sheet - Positioned above bottom nav */}
      <div
        className="absolute left-0 right-0 z-20 bg-card rounded-t-3xl shadow-2xl"
        style={{
          bottom: "64px",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Handle */}
        <div className="flex justify-center py-3">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Chat Input (when in chat view) */}
        {activeView === "chat" && (
          <div className="px-4 pb-4">
            {/* Quick Replies */}
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-hide">
              {quickMessages.map((msg) => (
                <button
                  key={msg}
                  onClick={() => handleSendMessage(msg)}
                  className="flex-shrink-0 px-3 py-1.5 rounded-full bg-muted text-xs font-medium"
                >
                  {msg}
                </button>
              ))}
            </div>

            <div className="flex gap-2">
              <input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && handleSendMessage(inputMessage)
                }
                placeholder={`Message ${chatTarget === "customer" ? activeDelivery.customer : "Dispatch"}...`}
                className="flex-1 h-12 px-4 rounded-xl bg-muted text-foreground placeholder:text-muted-foreground outline-none"
              />
              <Button
                size="icon"
                className="h-12 w-12 rounded-xl"
                onClick={() => handleSendMessage(inputMessage)}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}

        {/* Delivery Info & Actions (when not in chat) */}
        {activeView !== "chat" && (
          <div className="px-4 pb-4">
            {/* Customer Preview */}
            <div className="flex items-center gap-3 mb-4">
              <img
                src={activeDelivery.customerPhoto}
                alt={activeDelivery.customer}
                className="w-12 h-12 rounded-full border-2 border-primary"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">
                    {activeDelivery.customer}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold text-white ${statusColors[activeDelivery.status]}`}
                  >
                    {statusLabels[activeDelivery.status]}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {activeDelivery.address}
                </p>
              </div>

              {/* Quick Contact */}
              <div className="flex gap-2">
                <button
                  onClick={() => window.open(`tel:${activeDelivery.phone}`)}
                  className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center"
                >
                  <Phone className="w-4 h-4 text-green-600" />
                </button>
                <button
                  onClick={() => {
                    setActiveView("chat");
                    setChatTarget("customer");
                  }}
                  className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center"
                >
                  <MessageSquare className="w-4 h-4 text-blue-600" />
                </button>
              </div>
            </div>

            {/* Special Instructions */}
            {activeDelivery.specialInstructions && (
              <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3 mb-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5" />
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      {activeDelivery.specialInstructions}
                    </p>
                    {activeDelivery.gateCode && (
                      <p className="text-xs text-amber-600 mt-1">
                        Gate:{" "}
                        <span className="font-mono font-bold">
                          {activeDelivery.gateCode}
                        </span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Main Action Button */}
            {activeDelivery.status !== "delivered" && (
              <Button
                onClick={() => {
                  if (activeDelivery.status === "pending") {
                    pickupVerification.startPickup();
                    advanceStatus();
                    setActiveView("items");
                  } else if (activeDelivery.status === "picking") {
                    if (!pickupVerification.allVerified) {
                      toast({
                        title: "Verify All Items",
                        description: "Please verify all items before signing",
                        variant: "destructive",
                      });
                      setActiveView("items");
                      return;
                    }
                    if (!pickupVerification.driverSignature) {
                      setSignatureType("driver");
                      setShowSignature(true);
                      return;
                    }
                    advanceStatus();
                  } else if (activeDelivery.status === "picked") {
                    // Launch native navigation when starting delivery
                    import("@/lib/navigation-utils").then(
                      ({ launchNavigation }) => {
                        launchNavigation({
                          destinationLat: activeDelivery.location.lat,
                          destinationLng: activeDelivery.location.lng,
                          destinationAddress: fullAddress,
                        });
                      },
                    );
                    // Advance to en_route and switch to map view
                    advanceStatus();
                    setActiveView("map");
                    // Add AI insight about the route
                    addInsight(
                      "traffic",
                      `🚗 Navigating to ${activeDelivery.suburb} • ETA ${activeDelivery.eta} • ${activeDelivery.distance} km`,
                      "high",
                      undefined,
                      undefined,
                      10000,
                    );
                    toast({
                      title: "🚗 Navigation Started",
                      description: `Opening maps to ${activeDelivery.customer}`,
                    });
                    impact("medium");
                  } else if (activeDelivery.status === "arrived") {
                    deliveryVerification.startDelivery();
                    advanceStatus();
                    setActiveView("items");
                  } else if (activeDelivery.status === "delivering") {
                    if (
                      deliveryVerification.progress.delivered <
                      deliveryVerification.progress.total
                    ) {
                      toast({
                        title: "Confirm All Items",
                        description: "Please confirm all items with customer",
                        variant: "destructive",
                      });
                      setActiveView("items");
                      return;
                    }
                    setSignatureType("customer");
                    setShowSignature(true);
                  } else {
                    advanceStatus();
                  }
                }}
                className="w-full h-14 rounded-2xl text-base font-bold gap-2"
                size="lg"
              >
                {activeDelivery.status === "pending" && (
                  <>
                    <Package className="w-5 h-5" />
                    START PICKUP
                  </>
                )}
                {activeDelivery.status === "picking" && (
                  <>
                    {pickupVerification.allVerified ? (
                      <Pen className="w-5 h-5" />
                    ) : (
                      <Package className="w-5 h-5" />
                    )}
                    {pickupVerification.allVerified
                      ? "SIGN PICKUP"
                      : `VERIFY (${pickupVerification.progress.verified}/${pickupVerification.progress.total})`}
                  </>
                )}
                {activeDelivery.status === "picked" && (
                  <>
                    <Navigation className="w-5 h-5" />
                    START DELIVERY
                  </>
                )}
                {activeDelivery.status === "en_route" && (
                  <>
                    <Navigation className="w-5 h-5" />
                    ARRIVED
                  </>
                )}
                {activeDelivery.status === "arrived" && (
                  <>
                    <PackageCheck className="w-5 h-5" />
                    START HANDOVER
                  </>
                )}
                {activeDelivery.status === "delivering" && (
                  <>
                    <Pen className="w-5 h-5" />
                    GET SIGNATURE
                  </>
                )}
              </Button>
            )}

            {/* Completed State */}
            {activeDelivery.status === "delivered" && (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle className="w-12 h-12 text-green-500" />
                <span className="font-bold text-lg text-green-600">
                  Delivery Complete!
                </span>
                <Button
                  variant="outline"
                  onClick={() => navigate("/driver")}
                  className="w-full h-12 rounded-xl"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Return to Dashboard
                </Button>
              </div>
            )}

            {/* Secondary Actions */}
            {activeDelivery.status !== "delivered" && (
              <div className="grid grid-cols-4 gap-2 mt-4">
                <button
                  onClick={() => setShowActions(true)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted"
                >
                  <Menu className="w-5 h-5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">
                    More
                  </span>
                </button>
                <button
                  onClick={() => {
                    // Find first unverified item
                    const unverifiedIndex = pickupVerification.items.findIndex(
                      (item) => !item.verified,
                    );
                    if (unverifiedIndex !== -1) {
                      openScannerForItem(unverifiedIndex);
                    } else {
                      toast({
                        title: "All Items Verified",
                        description: "Ready to sign",
                      });
                    }
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-blue-100 dark:bg-blue-900/30"
                >
                  <ScanLine className="w-5 h-5 text-blue-600" />
                  <span className="text-[10px] text-blue-600">Scan</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("chat");
                    setChatTarget("admin");
                  }}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl bg-purple-100 dark:bg-purple-900/30"
                >
                  <Headphones className="w-5 h-5 text-purple-600" />
                  <span className="text-[10px] text-purple-600">Dispatch</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fixed Bottom Navigation Bar - Customer App Style */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveView("map")}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors ${
              activeView === "map" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Navigation2
              className={`w-5 h-5 ${activeView === "map" ? "text-primary" : ""}`}
            />
            <span className="text-[10px] font-medium">Map</span>
          </button>

          <button
            onClick={() => setActiveView("items")}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors relative ${
              activeView === "items" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Package
              className={`w-5 h-5 ${activeView === "items" ? "text-primary" : ""}`}
            />
            <span className="text-[10px] font-medium">Items</span>
            {!pickupVerification.allVerified &&
              activeDelivery.status === "picking" && (
                <span className="absolute top-1 right-2 w-2 h-2 bg-amber-500 rounded-full" />
              )}
          </button>

          <button
            onClick={() => {
              impact("medium");
              if (activeDelivery.phone) {
                window.open(`tel:${activeDelivery.phone}`, "_self");
              }
            }}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-green-600"
          >
            <div className="w-10 h-10 -mt-4 bg-green-500 rounded-full flex items-center justify-center shadow-lg">
              <Phone className="w-5 h-5 text-white" />
            </div>
            <span className="text-[10px] font-medium">Call</span>
          </button>

          <button
            onClick={() => {
              setActiveView("chat");
              setChatTarget("customer");
            }}
            className={`flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-colors relative ${
              activeView === "chat" && chatTarget === "customer"
                ? "text-primary"
                : "text-muted-foreground"
            }`}
          >
            <MessageSquare
              className={`w-5 h-5 ${activeView === "chat" ? "text-primary" : ""}`}
            />
            <span className="text-[10px] font-medium">Chat</span>
            {customerMessages.some((m) => !m.read && m.from !== "driver") && (
              <span className="absolute top-1 right-2 w-2 h-2 bg-red-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => setShowActions(true)}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Signature Modal */}
      <AnimatePresence>
        {showSignature && (
          <SignaturePad
            onSave={handleSignatureSave}
            onCancel={() => setShowSignature(false)}
            title={
              signatureType === "driver"
                ? "Driver Pickup Signature"
                : signatureType === "customer"
                  ? "Customer Delivery Signature"
                  : "Warehouse Signature"
            }
            subtitle={
              signatureType === "driver"
                ? "Confirm you have picked up all items"
                : "Customer confirms receipt of all items"
            }
            signerName={
              signatureType === "driver"
                ? "Sipho M."
                : signatureType === "customer"
                  ? activeDelivery.customer
                  : undefined
            }
            signerRole={signatureType}
          />
        )}
      </AnimatePresence>

      {/* Barcode Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="bg-card rounded-3xl w-full max-w-md p-6 text-center"
            >
              {/* Current Item Info */}
              {pickupVerification.items[currentScanIndex] && (
                <div className="mb-4 p-4 bg-primary/10 rounded-2xl">
                  <p className="text-xs text-muted-foreground mb-1">
                    Scan Item {pickupVerification.progress.verified + 1} of{" "}
                    {pickupVerification.progress.total}
                  </p>
                  <h3 className="font-bold text-lg text-foreground">
                    {pickupVerification.items[currentScanIndex].name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Qty: {pickupVerification.items[currentScanIndex].quantity} •{" "}
                    {pickupVerification.items[currentScanIndex].size}
                  </p>
                </div>
              )}

              <div className="w-full h-48 bg-muted rounded-2xl flex items-center justify-center relative overflow-hidden">
                <div className="absolute inset-4 border-2 border-dashed border-primary rounded-xl" />
                <div
                  className="absolute left-0 right-0 h-0.5 bg-red-500 animate-pulse"
                  style={{ top: "50%" }}
                />
                <ScanLine className="w-12 h-12 text-muted-foreground" />
              </div>

              <p className="mt-4 text-sm text-muted-foreground">
                Position barcode within frame
              </p>

              {/* Demo Scan Button - Only for expected item */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Demo: Tap to simulate scan
                </p>
                {pickupVerification.items[currentScanIndex] && (
                  <Button
                    onClick={() =>
                      handleBarcodeScan(
                        pickupVerification.items[currentScanIndex].barcode ||
                          "",
                      )
                    }
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500"
                  >
                    <ScanLine className="w-4 h-4 mr-2" />
                    Scan:{" "}
                    {pickupVerification.items[currentScanIndex].name.slice(
                      0,
                      25,
                    )}
                    ...
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                onClick={() => setShowScanner(false)}
                className="w-full mt-4 h-12 rounded-xl"
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice Command Modal */}
      <AnimatePresence>
        {showVoiceModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center"
            onClick={() => setShowVoiceModal(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-3xl p-8 mx-4 text-center max-w-sm"
            >
              <motion.button
                onTouchStart={startListening}
                onTouchEnd={stopListening}
                onMouseDown={startListening}
                onMouseUp={stopListening}
                animate={isListening ? { scale: [1, 1.1, 1] } : {}}
                transition={{ repeat: Infinity, duration: 1 }}
                className={`w-24 h-24 rounded-full mx-auto mb-6 flex items-center justify-center ${
                  isListening
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Mic className="w-10 h-10" />
              </motion.button>

              <h3 className="text-xl font-bold text-foreground mb-2">
                {isListening ? "Listening..." : "Hold to speak"}
              </h3>

              <p className="text-sm text-muted-foreground mb-4">
                {lastCommand ||
                  'Try: "Call customer", "Navigate", "Mark arrived"'}
              </p>

              <div className="flex flex-wrap gap-2 justify-center">
                {["Call customer", "Navigate", "Arrived", "Help"].map((cmd) => (
                  <span
                    key={cmd}
                    className="px-3 py-1 rounded-full bg-muted text-xs text-muted-foreground"
                  >
                    {cmd}
                  </span>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* More Actions Sheet */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50"
            onClick={() => setShowActions(false)}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl p-4 safe-area-bottom"
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />

              {/* AI Assistant Section */}
              <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 rounded-2xl p-4 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">
                      AI Route Assistant
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Powered by smart algorithms
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => {
                      addInsight(
                        "optimization",
                        "🚀 Re-optimizing route based on current traffic...",
                        "high",
                        undefined,
                        undefined,
                        5000,
                      );
                      setShowActions(false);
                      impact("medium");
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/50 dark:bg-white/10"
                  >
                    <Route className="w-4 h-4 text-purple-500" />
                    <span className="text-xs font-medium">Optimize Route</span>
                  </button>
                  <button
                    onClick={() => {
                      addInsight(
                        "traffic",
                        "🚦 Checking traffic conditions on your route...",
                        "medium",
                        undefined,
                        undefined,
                        5000,
                      );
                      setShowActions(false);
                      impact("medium");
                    }}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white/50 dark:bg-white/10"
                  >
                    <Navigation className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-medium">Check Traffic</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted">
                  <AlertTriangle className="w-6 h-6 text-red-500" />
                  <span className="text-xs font-medium">Report Issue</span>
                </button>
                <button
                  onClick={() => {
                    navigate("/driver");
                    setShowActions(false);
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted"
                >
                  <Home className="w-6 h-6 text-blue-500" />
                  <span className="text-xs font-medium">Dashboard</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted">
                  <FileText className="w-6 h-6 text-amber-500" />
                  <span className="text-xs font-medium">View Audit</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted">
                  <Shield className="w-6 h-6 text-green-500" />
                  <span className="text-xs font-medium">Safety</span>
                </button>
                <button className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-muted">
                  <Clipboard className="w-6 h-6 text-purple-500" />
                  <span className="text-xs font-medium">Pickup Record</span>
                </button>
                <button
                  onClick={() => {
                    setActiveView("chat");
                    setChatTarget("admin");
                    setShowActions(false);
                  }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-purple-100 dark:bg-purple-900/30"
                >
                  <Radio className="w-6 h-6 text-purple-600" />
                  <span className="text-xs font-medium text-purple-600">
                    Dispatch
                  </span>
                </button>
              </div>

              <Button
                variant="outline"
                className="w-full mt-4 h-12 rounded-xl"
                onClick={() => setShowActions(false)}
              >
                Cancel
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverActiveUber;
