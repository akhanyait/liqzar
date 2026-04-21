import { useState, useEffect, useCallback, useRef } from "react";

interface Location {
  lat: number;
  lng: number;
}

interface Delivery {
  id: string;
  customer: string;
  address: string;
  phone: string;
  items: number;
  priority: "high" | "medium" | "low";
  timeWindow?: { start: string; end: string };
  location: Location;
  estimatedTime?: number;
  distance?: number;
  specialInstructions?: string;
}

interface RouteSegment {
  from: Location;
  to: Location;
  distance: number;
  duration: number;
  trafficLevel: "clear" | "moderate" | "heavy" | "standstill";
  trafficDelay: number;
  roadType: "highway" | "arterial" | "residential";
}

interface OptimizedRoute {
  deliveries: Delivery[];
  totalDistance: number;
  totalDuration: number;
  segments: RouteSegment[];
  savings: {
    distance: number;
    time: number;
    fuel: number;
  };
  score: number;
}

interface TrafficUpdate {
  location: Location;
  severity: "minor" | "moderate" | "severe";
  delayMinutes: number;
  description: string;
  affectsRoute: boolean;
  alternativeAvailable: boolean;
}

interface AIInsight {
  id: string;
  type:
    | "optimization"
    | "traffic"
    | "customer"
    | "earnings"
    | "safety"
    | "efficiency";
  message: string;
  action?: () => void;
  actionLabel?: string;
  priority: "low" | "medium" | "high";
  expiresAt?: number;
}

