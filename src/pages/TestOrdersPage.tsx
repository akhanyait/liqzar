import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Package, CheckCircle2, AlertCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const TestOrdersPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [creating, setCreating] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    orders?: string[];
  } | null>(null);

  const createTestOrders = async () => {
    try {
      setCreating(true);
      setResult(null);

      if (!user) {
        setResult({
          success: false,
          message: "You must be logged in to create test orders",
        });
        return;
      }

      // Get some products
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, image_url")
        .limit(10);

      if (productsError || !products || products.length === 0) {
        setResult({
          success: false,
          message: "No products found in database. Please add products first.",
        });
        return;
      }

      const ordersCreated: string[] = [];

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
          console.error("Error creating order:", orderError);
          continue;
        }

        ordersCreated.push(orderNumber);

        // Create order items
        const orderItems = selectedProducts.map((product) => ({
          order_id: order.id,
          product_id: product.id,
          product_name: product.name,
          product_image: product.image_url,
          quantity: Math.floor(Math.random() * 3) + 1,
          unit_price: product.price || 0,
          subtotal: (product.price || 0) * (Math.floor(Math.random() * 3) + 1),
        }));

        const { error: itemsError } = await supabase
          .from("order_items")
          .insert(orderItems);

        if (itemsError) {
          console.error("Error creating order items:", itemsError);
          continue;
        }
      }

      setResult({
        success: true,
        message: `Successfully created ${ordersCreated.length} test orders!`,
        orders: ordersCreated,
      });

      toast({
        title: "Success! 🎉",
        description: `Created ${ordersCreated.length} test orders`,
      });
    } catch (error: any) {
      console.error("Error creating test orders:", error);
      setResult({
        success: false,
        message: error.message || "Failed to create test orders",
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 pb-24">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-300" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-zinc-100">
                Create Test Orders
              </h1>
              <p className="text-sm text-zinc-400">
                For driver testing & development
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Info Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-zinc-100 mb-2">
                Test Order Generator
              </h2>
              <p className="text-sm text-zinc-400 mb-4">
                This will create 3 sample orders with real products from your
                catalog. Each order will have 2-4 items and be ready for driver
                pickup and scanning.
              </p>
              <ul className="space-y-2 text-sm text-zinc-400">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Orders with proper UUID format
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Real products from your catalog
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Status: Pending (ready for driver)
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  Payment: Paid
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* Create Button */}
        <button
          onClick={createTestOrders}
          disabled={creating}
          className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-6"
        >
          {creating ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
              Creating Orders...
            </>
          ) : (
            <>
              <Package className="w-5 h-5" />
              Create Test Orders
            </>
          )}
        </button>

        {/* Result */}
        {result && (
          <div
            className={`border-2 rounded-2xl p-6 ${
              result.success
                ? "bg-green-950/20 border-green-600/50"
                : "bg-red-950/20 border-red-600/50"
            }`}
          >
            <div className="flex items-start gap-4">
              {result.success ? (
                <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
              )}
              <div className="flex-1">
                <h3
                  className={`font-bold mb-2 ${
                    result.success ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {result.success ? "Success!" : "Error"}
                </h3>
                <p
                  className={`text-sm mb-4 ${
                    result.success ? "text-green-300" : "text-red-300"
                  }`}
                >
                  {result.message}
                </p>
                {result.orders && result.orders.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-400 font-semibold uppercase">
                      Orders Created:
                    </p>
                    {result.orders.map((orderNum) => (
                      <div
                        key={orderNum}
                        className="bg-zinc-900 px-3 py-2 rounded-lg font-mono text-xs text-zinc-300"
                      >
                        {orderNum}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {result.success && (
              <button
                onClick={() => navigate("/driver")}
                className="w-full mt-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-xl font-medium transition-colors"
              >
                Go to Driver Dashboard
              </button>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-6 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
          <h3 className="text-sm font-bold text-zinc-100 mb-2">Next Steps:</h3>
          <ol className="space-y-2 text-sm text-zinc-400 list-decimal list-inside">
            <li>Click "Create Test Orders" button above</li>
            <li>Go to Driver Dashboard</li>
            <li>Click "Verify Stock Now" on any order</li>
            <li>Scan items using product IDs</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default TestOrdersPage;
