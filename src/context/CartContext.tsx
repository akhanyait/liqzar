import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { Product } from "@/data/products";

const CART_STORAGE_KEY = "liqzar-cart";

interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  vatAmount: number;
  deliveryFee: number;
  discountAmount: number;
  discountCode: string;
  applyDiscount: (code: string) => boolean;
  removeDiscount: () => void;
  total: number;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  /** @deprecated use subtotal */
  totalPrice: number;
}

const DELIVERY_THRESHOLD = 150;
const DELIVERY_FEE = 9.99;
// South African VAT rate (15%) - prices are VAT-inclusive
const VAT_RATE = 0.15;
const VAT_DIVISOR = 1 + VAT_RATE; // 1.15
// Maximum units per product per order (liquor compliance / stock fairness)
const MAX_QUANTITY_PER_ITEM = 24;

const DISCOUNT_CODES: Record<
  string,
  { type: "percent" | "fixed"; value: number; label: string }
> = {
  WELCOME10: { type: "percent", value: 10, label: "10% off" },
  PREMIUM20: { type: "percent", value: 20, label: "20% off" },
  SAVE50: { type: "fixed", value: 50, label: "R50 off" },
  FREEDELIVERY: { type: "fixed", value: DELIVERY_FEE, label: "Free delivery" },
};

const CartContext = createContext<CartContextType | null>(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Initialize cart from localStorage
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [discountCode, setDiscountCode] = useState("");

  // Persist cart to localStorage whenever items change
  useEffect(() => {
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error("Failed to save cart to localStorage", e);
    }
  }, [items]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        const newQty = Math.min(
          existing.quantity + quantity,
          MAX_QUANTITY_PER_ITEM,
        );
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, quantity: newQty } : i,
        );
      }
      return [
        ...prev,
        { product, quantity: Math.min(quantity, MAX_QUANTITY_PER_ITEM) },
      ];
    });
    setIsCartOpen(true);
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      const capped = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
      setItems((prev) =>
        prev.map((i) =>
          i.product.id === productId ? { ...i, quantity: capped } : i,
        ),
      );
    }
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setDiscountCode("");
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.product.price * i.quantity, 0),
    [items],
  );

  // VAT is included in prices - this shows the VAT component for transparency
  // Formula: VAT = Total inclusive price - (Total inclusive price / 1.15)
  const vatAmount = useMemo(
    () => +(subtotal - subtotal / VAT_DIVISOR).toFixed(2),
    [subtotal],
  );

  const deliveryFee =
    subtotal >= DELIVERY_THRESHOLD || subtotal === 0 ? 0 : DELIVERY_FEE;

  const discountAmount = useMemo(() => {
    if (!discountCode) return 0;
    const disc = DISCOUNT_CODES[discountCode];
    if (!disc) return 0;
    if (disc.type === "percent")
      return +(subtotal * (disc.value / 100)).toFixed(2);
    return Math.min(disc.value, subtotal + deliveryFee);
  }, [discountCode, subtotal, deliveryFee]);

  const total = Math.max(0, subtotal + deliveryFee - discountAmount);

  const applyDiscount = useCallback((code: string): boolean => {
    const upper = code.trim().toUpperCase();
    if (DISCOUNT_CODES[upper]) {
      setDiscountCode(upper);
      return true;
    }
    return false;
  }, []);

  const removeDiscount = useCallback(() => setDiscountCode(""), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        subtotal,
        vatAmount,
        deliveryFee,
        discountAmount,
        discountCode,
        applyDiscount,
        removeDiscount,
        total,
        isCartOpen,
        setIsCartOpen,
        totalPrice: subtotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
