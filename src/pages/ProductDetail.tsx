import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Star,
  Heart,
  Minus,
  Plus,
  ShoppingBag,
  Droplets,
  MapPin,
  Wine,
  Share2,
  Flame,
  Sparkles,
  Gem,
} from "lucide-react";
import { getProductImageUrl, StockTier, Product } from "@/data/products";
import { useProduct, useProducts } from "@/hooks/useProducts";
import { useCart } from "@/context/CartContext";
import { useState } from "react";
import ProductCard from "@/components/ProductCard";
import ProductReviews from "@/components/ProductReviews";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "@/hooks/use-toast";
import { useBackInStock } from "@/hooks/useBackInStock";
import { BellRing, BellOff } from "lucide-react";
import ArPreviewButton from "@/components/ArPreviewButton";

type ScarcityTier = Exclude<StockTier, "available">;

const SCARCITY_META: Record<
  ScarcityTier,
  { label: string; icon: typeof Flame; className: string }
> = {
  low: {
    label: "Low Stock",
    icon: Flame,
    className: "bg-primary text-primary-foreground border-primary",
  },
  allocated: {
    label: "Allocated Release",
    icon: Sparkles,
    className: "bg-background/80 text-primary border-primary/70 backdrop-blur-sm",
  },
  cellar_reserve: {
    label: "Cellar Reserve",
    icon: Gem,
    className: "bg-background/90 text-primary border-primary backdrop-blur-sm",
  },
};

