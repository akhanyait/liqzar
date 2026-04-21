import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, WifiOff, CheckCircle } from "lucide-react";
import {
  useHaptics,
  isNativeApp,
  useOnlineStatus,
} from "@/hooks/useNativeFeatures";

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
  threshold?: number;
  className?: string;
}

const PullToRefresh = ({
  onRefresh,
  children,
  threshold = 80,
  className = "",
}: PullToRefreshProps) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshComplete, setRefreshComplete] = useState(false);
  const [startY, setStartY] = useState<number | null>(null);
  const { impact, notification } = useHaptics();
  const isOnline = useOnlineStatus();

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    // Only enable pull-to-refresh when at top of scroll
    const target = e.currentTarget;
    if (target.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (startY === null || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const diff = currentY - startY;

      if (diff > 0) {
        // Resistance effect - harder to pull the further you go
        const resistance = 0.4;
        const distance = Math.pow(diff, resistance) * 10;
        setPullDistance(Math.min(distance, threshold * 1.5));

        // Haptic feedback at threshold
        if (distance >= threshold && pullDistance < threshold) {
          impact("medium");
        }
      }
    },
    [startY, isRefreshing, threshold, pullDistance, impact],
  );

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      impact("heavy");

      try {
        await onRefresh();
        notification("success");
        setRefreshComplete(true);
        setTimeout(() => setRefreshComplete(false), 1000);
      } catch (error) {
        notification("error");
      } finally {
        setIsRefreshing(false);
      }
    }

    setPullDistance(0);
    setStartY(null);
  }, [pullDistance, threshold, isRefreshing, onRefresh, impact, notification]);

  const progress = Math.min((pullDistance / threshold) * 100, 100);
  const readyToRefresh = pullDistance >= threshold;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <AnimatePresence>
        {(pullDistance > 0 || isRefreshing) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 flex justify-center z-10"
            style={{
              height: isRefreshing ? 60 : Math.max(pullDistance, 0),
              paddingTop: isRefreshing ? 20 : pullDistance * 0.3,
            }}
          >
            <div className="flex flex-col items-center">
              {!isOnline ? (
                <WifiOff className="w-6 h-6 text-muted-foreground" />
              ) : refreshComplete ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center"
                >
                  <CheckCircle className="w-5 h-5 text-white" />
                </motion.div>
              ) : (
                <motion.div
                  animate={{
                    rotate: isRefreshing
                      ? 360
                      : readyToRefresh
                        ? 180
                        : progress * 1.8,
                  }}
                  transition={{
                    rotate: isRefreshing
                      ? { duration: 1, repeat: Infinity, ease: "linear" }
                      : { duration: 0.2 },
                  }}
                  className={`w-8 h-8 rounded-full border-3 flex items-center justify-center ${
                    readyToRefresh
                      ? "border-primary bg-primary/10"
                      : "border-muted-foreground/30"
                  }`}
                  style={{
                    borderTopColor: readyToRefresh
                      ? "var(--primary)"
                      : "transparent",
                  }}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${
                      readyToRefresh ? "text-primary" : "text-muted-foreground"
                    }`}
                  />
                </motion.div>
              )}

              {!isRefreshing && !refreshComplete && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {!isOnline
                    ? "You're offline"
                    : readyToRefresh
                      ? "Release to refresh"
                      : "Pull to refresh"}
                </p>
              )}

              {isRefreshing && (
                <p className="text-[10px] text-primary mt-1 font-medium">
                  Refreshing...
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content with transform */}
      <motion.div
        animate={{
          y: isRefreshing ? 60 : pullDistance,
        }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        {children}
      </motion.div>
    </div>
  );
};

export default PullToRefresh;
