import { X, Minus, Plus, ShoppingBag, ArrowLeft } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";

const CartDrawer = () => {
  const {
    items,
    removeItem,
    updateQuantity,
    subtotal,
    vatAmount,
    deliveryFee,
    total,
    discountAmount,
    isCartOpen,
    setIsCartOpen,
  } = useCart();
  const navigate = useNavigate();

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent
        className="bg-background border-border w-full sm:max-w-md flex flex-col p-0 safe-area-top safe-area-bottom"
        hideCloseButton
      >
        {/* Custom Header with safe area */}
        <div className="border-b border-border p-4 flex items-center gap-3">
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-foreground text-lg flex items-center gap-2 flex-1">
            <ShoppingBag className="w-5 h-5" />
            Your cart
          </h2>
          <button
            onClick={() => setIsCartOpen(false)}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-secondary"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground p-4">
            <ShoppingBag className="w-16 h-16 opacity-20" />
            <p className="text-lg font-bold">Your cart is empty</p>
            <p className="text-sm">Add items to get started</p>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <AnimatePresence>
                {items.map(({ product, quantity }) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="flex gap-3 p-3 rounded-2xl bg-secondary"
                  >
                    <img
                      src={
                        product.image_url ||
                        product.image ||
                        buildPlaceholderImageUrl(product.name, product.category)
                      }
                      alt={product.name}
                      className="w-16 h-20 rounded-xl object-contain bg-muted"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {product.brand}
                      </p>
                      <h4 className="text-sm font-semibold truncate text-foreground">
                        {product.name}
                      </h4>
                      <p className="text-sm font-bold text-foreground mt-1">
                        R
                        {(product.price * quantity).toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <button
                          onClick={() =>
                            updateQuantity(product.id, quantity - 1)
                          }
                          className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-sm font-bold w-5 text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() =>
                            updateQuantity(product.id, quantity + 1)
                          }
                          className="w-7 h-7 rounded-full border border-border flex items-center justify-center hover:bg-background transition-colors"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => removeItem(product.id)}
                      className="text-muted-foreground hover:text-foreground self-start"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            <div className="border-t border-border p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground font-medium">
                  R
                  {subtotal.toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Incl. VAT (15%)</span>
                <span className="text-muted-foreground">
                  R
                  {vatAmount.toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Delivery</span>
                <span
                  className={
                    deliveryFee === 0
                      ? "text-primary font-medium"
                      : "text-foreground"
                  }
                >
                  {deliveryFee === 0
                    ? "Free"
                    : `R${deliveryFee.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-primary">Discount</span>
                  <span className="text-primary font-medium">
                    -R
                    {discountAmount.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div className="border-t border-border pt-2 flex justify-between items-center">
                <span className="font-bold text-foreground">Total</span>
                <span className="text-xl font-bold text-foreground">
                  R
                  {total.toLocaleString("en-ZA", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <button
                onClick={() => {
                  setIsCartOpen(false);
                  navigate("/cart");
                }}
                className="w-full bg-foreground text-background font-semibold h-12 rounded-full hover:bg-foreground/90 transition-colors mt-2 text-sm"
              >
                Go to checkout · R
                {total.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
