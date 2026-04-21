import { useState } from "react";
import { motion } from "framer-motion";
import {
  Mic,
  QrCode,
  MapPin,
  Sparkles,
  Shuffle,
  RefreshCw,
  Wallet,
  Box,
  Camera,
  Smartphone,
  ChevronRight,
  TrendingUp,
  Gift,
  Star,
} from "lucide-react";
import { useHaptics, isNativeApp } from "@/hooks/useNativeFeatures";

interface MobileOnlyFeaturesProps {
  onVoiceSearch: () => void;
  onScanBarcode: () => void;
  onNearbyStores: () => void;
  onARPreview: () => void;
}

const MobileOnlyFeatures = ({
  onVoiceSearch,
  onScanBarcode,
  onNearbyStores,
  onARPreview,
}: MobileOnlyFeaturesProps) => {
  const { impact } = useHaptics();

  const quickActions = [
    {
      icon: Mic,
      label: "Voice",
      subLabel: "Search by voice",
      color: "from-blue-500 to-blue-600",
      onClick: onVoiceSearch,
    },
    {
      icon: QrCode,
      label: "Scan",
      subLabel: "Scan barcode",
      color: "from-green-500 to-green-600",
      onClick: onScanBarcode,
    },
    {
      icon: MapPin,
      label: "Nearby",
      subLabel: "Stores near you",
      color: "from-orange-500 to-orange-600",
      onClick: onNearbyStores,
    },
    {
      icon: Box,
      label: "AR View",
      subLabel: "Preview in 3D",
      color: "from-purple-500 to-purple-600",
      onClick: onARPreview,
    },
  ];

  const handleClick = (action: (typeof quickActions)[0]) => {
    impact("medium");
    action.onClick();
  };

  // Only show on mobile/native
  if (
    !isNativeApp() &&
    typeof window !== "undefined" &&
    window.innerWidth > 768
  ) {
    return null;
  }

  return (
    <div className="px-4 py-2">
      {/* Quick Actions Grid */}
      <div className="grid grid-cols-4 gap-2">
        {quickActions.map((action, index) => (
          <motion.button
            key={action.label}
            onClick={() => handleClick(action)}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex flex-col items-center p-3 rounded-2xl bg-card border border-border hover:border-primary/30 transition-colors"
          >
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${action.color} flex items-center justify-center mb-2`}
            >
              <action.icon className="w-5 h-5 text-white" />
            </div>
            <span className="text-xs font-bold text-foreground">
              {action.label}
            </span>
            <span className="text-[9px] text-muted-foreground">
              {action.subLabel}
            </span>
          </motion.button>
        ))}
      </div>

      {/* Native-only badge */}
      {isNativeApp() && (
        <div className="flex items-center justify-center gap-1.5 mt-3 opacity-50">
          <Smartphone className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Mobile-only features
          </span>
        </div>
      )}
    </div>
  );
};

// Swipeable Promo Cards
export const SwipeablePromoCards = () => {
  const { impact } = useHaptics();
  const [currentIndex, setCurrentIndex] = useState(0);

  const promos = [
    {
      id: 1,
      title: "Happy Hour Deals",
      subtitle: "50% off selected wines",
      gradient: "from-primary/90 to-accent/90",
      icon: TrendingUp,
      cta: "Shop Now",
    },
    {
      id: 2,
      title: "Weekend Special",
      subtitle: "Buy 2 get 1 free on spirits",
      gradient: "from-green-500/90 to-emerald-600/90",
      icon: Gift,
      cta: "Claim Deal",
    },
    {
      id: 3,
      title: "Member Exclusive",
      subtitle: "Double points this week",
      gradient: "from-purple-500/90 to-violet-600/90",
      icon: Star,
      cta: "Shop Now",
    },
  ];

  const handleSwipe = (direction: "left" | "right") => {
    impact("light");
    if (direction === "left") {
      setCurrentIndex((prev) => (prev + 1) % promos.length);
    } else {
      setCurrentIndex((prev) => (prev - 1 + promos.length) % promos.length);
    }
  };

  return (
    <div className="px-4 py-2 overflow-hidden">
      <div className="relative">
        {/* Cards */}
        <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2">
          {promos.map((promo, index) => (
            <motion.div
              key={promo.id}
              className={`flex-shrink-0 w-[85%] snap-center`}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <div
                className={`relative h-32 rounded-2xl bg-gradient-to-r ${promo.gradient} p-4 overflow-hidden`}
              >
                {/* Background pattern */}
                <div className="absolute inset-0 opacity-20">
                  <svg className="w-full h-full" viewBox="0 0 100 100">
                    <circle
                      cx="80"
                      cy="20"
                      r="40"
                      fill="currentColor"
                      className="text-white"
                    />
                    <circle
                      cx="20"
                      cy="80"
                      r="30"
                      fill="currentColor"
                      className="text-black"
                    />
                  </svg>
                </div>

                <div className="relative h-full flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <promo.icon className="w-4 h-4 text-white/80" />
                      <span className="text-xs text-white/80 font-medium">
                        {promo.subtitle}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-white">
                      {promo.title}
                    </h3>
                  </div>
                  <button className="self-start px-4 py-1.5 bg-white rounded-full text-xs font-bold text-foreground">
                    {promo.cta} <ChevronRight className="w-3 h-3 inline" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-1.5 mt-2">
          {promos.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all ${
                index === currentIndex
                  ? "w-4 bg-primary"
                  : "w-1.5 bg-muted-foreground/30"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// AR Preview Placeholder
export const ARPreviewPlaceholder = ({ onClose }: { onClose: () => void }) => {
  const { impact } = useHaptics();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-black"
    >
      {/* Camera view simulation */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-gray-800">
        {/* Grid overlay */}
        <div className="absolute inset-0 opacity-20">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="absolute w-full h-px bg-white/30"
              style={{ top: `${i * 10}%` }}
            />
          ))}
        </div>
      </div>

      {/* AR instruction */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center p-6">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-32 h-32 border-4 border-dashed border-primary rounded-2xl mx-auto mb-6 flex items-center justify-center"
          >
            <Box className="w-12 h-12 text-primary" />
          </motion.div>
          <h3 className="text-xl font-bold text-white mb-2">AR Preview</h3>
          <p className="text-sm text-white/70 max-w-xs mx-auto">
            Point your camera at a flat surface to see how the bottle looks in
            your space
          </p>
          <p className="text-xs text-primary mt-4 font-medium">Coming Soon</p>
        </div>
      </div>

      {/* Close button */}
      <button
        onClick={() => {
          impact("light");
          onClose();
        }}
        className="absolute top-safe left-4 mt-4 px-4 py-2 bg-white/10 rounded-full text-white text-sm font-medium backdrop-blur-sm"
      >
        Close
      </button>
    </motion.div>
  );
};

// Location-based Near You section placeholder
export const NearYouSection = ({ onClose }: { onClose: () => void }) => {
  const { impact } = useHaptics();
  const [loading, setLoading] = useState(true);

  const stores = [
    {
      name: "LIQZAR Sandton",
      distance: "1.2 km",
      status: "Open",
      rating: 4.8,
    },
    {
      name: "LIQZAR Rosebank",
      distance: "3.5 km",
      status: "Open",
      rating: 4.9,
    },
    {
      name: "LIQZAR Fourways",
      distance: "5.8 km",
      status: "Closing soon",
      rating: 4.7,
    },
  ];

  useState(() => {
    setTimeout(() => setLoading(false), 1500);
  });

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <MapPin className="w-5 h-5 text-primary" />
        <h3 className="font-bold text-foreground">Stores Near You</h3>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-3">
          {stores.map((store, index) => (
            <motion.div
              key={store.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-3 bg-muted/50 rounded-xl flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-foreground text-sm">
                  {store.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{store.distance}</span>
                  <span>•</span>
                  <span
                    className={
                      store.status === "Open"
                        ? "text-green-500"
                        : "text-orange-500"
                    }
                  >
                    {store.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm">
                <Star className="w-3.5 h-3.5 fill-primary text-primary" />
                <span className="font-bold text-foreground">
                  {store.rating}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          impact("light");
          onClose();
        }}
        className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold"
      >
        Open Maps
      </button>
    </div>
  );
};

export default MobileOnlyFeatures;
