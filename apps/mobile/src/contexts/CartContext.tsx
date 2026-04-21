import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../lib/supabase";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  category: string;
  bottle_size?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  validateCart: () => Promise<{ valid: boolean; removed: string[] }>;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_STORAGE_KEY = "@liqzar_cart";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const loadedRef = useRef(false);

  // Load cart from storage on mount
  useEffect(() => {
    loadCart();
  }, []);

  // Save cart to storage whenever it changes
  useEffect(() => {
    if (!loadedRef.current) return;
    saveCart();
  }, [items]);

  const loadCart = async () => {
    try {
      const stored = await AsyncStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        setItems(JSON.parse(stored));
      }
    } catch (error) {
      console.error("Failed to load cart:", error);
    } finally {
      loadedRef.current = true;
    }
  };

  const saveCart = async () => {
    try {
      await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error("Failed to save cart:", error);
    }
  };

  const addItem = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      setItems((current) => {
        const existing = current.find((i) => i.id === item.id);
        if (existing) {
          const newQty = Math.min(existing.quantity + quantity, 20);
          return current.map((i) =>
            i.id === item.id ? { ...i, quantity: newQty } : i,
          );
        }
        return [...current, { ...item, quantity: Math.min(quantity, 20) }];
      });
    },
    [],
  );

  const removeItem = useCallback((id: string) => {
    setItems((current) => current.filter((i) => i.id !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((current) => current.filter((i) => i.id !== id));
      return;
    }
    setItems((current) =>
      current.map((i) => (i.id === id ? { ...i, quantity } : i)),
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const validateCart = useCallback(async () => {
    if (items.length === 0) return { valid: true, removed: [] as string[] };

    const productIds = items.map(i => i.id);
    const { data: products } = await supabase
      .from("products")
      .select("id, price, in_stock, stock_quantity")
      .in("id", productIds);

    if (!products) return { valid: true, removed: [] };

    const productMap = new Map(products.map(p => [p.id, p]));
    const removed: string[] = [];

    const validItems = items.filter(item => {
      const product = productMap.get(item.id);
      if (!product || !product.in_stock || product.stock_quantity < 1) {
        removed.push(item.name);
        return false;
      }
      return true;
    });

    if (removed.length > 0) {
      setItems(validItems);
    }

    return { valid: removed.length === 0, removed };
  }, [items]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [items],
  );
  const itemCount = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items],
  );

  const value = useMemo(
    () => ({
      items,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      validateCart,
      total,
      itemCount,
    }),
    [items, addItem, removeItem, updateQuantity, clearCart, validateCart, total, itemCount],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
