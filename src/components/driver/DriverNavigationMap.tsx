import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation,
  Volume2,
  VolumeX,
  MapPin,
  Clock,
  Fuel,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Maximize2,
  Phone,
  MessageSquare,
  Zap,
  TrendingUp,
  CornerUpRight,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  RefreshCw,
  Mic,
  MicOff,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { launchNavigation } from "@/lib/navigation-utils";

interface NavigationStep {
  instruction: string;
  distance: string;
  duration: string;
  icon: "straight" | "left" | "right" | "arrive";
  streetName?: string;
}

interface DeliveryDestination {
  id: string;
  customer: string;
  address: string;
  phone: string;
  lat: number;
  lng: number;
  eta: string;
  distance: string;
  items: number;
  specialInstructions?: string;
}

interface DriverNavigationMapProps {
  destination: DeliveryDestination;
  driverLocation: { lat: number; lng: number };
  onStartNavigation?: () => void;
  onArrived?: () => void;
  onCallCustomer?: () => void;
  onMessageCustomer?: () => void;
}

const mockNavigationSteps: NavigationStep[] = [
  {
    instruction: "Head north on Jan Smuts Ave",
    distance: "400m",
    duration: "1 min",
    icon: "straight",
    streetName: "Jan Smuts Ave",
  },
  {
    instruction: "Turn right onto William Nicol Dr",
    distance: "1.2km",
    duration: "3 min",
    icon: "right",
    streetName: "William Nicol Dr",
  },
  {
    instruction: "Continue straight through intersection",
    distance: "800m",
    duration: "2 min",
    icon: "straight",
  },
  {
    instruction: "Turn left onto Rivonia Rd",
    distance: "600m",
    duration: "2 min",
    icon: "left",
    streetName: "Rivonia Rd",
  },
  {
    instruction: "Arrive at destination on your right",
    distance: "50m",
    duration: "30 sec",
    icon: "arrive",
  },
];

const trafficConditions = [
  { segment: "Jan Smuts Ave", status: "clear", delay: 0 },
  { segment: "William Nicol Dr", status: "moderate", delay: 2 },
  { segment: "Rivonia Rd", status: "busy", delay: 5 },
];

