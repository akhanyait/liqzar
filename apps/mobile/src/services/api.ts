import { supabase } from "../lib/supabase";

// API configuration
const API_BASE_URL = "https://api.liqzar.co.za";

/**
 * Products API
 */
export const productsApi = {
  async getProducts(params?: {
    category?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = supabase
      .from("products")
      .select("*")
      .eq("in_stock", true)
      .order("name");

    if (params?.category && params.category !== "All") {
      query = query.ilike("category", `%${params.category}%`);
    }

    if (params?.search) {
      query = query.ilike("name", `%${params.search}%`);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(
        params.offset,
        params.offset + (params.limit || 10) - 1,
      );
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
  },

  async getProductById(id: string) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  async getFeaturedProducts(limit = 6) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_featured", true)
      .eq("in_stock", true)
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async getTrendingProducts(limit = 6) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .eq("is_trending", true)
      .eq("in_stock", true)
      .limit(limit);

    if (error) throw error;
    return data;
  },

  async getHappyHourProducts(limit = 6) {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .gte("discount", 20)
      .eq("in_stock", true)
      .limit(limit);

    if (error) throw error;
    return data;
  },
};

/**
 * Orders API
 */
export const ordersApi = {
  async getOrders(userId: string) {
    // Try with order_items join first, fall back to simple query
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async getOrderById(orderId: string) {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (error) throw error;
    return data;
  },

  async createOrder(orderData: {
    user_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
    }>;
    delivery_address: any;
    delivery_method: string;
    payment_method: string;
    subtotal: number;
    delivery_fee: number;
    vat_amount: number;
    total: number;
    customer_notes?: string;
  }) {
    // Generate order number
    const orderNumber = `LQ${Date.now().toString(36).toUpperCase()}`;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        order_number: orderNumber,
        user_id: orderData.user_id,
        status: "pending",
        subtotal: orderData.subtotal,
        delivery_fee: orderData.delivery_fee,
        vat_amount: orderData.vat_amount,
        total: orderData.total,
        delivery_address: orderData.delivery_address,
        delivery_method: orderData.delivery_method,
        payment_method: orderData.payment_method,
        payment_status: "pending",
        customer_notes: orderData.customer_notes,
      })
      .select()
      .single();

    if (orderError) throw orderError;

    // Insert order items
    const orderItems = orderData.items.map((item) => ({
      order_id: order.id,
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
      subtotal: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    return order;
  },
};

/**
 * Profile API
 */
export const profileApi = {
  async getProfile(userId: string) {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return data;
  },

  async updateProfile(
    userId: string,
    updates: {
      full_name?: string;
      phone_number?: string;
      date_of_birth?: string;
    },
  ) {
    const { data, error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getAddresses(userId: string) {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  },

  async addAddress(
    userId: string,
    address: {
      label: string;
      street: string;
      city: string;
      province: string;
      postal_code: string;
      country: string;
      latitude?: number;
      longitude?: number;
      is_default?: boolean;
    },
  ) {
    const { data, error } = await supabase
      .from("addresses")
      .insert({
        user_id: userId,
        ...address,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteAddress(addressId: string) {
    const { error } = await supabase
      .from("addresses")
      .delete()
      .eq("id", addressId);

    if (error) throw error;
  },
};

/**
 * Wishlist API
 */
export const wishlistApi = {
  async getWishlist(userId: string) {
    const { data, error } = await supabase
      .from("wishlist")
      .select("id, product_id, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    // Fetch product details separately to avoid PGRST200 join errors
    if (data && data.length > 0) {
      const productIds = data.map((w: any) => w.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("*")
        .in("id", productIds);

      const productMap = new Map((products || []).map((p: any) => [p.id, p]));
      return data.map((w: any) => ({
        ...w,
        products: productMap.get(w.product_id) || null,
      }));
    }
    return data;
  },

  async addToWishlist(userId: string, productId: string) {
    const { data, error } = await supabase
      .from("wishlist")
      .insert({
        user_id: userId,
        product_id: productId,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async removeFromWishlist(userId: string, productId: string) {
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("product_id", productId);

    if (error) throw error;
  },

  async isInWishlist(userId: string, productId: string) {
    const { data, error } = await supabase
      .from("wishlist")
      .select("id")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .single();

    if (error && error.code !== "PGRST116") throw error;
    return !!data;
  },
};
