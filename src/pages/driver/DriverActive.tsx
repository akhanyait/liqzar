import { useState } from "react";
import {
  MapPin,
  Phone,
  Package,
  Clock,
  Navigation,
  ChevronRight,
  Camera,
  QrCode,
  MessageSquare,
  AlertTriangle,
  CheckCircle,
  ArrowRight,
  Send,
  X,
  Map,
  Route,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import LiveMap from "@/components/LiveMap";
import DriverNavigationMap from "@/components/driver/DriverNavigationMap";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/hooks/use-toast";

interface Delivery {
  id: string;
  customer: string;
  address: string;
  phone: string;
  items: number;
  eta: string;
  status: string;
  lat: number;
  lng: number;
  smartEta: { drive: string; traffic: string; handoff: string };
}

const initialDeliveries: Delivery[] = [
  {
    id: "ORD-2401",
    customer: "Thabo M.",
    address: "42 Rivonia Rd, Sandton",
    phone: "+27 82 123 ****",
    items: 4,
    eta: "15 min",
    status: "En Route",
    lat: -26.1076,
    lng: 28.0567,
    smartEta: { drive: "12 min", traffic: "+2 min", handoff: "~1 min" },
  },
  {
    id: "ORD-2400",
    customer: "Naledi K.",
    address: "12 Oxford Rd, Rosebank",
    phone: "+27 83 234 ****",
    items: 2,
    eta: "35 min",
    status: "Picked Up",
    lat: -26.1455,
    lng: 28.0404,
    smartEta: { drive: "28 min", traffic: "+5 min", handoff: "~2 min" },
  },
  {
    id: "ORD-2398",
    customer: "Priya N.",
    address: "88 Umhlanga Rocks Dr",
    phone: "+27 71 456 ****",
    items: 1,
    eta: "1 hr",
    status: "Pending Pickup",
    lat: -26.1295,
    lng: 28.0635,
    smartEta: { drive: "45 min", traffic: "+10 min", handoff: "~1 min" },
  },
];

const statusFlow = [
  "Pending Pickup",
  "Picked Up",
  "En Route",
  "Arrived",
  "Delivered",
];
const pipelineSteps = [
  "Picked",
  "Packed",
  "Dispatched",
  "En Route",
  "Delivered",
];

const statusColors: Record<string, string> = {
  "Pending Pickup": "bg-yellow-100 text-yellow-700",
  "Picked Up": "bg-blue-100 text-blue-700",
  "En Route": "bg-amber-100 text-amber-700",
  Arrived: "bg-purple-100 text-purple-700",
  Delivered: "bg-green-100 text-green-700",
};

const getStepIndex = (status: string) => {
  if (status === "Pending Pickup") return 1;
  if (status === "Picked Up") return 2;
  if (status === "En Route" || status === "Arrived") return 3;
  if (status === "Delivered") return 4;
  return 0;
};

const getNextStatus = (current: string) => {
  const idx = statusFlow.indexOf(current);
  return idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
};

const getNextLabel = (current: string) => {
  const next = getNextStatus(current);
  if (!next) return null;
  if (next === "Picked Up") return "Confirm Pickup";
  if (next === "En Route") return "Start Delivery";
  if (next === "Arrived") return "Mark Arrived";
  if (next === "Delivered") return "Complete Delivery";
  return next;
};

const quickMessages = [
  "I'm outside your gate",
  "Please share gate/building code",
  "I'll be there in 5 minutes",
  "Order ready for handoff",
  "Could not find address, please call me",
];

const issueTypes = [
  { label: "Wrong items in order", icon: "📦" },
  { label: "Damaged goods", icon: "💔" },
  { label: "Customer not available", icon: "🚫" },
  { label: "Gate code needed", icon: "🔑" },
  { label: "Cannot find address", icon: "📍" },
  { label: "Vehicle issue", icon: "🚗" },
];

const DriverActive = () => {
  const [deliveries, setDeliveries] = useState<Delivery[]>(initialDeliveries);
  const [selected, setSelected] = useState<string | null>(null);
  const [showComms, setShowComms] = useState<string | null>(null);
  const [showIssue, setShowIssue] = useState<string | null>(null);
  const [showPOD, setShowPOD] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState<string | null>(null);
  const [mapViewMode, setMapViewMode] = useState<"overview" | "navigation">(
    "overview",
  );
  const [activeNavDelivery, setActiveNavDelivery] = useState<Delivery | null>(
    null,
  );
  const [commsMessages, setCommsMessages] = useState<
    Array<{ from: string; text: string; time: string }>
  >([{ from: "system", text: "Chat started with customer", time: "Now" }]);
  const [customMsg, setCustomMsg] = useState("");

  const advanceStatus = (id: string) => {
    setDeliveries((prev) =>
      prev.map((d) => {
        if (d.id !== id) return d;
        const next = getNextStatus(d.status);
        if (!next) return d;
        toast({
          title: `${id} → ${next}`,
          description: `Delivery status updated`,
        });
        return { ...d, status: next };
      }),
    );
  };

  const handleSendMessage = (orderId: string, msg: string) => {
    if (!msg.trim()) return;
    setCommsMessages((prev) => [
      ...prev,
      { from: "driver", text: msg, time: "Now" },
    ]);
    setCustomMsg("");
    toast({
      title: "Message sent",
      description: `Sent to customer for ${orderId}`,
    });
    // Simulate customer reply
    setTimeout(() => {
      setCommsMessages((prev) => [
        ...prev,
        { from: "customer", text: "Thanks, noted! 👍", time: "Just now" },
      ]);
    }, 1500);
  };

  const handlePOD = (orderId: string) => {
    toast({
      title: "📸 Proof Captured",
      description: `Photo proof saved for ${orderId} with GPS coordinates`,
    });
    setShowPOD(null);
  };

  const handleScan = (orderId: string) => {
    toast({
      title: "✅ QR Verified",
      description: `Order ${orderId} barcode confirmed`,
    });
    setShowScanner(null);
  };

  const handleIssue = (orderId: string, issue: string) => {
    toast({
      title: "🚨 Issue Reported",
      description: `"${issue}" flagged for ${orderId}. Admin notified.`,
      variant: "destructive",
    });
    setShowIssue(null);
  };

  const mapMarkers: Array<{
    lat: number;
    lng: number;
    label: string;
    color: "green" | "orange" | "blue" | "gray";
    popup: string;
  }> = [
    {
      lat: -26.0875,
      lng: 28.0432,
      label: "You",
      color: "green",
      popup: "Your location",
    },
    ...deliveries
      .filter((d) => d.status !== "Delivered")
      .map((d) => ({
        lat: d.lat,
        lng: d.lng,
        label: d.id,
        color: (d.status === "En Route" || d.status === "Arrived"
          ? "orange"
          : d.status === "Picked Up"
            ? "blue"
            : "gray") as "orange" | "blue" | "gray",
        popup: `${d.customer} • ${d.eta}`,
      })),
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-foreground">
          Active Deliveries
        </h2>
        <p className="text-sm text-muted-foreground">
          {deliveries.filter((d) => d.status !== "Delivered").length} deliveries
          remaining
        </p>
      </div>

      {/* Live Map */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-foreground">Live Tracking</h3>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setMapViewMode("overview")}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                  mapViewMode === "overview"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Map className="w-3 h-3 inline mr-1" />
                Overview
              </button>
              <button
                onClick={() => {
                  const activeDelivery =
                    deliveries.find(
                      (d) =>
                        d.status === "En Route" || d.status === "Picked Up",
                    ) || deliveries[0];
                  setActiveNavDelivery(activeDelivery);
                  setMapViewMode("navigation");
                }}
                className={`px-2 py-1 rounded text-[10px] font-bold transition-colors ${
                  mapViewMode === "navigation"
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                <Route className="w-3 h-3 inline mr-1" />
                Navigate
              </button>
            </div>
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold animate-pulse">
              ● LIVE
            </span>
          </div>
        </div>

        {mapViewMode === "overview" ? (
          <LiveMap markers={mapMarkers} height="180px" />
        ) : (
          <DriverNavigationMap
            driverLocation={{ lat: -26.0875, lng: 28.0432 }}
            destination={{
              id: activeNavDelivery?.id || "ORD-0000",
              customer: activeNavDelivery?.customer || "Customer",
              phone: activeNavDelivery?.phone || "+27 82 123 ****",
              address: activeNavDelivery?.address || "",
              lat: activeNavDelivery?.lat || -26.1076,
              lng: activeNavDelivery?.lng || 28.0567,
              eta: "15 min",
              distance: "5.2 km",
              items: 3,
            }}
          />
        )}
      </div>

      {/* Delivery Cards */}
      <div className="space-y-3">
        {deliveries.map((d) => (
          <motion.div
            key={d.id}
            layout
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            <div
              className="p-4 cursor-pointer"
              onClick={() => setSelected(selected === d.id ? null : d.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-foreground">{d.id}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${statusColors[d.status] || "bg-muted text-muted-foreground"}`}
                  >
                    {d.status}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" /> {d.eta}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground transition-transform ${selected === d.id ? "rotate-90" : ""}`}
                  />
                </div>
              </div>

              {/* Pipeline */}
              <div className="flex items-center gap-1 mb-3">
                {pipelineSteps.map((step, i) => {
                  const active = i <= getStepIndex(d.status);
                  return (
                    <div key={step} className="flex-1">
                      <div
                        className={`h-1 rounded-full ${active ? "bg-primary" : "bg-muted"}`}
                      />
                      <p
                        className={`text-[8px] mt-0.5 text-center ${active ? "text-primary font-bold" : "text-muted-foreground"}`}
                      >
                        {step}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-medium text-foreground">{d.customer}</p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <MapPin className="w-3 h-3" /> {d.address}
                </p>
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Package className="w-3 h-3" /> {d.items} items
                </p>
              </div>
            </div>

            {/* Expanded Panel */}
            <AnimatePresence>
              {selected === d.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-border"
                >
                  <div className="p-4 space-y-3">
                    {/* Smart ETA */}
                    <div className="bg-muted/50 rounded-xl p-3">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                        Smart ETA Breakdown
                      </p>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          Drive time
                        </span>
                        <span className="font-medium text-foreground">
                          {d.smartEta.drive}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">
                          Traffic delay
                        </span>
                        <span className="font-medium text-amber-600">
                          {d.smartEta.traffic}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Handoff</span>
                        <span className="font-medium text-foreground">
                          {d.smartEta.handoff}
                        </span>
                      </div>
                    </div>

                    {/* Status Advancement Button */}
                    {d.status !== "Delivered" && (
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          advanceStatus(d.id);
                        }}
                        className="w-full rounded-xl gap-2 bg-primary text-primary-foreground"
                      >
                        <ArrowRight className="w-4 h-4" />
                        {getNextLabel(d.status)}
                      </Button>
                    )}

                    {d.status === "Delivered" && (
                      <div className="flex items-center justify-center gap-2 py-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-bold text-sm">
                          Delivery Complete
                        </span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowComms(d.id);
                        }}
                      >
                        <MessageSquare className="w-3 h-3" /> Message
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`tel:${d.phone}`);
                        }}
                      >
                        <Phone className="w-3 h-3" /> Call
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowScanner(d.id);
                        }}
                      >
                        <QrCode className="w-3 h-3" /> Scan QR
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowPOD(d.id);
                        }}
                      >
                        <Camera className="w-3 h-3" /> POD
                      </Button>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl flex-1 gap-1 text-xs text-destructive border-destructive/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowIssue(d.id);
                        }}
                      >
                        <AlertTriangle className="w-3 h-3" /> Report Issue
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl flex-1 gap-1 text-xs bg-foreground text-background hover:bg-foreground/90"
                        onClick={(e) => {
                          e.stopPropagation();
                        }}
                      >
                        <Navigation className="w-3 h-3" /> Navigate
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* === MODALS === */}

      {/* Comms Modal */}
      <AnimatePresence>
        {showComms && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-card w-full rounded-t-3xl max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <h3 className="font-bold text-foreground">Message Customer</h3>
                <button
                  onClick={() => setShowComms(null)}
                  className="text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-auto p-4 space-y-2 max-h-[40vh]">
                {commsMessages.map((m, i) => (
                  <div
                    key={i}
                    className={`flex ${m.from === "driver" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`px-3 py-2 rounded-2xl text-xs max-w-[75%] ${
                        m.from === "driver"
                          ? "bg-primary text-primary-foreground"
                          : m.from === "customer"
                            ? "bg-muted text-foreground"
                            : "bg-muted/50 text-muted-foreground italic"
                      }`}
                    >
                      {m.text}
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Messages */}
              <div className="px-4 py-2 flex gap-2 overflow-x-auto">
                {quickMessages.map((msg) => (
                  <button
                    key={msg}
                    onClick={() => handleSendMessage(showComms, msg)}
                    className="flex-shrink-0 px-3 py-1.5 bg-muted rounded-full text-[10px] font-medium text-foreground hover:bg-muted/80"
                  >
                    {msg}
                  </button>
                ))}
              </div>

              {/* Custom Input */}
              <div className="p-4 pt-2 flex gap-2">
                <input
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && handleSendMessage(showComms, customMsg)
                  }
                  placeholder="Type a message..."
                  className="flex-1 bg-muted rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <Button
                  size="sm"
                  className="rounded-xl"
                  onClick={() => handleSendMessage(showComms, customMsg)}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Issue Report Modal */}
      <AnimatePresence>
        {showIssue && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-card w-full rounded-t-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">
                  Report Issue — {showIssue}
                </h3>
                <button
                  onClick={() => setShowIssue(null)}
                  className="text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {issueTypes.map((issue) => (
                  <button
                    key={issue.label}
                    onClick={() => handleIssue(showIssue, issue.label)}
                    className="bg-muted rounded-xl p-3 text-left hover:bg-muted/80 transition-colors"
                  >
                    <span className="text-xl mb-1 block">{issue.icon}</span>
                    <span className="text-xs font-medium text-foreground">
                      {issue.label}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* POD Modal */}
      <AnimatePresence>
        {showPOD && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-card w-full rounded-t-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">
                  Proof of Delivery — {showPOD}
                </h3>
                <button
                  onClick={() => setShowPOD(null)}
                  className="text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-2xl h-48 flex flex-col items-center justify-center gap-3 bg-muted/30">
                  <Camera className="w-10 h-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Tap to capture delivery photo
                  </p>
                </div>
                <div className="border-2 border-dashed border-border rounded-2xl h-32 flex flex-col items-center justify-center gap-2 bg-muted/30">
                  <p className="text-xs font-medium text-muted-foreground">
                    Customer Signature Area
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Customer signs here to confirm receipt
                  </p>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">GPS Coordinates</span>
                  <span className="font-mono text-foreground">
                    -26.1076, 28.0567
                  </span>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Timestamp</span>
                  <span className="font-mono text-foreground">
                    {new Date().toLocaleString()}
                  </span>
                </div>
                <Button
                  className="w-full rounded-xl"
                  onClick={() => handlePOD(showPOD)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Confirm & Save POD
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* QR Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-end"
          >
            <motion.div
              initial={{ y: 300 }}
              animate={{ y: 0 }}
              exit={{ y: 300 }}
              className="bg-card w-full rounded-t-3xl p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-foreground">
                  Scan QR / Barcode — {showScanner}
                </h3>
                <button
                  onClick={() => setShowScanner(null)}
                  className="text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-foreground/5 rounded-2xl h-56 flex flex-col items-center justify-center gap-3 relative overflow-hidden">
                  <div className="absolute inset-8 border-2 border-primary rounded-xl" />
                  <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-primary animate-pulse" />
                  <QrCode className="w-12 h-12 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  Point camera at order QR code or barcode to verify
                </p>
                <Button
                  className="w-full rounded-xl"
                  onClick={() => handleScan(showScanner)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" /> Simulate Scan ✓
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverActive;
