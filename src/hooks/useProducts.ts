import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/data/products";
import { normalizeProduct } from "@/lib/product-utils";

export const useProducts = (options?: {
  category?: string;
  search?: string;
  featured?: boolean;
  trending?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  limit?: number;
}) => {
  return useQuery({
    queryKey: ["products", options],
    queryFn: async () => {
      if (options?.limit === 0) return [] as Product[];
      let query = supabase.from("products").select("*").order("name") as any;

      if (options?.category) {
        query = query.eq("category", options.category);
      }
      if (options?.search) {
        query = query.ilike("name", `%${options.search}%`);
      }
      if (options?.featured) {
        query = query.eq("is_featured", true);
      }
      if (options?.trending) {
        query = query.eq("is_trending", true);
      }
      if (options?.bestSeller) {
        query = query.eq("is_best_seller", true);
      }
      if (options?.newArrival) {
        query = query.eq("is_new_arrival", true);
      }
      // Exclude products without real images for curated sections
      if (
        options?.featured ||
        options?.trending ||
        options?.bestSeller ||
        options?.newArrival
      ) {
        query = query
          .not("image_url", "is", null)
          .not("image_url", "eq", "")
          .not("image_url", "like", "%placehold%");
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return ((data || []) as Product[]).map((product) =>
        normalizeProduct(product),
      );
    },
  });
};

export const useProduct = (id: string) => {
  return useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return normalizeProduct(data as Product);
    },
    enabled: !!id,
    staleTime: 60000, // Show cached data instantly for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });
};