const DriverNavigationMap = ({
  destination,
  driverLocation,
  onStartNavigation,
  onArrived,
  onCallCustomer,
  onMessageCustomer,
}: DriverNavigationMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceCommand, setVoiceCommand] = useState<string | null>(null);
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [eta, setEta] = useState("15 min");
  const [trafficDelay, setTrafficDelay] = useState(2);

  // Initialize map
  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    const map = L.map(mapRef.current, {
      zoomControl: false,
      attributionControl: false,
    }).setView([driverLocation.lat, driverLocation.lng], 15);

    // Dark style map for premium look
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    ).addTo(map);

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update markers and route
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        map.removeLayer(layer);
      }
    });

    // Driver marker (pulsing blue dot like Uber)
    const driverIcon = L.divIcon({
      className: "",
      html: `
        <div style="position:relative">
          <div style="width:24px;height:24px;background:linear-gradient(135deg,#3b82f6,#1d4ed8);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)">
            <div style="position:absolute;inset:4px;background:white;border-radius:50%"></div>
          </div>
          <div style="position:absolute;inset:-8px;border:2px solid rgba(59,130,246,0.5);border-radius:50%;animation:pulse 2s infinite"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
    L.marker([driverLocation.lat, driverLocation.lng], {
      icon: driverIcon,
    }).addTo(map);

    // Destination marker (gold pin)
    const destIcon = L.divIcon({
      className: "",
      html: `
        <div style="width:32px;height:40px;display:flex;flex-direction:column;align-items:center">
          <div style="width:24px;height:24px;background:linear-gradient(135deg,#d4a520,#b8860b);border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center">
            <span style="color:white;font-size:12px;font-weight:bold">${destination.items}</span>
          </div>
          <div style="width:4px;height:12px;background:linear-gradient(#b8860b,transparent);border-radius:0 0 2px 2px"></div>
        </div>
      `,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });
    const destMarker = L.marker([destination.lat, destination.lng], {
      icon: destIcon,
    }).addTo(map);
    destMarker.bindPopup(
      `<b>${destination.customer}</b><br/>${destination.address}`,
    );

    // Route line (animated gradient)
    const routeCoords: [number, number][] = [
      [driverLocation.lat, driverLocation.lng],
      [driverLocation.lat - 0.005, driverLocation.lng + 0.008],
      [driverLocation.lat - 0.012, driverLocation.lng + 0.01],
      [destination.lat, destination.lng],
    ];

    L.polyline(routeCoords, {
      color: "#d4a520",
      weight: 5,
      opacity: 0.9,
      lineCap: "round",
    }).addTo(map);

    // Fit bounds
    const bounds = L.latLngBounds(
      [driverLocation.lat, driverLocation.lng],
      [destination.lat, destination.lng],
    );
    map.fitBounds(bounds, { padding: [50, 50] });

    // Add traffic overlay indicators
    trafficConditions.forEach((tc, i) => {
      if (tc.status !== "clear") {
        const lat = driverLocation.lat - 0.004 * (i + 1);
        const lng = driverLocation.lng + 0.003 * (i + 1);
        L.circleMarker([lat, lng], {
          radius: 8,
          fillColor: tc.status === "moderate" ? "#f59e0b" : "#ef4444",
          fillOpacity: 0.7,
          stroke: false,
        })
          .addTo(map)
          .bindPopup(`${tc.segment}: ${tc.status} (+${tc.delay} min)`);
      }
    });
  }, [driverLocation, destination]);

  // Simulate AI suggestions
  useEffect(() => {
    const suggestions = [
      "🚦 Traffic clearing on William Nicol Dr - ETA improving",
      "💡 Alternative route via Sandton Dr saves 3 min",
      "📍 Customer usually tips well - ensure quality service",
      "⚡ You're 15% ahead of schedule - great pace!",
      "🎯 This area has high demand - expect more orders soon",
    ];

    const timer = setInterval(() => {
      if (isNavigating && Math.random() > 0.7) {
        setAiSuggestion(
          suggestions[Math.floor(Math.random() * suggestions.length)],
        );
        setTimeout(() => setAiSuggestion(null), 5000);
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [isNavigating]);

  // Voice command simulation
  const processVoiceCommand = (command: string) => {
    const lowerCommand = command.toLowerCase();
    if (lowerCommand.includes("call") || lowerCommand.includes("phone")) {
      onCallCustomer?.();
      return "Calling customer...";
    }
    if (lowerCommand.includes("message") || lowerCommand.includes("text")) {
      onMessageCustomer?.();
      return "Opening message...";
    }
    if (lowerCommand.includes("arrived") || lowerCommand.includes("here")) {
      onArrived?.();
      return "Marking as arrived...";
    }
    if (
      lowerCommand.includes("alternative") ||
      lowerCommand.includes("different route")
    ) {
      return "Finding alternative route...";
    }
    if (lowerCommand.includes("traffic")) {
      return `Current traffic: ${trafficDelay} min delay on route`;
    }
    return "Command not recognized. Try: 'Call customer', 'Find alternative route', or 'Mark as arrived'";
  };

  const handleVoiceToggle = () => {
    if (isListening) {
      // Simulate voice recognition result
      const mockCommands = [
        "Call customer",
        "What's the traffic like?",
        "Find alternative route",
      ];
      const command =
        mockCommands[Math.floor(Math.random() * mockCommands.length)];
      setVoiceCommand(command);
      const response = processVoiceCommand(command);
      setTimeout(() => {
        setVoiceCommand(response);
        setTimeout(() => setVoiceCommand(null), 2000);
      }, 1000);
    }
    setIsListening(!isListening);
  };

  const getDirectionIcon = (icon: string) => {
    switch (icon) {
      case "left":
        return <ArrowLeft className="w-6 h-6" />;
      case "right":
        return <ArrowRight className="w-6 h-6" />;
      case "arrive":
        return <MapPin className="w-6 h-6" />;
      default:
        return <ArrowUp className="w-6 h-6" />;
    }
  };

  const currentNavStep = mockNavigationSteps[currentStep];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-border transition-all duration-300 ${isExpanded ? "h-[70vh]" : "h-[300px]"}`}
    >
      {/* Map */}
      <div ref={mapRef} className="absolute inset-0" />

      {/* Top overlay - ETA and controls */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-black/70 to-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-card/95 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg">
              <p className="text-[10px] text-muted-foreground font-medium">
                ARRIVING IN
              </p>
              <p className="text-xl font-bold text-foreground">{eta}</p>
              {trafficDelay > 0 && (
                <p className="text-[10px] text-amber-500 font-medium">
                  +{trafficDelay} min traffic
                </p>
              )}
            </div>
            <div className="bg-card/95 backdrop-blur-md rounded-xl px-3 py-2 shadow-lg">
              <p className="text-[10px] text-muted-foreground font-medium">
                DISTANCE
              </p>
              <p className="text-lg font-bold text-foreground">
                {destination.distance}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-full ${voiceEnabled ? "bg-primary text-primary-foreground" : "bg-card/95 text-muted-foreground"}`}
            >
              {voiceEnabled ? (
                <Volume2 className="w-4 h-4" />
              ) : (
                <VolumeX className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 rounded-full bg-card/95 text-foreground"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* AI Suggestion bubble */}
      <AnimatePresence>
        {aiSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-20 left-3 right-3 z-20"
          >
            <div className="bg-primary/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary-foreground flex-shrink-0" />
              <p className="text-sm text-primary-foreground font-medium">
                {aiSuggestion}
              </p>
              <button onClick={() => setAiSuggestion(null)} className="ml-auto">
                <X className="w-4 h-4 text-primary-foreground/70" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice command indicator */}
      <AnimatePresence>
        {isListening && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30"
          >
            <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center animate-pulse">
              <Mic className="w-10 h-10 text-primary-foreground" />
            </div>
            <p className="text-center text-white font-bold mt-2">
              Listening...
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice command result */}
      <AnimatePresence>
        {voiceCommand && !isListening && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-1/3 left-1/2 -translate-x-1/2 z-30"
          >
            <div className="bg-card/95 backdrop-blur-md rounded-xl px-4 py-3 shadow-lg">
              <p className="text-sm text-foreground font-medium">
                {voiceCommand}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom navigation panel */}
      <div className="absolute bottom-0 left-0 right-0 z-10">
        {/* Turn-by-turn directions */}
        {isNavigating && (
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-card/95 backdrop-blur-md border-t border-border rounded-t-2xl overflow-hidden"
          >
            {/* Current instruction */}
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-primary flex items-center justify-center text-primary-foreground">
                  {getDirectionIcon(currentNavStep.icon)}
                </div>
                <div className="flex-1">
                  <p className="text-lg font-bold text-foreground">
                    {currentNavStep.instruction}
                  </p>
                  {currentNavStep.streetName && (
                    <p className="text-sm text-primary font-medium">
                      {currentNavStep.streetName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {currentNavStep.distance} • {currentNavStep.duration}
                  </p>
                </div>
              </div>
            </div>

            {/* Upcoming steps (collapsible) */}
            <button
              onClick={() => setShowAllSteps(!showAllSteps)}
              className="w-full px-4 py-2 flex items-center justify-between text-sm text-muted-foreground hover:bg-muted/50"
            >
              <span>
                {mockNavigationSteps.length - currentStep - 1} more steps
              </span>
              {showAllSteps ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronUp className="w-4 h-4" />
              )}
            </button>

            <AnimatePresence>
              {showAllSteps && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: "auto" }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  {mockNavigationSteps.slice(currentStep + 1).map((step, i) => (
                    <div
                      key={i}
                      className="px-4 py-3 border-t border-border/30 flex items-center gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        {getDirectionIcon(step.icon)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {step.instruction}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {step.distance}
                        </p>
                      </div>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quick actions */}
            <div className="p-3 flex items-center gap-2 border-t border-border/50">
              <button
                onClick={handleVoiceToggle}
                className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-colors ${
                  isListening
                    ? "bg-red-500 text-white"
                    : "bg-muted text-foreground"
                }`}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                {isListening ? "Stop" : "Voice"}
              </button>
              <button
                onClick={onCallCustomer}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Phone className="w-4 h-4" /> Call
              </button>
              <button
                onClick={onMessageCustomer}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground flex items-center justify-center gap-2 text-sm font-bold"
              >
                <MessageSquare className="w-4 h-4" /> Text
              </button>
              <button
                onClick={onArrived}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground flex items-center justify-center gap-2 text-sm font-bold"
              >
                <Check className="w-4 h-4" /> Arrived
              </button>
            </div>
          </motion.div>
        )}

        {/* Start navigation button */}
        {!isNavigating && (
          <div className="p-4 bg-card/95 backdrop-blur-md border-t border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-foreground">
                  {destination.customer}
                </p>
                <p className="text-sm text-muted-foreground">
                  {destination.address}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">
                  {destination.items} items
                </p>
              </div>
            </div>

            {destination.specialInstructions && (
              <div className="mb-3 p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <p className="text-xs text-yellow-600 font-medium">
                  📝 {destination.specialInstructions}
                </p>
              </div>
            )}

            <button
              onClick={() => {
                setIsNavigating(true);
                onStartNavigation?.();
                // Launch native maps app with destination
                launchNavigation({
                  destinationLat: destination.lat,
                  destinationLng: destination.lng,
                  destinationAddress: destination.address,
                });
              }}
              className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg flex items-center justify-center gap-2"
            >
              <Navigation className="w-5 h-5" /> Start Navigation
            </button>
          </div>
        )}
      </div>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.5; }
          50% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default DriverNavigationMap;
