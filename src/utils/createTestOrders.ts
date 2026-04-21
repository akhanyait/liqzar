import { supabase } from "@/integrations/supabase/client";

/**
 * Creates test orders for driver testing
 * Run this from the browser console: window.createTestOrders()
 */
export async function createTestOrders() {
  try {
    console.log("🚀 Creating test orders...");

    // Get the current user (must be logged in as customer)
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error("❌ Error: You must be logged in as a customer");
      return;
    }

    console.log("✅ User found:", user.email);

    // Get some products to add to orders
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, name, price, image_url")
      .limit(10);

    if (productsError || !products || products.length === 0) {
      console.error("❌ Error fetching products:", productsError);
      return;
    }

    console.log(`✅ Found ${products.length} products`);

    // Create 3 test orders
    const ordersToCreate = [
      {
        customer_name: "Thabo Mokgadi",
        delivery_address: {
          street: "42 Rivonia Road",
          city: "Sandton",
          province: "Gauteng",
          postal_code: "2196",
        },
        items_count: 4,
        delivery_instructions: "Please ring the doorbell",
      },
      {
        customer_name: "Naledi Khumalo",
        delivery_address: {
          street: "12 Oxford Road",
          city: "Rosebank",
          province: "Gauteng",
          postal_code: "2196",
        },
        items_count: 2,
        delivery_instructions: "Leave with security",
      },
      {
        customer_name: "Sipho Ndlovu",
        delivery_address: {
          street: "88 Umhlanga Rocks Drive",
          city: "Umhlanga",
          province: "KwaZulu-Natal",
          postal_code: "4320",
        },
        items_count: 3,
        delivery_instructions: "Call on arrival",
      },
    ];

    for (const orderData of ordersToCreate) {
      // Calculate order totals
      const selectedProducts = products.slice(0, orderData.items_count);
      const subtotal = selectedProducts.reduce(
        (sum, p) => sum + (p.price || 0),
        0,
      );
      const deliveryFee = 50;
      const vatAmount = (subtotal + deliveryFee) * 0.15;
      const total = subtotal + deliveryFee + vatAmount;

      // Generate order number
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Create the order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          user_id: user.id,
          order_number: orderNumber,
          status: "pending",
          payment_status: "captured",
          payment_method: "card",
          delivery_method: "standard",
          delivery_address: orderData.delivery_address,
          delivery_instructions: orderData.delivery_instructions,
          subtotal: subtotal,
          delivery_fee: deliveryFee,
          vat_amount: vatAmount,
          discount_amount: 0,
          total: total,
        })
        .select()
        .single();

      if (orderError) {
        console.error("❌ Error creating order:", orderError);
        continue;
      }

      console.log(`✅ Created order: ${orderNumber}`);

      // Create order items
      const orderItems = selectedProducts.map((product, index) => ({
        order_id: order.id,
        product_id: product.id,
        product_name: product.name,
        product_image: product.image_url,
        quantity: Math.floor(Math.random() * 3) + 1, // 1-3 quantity
        unit_price: product.price || 0,
        subtotal: (product.price || 0) * (Math.floor(Math.random() * 3) + 1),
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) {
        console.error("❌ Error creating order items:", itemsError);
        continue;
      }

      console.log(`   ✅ Added ${orderItems.length} items to order`);
    }

    console.log("🎉 Test orders created successfully!");
    console.log("💡 Refresh the driver dashboard to see the new orders");
  } catch (error) {
    console.error("❌ Error in createTestOrders:", error);
  }
}

// Make it available globally for browser console
if (typeof window !== "undefined") {
  (window as any).createTestOrders = createTestOrders;
}
