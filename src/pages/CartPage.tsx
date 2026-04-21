import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import {
  Minus,
  Plus,
  X,
  Truck,
  ShieldCheck,
  Clock,
  Tag,
  Percent,
  Trash2,
  ShoppingBag,
  Gift,
  ArrowRight,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import { useCart } from "@/context/CartContext";

const CartPage = () => {
  const navigate = useNavigate();
  const {
    items,
    removeItem,
    updateQuantity,
    clearCart,
    subtotal,
    vatAmount,
    deliveryFee,
    discountAmount,
    discountCode,
    applyDiscount,
    removeDiscount,
    total,
    totalItems,
  } = useCart();
  const [promoInput, setPromoInput] = useState("");
  const [promoError, setPromoError] = useState("");
  const [promoSuccess, setPromoSuccess] = useState(false);

  const handleApplyPromo = () => {
    setPromoError("");
    setPromoSuccess(false);
    if (!promoInput.trim()) return;
    const ok = applyDiscount(promoInput);
    if (ok) {
      setPromoSuccess(true);
      setPromoInput("");
    } else {
      setPromoError("Invalid promo code");
    }
  };

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <div className="bg-primary pt-6 pb-4 px-4">
        <div className="container flex items-center gap-3">
          <BackButton />
          <div className="flex-1">
            <h1 className="text-xl font-bold text-primary-foreground">Cart</h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5">
              {totalItems > 0
                ? `${totalItems} items in your cart`
                : "Your shopping cart"}
            </p>
          </div>
          {items.length > 0 && (
            <button
              onClick={clearCart}
              className="flex items-center gap-1 text-xs text-primary-foreground/70 hover:text-primary-foreground"
            >
              <Trash2 className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className="container px-4 mt-4">
        {items.length === 0 ? (
          <div className="bg-background border border-border rounded-2xl p-8 text-center">
            <ShoppingBag
              className="w-10 h-10 text-muted-foreground mx-auto mb-3"
              strokeWidth={1.5}
            />
            <h3 className="font-bold text-foreground">Your cart is empty</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Discover our premium collection.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold text-sm"
            >
              <Plus className="w-4 h-4" /> Start Shopping
            </Link>
          </div>
        ) : (
          <div className="md:flex md:gap-6">
            <div className="flex-1 space-y-3">
              <AnimatePresence>
                {items.map(({ product, quantity }, i) => (
                  <motion.div
                    key={product.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    className="bg-secondary p-3 rounded-2xl flex gap-3"
                  >
                    <Link
                      to={`/product/${product.id}`}
                      className="flex-shrink-0"
                    >
                      <img
                        src={product.image}
                        alt={product.name}
                        className="w-20 h-24 rounded-xl object-cover"
                      />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {product.brand}
                      </p>
                      <h3 className="text-sm font-semibold truncate text-foreground">
                        {product.name}
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {product.volume}
                      </p>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() =>
                              updateQuantity(product.id, quantity - 1)
                            }
                            className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center"
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
                            className="w-7 h-7 rounded-full border border-border bg-background flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="font-bold text-foreground">
                          R
                          {(product.price * quantity).toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
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

              {subtotal < 150 && (
                <div className="bg-secondary rounded-2xl p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Truck className="w-4 h-4 text-primary" />
                    <span className="text-muted-foreground">
                      Add{" "}
                      <span className="font-bold text-primary">
                        R
                        {(150 - subtotal).toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>{" "}
                      for free delivery
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border mt-2 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{
                        width: `${Math.min(100, (subtotal / 150) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="md:w-80 mt-6 md:mt-0">
              <div className="bg-secondary p-5 rounded-2xl md:sticky md:top-36 space-y-4">
                <h3 className="font-bold text-foreground text-lg">
                  Order Summary
                </h3>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-medium text-foreground">
                      Promo Code
                    </span>
                  </div>
                  {discountCode ? (
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-primary/10">
                      <div className="flex items-center gap-2">
                        <Gift className="w-4 h-4 text-primary" />
                        <div>
                          <p className="text-xs font-bold text-primary">
                            {discountCode}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            -R
                            {discountAmount.toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}{" "}
                            applied
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={removeDiscount}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoInput}
                        onChange={(e) => {
                          setPromoInput(e.target.value.toUpperCase());
                          setPromoError("");
                          setPromoSuccess(false);
                        }}
                        placeholder="Enter code"
                        className="flex-1 h-9 px-3 rounded-xl bg-background border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-foreground/10"
                        onKeyDown={(e) =>
                          e.key === "Enter" && handleApplyPromo()
                        }
                      />
                      <button
                        onClick={handleApplyPromo}
                        className="px-3 h-9 rounded-xl bg-foreground text-background text-xs font-semibold"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                  {promoError && (
                    <p className="text-[10px] text-destructive mt-1">
                      {promoError}
                    </p>
                  )}
                  {promoSuccess && (
                    <p className="text-[10px] text-primary mt-1">
                      Promo code applied!
                    </p>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium">
                      R
                      {subtotal.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground text-xs">
                      Incl. VAT (15%)
                    </span>
                    <span className="text-xs text-muted-foreground">
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
                        deliveryFee === 0 ? "text-primary font-medium" : ""
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
                  <div className="border-t border-border pt-3 flex justify-between items-center">
                    <span className="font-bold text-foreground">Total</span>
                    <span className="text-2xl font-bold text-foreground">
                      R
                      {total.toLocaleString("en-ZA", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => navigate("/checkout")}
                  className="cta-gold w-full font-semibold h-12 rounded-full text-sm inline-flex items-center justify-center gap-2"
                >
                  Go to checkout <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {items.length > 0 && (
        <div
          className="md:hidden fixed bottom-[64px] left-0 right-0 z-40 px-4 pb-3 pt-2 bg-gradient-to-t from-background via-background to-background/85 backdrop-blur-sm border-t border-border/40"
          role="region"
          aria-label="Cart checkout summary"
        >
          <button
            onClick={() => navigate("/checkout")}
            className="cta-gold w-full h-14 rounded-full font-semibold text-sm flex items-center justify-between px-5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              {totalItems} {totalItems === 1 ? "item" : "items"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-base font-bold">
                R
                {total.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
              <ArrowRight className="w-4 h-4" />
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default CartPage;
