/**
 * Customer Delivery Notifications Hook
 * Handles all delivery-related notifications for customers
 */

import { useState, useEffect, useCallback } from "react";
import { toast } from "@/hooks/use-toast";
import { formatDeliveryStatus } from "@/lib/delivery-scheduling";

export type DeliveryNotificationType =
  | "order_confirmed"
  | "scheduled_same_day"
  | "scheduled_next_day"
  | "scheduled_date"
  | "driver_allocated"
  | "driver_to_warehouse"
  | "order_loaded"
  | "driver_en_route"
  | "arriving_soon"
  | "delivered"
  | "delivery_rescheduled";

export interface DeliveryNotification {
  id: string;
  orderId: string;
  type: DeliveryNotificationType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  details?: Record<string, any>;
}

interface NotificationPreferences {
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  soundEnabled: boolean;
}

const NOTIFICATIONS_KEY = "liqzar_delivery_notifications";
const PREFERENCES_KEY = "liqzar_notification_preferences";

/**
 * Hook for managing customer delivery notifications
 */
export const useDeliveryNotifications = (orderId?: string) => {
  const [notifications, setNotifications] = useState<DeliveryNotification[]>(
    [],
  );
  const [unreadCount, setUnreadCount] = useState(0);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    pushEnabled: true,
    smsEnabled: true,
    emailEnabled: true,
    soundEnabled: true,
  });

  // Load notifications and preferences from storage
  useEffect(() => {
    const stored = localStorage.getItem(NOTIFICATIONS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const filtered = orderId
        ? parsed.filter((n: DeliveryNotification) => n.orderId === orderId)
        : parsed;
      setNotifications(filtered);
      setUnreadCount(
        filtered.filter((n: DeliveryNotification) => !n.read).length,
      );
    }

    const prefs = localStorage.getItem(PREFERENCES_KEY);
    if (prefs) {
      setPreferences(JSON.parse(prefs));
    }
  }, [orderId]);

  // Add a new notification
  const addNotification = useCallback(
    (
      type: DeliveryNotificationType,
      orderIdParam: string,
      details?: Record<string, any>,
    ) => {
      const { title, message } = formatDeliveryStatus(type, details);

      const notification: DeliveryNotification = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
        orderId: orderIdParam,
        type,
        title,
        message,
        timestamp: new Date(),
        read: false,
        details,
      };

      setNotifications((prev) => {
        const updated = [notification, ...prev].slice(0, 50); // Keep last 50
        localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
        return updated;
      });

      setUnreadCount((prev) => prev + 1);

      // Show toast notification
      toast({
        title: notification.title,
        description: notification.message,
      });

      // Play sound if enabled
      if (preferences.soundEnabled) {
        playNotificationSound(type);
      }

      return notification;
    },
    [preferences.soundEnabled],
  );

  // Mark notification as read
  const markAsRead = useCallback((notificationId: string) => {
    setNotifications((prev) => {
      const updated = prev.map((n) =>
        n.id === notificationId ? { ...n, read: true } : n,
      );
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
    setUnreadCount((prev) => Math.max(0, prev - 1));
  }, []);

  // Mark all as read
  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(updated));
      return updated;
    });
    setUnreadCount(0);
  }, []);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem(NOTIFICATIONS_KEY);
  }, []);

  // Update preferences
  const updatePreferences = useCallback(
    (newPrefs: Partial<NotificationPreferences>) => {
      setPreferences((prev) => {
        const updated = { ...prev, ...newPrefs };
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify(updated));
        return updated;
      });
    },
    [],
  );

  // Get notifications for a specific order
  const getOrderNotifications = useCallback(
    (orderIdParam: string) => {
      return notifications.filter((n) => n.orderId === orderIdParam);
    },
    [notifications],
  );

  // Get latest status for an order
  const getLatestStatus = useCallback(
    (orderIdParam: string): DeliveryNotificationType | null => {
      const orderNotifs = notifications.filter(
        (n) => n.orderId === orderIdParam,
      );
      return orderNotifs.length > 0 ? orderNotifs[0].type : null;
    },
    [notifications],
  );

  return {
    notifications,
    unreadCount,
    preferences,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    updatePreferences,
    getOrderNotifications,
    getLatestStatus,
  };
};

/**
 * Play notification sound based on type
 */
const playNotificationSound = (type: DeliveryNotificationType) => {
  // In production, you'd have actual audio files
  // For now, we'll use the Web Audio API for a simple beep
  try {
    const audioContext = new (
      window.AudioContext || (window as any).webkitAudioContext
    )();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different tones for different notification types
    const frequencies: Record<string, number> = {
      delivered: 800,
      arriving_soon: 600,
      driver_en_route: 500,
      default: 440,
    };

    oscillator.frequency.value = frequencies[type] || frequencies.default;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(
      0.01,
      audioContext.currentTime + 0.3,
    );

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (e) {
    // Audio not supported, ignore
  }
};

/**
 * Simulate delivery status updates (for demo purposes)
 */
export const simulateDeliveryProgress = (
  orderId: string,
  addNotification: (
    type: DeliveryNotificationType,
    orderId: string,
    details?: Record<string, any>,
  ) => void,
) => {
  const timeline: Array<{
    delay: number;
    type: DeliveryNotificationType;
    details?: Record<string, any>;
  }> = [
    { delay: 0, type: "order_confirmed" },
    {
      delay: 5000,
      type: "driver_allocated",
      details: { driverName: "Sipho M." },
    },
    { delay: 10000, type: "driver_to_warehouse" },
    { delay: 15000, type: "order_loaded" },
    { delay: 20000, type: "driver_en_route", details: { eta: "15 minutes" } },
    { delay: 30000, type: "arriving_soon", details: { minutes: 5 } },
  ];

  timeline.forEach(({ delay, type, details }) => {
    setTimeout(() => {
      addNotification(type, orderId, details);
    }, delay);
  });
};

/**
 * Notification status colors and icons
 */
export const getNotificationStyle = (type: DeliveryNotificationType) => {
  const styles: Record<
    string,
    { color: string; bgColor: string; icon: string }
  > = {
    order_confirmed: {
      color: "text-green-600",
      bgColor: "bg-green-100",
      icon: "✅",
    },
    scheduled_same_day: {
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      icon: "🚀",
    },
    scheduled_next_day: {
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      icon: "📅",
    },
    scheduled_date: {
      color: "text-purple-600",
      bgColor: "bg-purple-100",
      icon: "📅",
    },
    driver_allocated: {
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      icon: "🚗",
    },
    driver_to_warehouse: {
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      icon: "🏪",
    },
    order_loaded: {
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      icon: "📦",
    },
    driver_en_route: {
      color: "text-blue-600",
      bgColor: "bg-blue-100",
      icon: "🚚",
    },
    arriving_soon: {
      color: "text-green-600",
      bgColor: "bg-green-100",
      icon: "📍",
    },
    delivered: { color: "text-green-600", bgColor: "bg-green-100", icon: "🎉" },
    delivery_rescheduled: {
      color: "text-amber-600",
      bgColor: "bg-amber-100",
      icon: "📅",
    },
  };

  return (
    styles[type] || {
      color: "text-gray-600",
      bgColor: "bg-gray-100",
      icon: "📢",
    }
  );
};