const resolveScarcity = (p: Product): ScarcityTier | null => {
  if (p.stock_tier && p.stock_tier !== "available") return p.stock_tier;
  if (
    typeof p.stock_quantity === "number" &&
    p.stock_quantity > 0 &&
    p.stock_quantity <= 5
  ) {
    return "low";
  }
  return null;
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading } = useProduct(id || "");
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [imgError, setImgError] = useState(false);
  const { isInWishlist, toggle: toggleWishlistId } = useWishlist();
  const liked = id ? isInWishlist(id) : false;
  const {
    subscribed: notifySubscribed,
    subscribe: subscribeNotify,
    unsubscribe: unsubscribeNotify,
  } = useBackInStock(id);

  const toggleWishlist = () => {
    if (!id) return;
    const wasLiked = liked;
    toggleWishlistId(id);
    toast({
      title: wasLiked ? "Removed from wishlist" : "Added to wishlist",
    });
  };

  const { data: relatedProducts = [] } = useProducts({
    category: product?.category,
    limit: 4,
  });

  const recommendations = relatedProducts
    .filter((p) => p.id !== product?.id)
    .slice(0, 4);

  // Retailer prices are admin-only data; not shown on storefront

  if (isLoading) {
    return (
      <div className="pb-28 container px-4 pt-6 overflow-x-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Product not found</p>
      </div>
    );
  }

  const imageUrl = imgError
    ? buildPlaceholderImageUrl(product.name, product.category)
    : getProductImageUrl(product);

  return (
    <div className="pb-28">
      {/* Top bar */}
      <div className="container px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex gap-2">
          <button aria-label="Share product" className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors">
            <Share2 className="w-4 h-4 text-foreground" />
          </button>
          <button
            onClick={toggleWishlist}
            className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center hover:bg-muted transition-colors"
          >
            <Heart
              className={`w-5 h-5 transition-colors ${liked ? "fill-primary text-primary" : "text-foreground"}`}
            />
          </button>
        </div>
      </div>

      <div className="container px-4">
        {/* ── Two-column layout on desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left: Full product image */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="relative"
          >
            <div className="sticky top-4 aspect-square bg-secondary rounded-3xl overflow-hidden flex items-center justify-center p-6">
              <img
                src={imageUrl}
                alt={product.name}
                onError={() => setImgError(true)}
                className="w-full h-full object-contain max-h-[600px]"
              />
              {product.is_trending && (
                <span className="absolute top-4 left-4 px-3 py-1 text-[10px] font-bold uppercase tracking-wider warm-gradient text-primary-foreground rounded-lg">
                  Trending
                </span>
              )}
              {product.is_new_arrival && (
                <span className="absolute top-4 left-4 px-3 py-1 text-[10px] font-bold uppercase tracking-wider bg-accent text-accent-foreground rounded-lg">
                  New
                </span>
              )}
              {(() => {
                const scarcity = resolveScarcity(product);
                if (!scarcity) return null;
                const Meta = SCARCITY_META[scarcity];
                const Icon = Meta.icon;
                return (
                  <span
                    className={`absolute top-4 right-4 inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-wider border rounded-lg ${Meta.className}`}
                  >
                    <Icon className="w-3 h-3" strokeWidth={2.5} />
                    {Meta.label}
                  </span>
                );
              })()}
              {((product as any).ar_model_url_ios || (product as any).ar_model_url_android) && (
                <div className="absolute bottom-4 left-4">
                  <ArPreviewButton
                    usdzUrl={(product as any).ar_model_url_ios}
                    glbUrl={(product as any).ar_model_url_android}
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* Right: Product info */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Category & Name */}
            <div>
              <span className="text-xs text-primary uppercase tracking-[0.3em] font-semibold">
                {product.category}
              </span>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground mt-1 leading-tight">
                {product.name}
              </h1>
              <div className="flex items-center gap-3 mt-3">
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < Math.floor(product.rating) ? "fill-primary text-primary" : "text-muted-foreground/30"}`}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-primary">
                  {product.rating}
                </span>
                {product.review_count != null && (
                  <span className="text-xs text-muted-foreground">
                    ({product.review_count} reviews)
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-end gap-3">
              <span className="text-4xl font-display font-bold text-foreground">
                R
                {product.price.toLocaleString("en-ZA", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>
            </div>

            {/* Info Badges */}
            <div className="flex flex-wrap gap-3">
              {product.alcohol_pct && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary">
                  <Droplets className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      ABV
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {product.alcohol_pct}
                    </p>
                  </div>
                </div>
              )}
              {product.bottle_size && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary">
                  <Wine className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Size
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {product.bottle_size}
                    </p>
                  </div>
                </div>
              )}
              {product.country && (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-secondary">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                      Origin
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {product.country}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Add to Cart or Notify Me (when out of stock) */}
            {product.in_stock === false ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between p-4 rounded-2xl border border-destructive/30 bg-destructive/5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-destructive">
                      Out of Stock
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Temporarily unavailable — we'll let you know the moment it
                      returns.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    if (notifySubscribed) {
                      unsubscribeNotify();
                      toast({ title: "Notification cancelled" });
                    } else {
                      subscribeNotify();
                      toast({
                        title: "You're on the list",
                        description:
                          "We'll send a notification when this returns to stock.",
                      });
                    }
                  }}
                  className={`w-full font-semibold h-12 rounded-xl transition-all flex items-center justify-center gap-2 ${
                    notifySubscribed
                      ? "bg-secondary text-foreground border border-border hover:bg-muted"
                      : "warm-gradient text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {notifySubscribed ? (
                    <>
                      <BellOff className="w-4 h-4 shrink-0" />
                      <span>You'll be notified — tap to cancel</span>
                    </>
                  ) : (
                    <>
                      <BellRing className="w-4 h-4 shrink-0" />
                      <span>Notify Me When Available</span>
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex items-center bg-secondary rounded-xl">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-bold text-foreground">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <Button
                  onClick={() => addItem(product, quantity)}
                  className="cta-gold flex-1 font-semibold h-12 rounded-xl flex items-center justify-center gap-2"
                >
                  <ShoppingBag className="w-4 h-4 shrink-0" />
                  <span className="truncate">Add to Cart</span>
                  <span className="shrink-0 opacity-90">
                    R{(product.price * quantity).toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </Button>
              </div>
            )}

            {/* Description & Tasting Notes */}
            {product.description && (
              <div className="p-5 rounded-2xl bg-secondary">
                <h3 className="font-display font-bold text-foreground mb-2">
                  About This Product
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Product Specs */}
            <div className="p-5 rounded-2xl bg-secondary">
              <h3 className="font-display font-bold text-foreground mb-3">
                Product Details
              </h3>
              <div className="space-y-2.5">
                {[
                  ["Category", product.category],
                  product.bottle_size
                    ? ["Bottle Size", product.bottle_size]
                    : null,
                  product.alcohol_pct ? ["Alcohol", product.alcohol_pct] : null,
                  product.country ? ["Country", product.country] : null,
                  ["Rating", `${product.rating} / 5`],
                  product.in_stock
                    ? ["Availability", "In Stock"]
                    : ["Availability", "Out of Stock"],
                ]
                  .filter(Boolean)
                  .map(([label, value]) => (
                    <div
                      key={label as string}
                      className="flex items-center justify-between text-sm border-b border-border/50 pb-2 last:border-none last:pb-0"
                    >
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </motion.div>
        </div>

        {/* ── Full width sections below ── */}
        <div className="mt-10">
          {/* Reviews */}
          <div className="p-5 rounded-2xl bg-secondary max-w-2xl">
            <ProductReviews productId={product.id} />
          </div>
        </div>

        {/* Recommendations */}
        {recommendations.length > 0 && (
          <div className="mt-10">
            <h3 className="font-display text-lg font-bold text-foreground mb-4">
              You May Also Like
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {recommendations.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;
