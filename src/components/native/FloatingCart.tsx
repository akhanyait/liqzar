import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingCart, X, Minus, Plus, Trash2, ChevronUp } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useHaptics, isNativeApp } from "@/hooks/useNativeFeatures";
import { useNavigate } from "react-router-dom";

const FloatingCart = () => {
  const { items, total, updateQuantity, removeItem, totalItems } = useCart();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showBounce, setShowBounce] = useState(false);
  const { impact, notification } = useHaptics();
  const navigate = useNavigate();

  const itemCount = totalItems;

  // Bounce animation when item added
  useEffect(() => {
    if (itemCount > 0) {
      setShowBounce(true);
      impact("medium");
      setTimeout(() => setShowBounce(false), 300);
    }
  }, [itemCount]);

  const handleToggle = () => {
    impact("light");
    setIsExpanded(!isExpanded);
  };

  const handleCheckout = () => {
    impact("medium");
    notification("success");
    setIsExpanded(false);
    navigate("/checkout");
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    impact("light");
    const item = items.find((i) => i.product.id === productId);
    if (item) {
      const newQty = item.quantity + delta;
      if (newQty <= 0) {
        removeItem(productId);
        notification("warning");
      } else {
        updateQuantity(productId, newQty);
      }
    }
  };

  const handleRemove = (productId: string) => {
    impact("medium");
    notification("warning");
    removeItem(productId);
  };

  // Don't show if cart is empty
  if (itemCount === 0) return null;

  // Only show on mobile
  if (
    !isNativeApp() &&
    typeof window !== "undefined" &&
    window.innerWidth > 768
  ) {
    return null;
  }

  return (
    <>
      {/* Backdrop when expanded */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsExpanded(false)}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Floating Cart Button / Expanded Panel */}
      <motion.div
        layout
        className={`fixed z-50 ${
          isExpanded
            ? "inset-x-4 bottom-[calc(5rem+env(safe-area-inset-bottom))]"
            : "right-4 bottom-[calc(6rem+env(safe-area-inset-bottom))]"
        }`}
      >
        <AnimatePresence mode="wait">
          {isExpanded ? (
            // Expanded cart panel
            <motion.div
              key="expanded"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-card rounded-2xl shadow-2xl border border-border overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-foreground">
                    Cart ({itemCount})
                  </h3>
                </div>
                <button
                  onClick={handleToggle}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              {/* Items */}
              <div className="max-h-[40vh] overflow-auto p-4 space-y-3">
                {items.map((item) => (
                  <motion.div
                    key={item.product.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="flex items-center gap-3 bg-muted/50 rounded-xl p-3"
                  >
                    {/* Image */}
                    <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      {item.product.image_url ? (
                        <img
                          src={item.product.image_url}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <ShoppingCart className="w-5 h-5 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R
                        {item.product.price.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleQuantityChange(item.product.id, -1)
                        }
                        className="w-7 h-7 rounded-full bg-muted flex items-center justify-center"
                      >
                        <Minus className="w-3 h-3 text-foreground" />
                      </button>
                      <span className="text-sm font-bold text-foreground w-5 text-center">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.product.id, 1)}
                        className="w-7 h-7 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Plus className="w-3 h-3 text-primary-foreground" />
                      </button>
                    </div>

                    {/* Remove */}
                    <button
                      onClick={() => handleRemove(item.product.id)}
                      className="w-7 h-7 rounded-full flex items-center justify-center text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-border space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-lg font-bold text-foreground">
                    R
                    {total.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3.5 bg-primary text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  <ShoppingCart className="w-4 h-4" />
                  Checkout
                </button>
              </div>
            </motion.div>
          ) : (
            // Floating button
            <motion.button
              key="collapsed"
              onClick={handleToggle}
              whileTap={{ scale: 0.9 }}
              animate={showBounce ? { scale: [1, 1.2, 1] } : {}}
              className="relative w-14 h-14 bg-primary rounded-full shadow-lg flex items-center justify-center"
            >
              <ShoppingCart className="w-6 h-6 text-primary-foreground" />

              {/* Badge */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-destructive rounded-full flex items-center justify-center"
              >
                <span className="text-xs font-bold text-destructive-foreground">
                  {itemCount}
                </span>
              </motion.div>

              {/* Expand hint */}
              <motion.div
                className="absolute -top-6"
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <ChevronUp className="w-4 h-4 text-primary" />
              </motion.div>
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};

export default FloatingCart;