// Haversine distance calculation
const calculateDistance = (from: Location, to: Location): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((from.lat * Math.PI) / 180) *
      Math.cos((to.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Estimate travel time based on distance and road type
const estimateTravelTime = (
  distance: number,
  roadType: "highway" | "arterial" | "residential",
): number => {
  const speeds = { highway: 80, arterial: 40, residential: 25 }; // km/h
  return (distance / speeds[roadType]) * 60; // minutes
};

// Nearest neighbor algorithm for route optimization
const optimizeRouteNearestNeighbor = (
  start: Location,
  deliveries: Delivery[],
): Delivery[] => {
  if (deliveries.length <= 1) return deliveries;

  const remaining = [...deliveries];
  const optimized: Delivery[] = [];
  let current = start;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      // Factor in priority (high priority gets distance bonus)
      const priorityMultiplier =
        remaining[i].priority === "high"
          ? 0.7
          : remaining[i].priority === "medium"
            ? 0.9
            : 1;
      const dist =
        calculateDistance(current, remaining[i].location) * priorityMultiplier;

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    const nearest = remaining.splice(nearestIdx, 1)[0];
    optimized.push(nearest);
    current = nearest.location;
  }

  return optimized;
};

// 2-opt optimization for route improvement
const optimizeRoute2Opt = (deliveries: Delivery[]): Delivery[] => {
  if (deliveries.length < 4) return deliveries;

  let improved = true;
  let route = [...deliveries];

  while (improved) {
    improved = false;
    for (let i = 1; i < route.length - 1; i++) {
      for (let j = i + 1; j < route.length; j++) {
        const d1 =
          calculateDistance(route[i - 1].location, route[i].location) +
          calculateDistance(
            route[j].location,
            route[j + 1]?.location || route[0].location,
          );
        const d2 =
          calculateDistance(route[i - 1].location, route[j].location) +
          calculateDistance(
            route[i].location,
            route[j + 1]?.location || route[0].location,
          );

        if (d2 < d1) {
          // Reverse segment between i and j
          const segment = route.slice(i, j + 1).reverse();
          route = [...route.slice(0, i), ...segment, ...route.slice(j + 1)];
          improved = true;
        }
      }
    }
  }

  return route;
};

export function useAIRouteOptimizer(driverLocation: Location) {
  const [optimizedRoute, setOptimizedRoute] = useState<OptimizedRoute | null>(
    null,
  );
  const [trafficUpdates, setTrafficUpdates] = useState<TrafficUpdate[]>([]);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [lastOptimization, setLastOptimization] = useState<number>(0);
  const insightIdCounter = useRef(0);

  // Optimize route when deliveries change
  const optimizeDeliveries = useCallback(
    (deliveries: Delivery[]): OptimizedRoute => {
      if (deliveries.length === 0) {
        return {
          deliveries: [],
          totalDistance: 0,
          totalDuration: 0,
          segments: [],
          savings: { distance: 0, time: 0, fuel: 0 },
          score: 100,
        };
      }

      setIsOptimizing(true);

      // Calculate original route distance
      let originalDistance = 0;
      let current = driverLocation;
      deliveries.forEach((d) => {
        originalDistance += calculateDistance(current, d.location);
        current = d.location;
      });

      // Apply optimization algorithms
      let optimized = optimizeRouteNearestNeighbor(driverLocation, deliveries);
      optimized = optimizeRoute2Opt(optimized);

      // Calculate optimized metrics
      let totalDistance = 0;
      let totalDuration = 0;
      const segments: RouteSegment[] = [];
      current = driverLocation;

      optimized.forEach((delivery, idx) => {
        const dist = calculateDistance(current, delivery.location);
        const roadType =
          dist > 5 ? "highway" : dist > 1 ? "arterial" : "residential";
        const trafficLevel =
          Math.random() > 0.7
            ? "moderate"
            : Math.random() > 0.9
              ? "heavy"
              : "clear";
        const trafficDelay =
          trafficLevel === "clear" ? 0 : trafficLevel === "moderate" ? 2 : 5;
        const duration = estimateTravelTime(dist, roadType) + trafficDelay;

        segments.push({
          from: current,
          to: delivery.location,
          distance: dist,
          duration,
          trafficLevel,
          trafficDelay,
          roadType,
        });

        totalDistance += dist;
        totalDuration += duration;
        current = delivery.location;

        // Update delivery with estimates
        delivery.distance = dist;
        delivery.estimatedTime = duration;
      });

      const distanceSavings = Math.max(0, originalDistance - totalDistance);
      const timeSavings = distanceSavings * 1.5; // Rough estimate
      const fuelSavings = distanceSavings * 0.12; // R/km estimate

      setIsOptimizing(false);
      setLastOptimization(Date.now());

      return {
        deliveries: optimized,
        totalDistance,
        totalDuration,
        segments,
        savings: {
          distance: distanceSavings,
          time: timeSavings,
          fuel: fuelSavings,
        },
        score: Math.min(100, 60 + (distanceSavings / originalDistance) * 100),
      };
    },
    [driverLocation],
  );

  // Generate AI insight
  const addInsight = useCallback(
    (
      type: AIInsight["type"],
      message: string,
      priority: AIInsight["priority"] = "medium",
      action?: () => void,
      actionLabel?: string,
      expiresIn?: number,
    ) => {
      const id = `insight-${++insightIdCounter.current}`;
      const insight: AIInsight = {
        id,
        type,
        message,
        priority,
        action,
        actionLabel,
        expiresAt: expiresIn ? Date.now() + expiresIn : undefined,
      };

      setInsights((prev) => [insight, ...prev.slice(0, 4)]);

      if (expiresIn) {
        setTimeout(() => {
          setInsights((prev) => prev.filter((i) => i.id !== id));
        }, expiresIn);
      }

      return id;
    },
    [],
  );

  // Dismiss insight
  const dismissInsight = useCallback((id: string) => {
    setInsights((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // Simulate real-time traffic updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Random traffic event simulation
      if (Math.random() > 0.85) {
        const update: TrafficUpdate = {
          location: {
            lat: driverLocation.lat + (Math.random() - 0.5) * 0.02,
            lng: driverLocation.lng + (Math.random() - 0.5) * 0.02,
          },
          severity:
            Math.random() > 0.7
              ? "severe"
              : Math.random() > 0.4
                ? "moderate"
                : "minor",
          delayMinutes: Math.floor(Math.random() * 10) + 1,
          description: [
            "Accident ahead",
            "Road construction",
            "Heavy congestion",
            "Lane closure",
          ][Math.floor(Math.random() * 4)],
          affectsRoute: Math.random() > 0.5,
          alternativeAvailable: Math.random() > 0.3,
        };

        setTrafficUpdates((prev) => [update, ...prev.slice(0, 4)]);

        if (update.affectsRoute && update.severity !== "minor") {
          addInsight(
            "traffic",
            `🚦 ${update.description} - ${update.delayMinutes} min delay${update.alternativeAvailable ? ". Alternative route available." : ""}`,
            update.severity === "severe" ? "high" : "medium",
            update.alternativeAvailable ? () => {} : undefined,
            update.alternativeAvailable ? "Reroute" : undefined,
            30000,
          );
        }
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [driverLocation, addInsight]);

  // Generate periodic AI insights
  useEffect(() => {
    const insights = [
      {
        type: "efficiency" as const,
        msg: "⚡ You're 12% ahead of schedule - great pace!",
        priority: "low" as const,
      },
      {
        type: "earnings" as const,
        msg: "💰 Complete 2 more deliveries to unlock R50 bonus",
        priority: "medium" as const,
      },
      {
        type: "customer" as const,
        msg: "⭐ Your rating is 4.9 - customers love your service!",
        priority: "low" as const,
      },
      {
        type: "optimization" as const,
        msg: "🎯 High demand detected nearby - stay in area for more orders",
        priority: "medium" as const,
      },
      {
        type: "safety" as const,
        msg: "☀️ Bright sunlight - drive safe and stay hydrated",
        priority: "low" as const,
      },
    ];

    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const insight = insights[Math.floor(Math.random() * insights.length)];
        addInsight(
          insight.type,
          insight.msg,
          insight.priority,
          undefined,
          undefined,
          20000,
        );
      }
    }, 45000);

    return () => clearInterval(interval);
  }, [addInsight]);

  // Add initial AI insights on mount
  useEffect(() => {
    // Immediate welcome insight
    setTimeout(() => {
      addInsight(
        "optimization",
        "🚀 Route optimized! Saving 15 min vs original order",
        "high",
        undefined,
        undefined,
        15000,
      );
    }, 500);

    // Second insight after 3 seconds
    setTimeout(() => {
      addInsight(
        "earnings",
        "💰 3 deliveries to go for R100 bonus",
        "medium",
        undefined,
        undefined,
        25000,
      );
    }, 3000);

    // Third insight after 6 seconds
    setTimeout(() => {
      addInsight(
        "customer",
        "⭐ High-value customer ahead - extra tip potential!",
        "low",
        undefined,
        undefined,
        20000,
      );
    }, 6000);
  }, []); // Only run once on mount

  // Get ETA to specific delivery
  const getETAToDelivery = useCallback(
    (delivery: Delivery): string => {
      const dist = calculateDistance(driverLocation, delivery.location);
      const roadType =
        dist > 5 ? "highway" : dist > 1 ? "arterial" : "residential";
      const time = estimateTravelTime(dist, roadType);

      if (time < 60) return `${Math.round(time)} min`;
      const hours = Math.floor(time / 60);
      const mins = Math.round(time % 60);
      return `${hours}h ${mins}m`;
    },
    [driverLocation],
  );

  // Check if reroute is beneficial
  const checkForBetterRoute = useCallback(
    (currentRoute: OptimizedRoute): { available: boolean; savings: number } => {
      // Simulate route checking
      const hasBetterRoute = Math.random() > 0.7;
      return {
        available: hasBetterRoute,
        savings: hasBetterRoute ? Math.floor(Math.random() * 8) + 2 : 0,
      };
    },
    [],
  );

  return {
    optimizedRoute,
    setOptimizedRoute,
    trafficUpdates,
    insights,
    isOptimizing,
    lastOptimization,
    optimizeDeliveries,
    addInsight,
    dismissInsight,
    getETAToDelivery,
    checkForBetterRoute,
  };
}

// Voice command processor
export function useDriverVoiceCommands() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  const commands = {
    navigate: ["navigate to", "directions to", "take me to", "go to"],
    call: ["call customer", "call them", "phone customer", "ring customer"],
    message: ["message customer", "text customer", "send message"],
    arrived: ["arrived", "i'm here", "at destination", "mark arrived"],
    delivered: ["delivered", "complete delivery", "done", "finished"],
    traffic: ["traffic", "traffic ahead", "what's the traffic"],
    next: ["next delivery", "next order", "what's next"],
    help: ["help", "support", "problem", "issue"],
    cancel: ["cancel", "go back", "nevermind"],
  };

  const processCommand = useCallback(
    (text: string): { command: string; action: string } | null => {
      const lowerText = text.toLowerCase();

      for (const [action, phrases] of Object.entries(commands)) {
        for (const phrase of phrases) {
          if (lowerText.includes(phrase)) {
            return { command: text, action };
          }
        }
      }

      return null;
    },
    [],
  );

  const startListening = useCallback(() => {
    setIsListening(true);
    setTranscript("");

    // Simulate voice recognition
    setTimeout(() => {
      const mockCommands = [
        "Call customer",
        "Navigate to next delivery",
        "What's the traffic like",
        "Mark as arrived",
      ];
      const mock =
        mockCommands[Math.floor(Math.random() * mockCommands.length)];
      setTranscript(mock);
      setLastCommand(mock);
      setIsListening(false);
    }, 2000);
  }, []);

  const stopListening = useCallback(() => {
    setIsListening(false);
  }, []);

  return {
    isListening,
    transcript,
    lastCommand,
    startListening,
    stopListening,
    processCommand,
  };
}

// Earnings tracker
export function useDriverEarnings() {
  const [todayEarnings, setTodayEarnings] = useState({
    deliveries: 0,
    base: 0,
    tips: 0,
    bonuses: 0,
    total: 0,
  });

  const [weeklyEarnings, setWeeklyEarnings] = useState({
    mon: 0,
    tue: 0,
    wed: 0,
    thu: 0,
    fri: 0,
    sat: 0,
    sun: 0,
  });

  const [activeStreak, setActiveStreak] = useState(0);
  const [nextBonus, setNextBonus] = useState({
    deliveriesNeeded: 3,
    amount: 50,
  });

  const addDeliveryEarning = useCallback((amount: number, tip: number = 0) => {
    setTodayEarnings((prev) => ({
      deliveries: prev.deliveries + 1,
      base: prev.base + amount,
      tips: prev.tips + tip,
      bonuses: prev.bonuses,
      total: prev.total + amount + tip,
    }));
    setActiveStreak((prev) => prev + 1);

    // Check for bonus
    setNextBonus((prev) => {
      if (prev.deliveriesNeeded <= 1) {
        setTodayEarnings((p) => ({
          ...p,
          bonuses: p.bonuses + prev.amount,
          total: p.total + prev.amount,
        }));
        return { deliveriesNeeded: 5, amount: 75 }; // Next milestone
      }
      return { ...prev, deliveriesNeeded: prev.deliveriesNeeded - 1 };
    });
  }, []);

  return {
    todayEarnings,
    weeklyEarnings,
    activeStreak,
    nextBonus,
    addDeliveryEarning,
  };
}
