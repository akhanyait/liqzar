import { Star, Plus, Flame, Sparkles, Gem } from "lucide-react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useState } from "react";
import { Product, StockTier, getProductImageUrl } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";

type ScarcityTier = Exclude<StockTier, "available">;

const SCARCITY_META: Record<ScarcityTier, { label: string; icon: typeof Flame; className: string }> = {
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
  if (typeof p.stock_quantity === "number" && p.stock_quantity > 0 && p.stock_quantity <= 5) {
    return "low";
  }
  return null;
};

interface ProductCardProps {
  product: Product;
  index?: number;
}

const ProductCard = ({ product, index = 0 }: ProductCardProps) => {
  const { addItem } = useCart();
  const [imgSrc, setImgSrc] = useState(() => getProductImageUrl(product));
  const [imgError, setImgError] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);

  const handleImgError = () => {
    if (!imgError) {
      setImgError(true);
      setImgSrc(buildPlaceholderImageUrl(product.name, product.category));
    }
  };

  const isOutOfStock =
    "stock_quantity" in product && (product as any).stock_quantity === 0;
  const scarcity = resolveScarcity(product);
  const ScarcityIcon = scarcity ? SCARCITY_META[scarcity].icon : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: Math.min(index * 0.06, 0.5),
        duration: 0.55,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -4 }}
      className="group"
    >
      {/* Card chrome: bg, border, shadow, rounded, press feedback */}
      <div className="bg-card border border-border/60 rounded-2xl overflow-hidden shadow-[0_2px_8px_hsl(220_15%_20%/0.06),0_0_0_1px_hsl(var(--border)/0.4)] hover:shadow-[0_10px_30px_hsl(var(--gold)/0.18),0_0_0_1px_hsl(var(--gold)/0.25)] transition-all duration-500 ease-out active:scale-[0.98] active:duration-75 transform-gpu will-change-transform">
        <Link to={`/product/${product.id}`} className="block" tabIndex={0}>
          {/* Image container — portrait 3:4 matches bottle proportions */}
          <div className="relative aspect-[3/4] overflow-hidden bg-secondary/60">
            {/* Skeleton while loading */}
            {!imgLoaded && (
              <div
                className="absolute inset-0 skeleton-shimmer"
                aria-hidden
              />
            )}

            <img
              src={imgSrc}
              alt={product.name}
              onError={handleImgError}
              onLoad={() => setImgLoaded(true)}
              className={[
                "w-full h-full object-contain p-3 transition-all duration-500",
                "group-hover:scale-[1.04]",
                imgLoaded ? "opacity-100" : "opacity-0",
              ].join(" ")}
              loading="lazy"
              draggable={false}
            />

            {/* Subtle gradient at bottom for readability */}
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card/40 to-transparent pointer-events-none" />

            {/* Sale badge */}
            {product.originalPrice && !isOutOfStock && (
              <span className="absolute top-2.5 left-2.5 px-2 py-0.5 text-[10px] font-bold warm-gradient text-primary-foreground rounded-md shadow-sm tracking-wide">
                SALE
              </span>
            )}

            {/* Scarcity badge — top-right; signals allocation tier */}
            {scarcity && !isOutOfStock && ScarcityIcon && (
              <span
                className={[
                  "absolute top-2.5 right-2.5",
                  "inline-flex items-center gap-1 px-2 py-0.5",
                  "text-[10px] font-bold uppercase tracking-widest",
                  "rounded-md border",
                  SCARCITY_META[scarcity].className,
                ].join(" ")}
              >
                <ScarcityIcon className="w-3 h-3" strokeWidth={2.5} />
                {SCARCITY_META[scarcity].label}
              </span>
            )}

            {/* Out of stock overlay */}
            {isOutOfStock && (
              <span className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                <span className="px-3 py-1 text-xs font-semibold bg-muted/90 text-muted-foreground rounded-full border border-border/50">
                  Out of stock
                </span>
              </span>
            )}

            {/* Add to cart — always visible on mobile, hover on desktop */}
            {!isOutOfStock && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  addItem(product);
                }}
                aria-label={`Add ${product.name} to cart`}
                className={[
                  "absolute bottom-2.5 right-2.5",
                  "w-11 h-11 warm-gradient rounded-xl",
                  "flex items-center justify-center",
                  "shadow-[0_2px_8px_hsl(var(--gold)/0.4)]",
                  "transition-all duration-200 hover:scale-110 active:scale-95",
                  "text-primary-foreground",
                  // Always visible mobile; appear on hover desktop
                  "opacity-100 md:opacity-0 md:group-hover:opacity-100",
                  "focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:outline-none",
                ].join(" ")}
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            )}
          </div>

          {/* Product info */}
          <div className="p-3 space-y-1">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest truncate">
              {product.category}
            </p>
            <h3 className="text-sm font-semibold text-foreground leading-snug line-clamp-2 min-h-[2.5rem]">
              {product.name}
            </h3>
            <div className="flex items-center gap-1 pt-0.5">
              <Star className="w-3 h-3 fill-primary text-primary flex-shrink-0" />
              <span className="text-xs font-medium text-foreground/80">
                {product.rating}
              </span>
            </div>
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-base font-bold text-foreground">
                R{Math.round(product.price).toLocaleString("en-ZA")}
              </span>
              {product.originalPrice && (
                <span className="text-xs text-muted-foreground line-through">
                  R{Math.round(product.originalPrice).toLocaleString("en-ZA")}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </motion.div>
  );
};

export default ProductCard;
