import { useState } from "react";
import { cn } from "@/lib/utils";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";

/**
 * ProductImage — unified surface for every bottle/pack image in LIQZAR.
 *
 * Why: real product photography arrives from multiple sources (scraped,
 * supplier, user-upload, Supabase storage) with inconsistent crops,
 * backgrounds, and aspect ratios. Without a single enforced container the
 * catalogue wall looks noisy no matter how good the tokens are.
 *
 * This component normalises the visual discipline:
 *   - portrait 3:4 aspect by default (matches bottle proportions)
 *   - soft champagne backdrop + inner radial glow so photos with transparent
 *     or mismatched backgrounds sit harmoniously
 *   - object-contain + padding (never cropped)
 *   - skeleton shimmer while loading
 *   - silent fallback to category-coloured placeholder on error
 *   - optional hover-scale for catalogue cards
 */
type AspectRatio = "portrait" | "square" | "hero";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  productName: string;
  category?: string | null;
  aspectRatio?: AspectRatio;
  hoverZoom?: boolean;
  rounded?: "sm" | "md" | "lg" | "xl" | "2xl";
  padding?: "none" | "sm" | "md" | "lg";
  className?: string;
  priority?: boolean;
}

const ASPECT: Record<AspectRatio, string> = {
  portrait: "aspect-[3/4]",
  square: "aspect-square",
  hero: "aspect-[4/3]",
};

const PADDING: Record<NonNullable<ProductImageProps["padding"]>, string> = {
  none: "p-0",
  sm: "p-2",
  md: "p-3",
  lg: "p-5",
};

const ROUNDED: Record<NonNullable<ProductImageProps["rounded"]>, string> = {
  sm: "rounded-lg",
  md: "rounded-xl",
  lg: "rounded-2xl",
  xl: "rounded-3xl",
  "2xl": "rounded-[2rem]",
};

export const ProductImage = ({
  src,
  alt,
  productName,
  category,
  aspectRatio = "portrait",
  hoverZoom = false,
  rounded = "lg",
  padding = "md",
  className,
  priority = false,
}: ProductImageProps) => {
  const [imgSrc, setImgSrc] = useState(
    () => src || buildPlaceholderImageUrl(productName, category),
  );
  const [hasErrored, setHasErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const handleError = () => {
    if (!hasErrored) {
      setHasErrored(true);
      setImgSrc(buildPlaceholderImageUrl(productName, category));
    }
  };

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        ASPECT[aspectRatio],
        ROUNDED[rounded],
        // Unified neutral backdrop — warm champagne in light, deep espresso
        // in dark. Inner radial glow creates a subtle spotlight so bottles
        // pop against mixed-source photography.
        "bg-gradient-to-br from-secondary/40 via-secondary/20 to-secondary/50",
        "dark:from-muted/30 dark:via-muted/10 dark:to-muted/40",
        "before:absolute before:inset-0 before:pointer-events-none",
        "before:bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.08)_0%,transparent_60%)]",
        "dark:before:bg-[radial-gradient(ellipse_at_center,hsl(var(--gold)/0.12)_0%,transparent_65%)]",
        // Hairline inner border for definition
        "after:absolute after:inset-0 after:pointer-events-none",
        "after:rounded-[inherit] after:ring-1 after:ring-inset after:ring-border/40",
        className,
      )}
    >
      {!loaded && (
        <div className="absolute inset-0 skeleton-shimmer" aria-hidden />
      )}

      <img
        src={imgSrc}
        alt={alt}
        onError={handleError}
        onLoad={() => setLoaded(true)}
        draggable={false}
        loading={priority ? "eager" : "lazy"}
        decoding={priority ? "sync" : "async"}
        className={cn(
          "relative z-[1] w-full h-full object-contain transition-all duration-500 ease-out",
          PADDING[padding],
          loaded ? "opacity-100" : "opacity-0",
          hoverZoom && "group-hover:scale-[1.05]",
        )}
      />
    </div>
  );
};

export default ProductImage;
