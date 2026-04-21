import { useState, useEffect, useCallback, useRef } from "react";

// Types for real-time sync
export interface DeliveryUpdate {
  orderId: string;
  status:
    | "pending"
    | "picked"
    | "en_route"
    | "arrived"
    | "delivered"
    | "cancelled";
  driverName: string;
  driverId: string;
  driverPhoto?: string;
  driverRating?: number;
  driverPhone?: string;
  currentLocation: { lat: number; lng: number };
  eta: string;
  distance: number;
  timestamp: number;
  message?: string;
}

export interface ChatMessage {
  id: string;
  orderId: string;
  from: "driver" | "customer" | "admin" | "system";
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  read: boolean;
}

export interface DriverLocation {
  driverId: string;
  orderId: string;
  lat: number;
  lng: number;
  heading: number;
  speed: number;
  timestamp: number;
}

// Storage keys
const DELIVERY_UPDATE_KEY = "liqzar_delivery_update";
const CHAT_MESSAGES_KEY = "liqzar_chat_messages";
const DRIVER_LOCATION_KEY = "liqzar_driver_location";

// Broadcast channel for cross-tab communication
const createChannel = (name: string) => {
  if (typeof BroadcastChannel !== "undefined") {
    return new BroadcastChannel(name);
  }
  return null;
};

/**
 * Hook for drivers to send real-time updates to customers
 */
