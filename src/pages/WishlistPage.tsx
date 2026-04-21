import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Trash2, Plus } from "lucide-react";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";
import { getProductImageUrl } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useProducts } from "@/hooks/useProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { Skeleton } from "@/components/ui/skeleton";

// Legacy re-exports — preserved so older imports (e.g. from ProductDetail) keep
// working. The real source of truth is the useWishlist hook; these shims read
// localStorage only and are best-effort for code that hasn't been migrated yet.
const GUEST_KEY = "liqzar-wishlist-guest";
const LEGACY_KEY = "liqzar-wishlist";

const readGuestLegacy = (): string[] => {
  try {
    const modern = localStorage.getItem(GUEST_KEY);
    if (modern) return JSON.parse(modern) as string[];
    const legacy = localStorage.getItem(LEGACY_KEY);
    return legacy ? (JSON.parse(legacy) as string[]) : [];
  } catch {
    return [];
  }
};

export const isInWishlist = (productId: string): boolean =>
  readGuestLegacy().includes(productId);
export const addToWishlist = (productId: string): void => {
  const next = Array.from(new Set([...readGuestLegacy(), productId]));
  localStorage.setItem(GUEST_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("wishlist-updated"));
};
export const removeFromWishlistById = (productId: string): void => {
  const next = readGuestLegacy().filter((id) => id !== productId);
  localStorage.setItem(GUEST_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("wishlist-updated"));
};

const WishlistPage = () => {
  const { addItem } = useCart();
  const { items: wishlistIds, remove, isLoading: wishlistLoading } =
    useWishlist();

  const { data: allProducts = [], isLoading: productsLoading } = useProducts({
    limit: 200,
  });

  const wishlistProducts = allProducts.filter((p) =>
    wishlistIds.includes(p.id),
  );

  const isLoading = wishlistLoading || productsLoading;

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <div className="bg-primary pt-6 pb-4 px-4">
        <div className="container flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Wishlist
            </h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5">
              {wishlistProducts.length} saved items
            </p>
          </div>
        </div>
      </div>

      <div className="container px-4 mt-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-secondary rounded-2xl p-3 flex gap-3">
                <Skeleton className="w-20 h-24 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-24 mt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : wishlistProducts.length === 0 ? (
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Save bottles you're eyeing — they'll be waiting here when you're ready."
            action={{ label: "Browse the collection", to: "/catalogue" }}
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence>
              {wishlistProducts.map((product, i) => (
                <motion.div
                  key={product.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.03 }}
                  className="bg-secondary rounded-2xl p-3 flex gap-3"
                >
                  <Link to={`/product/${product.id}`} className="flex-shrink-0">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className="w-20 h-24 rounded-xl object-cover"
                    />
                  </Link>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {product.brand || product.category}
                    </p>
                    <Link to={`/product/${product.id}`}>
                      <h3 className="text-sm font-semibold text-foreground truncate hover:text-primary transition-colors">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.volume || product.bottle_size}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-bold text-foreground">
                        R
                        {product.price.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => remove(product.id)}
                          className="w-8 h-8 rounded-full bg-background flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors"
                          aria-label="Remove from wishlist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => addItem(product)}
                          className="h-8 px-3 rounded-full bg-foreground text-background text-xs font-semibold flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> Add
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
