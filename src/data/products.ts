export type StockTier = "available" | "low" | "allocated" | "cellar_reserve";

export interface Product {
  id: string;
  name: string;
  category: string;
  bottle_size?: string | null;
  country?: string | null;
  alcohol_pct?: string | null;
  price: number;
  cheapest_retailer?: string | null;
  checkers_price?: number | null;
  pnp_price?: number | null;
  tops_price?: number | null;
  woolworths_price?: number | null;
  norman_price?: number | null;
  makro_price?: number | null;
  image_url?: string | null;
  image_search_url?: string | null;
  product_search_url?: string | null;
  description?: string | null;
  rating: number;
  review_count?: number;
  in_stock?: boolean;
  is_featured?: boolean;
  is_trending?: boolean;
  is_best_seller?: boolean;
  is_new_arrival?: boolean;
  created_at?: string;
  updated_at?: string;
  // Stock management
  stock_quantity?: number | null;
  reorder_level?: number | null;
  max_stock_level?: number | null;
  units_sold_30d?: number | null;
  units_sold_7d?: number | null;
  last_restock_date?: string | null;
  last_sold_date?: string | null;
  // Pricing
  markup_pct?: number | null;
  // Legacy compat fields
  brand?: string;
  subcategory?: string;
  image?: string;
  reviews?: number;
  alcohol?: number;
  volume?: string;
  origin?: string;
  tastingNotes?: string[];
  originalPrice?: number;
  isFeatured?: boolean;
  isTrending?: boolean;
  isStaffPick?: boolean;
  isBestSeller?: boolean;
  isNewArrival?: boolean;
  isPremiumCollection?: boolean;
  stock_tier?: StockTier;
}

import { buildPlaceholderImageUrl } from "@/lib/product-utils";

const sanitizeImageUrl = (url: string): string => {
  const decoded = url
    .replace(/&quot;/gi, '"')
    .replace(/&amp;/gi, "&")
    .trim();

  const embeddedMatch = decoded.match(/"(https?:\/\/[^"\s]+)"/i);
  return embeddedMatch?.[1] || decoded;
};

export const getProductImageUrl = (product: Product): string => {
  if (product.image_url) return sanitizeImageUrl(product.image_url);
  if (product.image) return sanitizeImageUrl(product.image);
  return buildPlaceholderImageUrl(product.name, product.category);
};

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  image: string;
}

export const categories: Category[] = [
  { id: "whisky-blended", name: "Blended Scotch", slug: "Whisky - Blended Scotch", icon: "🥃", image: "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=200&h=200&fit=crop" },
  { id: "whisky-single-malt", name: "Single Malt Scotch", slug: "Whisky - Single Malt Scotch", icon: "🏴󠁧󠁢󠁳󠁣󠁴󠁿", image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200&h=200&fit=crop" },
  { id: "whisky-bourbon", name: "Bourbon & American", slug: "Whisky - Bourbon & American", icon: "🇺🇸", image: "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=200&h=200&fit=crop" },
  { id: "whisky-japanese", name: "Japanese & World", slug: "Whisky - Japanese & World", icon: "🇯🇵", image: "https://images.unsplash.com/photo-1582106245687-cbb466a9f07f?w=200&h=200&fit=crop" },
  { id: "whisky-irish", name: "Irish Whiskey", slug: "Whisky - Irish", icon: "🇮🇪", image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=200&h=200&fit=crop" },
  { id: "cognac", name: "Cognac & Brandy", slug: "Cognac & Brandy", icon: "🍷", image: "https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=200&h=200&fit=crop" },
  { id: "vodka", name: "Vodka", slug: "Vodka", icon: "🧊", image: "https://images.unsplash.com/photo-1607622750671-6cd9a99eabd1?w=200&h=200&fit=crop" },
  { id: "gin", name: "Gin", slug: "Gin", icon: "🌿", image: "https://images.unsplash.com/photo-1608885898957-a559228e4202?w=200&h=200&fit=crop" },
  { id: "tequila", name: "Tequila & Mezcal", slug: "Tequila & Mezcal", icon: "🌵", image: "https://images.unsplash.com/photo-1516535794938-6063878f08cc?w=200&h=200&fit=crop" },
  { id: "rum", name: "Rum", slug: "Rum", icon: "🏝️", image: "https://images.unsplash.com/photo-1592751065013-f85e4f5e9450?w=200&h=200&fit=crop" },
  { id: "beer", name: "Premium Beer", slug: "Beer - Premium", icon: "🍺", image: "https://images.unsplash.com/photo-1535958636474-b021ee887b13?w=200&h=200&fit=crop" },
  { id: "champagne", name: "Champagne & Sparkling", slug: "Champagne & Sparkling", icon: "🥂", image: "https://images.unsplash.com/photo-1594372365401-44f01f5aae65?w=200&h=200&fit=crop" },
  { id: "wine", name: "Premium Wine", slug: "Wine - Premium", icon: "🍇", image: "https://images.unsplash.com/photo-1474722883778-792e7990302f?w=200&h=200&fit=crop" },
  { id: "liqueurs", name: "Liqueurs & Cream", slug: "Liqueurs & Cream", icon: "🍸", image: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=200&h=200&fit=crop" },
];

// Legacy compat — empty array, use useProducts hook instead
export const products: Product[] = [];