export function useDriverSync(driverId: string, driverName: string) {
  const deliveryChannel = useRef(createChannel("liqzar_delivery"));
  const chatChannel = useRef(createChannel("liqzar_chat"));
  const locationChannel = useRef(createChannel("liqzar_location"));

  // Send delivery status update
  const sendDeliveryUpdate = useCallback(
    (update: Omit<DeliveryUpdate, "timestamp" | "driverId" | "driverName">) => {
      const fullUpdate: DeliveryUpdate = {
        ...update,
        driverId,
        driverName,
        timestamp: Date.now(),
      };

      // Store in localStorage for persistence
      const key = `${DELIVERY_UPDATE_KEY}_${update.orderId}`;
      localStorage.setItem(key, JSON.stringify(fullUpdate));

      // Broadcast to other tabs
      deliveryChannel.current?.postMessage(fullUpdate);

      // Dispatch custom event for same-tab listeners
      window.dispatchEvent(
        new CustomEvent("delivery-update", { detail: fullUpdate }),
      );
    },
    [driverId, driverName],
  );

  // Send chat message
  const sendChatMessage = useCallback(
    (orderId: string, text: string) => {
      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId,
        from: "driver",
        senderId: driverId,
        senderName: driverName,
        text,
        timestamp: Date.now(),
        read: false,
      };

      // Get existing messages
      const key = `${CHAT_MESSAGES_KEY}_${orderId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(message);

      // Keep last 100 messages
      if (existing.length > 100) existing.splice(0, existing.length - 100);
      localStorage.setItem(key, JSON.stringify(existing));

      // Broadcast
      chatChannel.current?.postMessage(message);
      window.dispatchEvent(
        new CustomEvent("chat-message", { detail: message }),
      );

      return message;
    },
    [driverId, driverName],
  );

  // Update driver location
  const updateLocation = useCallback(
    (
      orderId: string,
      lat: number,
      lng: number,
      heading: number = 0,
      speed: number = 0,
    ) => {
      const location: DriverLocation = {
        driverId,
        orderId,
        lat,
        lng,
        heading,
        speed,
        timestamp: Date.now(),
      };

      localStorage.setItem(
        `${DRIVER_LOCATION_KEY}_${orderId}`,
        JSON.stringify(location),
      );
      locationChannel.current?.postMessage(location);
      window.dispatchEvent(
        new CustomEvent("driver-location", { detail: location }),
      );
    },
    [driverId],
  );

  // Cleanup
  useEffect(() => {
    return () => {
      deliveryChannel.current?.close();
      chatChannel.current?.close();
      locationChannel.current?.close();
    };
  }, []);

  return {
    sendDeliveryUpdate,
    sendChatMessage,
    updateLocation,
  };
}

/**
 * Hook for customers to receive real-time updates from drivers
 */
export function useCustomerSync(orderId: string) {
  const [deliveryUpdate, setDeliveryUpdate] = useState<DeliveryUpdate | null>(
    null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(
    null,
  );
  const [isConnected, setIsConnected] = useState(true);

  const deliveryChannel = useRef(createChannel("liqzar_delivery"));
  const chatChannel = useRef(createChannel("liqzar_chat"));
  const locationChannel = useRef(createChannel("liqzar_location"));

  // Load initial data from localStorage
  useEffect(() => {
    // Load delivery update
    const storedUpdate = localStorage.getItem(
      `${DELIVERY_UPDATE_KEY}_${orderId}`,
    );
    if (storedUpdate) {
      setDeliveryUpdate(JSON.parse(storedUpdate));
    }

    // Load chat messages
    const storedMessages = localStorage.getItem(
      `${CHAT_MESSAGES_KEY}_${orderId}`,
    );
    if (storedMessages) {
      setMessages(JSON.parse(storedMessages));
    }

    // Load driver location
    const storedLocation = localStorage.getItem(
      `${DRIVER_LOCATION_KEY}_${orderId}`,
    );
    if (storedLocation) {
      setDriverLocation(JSON.parse(storedLocation));
    }
  }, [orderId]);

  // Listen for broadcast channel updates
  useEffect(() => {
    const handleDeliveryUpdate = (event: MessageEvent<DeliveryUpdate>) => {
      if (event.data.orderId === orderId) {
        setDeliveryUpdate(event.data);
      }
    };

    const handleChatMessage = (event: MessageEvent<ChatMessage>) => {
      if (event.data.orderId === orderId) {
        setMessages((prev) => [...prev, event.data]);
      }
    };

    const handleLocation = (event: MessageEvent<DriverLocation>) => {
      if (event.data.orderId === orderId) {
        setDriverLocation(event.data);
      }
    };

    deliveryChannel.current?.addEventListener("message", handleDeliveryUpdate);
    chatChannel.current?.addEventListener("message", handleChatMessage);
    locationChannel.current?.addEventListener("message", handleLocation);

    return () => {
      deliveryChannel.current?.removeEventListener(
        "message",
        handleDeliveryUpdate,
      );
      chatChannel.current?.removeEventListener("message", handleChatMessage);
      locationChannel.current?.removeEventListener("message", handleLocation);
    };
  }, [orderId]);

  // Listen for custom events (same tab)
  useEffect(() => {
    const handleDeliveryEvent = (e: CustomEvent<DeliveryUpdate>) => {
      if (e.detail.orderId === orderId) {
        setDeliveryUpdate(e.detail);
      }
    };

    const handleChatEvent = (e: CustomEvent<ChatMessage>) => {
      if (e.detail.orderId === orderId) {
        setMessages((prev) => [...prev, e.detail]);
      }
    };

    const handleLocationEvent = (e: CustomEvent<DriverLocation>) => {
      if (e.detail.orderId === orderId) {
        setDriverLocation(e.detail);
      }
    };

    window.addEventListener(
      "delivery-update",
      handleDeliveryEvent as EventListener,
    );
    window.addEventListener("chat-message", handleChatEvent as EventListener);
    window.addEventListener(
      "driver-location",
      handleLocationEvent as EventListener,
    );

    return () => {
      window.removeEventListener(
        "delivery-update",
        handleDeliveryEvent as EventListener,
      );
      window.removeEventListener(
        "chat-message",
        handleChatEvent as EventListener,
      );
      window.removeEventListener(
        "driver-location",
        handleLocationEvent as EventListener,
      );
    };
  }, [orderId]);

  // Poll for updates (fallback for browsers without BroadcastChannel)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      const storedUpdate = localStorage.getItem(
        `${DELIVERY_UPDATE_KEY}_${orderId}`,
      );
      if (storedUpdate) {
        const update = JSON.parse(storedUpdate);
        if (!deliveryUpdate || update.timestamp > deliveryUpdate.timestamp) {
          setDeliveryUpdate(update);
        }
      }

      const storedLocation = localStorage.getItem(
        `${DRIVER_LOCATION_KEY}_${orderId}`,
      );
      if (storedLocation) {
        const loc = JSON.parse(storedLocation);
        if (!driverLocation || loc.timestamp > driverLocation.timestamp) {
          setDriverLocation(loc);
        }
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [orderId, deliveryUpdate, driverLocation]);

  // Send message as customer
  const sendMessage = useCallback(
    (text: string, customerId: string, customerName: string) => {
      const message: ChatMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId,
        from: "customer",
        senderId: customerId,
        senderName: customerName,
        text,
        timestamp: Date.now(),
        read: false,
      };

      const key = `${CHAT_MESSAGES_KEY}_${orderId}`;
      const existing = JSON.parse(localStorage.getItem(key) || "[]");
      existing.push(message);
      if (existing.length > 100) existing.splice(0, existing.length - 100);
      localStorage.setItem(key, JSON.stringify(existing));

      chatChannel.current?.postMessage(message);
      window.dispatchEvent(
        new CustomEvent("chat-message", { detail: message }),
      );

      setMessages((prev) => [...prev, message]);

      return message;
    },
    [orderId],
  );

  // Mark messages as read
  const markMessagesRead = useCallback(() => {
    setMessages((prev) => prev.map((m) => ({ ...m, read: true })));

    const key = `${CHAT_MESSAGES_KEY}_${orderId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    const updated = existing.map((m: ChatMessage) => ({ ...m, read: true }));
    localStorage.setItem(key, JSON.stringify(updated));
  }, [orderId]);

  // Get unread count
  const unreadCount = messages.filter(
    (m) => !m.read && m.from !== "customer",
  ).length;

  // Cleanup
  useEffect(() => {
    return () => {
      deliveryChannel.current?.close();
      chatChannel.current?.close();
      locationChannel.current?.close();
    };
  }, []);

  return {
    deliveryUpdate,
    messages,
    driverLocation,
    isConnected,
    sendMessage,
    markMessagesRead,
    unreadCount,
  };
}

