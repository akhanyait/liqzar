import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Navigation2,
  Zap,
  Route,
  Clock,
  MapPin,
  TrendingUp,
  Fuel,
  Package,
  AlertCircle,
} from "lucide-react";
import InAppMapNavigation from "@/components/InAppMapNavigation";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { toast } from "@/hooks/use-toast";

interface DeliveryStop {
  id: string;
  orderId: string;
  customer: string;
  address: string;
  items: number;
  location: { lat: number; lng: number };
  eta: string;
  status: "pending" | "current" | "completed";
}

const mockStops: DeliveryStop[] = [
  {
    id: "1",
    orderId: "ORD-2401",
    customer: "Thabo M.",
    address: "42 Rivonia Road, Sandton",
    items: 4,
    location: { lat: -26.1076, lng: 28.0567 },
    eta: "8 min",
    status: "current",
  },
  {
    id: "2",
    orderId: "ORD-2400",
    customer: "Naledi K.",
    address: "12 Oxford Rd, Rosebank",
    items: 2,
    location: { lat: -26.1455, lng: 28.0404 },
    eta: "25 min",
    status: "pending",
  },
];

const LiveRouteScreen = () => {
  const navigate = useNavigate();
  const { impact } = useHaptics();

  const [driverLocation, setDriverLocation] = useState({
    lat: -26.0875,
    lng: 28.0432,
  });
  const [stops, setStops] = useState<DeliveryStop[]>(mockStops);
  const [routeStats, setRouteStats] = useState({
    totalDistance: "15.2 km",
    totalTime: "45 min",
    fuelSaved: "2.1 km",
    efficiency: 87,
    stopsRemaining: 2,
  });

  const currentStop = stops.find((s) => s.status === "current");

  // Simulate location updates
  useEffect(() => {
    const interval = setInterval(() => {
      setDriverLocation((prev) => ({
        lat: prev.lat + (Math.random() - 0.5) * 0.0001,
        lng: prev.lng + (Math.random() - 0.5) * 0.0001,
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const handleStartNavigation = () => {
    if (!currentStop) {
      toast({
        title: "No Active Delivery",
        description: "Please select a delivery to navigate to",
        variant: "destructive",
      });
      return;
    }

    impact("medium");

    // Navigate to full-screen drive mode with params
    const params = new URLSearchParams({
      orderId: currentStop.orderId,
      customer: currentStop.customer,
      address: currentStop.address,
      items: currentStop.items.toString(),
      lat: currentStop.location.lat.toString(),
      lng: currentStop.location.lng.toString(),
      phone: "+27 82 123 4567", // Would come from real data
    });

    navigate(`/driver/drive?${params.toString()}`);
  };

  const mapMarkers = [
    {
      lat: driverLocation.lat,
      lng: driverLocation.lng,
      label: "You",
      color: "green" as const,
      popup: "Your current location",
    },
    ...stops.map((stop, index) => ({
      lat: stop.location.lat,
      lng: stop.location.lng,
      label: `${index + 1}`,
      color: (stop.status === "current"
        ? "orange"
        : stop.status === "completed"
          ? "gray"
          : "blue") as "orange" | "gray" | "blue",
      popup: `${stop.customer} • ${stop.eta}`,
    })),
  ];

  return (
    <div className="fixed inset-0 bg-background z-40 flex flex-col">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => {
            impact("light");
            navigate("/driver/active");
          }}
          className="w-9 h-9 bg-muted rounded-full flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground">Live Route</h1>
          <p className="text-xs text-muted-foreground">
            AI-optimized delivery route
          </p>
        </div>
        <div className="px-2.5 py-1 bg-primary/10 rounded-full">
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">AI</span>
          </div>
        </div>
      </div>

      {/* Map Section */}
      <div className="h-[45vh] relative">
        <InAppMapNavigation
          driverLocation={driverLocation}
          destination={currentStop?.location || driverLocation}
          destinationLabel={currentStop?.address || "No destination"}
          className="w-full h-full"
        />

        {/* Floating Stats */}
        <div className="absolute top-3 left-3 right-3">
          <div className="bg-card/95 backdrop-blur-md rounded-xl p-3 shadow-lg border border-border/50">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Distance
                </p>
                <p className="text-sm font-bold text-foreground">
                  {routeStats.totalDistance}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Est. Time
                </p>
                <p className="text-sm font-bold text-foreground">
                  {routeStats.totalTime}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground mb-0.5">
                  Efficiency
                </p>
                <div className="flex items-center gap-1">
                  <p className="text-sm font-bold text-green-600">
                    {routeStats.efficiency}%
                  </p>
                  <TrendingUp className="w-3 h-3 text-green-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Route Details */}
      <div className="flex-1 bg-background overflow-y-auto">
        <div className="px-4 py-4 space-y-4">
          {/* AI Optimization Banner */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-3"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Route className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-bold text-foreground">
                    Optimized Route
                  </p>
                  <span className="px-1.5 py-0.5 bg-primary/20 text-primary text-[10px] font-bold rounded">
                    AI
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Saved {routeStats.fuelSaved} by avoiding traffic on William
                  Nicol Drive
                </p>
              </div>
              <Fuel className="w-4 h-4 text-green-600" />
            </div>
          </motion.div>

          {/* Delivery Stops */}
          <div>
            <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              Delivery Stops ({routeStats.stopsRemaining})
            </h3>

            <div className="space-y-2">
              {stops.map((stop, index) => (
                <motion.div
                  key={stop.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`rounded-xl border transition-all ${
                    stop.status === "current"
                      ? "bg-primary/5 border-primary/30 shadow-sm"
                      : stop.status === "completed"
                        ? "bg-muted/50 border-border opacity-60"
                        : "bg-card border-border"
                  }`}
                >
                  <div className="p-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                          stop.status === "current"
                            ? "bg-primary text-primary-foreground"
                            : stop.status === "completed"
                              ? "bg-muted text-muted-foreground"
                              : "bg-secondary text-foreground"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-bold text-foreground">
                            {stop.orderId}
                          </p>
                          {stop.status === "current" && (
                            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                              Current
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">
                          {stop.customer}
                        </p>
                        <div className="flex items-start gap-1 text-xs text-muted-foreground">
                          <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0" />
                          <span className="line-clamp-1">{stop.address}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-foreground">
                          {stop.eta}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {stop.items} items
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Traffic Alert */}
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-medium text-amber-900">
                  Traffic Alert
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Moderate traffic on M1 South. Added 5 min to route.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Start Navigation Button */}
      <div className="p-4 bg-card border-t border-border">
        <button
          onClick={handleStartNavigation}
          disabled={!currentStop}
          className="w-full bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground font-semibold py-3.5 rounded-xl flex items-center justify-center gap-2 transition-colors"
        >
          <Navigation2 className="w-5 h-5" />
          Start Turn-by-Turn Navigation
        </button>
      </div>
    </div>
  );
};

export default LiveRouteScreen;
