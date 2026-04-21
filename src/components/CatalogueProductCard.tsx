import { Heart, Plus, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { Product, getProductImageUrl } from "@/data/products";
import { useCart } from "@/context/CartContext";
import { memo, useCallback, useState } from "react";
import { buildPlaceholderImageUrl } from "@/lib/product-utils";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeProduct } from "@/lib/product-utils";

interface CatalogueProductCardProps {
  product: Product;
  index?: number;
}

const CatalogueProductCard = memo(({ product }: CatalogueProductCardProps) => {
  const { addItem } = useCart();
  const queryClient = useQueryClient();
  const [wishlisted, setWishlisted] = useState(false);
  const [imageSrc, setImageSrc] = useState(() => getProductImageUrl(product));
  const [imgError, setImgError] = useState(false);

  // Fallback: generate branded SVG bottle placeholder
  const fetchWebBottleImage = (name: string) => {
    setImageSrc(buildPlaceholderImageUrl(name, product.category));
  };

  // Prefetch product data on touch/hover for instant navigation
  const prefetchProduct = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ["product", product.id],
      queryFn: async () => {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("id", product.id)
          .single();
        return normalizeProduct(data as Product);
      },
      staleTime: 60000,
    });
  }, [product.id, queryClient]);

  const fallbackImage = buildPlaceholderImageUrl(
    product.name,
    product.category,
  );

  const discount = product.originalPrice
    ? Math.round(
        ((product.originalPrice - product.price) / product.originalPrice) * 100,
      )
    : null;

  return (
    <div className="group animate-in fade-in duration-200">
      <div className="flex flex-col h-full">
        <Link
          to={`/product/${product.id}`}
          onTouchStart={prefetchProduct}
          onMouseEnter={prefetchProduct}
          className="block relative aspect-[3/4] overflow-hidden rounded-2xl bg-secondary mb-2 active:scale-[0.98] transition-transform"
        >
          <img
            src={imageSrc}
            alt={product.name}
            className="w-full h-full object-contain p-2 transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={() => {
              if (!imgError) {
                setImgError(true);
                // Try to fetch from web as JPG
                fetchWebBottleImage(product.name);
              }
            }}
          />
          {discount && (
            <span className="absolute top-2 left-2 px-2 py-0.5 text-[10px] font-bold bg-primary text-primary-foreground rounded-full">
              -{discount}%
            </span>
          )}
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setWishlisted(!wishlisted);
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/90 flex items-center justify-center shadow-sm"
          >
            <Heart
              className={`w-3.5 h-3.5 ${wishlisted ? "fill-red-500 text-red-500" : "text-muted-foreground"}`}
            />
          </button>
        </Link>

        <div className="flex flex-col flex-1">
          <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
            {product.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {product.category}
            {product.bottle_size ? ` · ${product.bottle_size}` : ""}
          </p>

          <div className="flex items-center gap-1 mt-1">
            <Star className="w-3 h-3 fill-foreground text-foreground" />
            <span className="text-xs font-medium">{product.rating}</span>
          </div>

          <div className="mt-auto pt-2">
            <div className="flex items-baseline gap-1.5">
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

          <button
            onClick={() => addItem(product)}
            className="mt-2 w-full h-9 bg-foreground text-background text-xs font-semibold rounded-full flex items-center justify-center gap-1 active:scale-95 transition-transform"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>
      </div>
    </div>
  );
});

CatalogueProductCard.displayName = "CatalogueProductCard";

export default CatalogueProductCard;
