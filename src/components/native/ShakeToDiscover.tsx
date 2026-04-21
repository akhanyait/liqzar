import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  Shuffle,
  Wine,
  X,
  ShoppingCart,
  Heart,
  ChevronRight,
  Star,
} from "lucide-react";
import {
  useHaptics,
  useShakeDetection,
  isNativeApp,
} from "@/hooks/useNativeFeatures";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";
import { Product } from "@/data/products";

interface ShakeToDiscoverProps {
  products: Product[];
}

const ShakeToDiscover = ({ products }: ShakeToDiscoverProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [discoveredProduct, setDiscoveredProduct] = useState<Product | null>(
    null,
  );
  const [isShaking, setIsShaking] = useState(false);
  const [lastShakeTime, setLastShakeTime] = useState(0);
  const { impact, notification } = useHaptics();
  const { addItem } = useCart();

  const discoverRandomProduct = useCallback(() => {
    const now = Date.now();
    // Debounce: only trigger if 2 seconds have passed since last shake
    if (now - lastShakeTime < 2000) return;
    setLastShakeTime(now);

    setIsShaking(true);
    impact("heavy");

    // Pick random product
    const randomIndex = Math.floor(Math.random() * products.length);
    const product = products[randomIndex];

    setTimeout(() => {
      setDiscoveredProduct(product);
      setIsVisible(true);
      setIsShaking(false);
      notification("success");
    }, 500);
  }, [products, lastShakeTime, impact, notification]);

  // Register shake detection
  useShakeDetection(discoverRandomProduct, 20);

  const handleAddToCart = () => {
    if (discoveredProduct) {
      addItem(discoveredProduct, 1);
      impact("medium");
      notification("success");
      setIsVisible(false);
      toast({
        title: "Added to cart!",
        description: `${discoveredProduct.name} has been added`,
      });
    }
  };

  const handleWishlist = () => {
    if (discoveredProduct) {
      impact("light");
      toast({
        title: "Added to wishlist",
        description: `${discoveredProduct.name} saved for later`,
      });
    }
  };

  const handleManualShake = () => {
    discoverRandomProduct();
  };

  return (
    <>
      {/* Shake Indicator (shown on mobile when not interacting) */}
      {isNativeApp() && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: isShaking ? 1 : 0.7 }}
          className="fixed top-[calc(env(safe-area-inset-top)+60px)] left-1/2 -translate-x-1/2 z-30 px-3 py-1.5 bg-primary/10 rounded-full flex items-center gap-1.5"
        >
          <motion.div
            animate={isShaking ? { x: [-2, 2, -2, 2, 0] } : {}}
            transition={{ duration: 0.3, repeat: isShaking ? Infinity : 0 }}
          >
            <Shuffle className="w-3.5 h-3.5 text-primary" />
          </motion.div>
          <span className="text-[10px] font-medium text-primary">
            Shake to discover
          </span>
        </motion.div>
      )}

      {/* Manual trigger button (for testing or non-shake devices) */}
      {!isNativeApp() && (
        <motion.button
          onClick={handleManualShake}
          whileTap={{ scale: 0.95 }}
          className="fixed top-[calc(env(safe-area-inset-top)+70px)] right-4 z-30 p-2 bg-primary rounded-full shadow-lg"
        >
          <Shuffle className="w-5 h-5 text-primary-foreground" />
        </motion.button>
      )}

      {/* Discovery Modal */}
      <AnimatePresence>
        {isVisible && discoveredProduct && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, rotateY: -30 }}
              animate={{ scale: 1, opacity: 1, rotateY: 0 }}
              exit={{ scale: 0.8, opacity: 0, rotateY: 30 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="w-full max-w-sm bg-card rounded-3xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-primary/20 to-accent/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  <span className="font-bold text-foreground">
                    You Discovered!
                  </span>
                </div>
                <button
                  onClick={() => setIsVisible(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Product */}
              <div className="p-6">
                {/* Image */}
                <div className="relative w-full aspect-square bg-muted rounded-2xl overflow-hidden mb-4">
                  {discoveredProduct.image_url ? (
                    <img
                      src={discoveredProduct.image_url}
                      alt={discoveredProduct.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Wine className="w-20 h-20 text-muted-foreground/30" />
                    </div>
                  )}

                  {/* Category badge */}
                  <span className="absolute top-3 left-3 px-2 py-1 bg-black/50 rounded-full text-xs text-white font-medium backdrop-blur-sm">
                    {discoveredProduct.category}
                  </span>
                </div>

                {/* Info */}
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-bold text-foreground">
                    {discoveredProduct.name}
                  </h3>
                  <div className="flex items-center justify-center gap-1">
                    <Star className="w-4 h-4 fill-primary text-primary" />
                    <span className="text-sm text-foreground font-medium">
                      {discoveredProduct.rating}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      ({discoveredProduct.review_count || 0} reviews)
                    </span>
                  </div>
                  <p className="text-2xl font-bold text-primary">
                    R
                    {discoveredProduct.price.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 pt-0 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleWishlist}
                    className="flex items-center justify-center gap-2 py-3 bg-muted rounded-xl font-medium text-foreground"
                  >
                    <Heart className="w-4 h-4" />
                    Save
                  </button>
                  <button
                    onClick={handleAddToCart}
                    className="flex items-center justify-center gap-2 py-3 bg-primary rounded-xl font-medium text-primary-foreground"
                  >
                    <ShoppingCart className="w-4 h-4" />
                    Add
                  </button>
                </div>
                <button
                  onClick={handleManualShake}
                  className="w-full py-2 flex items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Shuffle className="w-4 h-4" />
                  <span className="text-sm">Try another</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ShakeToDiscover;
