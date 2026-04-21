import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Navigation2,
  Volume2,
  VolumeX,
  X,
  MapPin,
  Clock,
  ArrowRight,
  Phone,
  MessageSquare,
  Target,
  Gauge,
  Mic,
  MicOff,
  StopCircle,
  Map,
  CheckCircle,
  ArrowLeft,
  Maximize,
  Minimize,
  PhoneIncoming,
  PhoneOff,
} from "lucide-react";
import InAppMapNavigation from "@/components/InAppMapNavigation";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { toast } from "@/hooks/use-toast";

interface NavigationData {
  orderId: string;
  customer: string;
  address: string;
  phone: string;
  items: number;
  destination: { lat: number; lng: number };
}

const DriveScreen = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { impact } = useHaptics();

  // Parse navigation data from URL params
  const navData: NavigationData = {
    orderId: searchParams.get("orderId") || "ORD-2401",
    customer: searchParams.get("customer") || "Thabo M.",
    address: searchParams.get("address") || "42 Rivonia Road, Sandton",
    phone: searchParams.get("phone") || "+27 82 123 4567",
    items: parseInt(searchParams.get("items") || "4"),
    destination: {
      lat: parseFloat(searchParams.get("lat") || "-26.1076"),
      lng: parseFloat(searchParams.get("lng") || "28.0567"),
    },
  };

  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [voiceCommandsEnabled, setVoiceCommandsEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showEndDriveModal, setShowEndDriveModal] = useState(false);
  const [showRouteOptions, setShowRouteOptions] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<
    "fastest" | "shortest" | "avoid-traffic"
  >("fastest");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{
    name: string;
    number: string;
  } | null>(null);
  const recognitionRef = useRef<any>(null);

  const [currentLocation, setCurrentLocation] = useState({
    lat: -26.0875,
    lng: 28.0432,
  });
  const [distanceToDestination, setDistanceToDestination] = useState(3.2);
  const [eta, setEta] = useState(12);
  const [currentInstruction, setCurrentInstruction] = useState(
    "Head northwest on Rivonia Road",
  );
  const [nextTurnDistance, setNextTurnDistance] = useState("500m");
  const [speed, setSpeed] = useState(45);

  // Route options with colors for visualization
  const routeOptions = [
    {
      id: "fastest" as const,
      name: "Fastest Route",
      time: "12 min",
      distance: "3.2 km",
      color: "#FF6B00",
    },
    {
      id: "shortest" as const,
      name: "Shortest Route",
      time: "15 min",
      distance: "2.8 km",
      color: "#0066FF",
    },
    {
      id: "avoid-traffic" as const,
      name: "Avoid Traffic",
      time: "14 min",
      distance: "3.5 km",
      color: "#00CC66",
    },
  ];

  // Simulate navigation updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate movement
      const newLat = currentLocation.lat + (Math.random() - 0.5) * 0.0002;
      const newLng = currentLocation.lng + (Math.random() - 0.5) * 0.0002;
      setCurrentLocation({ lat: newLat, lng: newLng });

      // Update distance
      setDistanceToDestination((prev) => Math.max(0.1, prev - 0.1));
      setEta((prev) => Math.max(1, prev - 1));
      setSpeed(Math.floor(Math.random() * 20) + 40);

      // Update turn distance
      const turnDist = Math.max(50, Math.floor(Math.random() * 500));
      setNextTurnDistance(`${turnDist}m`);
    }, 3000);

    return () => clearInterval(interval);
  }, [currentLocation]);

  // Voice guidance
  useEffect(() => {
    if (voiceEnabled && nextTurnDistance === "100m") {
      const speech = new SpeechSynthesisUtterance(
        "In 100 meters, turn right onto Rivonia Road",
      );
      window.speechSynthesis.speak(speech);
    }
  }, [voiceEnabled, nextTurnDistance]);

  // Voice command recognition
  const startVoiceCommands = useCallback(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Voice Commands Not Supported",
        description: "Your device doesn't support voice commands",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-ZA";

    recognition.onresult = (event: any) => {
      const command =
        event.results[event.results.length - 1][0].transcript.toLowerCase();

      if (
        command.includes("call customer") ||
        command.includes("phone customer")
      ) {
        handleContact("call");
      } else if (command.includes("message") || command.includes("text")) {
        handleContact("message");
      } else if (command.includes("mute") || command.includes("quiet")) {
        setVoiceEnabled(false);
        impact("light");
        toast({
          title: "Voice Muted",
          description: "Navigation audio turned off",
        });
      } else if (command.includes("unmute") || command.includes("speak")) {
        setVoiceEnabled(true);
        impact("light");
        toast({
          title: "Voice Enabled",
          description: "Navigation audio turned on",
        });
      } else if (command.includes("route") || command.includes("alternative")) {
        setShowRouteOptions(true);
        impact("light");
      } else if (
        command.includes("end drive") ||
        command.includes("stop navigation")
      ) {
        setShowEndDriveModal(true);
        impact("medium");
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      if (voiceCommandsEnabled) {
        recognition.start(); // Restart if still enabled
      }
    };

    recognition.start();
    recognitionRef.current = recognition;
    setIsListening(true);
  }, [voiceCommandsEnabled, impact]);

  const stopVoiceCommands = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  // Toggle voice commands
  const handleToggleVoiceCommands = () => {
    impact("light");
    if (voiceCommandsEnabled) {
      stopVoiceCommands();
      setVoiceCommandsEnabled(false);
      toast({
        title: "Voice Commands Off",
        description: "Tap the mic button to enable",
      });
    } else {
      setVoiceCommandsEnabled(true);
      startVoiceCommands();
      toast({
        title: "Voice Commands Active",
        description: "Say 'call customer', 'route options', or 'end drive'",
      });
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      stopVoiceCommands();
    };
  }, [stopVoiceCommands]);

  const handleToggleVoice = () => {
    impact("light");
    setVoiceEnabled(!voiceEnabled);
    toast({
      title: voiceEnabled ? "Voice Guidance Off" : "Voice Guidance On",
      description: voiceEnabled
        ? "Turn-by-turn instructions muted"
        : "Voice instructions enabled",
    });
  };

  const handleExitNavigation = () => {
    impact("medium");
    setShowEndDriveModal(true);
  };

  const confirmEndDrive = () => {
    stopVoiceCommands();
    impact("heavy");
    toast({
      title: "Drive Ended",
      description: "Returning to active deliveries",
    });
    navigate("/driver/active");
  };

  const handleRouteChange = (routeId: typeof selectedRoute) => {
    impact("light");
    setSelectedRoute(routeId);
    setShowRouteOptions(false);
    const route = routeOptions.find((r) => r.id === routeId);
    toast({
      title: "Route Changed",
      description: `Switched to ${route?.name} - ${route?.time}`,
    });
  };

  const handleBackNavigation = () => {
    impact("light");
    navigate(-1);
  };

  const handleToggleFullscreen = () => {
    impact("light");
    setIsFullscreen(!isFullscreen);
    toast({
      title: isFullscreen ? "Fullscreen Off" : "Fullscreen On",
      description: isFullscreen
        ? "Controls visible"
        : "Immersive navigation mode",
    });
  };

  const handleAnswerCall = () => {
    impact("medium");
    toast({
      title: "Call Answered",
      description: `Connected to ${incomingCall?.name}`,
    });
    setIncomingCall(null);
  };

  const handleDeclineCall = () => {
    impact("light");
    toast({
      title: "Call Declined",
      description: "Continuing navigation",
    });
    setIncomingCall(null);
  };

  // Simulate incoming call (for demo - in production this would be triggered by actual phone call)
  useEffect(() => {
    // Simulate an incoming call after 10 seconds (for testing)
    const callTimer = setTimeout(() => {
      if (!incomingCall) {
        setIncomingCall({
          name: navData.customer,
          number: navData.phone,
        });
      }
    }, 10000);

    return () => clearTimeout(callTimer);
  }, []);

  const handleContact = (type: "call" | "message") => {
    impact("light");
    toast({
      title: type === "call" ? "Calling Customer" : "Opening Chat",
      description: `${navData.customer} - ${navData.phone}`,
    });
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Full-screen Map with Navigation Night Style */}
      <div className="flex-1 relative">
        <InAppMapNavigation
          driverLocation={currentLocation}
          destination={navData.destination}
          destinationLabel={navData.address}
          driverHeading={0}
          className="w-full h-full"
        />

        {/* Top Status Bar */}
        <div
          className={`absolute top-0 left-0 right-0 transition-all duration-300 ${
            isFullscreen ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <div className="bg-gradient-to-b from-background/95 to-transparent p-4">
            <div className="flex items-center justify-between">
              {/* Left Side - Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackNavigation}
                  className="w-10 h-10 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
                >
                  <ArrowLeft className="w-5 h-5 text-foreground" />
                </button>
                <button
                  onClick={handleExitNavigation}
                  className="w-10 h-10 bg-red-600 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
                >
                  <StopCircle className="w-5 h-5 text-white" />
                </button>
              </div>

              {/* Right Side - Feature Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleVoiceCommands}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-all ${
                    voiceCommandsEnabled
                      ? "bg-green-600 text-white animate-pulse"
                      : "bg-card/80 text-muted-foreground backdrop-blur-sm"
                  }`}
                >
                  {voiceCommandsEnabled ? (
                    <Mic className="w-5 h-5" />
                  ) : (
                    <MicOff className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={handleToggleVoice}
                  className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg transition-colors ${
                    voiceEnabled
                      ? "bg-primary text-primary-foreground"
                      : "bg-card/80 text-muted-foreground backdrop-blur-sm"
                  }`}
                >
                  {voiceEnabled ? (
                    <Volume2 className="w-5 h-5" />
                  ) : (
                    <VolumeX className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={handleToggleFullscreen}
                  className="w-10 h-10 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5 text-foreground" />
                  ) : (
                    <Maximize className="w-5 h-5 text-foreground" />
                  )}
                </button>

                <button
                  onClick={() => {
                    impact("light");
                    setShowRouteOptions(!showRouteOptions);
                  }}
                  className="w-10 h-10 bg-card/80 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg"
                >
                  <Map className="w-5 h-5 text-foreground" />
                </button>

                <div className="px-3 py-1.5 bg-card/80 backdrop-blur-sm rounded-full text-xs font-bold text-foreground shadow-lg">
                  <Gauge className="w-3 h-3 inline mr-1" />
                  {speed} km/h
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Tap to show controls when in fullscreen */}
        {isFullscreen && (
          <button
            onClick={() => setIsFullscreen(false)}
            className="absolute top-4 right-4 px-3 py-1.5 bg-black/50 backdrop-blur-sm rounded-full text-xs text-white"
          >
            Tap for controls
          </button>
        )}

        {/* Voice Command Indicator */}
        {isListening && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute top-20 left-1/2 -translate-x-1/2"
          >
            <div className="bg-green-600/95 backdrop-blur-md text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-xs font-bold">Listening...</span>
            </div>
          </motion.div>
        )}

        {/* Incoming Call Widget */}
        <AnimatePresence>
          {incomingCall && (
            <motion.div
              initial={{ opacity: 0, y: -100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -100 }}
              className="absolute top-20 inset-x-4 z-50"
            >
              <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-2xl p-4 shadow-2xl border-2 border-green-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ repeat: Infinity, duration: 1 }}
                      className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center"
                    >
                      <PhoneIncoming className="w-6 h-6 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-white font-bold text-sm">
                        Incoming Call
                      </p>
                      <p className="text-white/90 text-xs">
                        {incomingCall.name}
                      </p>
                      <p className="text-white/70 text-[10px]">
                        {incomingCall.number}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDeclineCall}
                      className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center shadow-lg"
                    >
                      <PhoneOff className="w-5 h-5 text-white" />
                    </button>
                    <button
                      onClick={handleAnswerCall}
                      className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-lg"
                    >
                      <Phone className="w-5 h-5 text-green-600" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Route Options Panel */}
        <AnimatePresence>
          {showRouteOptions && (
            <motion.div
              initial={{ opacity: 0, x: 300 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 300 }}
              className="absolute top-20 right-4 w-64"
            >
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-foreground">
                    Route Options
                  </h3>
                  <button
                    onClick={() => setShowRouteOptions(false)}
                    className="w-6 h-6 rounded-full bg-muted flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="space-y-2">
                  {routeOptions.map((route) => (
                    <button
                      key={route.id}
                      onClick={() => handleRouteChange(route.id)}
                      className={`w-full p-3 rounded-xl text-left transition-all ${
                        selectedRoute === route.id
                          ? "bg-primary/20 border-2 border-primary"
                          : "bg-muted border-2 border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: route.color }}
                        />
                        <p className="text-xs font-bold text-foreground">
                          {route.name}
                        </p>
                        {selectedRoute === route.id && (
                          <CheckCircle className="w-3.5 h-3.5 text-primary ml-auto" />
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{route.time}</span>
                        <span>•</span>
                        <span>{route.distance}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Custom Markers Overlay - Driver Car & Customer */}
        <div className="absolute inset-0 pointer-events-none">
          {/* Driver Car Icon - Bottom Center */}
          <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2">
            <div className="flex flex-col items-center pointer-events-auto">
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white"
              >
                <svg
                  className="w-6 h-6 text-white"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" />
                </svg>
              </motion.div>
              <div className="mt-1 px-2 py-0.5 bg-green-600 text-white text-[10px] font-bold rounded-full shadow">
                You
              </div>
            </div>
          </div>

          {/* Customer Destination Icon - Ahead */}
          <div className="absolute top-1/3 left-1/2 translate-x-8 -translate-y-8">
            <div className="flex flex-col items-center pointer-events-auto">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 1.5 }}
                className="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center shadow-lg border-4 border-white"
              >
                <MapPin className="w-6 h-6 text-white fill-white" />
              </motion.div>
              <div className="mt-1 px-2 py-0.5 bg-orange-600 text-white text-[10px] font-bold rounded-full shadow whitespace-nowrap">
                {navData.customer}
              </div>
            </div>
          </div>

          {/* Route Line Visualization */}
          <div className="absolute bottom-1/3 left-1/2 w-px h-1/4 bg-gradient-to-t from-transparent via-primary to-transparent opacity-50" />
        </div>

        {/* Turn-by-Turn Instruction Card */}
        {!isFullscreen && (
          <>
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute top-20 left-4 right-4"
            >
              <div className="bg-card/95 backdrop-blur-md rounded-2xl p-4 shadow-2xl border border-border/50">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center flex-shrink-0">
                    <Navigation2 className="w-6 h-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-foreground mb-1">
                      {nextTurnDistance}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {currentInstruction}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* ETA & Distance Card */}
            <div className="absolute top-20 left-4 right-4 mt-24">
              <div className="flex gap-2">
                <div className="flex-1 bg-green-600/90 backdrop-blur-md rounded-xl p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white" />
                    <div>
                      <p className="text-xs text-white/80">ETA</p>
                      <p className="text-lg font-bold text-white">{eta} min</p>
                    </div>
                  </div>
                </div>
                <div className="flex-1 bg-blue-600/90 backdrop-blur-md rounded-xl p-3 shadow-lg">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-white" />
                    <div>
                      <p className="text-xs text-white/80">Distance</p>
                      <p className="text-lg font-bold text-white">
                        {distanceToDestination.toFixed(1)} km
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom Delivery Info Card */}
      {!isFullscreen && (
        <motion.div
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="bg-card border-t border-border shadow-2xl"
        >
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  Delivering to
                </p>
                <h3 className="text-lg font-bold text-foreground">
                  {navData.customer}
                </h3>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleContact("call")}
                  className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center shadow-lg"
                >
                  <Phone className="w-5 h-5 text-white" />
                </button>
                <button
                  onClick={() => handleContact("message")}
                  className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-lg"
                >
                  <MessageSquare className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <p>{navData.address}</p>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium">{navData.orderId}</span>
                <span>•</span>
                <span>{navData.items} items</span>
              </div>
              <button className="text-xs font-bold text-primary flex items-center gap-1">
                View Order
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* End Drive Confirmation Modal */}
      <AnimatePresence>
        {showEndDriveModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              onClick={() => setShowEndDriveModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50"
            >
              <div className="bg-card rounded-2xl p-6 shadow-2xl border border-border">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <StopCircle className="w-6 h-6 text-red-600" />
                </div>
                <h2 className="text-xl font-bold text-center text-foreground mb-2">
                  End Drive?
                </h2>
                <p className="text-sm text-center text-muted-foreground mb-6">
                  Are you sure you want to stop navigation? You can resume
                  anytime from the active deliveries screen.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      impact("light");
                      setShowEndDriveModal(false);
                    }}
                    className="flex-1 py-3 bg-muted text-foreground rounded-xl font-semibold transition-colors hover:bg-muted/80"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmEndDrive}
                    className="flex-1 py-3 bg-red-600 text-white rounded-xl font-semibold transition-colors hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <StopCircle className="w-4 h-4" />
                    End Drive
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriveScreen;