/**
 * Hook for admin to monitor all deliveries
 */
export function useAdminSync() {
  const [activeDeliveries, setActiveDeliveries] = useState<DeliveryUpdate[]>(
    [],
  );
  const [driverLocations, setDriverLocations] = useState<
    Map<string, DriverLocation>
  >(new Map());

  const deliveryChannel = useRef(createChannel("liqzar_delivery"));
  const locationChannel = useRef(createChannel("liqzar_location"));

  // Listen for all delivery updates
  useEffect(() => {
    const handleDelivery = (event: MessageEvent<DeliveryUpdate>) => {
      setActiveDeliveries((prev) => {
        const existing = prev.findIndex(
          (d) => d.orderId === event.data.orderId,
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = event.data;
          return updated;
        }
        return [...prev, event.data];
      });
    };

    const handleLocation = (event: MessageEvent<DriverLocation>) => {
      setDriverLocations((prev) => {
        const updated = new Map(prev);
        updated.set(event.data.driverId, event.data);
        return updated;
      });
    };

    deliveryChannel.current?.addEventListener("message", handleDelivery);
    locationChannel.current?.addEventListener("message", handleLocation);

    return () => {
      deliveryChannel.current?.removeEventListener("message", handleDelivery);
      locationChannel.current?.removeEventListener("message", handleLocation);
    };
  }, []);

  // Send message to driver
  const sendToDriver = useCallback((orderId: string, text: string) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      orderId,
      from: "admin",
      senderId: "admin",
      senderName: "LIQZAR Dispatch",
      text,
      timestamp: Date.now(),
      read: false,
    };

    const key = `${CHAT_MESSAGES_KEY}_${orderId}`;
    const existing = JSON.parse(localStorage.getItem(key) || "[]");
    existing.push(message);
    localStorage.setItem(key, JSON.stringify(existing));

    const chatChannel = createChannel("liqzar_chat");
    chatChannel?.postMessage(message);
    chatChannel?.close();

    return message;
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      deliveryChannel.current?.close();
      locationChannel.current?.close();
    };
  }, []);

  return {
    activeDeliveries,
    driverLocations,
    sendToDriver,
  };
}

// Utility to get ETA from distance (rough estimate)
export function calculateETA(
  distanceKm: number,
  trafficLevel: "low" | "medium" | "high" = "medium",
): string {
  const baseSpeed = { low: 45, medium: 30, high: 15 }; // km/h
  const minutes = Math.ceil((distanceKm / baseSpeed[trafficLevel]) * 60);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return `${hours}h ${remainingMins}m`;
}

// Utility to format timestamp
export function formatMessageTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000)
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  return new Date(timestamp).toLocaleDateString();
}
