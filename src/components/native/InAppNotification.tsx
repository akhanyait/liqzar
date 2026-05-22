import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Bell,
  Package,
  Truck,
  Gift,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { useHaptics } from "@/hooks/useNativeFeatures";

export interface InAppNotification {
  id: string;
  title: string;
  message: string;
  type: "order" | "delivery" | "promo" | "alert" | "success";
  action?: () => void;
  actionLabel?: string;
}

interface InAppNotificationBannerProps {
  notification: InAppNotification | null;
  onDismiss: () => void;
  duration?: number;
}

const iconMap = {
  order: Package,
  delivery: Truck,
  promo: Gift,
  alert: AlertCircle,
  success: CheckCircle,
};

const colorMap = {
  order: "bg-blue-500",
  delivery: "bg-green-500",
  promo: "bg-purple-500",
  alert: "bg-amber-500",
  success: "bg-emerald-500",
};

export const InAppNotificationBanner = ({
  notification,
  onDismiss,
  duration = 4000,
}: InAppNotificationBannerProps) => {
  const { notification: hapticNotification } = useHaptics();

  useEffect(() => {
    if (notification) {
      hapticNotification("success");
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [notification, duration, onDismiss, hapticNotification]);

  const Icon = notification ? iconMap[notification.type] : Bell;
  const bgColor = notification ? colorMap[notification.type] : "bg-primary";

  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed top-0 left-0 right-0 z-[100] pt-[env(safe-area-inset-top)] px-4"
        >
          <div className="mt-2 bg-card border border-border rounded-2xl shadow-lg overflow-hidden">
            <div className="flex items-start gap-3 p-4">
              <div
                className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center flex-shrink-0`}
              >
                <Icon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm">
                  {notification.title}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                  {notification.message}
                </p>
                {notification.action && notification.actionLabel && (
                  <button
                    onClick={() => {
                      notification.action?.();
                      onDismiss();
                    }}
                    className="mt-2 text-xs font-semibold text-primary"
                  >
                    {notification.actionLabel}
                  </button>
                )}
              </div>
              <button
                onClick={onDismiss}
                className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Hook to manage in-app notifications
export const useInAppNotifications = () => {
  const [currentNotification, setCurrentNotification] =
    useState<InAppNotification | null>(null);
  const [queue, setQueue] = useState<InAppNotification[]>([]);

  const showNotification = useCallback(
    (notification: Omit<InAppNotification, "id">) => {
      const newNotification: InAppNotification = {
        ...notification,
        id: Date.now().toString(),
      };
      setQueue((prev) => [...prev, newNotification]);
    },
    [],
  );

  const dismissNotification = useCallback(() => {
    setCurrentNotification(null);
  }, []);

  // Process queue
  useEffect(() => {
    if (!currentNotification && queue.length > 0) {
      const [next, ...rest] = queue;
      setCurrentNotification(next);
      setQueue(rest);
    }
  }, [currentNotification, queue]);

  return {
    currentNotification,
    showNotification,
    dismissNotification,
  };
};

export default InAppNotificationBanner;
