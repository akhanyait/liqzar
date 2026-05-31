import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Product, getProductImageUrl } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { useRef, useState } from "react";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";
import { Skeleton } from "@/components/ui/skeleton";

interface TrendingNowProps {
  products: Product[];
  isLoading: boolean;
}

function getBadge(product: Product) {
  if (product.is_new_arrival || product.isNewArrival)
    return { label: "New", color: "bg-primary text-primary-foreground" };
  if (product.is_trending || product.isTrending)
    return { label: "Popular", color: "bg-accent text-accent-foreground" };
  if (product.originalPrice)
    return {
      label: `Save R${Math.round(product.originalPrice - product.price).toLocaleString("en-ZA")}`,
      color: "bg-destructive text-destructive-foreground",
    };
  if (product.is_best_seller || product.isBestSeller)
    return { label: "Best Seller", color: "bg-foreground text-background" };
  return null;
}

const TrendingNow = ({ products, isLoading }: TrendingNowProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: dir === "left" ? -300 : 300,
      behavior: "smooth",
    });
  };

  return (
    <section className="mt-12">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Trending Now
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          The bottles everyone's talking about
        </p>
      </div>

      <div className="relative">
        {/* Scroll arrows */}
        <button
          onClick={() => scroll("left")}
          aria-label="Scroll trending products left"
          className="absolute -left-1 md:left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors hidden md:flex"
        >
          <ChevronLeft className="w-4 h-4 text-foreground" />
        </button>
        <button
          onClick={() => scroll("right")}
          aria-label="Scroll trending products right"
          className="absolute -right-1 md:right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-secondary transition-colors hidden md:flex"
        >
          <ChevronRight className="w-4 h-4 text-foreground" />
        </button>

        <div
          ref={scrollRef}
          className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-none px-4 md:px-12 py-2"
        >
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 w-[140px] md:w-[160px] flex flex-col items-center"
                >
                  <Skeleton className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-full" />
                  <Skeleton className="h-3 w-24 mt-3" />
                  <Skeleton className="h-3 w-16 mt-1.5" />
                </div>
              ))
            : products.map((product, i) => (
                <TrendingCard key={product.id} product={product} index={i} />
              ))}
        </div>
      </div>
    </section>
  );
};

function TrendingCard({ product, index }: { product: Product; index: number }) {
  const { addItem } = useCart();
  const [imgSrc, setImgSrc] = useState(() => getProductImageUrl(product));
  const [imgError, setImgError] = useState(false);
  const badge = getBadge(product);

  const handleImgError = () => {
    if (!imgError) {
      setImgError(true);
      setImgSrc(buildPlaceholderImageUrl(product.name, product.category));
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex-shrink-0 w-[140px] md:w-[160px] group"
    >
      <Link
        to={`/product/${product.id}`}
        className="flex flex-col items-center text-center"
      >
        <div className="relative">
          {/* Circular image container */}
          <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-full bg-secondary border-2 border-border/50 overflow-hidden transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-lg">
            <img
              src={imgSrc}
              alt={product.name}
              onError={handleImgError}
              className="w-full h-full object-contain p-3 transition-transform duration-500 group-hover:scale-110"
              loading="lazy"
            />
          </div>

          {/* Badge */}
          {badge && (
            <span
              className={`absolute -top-1 left-1/2 -translate-x-1/2 px-2.5 py-0.5 text-[9px] font-bold rounded-full shadow-sm whitespace-nowrap ${badge.color}`}
            >
              {badge.label}
            </span>
          )}

          {/* Quick add button */}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              addItem(product);
            }}
            aria-label={`Add ${product.name} to cart`}
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full warm-gradient text-primary-foreground flex items-center justify-center shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <h3 className="text-xs font-semibold text-foreground mt-3 leading-tight line-clamp-2 px-1">
          {product.name}
        </h3>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {product.bottle_size || product.volume || ""}
          {(product.bottle_size || product.volume) && product.alcohol_pct
            ? " / "
            : ""}
          {product.alcohol_pct || ""}
        </p>
        <p className="text-sm font-bold text-foreground mt-1">
          R{Math.round(product.price).toLocaleString('en-ZA')}
        </p>
      </Link>
    </motion.div>
  );
}

export default TrendingNow;
