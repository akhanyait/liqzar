import { supabase } from "@/integrations/supabase/client";

interface CreateTestOrderParams {
  userId: string;
}

export async function createTestOrder({ userId }: CreateTestOrderParams) {
  try {
    // First, get some products from the database
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("*")
      .limit(3);

    if (productsError || !products || products.length === 0) {
      throw new Error(
        "No products found in database. Please add products first.",
      );
    }

    // Calculate totals
    const orderItems = products.map((product) => {
      const qty = Math.floor(1 + Math.random() * 3);
      const unitPrice = product.price || 0;
      return {
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        quantity: qty,
        unit_price: unitPrice,
        subtotal: unitPrice * qty,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.subtotal, 0);
    const vatAmount = subtotal * 0.15;
    const deliveryFee = 50;
    const total = subtotal + vatAmount + deliveryFee;

    // Create order using correct schema columns
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        status: "pending",
        subtotal,
        vat_amount: vatAmount,
        delivery_fee: deliveryFee,
        discount_amount: 0,
        total,
        delivery_method: "delivery",
        payment_method: "card",
        payment_status: "pending",
        delivery_address: {
          fullName: "Test Customer",
          phone: "0821234567",
          addressLine1: "123 Test Street",
          suburb: "Sandton",
          city: "Johannesburg",
          province: "Gauteng",
          postalCode: "2000",
          country: "South Africa",
        },
        delivery_instructions: "Test order - Please handle with care",
      })
      .select()
      .single();

    if (orderError) {
      console.error("Order creation error:", orderError);
      throw orderError;
    }

    // Create order items
    const orderItemsWithOrderId = orderItems.map((item) => ({
      ...item,
      order_id: order.id,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItemsWithOrderId);

    if (itemsError) {
      console.error("Order items creation error:", itemsError);
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    return {
      success: true,
      order,
      items: orderItemsWithOrderId,
    };
  } catch (error: any) {
    console.error("Error creating test order:", error);
    return {
      success: false,
      error: error.message || "Failed to create test order",
    };
  }
}

export async function createMultipleTestOrders(
  userId: string,
  count: number = 3,
) {
  const results = [];

  for (let i = 0; i < count; i++) {
    const result = await createTestOrder({ userId });
    results.push(result);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}
