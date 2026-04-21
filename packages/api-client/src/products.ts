import { getApiClient } from "./client";
import type {
  Product,
  ProductFilters,
  PaginatedResponse,
} from "@liqzar/types";

export const productsApi = {
  /**
   * Get all products with optional filters
   */
  async getProducts(
    filters?: ProductFilters,
  ): Promise<PaginatedResponse<Product>> {
    const client = getApiClient();
    return client.get("/products", filters);
  },

  /**
   * Get products by category
   */
  async getProductsByCategory(categoryId: string): Promise<Product[]> {
    const client = getApiClient();
    return client.get(`/products/category/${categoryId}`);
  },

  /**
   * Get single product by ID
   */
  async getProduct(productId: string): Promise<Product> {
    const client = getApiClient();
    return client.get(`/products/${productId}`);
  },

  /**
   * Search products
   */
  async searchProducts(query: string): Promise<Product[]> {
    const client = getApiClient();
    return client.get("/products/search", { q: query });
  },

  /**
   * Get featured/trending products
   */
  async getFeaturedProducts(): Promise<Product[]> {
    const client = getApiClient();
    return client.get("/products/featured");
  },

  /**
   * Get product recommendations
   */
  async getRecommendations(productId?: string): Promise<Product[]> {
    const client = getApiClient();
    const url = productId
      ? `/products/${productId}/recommendations`
      : "/products/recommendations";
    return client.get(url);
  },

  /**
   * Check product stock availability
   */
  async checkStock(
    productId: string,
  ): Promise<{ available: boolean; quantity: number }> {
    const client = getApiClient();
    return client.get(`/products/${productId}/stock`);
  },
};
