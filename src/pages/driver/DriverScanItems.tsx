import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine,
  Package,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowLeft,
  Barcode,
  TruckIcon,
  Menu,
  Headphones,
  QrCode,
  X,
  RefreshCw,
  Camera,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { Html5Qrcode } from "html5-qrcode";

interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  subtotal: number;
  barcode: string | null;
  is_scanned: boolean;
  weight_kg: number | null;
  is_grouped: boolean;
  group_id: string | null;
  // Product details from join
  description?: string | null;
  category?: string | null;
  bottle_size?: string | null;
  alcohol_pct?: string | null;
  stock_quantity?: number | null;
}

interface PackageGroup {
  id: string;
  group_name: string;
  group_barcode: string;
  total_items: number;
  is_scanned: boolean;
}

const DriverScanItems = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const { impact, notification } = useHaptics();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [groups, setGroups] = useState<PackageGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [orderDetails, setOrderDetails] = useState<any>(null);
  const [currentItemIndex, setCurrentItemIndex] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  // Validate UUID format
  const isValidUUID = (uuid: string | undefined): boolean => {
    if (!uuid) return false;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  };

  useEffect(() => {
    if (orderId && isValidUUID(orderId)) {
      fetchOrderItems();
    } else if (orderId && !isValidUUID(orderId)) {
      console.error("Invalid order ID format:", orderId);
      toast({
        title: "Invalid Order ID",
        description:
          "The order ID format is invalid. Please go back and try again.",
        variant: "destructive",
      });
      setLoading(false);
    }
  }, [orderId]);

  // Move to next unscanned item
  const goToNextItem = () => {
    const nextUnscannedIndex = items.findIndex(
      (item, index) => index > currentItemIndex && !item.is_scanned,
    );
    if (nextUnscannedIndex !== -1) {
      setCurrentItemIndex(nextUnscannedIndex);
    }
  };

  const fetchOrderItems = async () => {
    try {
      setLoading(true);

      // Validate orderId before making API call
      if (!orderId || !isValidUUID(orderId)) {
        throw new Error("Invalid order ID format");
      }

      // Fetch order details
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .single();

      if (orderError) {
        console.error("Order fetch error:", orderError);
        throw orderError;
      }

      // Fetch customer profile separately
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", orderData.user_id)
        .single();

      // Add customer name to order details
      const enrichedOrderData = {
        ...orderData,
        customer_name: (profile as any)?.full_name || "Guest",
      };
      setOrderDetails(enrichedOrderData);

      // Fetch order items
      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*")
        .eq("order_id", orderId);

      if (itemsError) {
        console.error("Items fetch error:", itemsError);
        throw itemsError;
      }

      // Fetch all product details separately (more reliable than join)
      const productIds =
        itemsData?.map((item: any) => item.product_id).filter(Boolean) || [];
      const productsMap = new Map();

      if (productIds.length > 0) {
        const { data: productsData, error: productsError } = await supabase
          .from("products")
          .select(
            "id, description, category, bottle_size, alcohol_pct, stock_quantity, image_url",
          )
          .in("id", productIds);

        if (productsError) {
          console.error("Products fetch error:", productsError);
        }

        if (productsData) {
          productsData.forEach((product: any) => {
            productsMap.set(product.id, product);
          });
        }
      }

      // Enrich items with product details
      const enrichedItems =
        itemsData?.map((item: any) => {
          const product = productsMap.get(item.product_id);
          return {
            ...item,
            description: product?.description || "",
            category: product?.category || "",
            bottle_size: product?.bottle_size || "",
            alcohol_pct: product?.alcohol_pct || null,
            stock_quantity: product?.stock_quantity ?? null,
            product_image: item.product_image || product?.image_url || "",
          };
        }) || [];

      setItems(enrichedItems);

      if (enrichedItems.length === 0) {
        console.warn("No order items found for order:", orderId);
        toast({
          title: "No Items Found",
          description: `Order #${orderId?.slice(-6)} has no items. Please check the order in admin panel.`,
          variant: "destructive",
        });
      }

      // Fetch package groups (commented out until migration applied)
      // const { data: groupsData, error: groupsError } = await supabase
      //   .from("package_groups")
      //   .select("*")
      //   .eq("order_id", orderId);
      // if (groupsError) throw groupsError;
      // setGroups(groupsData || []);
    } catch (error: any) {
      console.error("Error fetching items:", error);
      toast({
        title: "Error Loading Items",
        description:
          error.message || "Failed to load order items. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleScanItem = async (scannedCode: string) => {
    if (!scannedCode.trim()) return;

    try {
      setScanning(true);

      // Check if it's a group barcode (when groups feature is enabled)
      const group = groups.find((g) => g.group_barcode === scannedCode.trim());

      if (group) {
        // Scan entire group
        const groupItems = items.filter((i) => i.group_id === group.id);

        // Deduct inventory for all items in group
        for (const item of groupItems) {
          await deductInventory(item.product_id, item.quantity);
        }

        // Mark group as scanned (commented until migration applied)
        // await supabase.from("package_groups")...

        impact("heavy");
        notification("success");
        toast({
          title: "Package Scanned",
          description: `${group.group_name} - All ${group.total_items} items verified`,
        });

        await fetchOrderItems();
      } else {
        // Check if it's an individual item barcode
        // Using product_id or product_name as temporary barcode
        const item = items.find(
          (i) =>
            (i.barcode === scannedCode.trim() ||
              i.product_id === scannedCode.trim() ||
              i.product_name
                .toLowerCase()
                .includes(scannedCode.toLowerCase())) &&
            !i.is_scanned,
        );

        if (!item) {
          impact("medium");
          notification("warning");
          toast({
            title: "Item Not Found",
            description: "This item is not in this order or already scanned",
            variant: "destructive",
          });
          return;
        }

        // Deduct from inventory
        const inventoryDeducted = await deductInventory(
          item.product_id,
          item.quantity,
        );

        if (!inventoryDeducted) {
          toast({
            title: "Inventory Warning",
            description: "Low stock - scan recorded but check inventory",
            variant: "destructive",
          });
        }

        // Mark item as scanned in order_items
        const { error } = await supabase
          .from("order_items")
          .update({
            // is_scanned: true,  // Commented until migration adds field
            // scanned_at: new Date().toISOString(),
            // scanned_by: user?.id,
          })
          .eq("id", item.id);

        // Temporarily mark in local state
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, is_scanned: true } : i)),
        );

        if (error) {
          console.error("Update error:", error);
        }

        impact("medium");
        notification("success");
        toast({
          title: "Item Scanned ✓",
          description: `${item.product_name} (Qty: ${item.quantity})`,
        });
      }

      // Refresh items
      await fetchOrderItems();

      // Auto-advance to next unscanned item
      const nextUnscannedIndex = items.findIndex(
        (i, idx) => idx > currentItemIndex && !i.is_scanned,
      );
      if (nextUnscannedIndex !== -1) {
        setCurrentItemIndex(nextUnscannedIndex);
      }

      // Check if all items are scanned
      checkAllItemsScanned();
    } catch (error: any) {
      console.error("Scan error:", error);
      toast({
        title: "Scan Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  // Open camera scanner
  const openCameraScanner = async () => {
    try {
      // If scanner is already active, don't open again
      if (scannerActive || scanning) {
        return;
      }

      // Stop any existing scanner first
      if (scannerRef.current && scannerRef.current.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current = null;
      }

      setScannerActive(true);
      setScanning(true);

      // Wait for DOM to update with scanner element
      await new Promise((resolve) => setTimeout(resolve, 200));

      // Check if scanner element exists in DOM
      const scannerElement = document.getElementById("qr-reader");
      if (!scannerElement) {
        console.error("Scanner element not found in DOM");
        throw new Error("Scanner element not ready. Please try again.");
      }

      // Initialize scanner
      try {
        scannerRef.current = new Html5Qrcode("qr-reader");
      } catch (initError: any) {
        console.error("Scanner initialization error:", initError);
        throw new Error("Failed to initialize scanner: " + initError.message);
      }

      // Request camera permissions first
      try {
        await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch (permError: any) {
        console.error("Camera permission error:", permError);
        throw new Error(
          "Camera permission denied. Please enable camera access in your device settings.",
        );
      }

      // Start scanning with back camera
      await scannerRef.current.start(
        { facingMode: "environment" }, // Use back camera
        {
          fps: 10, // Scans per second
          qrbox: { width: 250, height: 250 }, // Scanning box size
        },
        async (decodedText) => {
          // Success callback when barcode is detected
          await stopScanner();

          // Process the scanned code
          await handleScanItem(decodedText);
        },
        (errorMessage) => {
          // Error callback - ignore, happens frequently while scanning
          // console.log("Scan error:", errorMessage);
        },
      );
    } catch (error: any) {
      console.error("Scanner error:", error);

      // Cleanup on error
      if (scannerRef.current) {
        try {
          if (scannerRef.current.isScanning) {
            await scannerRef.current.stop();
          }
          await scannerRef.current.clear();
        } catch (cleanupError) {
          console.error("Cleanup error:", cleanupError);
        }
        scannerRef.current = null;
      }

      setScannerActive(false);
      setScanning(false);

      toast({
        title: "Scanner Error",
        description:
          error.message || "Failed to open camera scanner. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Stop camera scanner
  const stopScanner = async () => {
    try {
      if (scannerRef.current) {
        // Check if scanner is running before stopping
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        // Clear the scanner instance
        await scannerRef.current.clear();
        scannerRef.current = null;
      }
      setScannerActive(false);
      setScanning(false);
    } catch (error) {
      console.error("Error stopping scanner:", error);
      // Force cleanup even if stop fails
      scannerRef.current = null;
      setScannerActive(false);
      setScanning(false);
    }
  };

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        if (scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Deduct inventory when item is scanned
  const deductInventory = async (
    productId: string,
    quantity: number,
  ): Promise<boolean> => {
    try {
      // Get current stock
      const { data: product, error: fetchError } = await supabase
        .from("products")
        .select("stock_quantity")
        .eq("id", productId)
        .single();

      if (fetchError) throw fetchError;

      const currentStock = product?.stock_quantity || 0;

      if (currentStock < quantity) {
        console.warn(
          `Low stock for product ${productId}: ${currentStock} available, ${quantity} needed`,
        );
        // Continue with scan but return false to indicate stock issue
      }

      // Deduct from inventory
      const { error: updateError } = await supabase
        .from("products")
        .update({
          stock_quantity: Math.max(0, currentStock - quantity),
          last_sold_date: new Date().toISOString(),
        })
        .eq("id", productId);

      if (updateError) throw updateError;

      return currentStock >= quantity;
    } catch (error) {
      console.error("Inventory deduction error:", error);
      return false;
    }
  };

  const checkAllItemsScanned = async () => {
    try {
      // Check if all items and groups are scanned
      const { data: itemsCheck } = await (supabase as any)
        .from("order_items")
        .select("id, is_scanned")
        .eq("order_id", orderId)
        .eq("is_scanned", false);

      const { data: groupsCheck } = await (supabase as any)
        .from("package_groups")
        .select("id, is_scanned")
        .eq("order_id", orderId)
        .eq("is_scanned", false);

      if (itemsCheck?.length === 0 && groupsCheck?.length === 0) {
        // All items scanned - update delivery assignment
        const { error } = await (supabase as any)
          .from("delivery_assignments")
          .update({
            all_items_scanned: true,
            pickup_verified_at: new Date().toISOString(),
            status: "picked_up",
          })
          .eq("order_id", orderId);

        if (error) throw error;

        impact("heavy");
        notification("success");
        toast({
          title: "All Items Verified!",
          description: "Ready to start delivery",
        });

        // Navigate to active delivery or dashboard
        setTimeout(() => {
          navigate("/driver");
        }, 1500);
      }
    } catch (error: any) {
      console.error("Error checking items:", error);
    }
  };

  const getTotalItems = () => {
    return items.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getScannedCount = () => {
    const scannedItems = items
      .filter((i) => i.is_scanned)
      .reduce((sum, item) => sum + item.quantity, 0);
    const scannedGroupItems = groups
      .filter((g) => g.is_scanned)
      .reduce((sum, group) => sum + group.total_items, 0);
    return scannedItems + scannedGroupItems;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-zinc-400">Loading items...</p>
        </div>
      </div>
    );
  }

  const totalItems = getTotalItems();
  const scannedItems = getScannedCount();
  const progress = totalItems > 0 ? (scannedItems / totalItems) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-950 pb-28">
      {/* Header */}
      <div className="bg-zinc-900 border-b border-zinc-800 sticky top-0 z-10">
        <div className="p-4">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-zinc-300" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-zinc-100">Scan Items</h1>
              <p className="text-sm text-zinc-400">
                Order #{orderId?.slice(-8)}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Items Scanned</span>
              <span className="font-bold text-zinc-100">
                {scannedItems} / {totalItems}
              </span>
            </div>
            <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
                className={`h-full ${progress === 100 ? "bg-green-600" : "bg-primary"}`}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Scanner Input */}
      <div className="p-4">
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-primary/20 rounded-xl flex items-center justify-center">
              <ScanLine className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-zinc-100">Scan Barcode</h2>
              <p className="text-xs text-zinc-400">
                Use camera to scan item barcodes
              </p>
            </div>
          </div>

          <button
            onClick={openCameraScanner}
            disabled={scanning}
            className="w-full py-6 bg-primary text-primary-foreground rounded-xl font-bold text-lg hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 shadow-lg shadow-primary/30 active:scale-95"
          >
            <Camera className="w-8 h-8" />
            {scanning ? "Scanning..." : "Open Camera Scanner"}
          </button>

          {/* Scanner View */}
          {scannerActive && (
            <div className="fixed inset-0 z-50 bg-black">
              <div className="relative w-full h-full flex flex-col">
                {/* Order Item Details Card */}
                <div className="absolute top-4 left-4 right-4 z-10">
                  <div className="bg-amber-50 rounded-2xl p-6 shadow-xl">
                    {items.length > 0 && items[currentItemIndex] && (
                      <>
                        <p className="text-sm text-gray-600 mb-2 text-center">
                          Scan Item {currentItemIndex + 1} of {items.length}
                        </p>
                        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">
                          {items[currentItemIndex].product_name}
                        </h2>
                        <p className="text-sm text-gray-700 text-center">
                          Qty: {items[currentItemIndex].quantity} •{" "}
                          {items[currentItemIndex].bottle_size || "750ml"}
                        </p>
                        {orderDetails && (
                          <div className="mt-3 pt-3 border-t border-gray-300">
                            <div className="flex justify-between text-xs text-gray-600">
                              <span>Order #{orderId?.slice(-6)}</span>
                              <span>
                                Customer: {orderDetails.customer_name || "N/A"}
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Scanner Container */}
                <div className="flex-1 relative">
                  <div
                    id="qr-reader"
                    className="w-full h-full"
                    style={{ position: "relative" }}
                  />

                  {/* Scanning Frame Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="relative">
                      {/* Orange Dashed Border */}
                      <div className="w-80 h-48 border-4 border-dashed border-amber-500 rounded-2xl relative">
                        {/* Red Center Line */}
                        <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-600 transform -translate-y-1/2" />
                        {/* Focus Corners */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                          <div className="w-12 h-12 border-2 border-gray-800 rounded-lg" />
                        </div>
                      </div>
                      <p className="text-white text-sm mt-4 text-center bg-black/50 px-4 py-2 rounded-full">
                        Position barcode within frame
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black via-black/80 to-transparent pb-8">
                  {/* Demo Scan Button */}
                  {items.length > 0 && items[currentItemIndex] && (
                    <button
                      onClick={async () => {
                        // Simulate scanning the current item
                        await stopScanner();
                        const currentItem = items[currentItemIndex];
                        await handleScanItem(currentItem.product_id);
                      }}
                      className="w-full py-4 bg-green-500 hover:bg-green-600 text-white rounded-2xl font-bold text-lg mb-3 flex items-center justify-center gap-2 transition-colors"
                    >
                      <ScanLine className="w-5 h-5" />
                      Scan:{" "}
                      {items[currentItemIndex].product_name.substring(0, 30)}...
                    </button>
                  )}

                  {/* Cancel Button */}
                  <button
                    onClick={stopScanner}
                    className="w-full py-4 bg-white hover:bg-gray-100 text-gray-900 rounded-2xl font-semibold text-lg transition-colors"
                  >
                    Cancel
                  </button>

                  {/* Demo Note */}
                  <p className="text-white/60 text-xs text-center mt-3">
                    Demo: Tap to simulate scan
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Current Item Info */}
          {items.length > 0 &&
            items[currentItemIndex] &&
            !items[currentItemIndex].is_scanned && (
              <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-xl">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-primary uppercase mb-1">
                      Current Item ({currentItemIndex + 1} of {items.length})
                    </p>
                    <h3 className="font-bold text-zinc-100 mb-1">
                      {items[currentItemIndex].product_name}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Quantity: {items[currentItemIndex].quantity}x
                    </p>
                    {items[currentItemIndex].product_id && (
                      <p className="text-xs text-zinc-500 font-mono mt-1">
                        ID: {items[currentItemIndex].product_id.slice(0, 12)}...
                      </p>
                    )}
                  </div>
                  <button
                    onClick={goToNextItem}
                    disabled={
                      items.findIndex(
                        (item, index) =>
                          index > currentItemIndex && !item.is_scanned,
                      ) === -1
                    }
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    Next Item
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>

      {/* Package Groups */}
      {groups.length > 0 && (
        <div className="p-4">
          <h2 className="text-sm font-bold text-zinc-400 uppercase mb-3 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Package Groups
          </h2>
          <div className="space-y-2">
            {groups.map((group) => (
              <motion.div
                key={group.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`bg-zinc-900 rounded-xl p-4 border ${
                  group.is_scanned
                    ? "border-green-600/50 bg-green-950/20"
                    : "border-zinc-800"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      group.is_scanned ? "bg-green-600" : "bg-zinc-800"
                    }`}
                  >
                    {group.is_scanned ? (
                      <CheckCircle2 className="w-5 h-5 text-white" />
                    ) : (
                      <Package className="w-5 h-5 text-zinc-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-zinc-100">
                      {group.group_name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-zinc-400">
                        {group.total_items} items
                      </span>
                      <span className="text-xs text-zinc-600">•</span>
                      <span className="text-xs text-zinc-500 font-mono">
                        {group.group_barcode}
                      </span>
                    </div>
                  </div>
                  {group.is_scanned && (
                    <div className="px-2 py-1 bg-green-600/20 rounded-lg">
                      <span className="text-xs font-bold text-green-400">
                        ✓ Scanned
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Individual Items */}
      <div className="p-4">
        <h2 className="text-sm font-bold text-zinc-400 uppercase mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="w-4 h-4" />
            Order Items
          </span>
          <span className="text-xs font-normal">
            {items.filter((i) => i.is_scanned).length} / {items.length} scanned
          </span>
        </h2>
        <div className="space-y-3">
          <AnimatePresence>
            {items.map((item, index) => {
              const isCurrentItem =
                index === currentItemIndex && !item.is_scanned;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: index * 0.05 }}
                  className={`bg-zinc-900 rounded-2xl overflow-hidden transition-all ${
                    item.is_scanned
                      ? "border-2 border-green-600/50 bg-green-950/10"
                      : isCurrentItem
                        ? "border-2 border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-2 border-zinc-800 hover:border-zinc-700"
                  }`}
                >
                  {/* Current Item Badge */}
                  {isCurrentItem && (
                    <div className="bg-primary px-4 py-1.5 flex items-center justify-between">
                      <span className="text-xs font-bold text-primary-foreground uppercase">
                        ⚡ Scan This Item Next
                      </span>
                      <span className="text-xs text-primary-foreground/80">
                        Item {index + 1} of {items.length}
                      </span>
                    </div>
                  )}

                  <div className="flex gap-4 p-4">
                    {/* Product Image */}
                    <div className="relative flex-shrink-0">
                      {item.product_image ? (
                        <img
                          src={item.product_image}
                          alt={item.product_name}
                          className="w-24 h-24 object-contain rounded-lg bg-zinc-800"
                        />
                      ) : (
                        <div className="w-24 h-24 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Package className="w-10 h-10 text-zinc-600" />
                        </div>
                      )}
                      {/* Scan Status Badge */}
                      <div
                        className={`absolute -top-2 -right-2 w-8 h-8 rounded-full flex items-center justify-center ${
                          item.is_scanned
                            ? "bg-green-600"
                            : "bg-zinc-700 border-2 border-zinc-800"
                        }`}
                      >
                        {item.is_scanned ? (
                          <CheckCircle2 className="w-5 h-5 text-white" />
                        ) : (
                          <Circle className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </div>

                    {/* Product Details */}
                    <div className="flex-1 min-w-0">
                      {/* Product Name */}
                      <h3 className="font-bold text-zinc-100 mb-1 line-clamp-2">
                        {item.product_name}
                      </h3>

                      {/* Description */}
                      {item.description && (
                        <p className="text-xs text-zinc-400 mb-2 line-clamp-2">
                          {item.description}
                        </p>
                      )}

                      {/* Product Specs */}
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        {item.bottle_size && (
                          <span className="px-2 py-0.5 bg-zinc-800 rounded-md text-[10px] font-medium text-zinc-300">
                            📏 {item.bottle_size}
                          </span>
                        )}
                        {item.alcohol_pct && (
                          <span className="px-2 py-0.5 bg-zinc-800 rounded-md text-[10px] font-medium text-zinc-300">
                            🍷 {item.alcohol_pct}% ABV
                          </span>
                        )}
                        {item.category && (
                          <span className="px-2 py-0.5 bg-primary/10 rounded-md text-[10px] font-medium text-primary">
                            {item.category}
                          </span>
                        )}
                      </div>

                      {/* Quantity & Price */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="bg-zinc-800 px-3 py-1 rounded-lg">
                            <p className="text-[10px] text-zinc-400">
                              Quantity
                            </p>
                            <p className="text-sm font-bold text-zinc-100">
                              {item.quantity}x
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400">
                              Unit Price
                            </p>
                            <p className="text-sm font-bold text-zinc-100">
                              R{item.unit_price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-400">
                              Subtotal
                            </p>
                            <p className="text-sm font-bold text-primary">
                              R{item.subtotal.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Stock Info */}
                      {item.stock_quantity !== null &&
                        item.stock_quantity !== undefined && (
                          <div className="mt-2 flex items-center gap-2">
                            <div
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] font-medium ${
                                item.stock_quantity >= item.quantity
                                  ? "bg-green-900/30 text-green-400"
                                  : "bg-red-900/30 text-red-400"
                              }`}
                            >
                              <AlertCircle className="w-3 h-3" />
                              Stock: {item.stock_quantity} available
                            </div>
                          </div>
                        )}

                      {/* Product ID for Scanning (temporary) */}
                      <div className="mt-2">
                        <p className="text-[10px] text-zinc-500 font-mono">
                          Product ID: {item.product_id.slice(0, 8)}...
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Scan Status Footer */}
                  {item.is_scanned && (
                    <div className="bg-green-950/30 border-t border-green-600/30 px-4 py-2 flex items-center justify-between">
                      <span className="text-xs font-medium text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Scanned & Verified
                      </span>
                      <span className="text-[10px] text-green-500/70">
                        Inventory deducted
                      </span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Empty State */}
        {items.length === 0 && !loading && (
          <div className="text-center py-12">
            <Package className="w-16 h-16 text-zinc-700 mx-auto mb-3" />
            <p className="text-zinc-400 text-lg font-semibold mb-2">
              No items in this order
            </p>
            <p className="text-zinc-500 text-sm mb-4">
              Order ID: {orderId?.slice(-8)}
            </p>
            <button
              onClick={fetchOrderItems}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm transition-colors"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-zinc-400">Loading items...</p>
          </div>
        )}

        {/* Debug Info (temporary) */}
        {!loading && items.length === 0 && (
          <div className="px-4 mt-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <p className="text-xs text-zinc-500 font-mono">
                Debug: Check browser console for details
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-800 z-30 pb-safe">
        <div className="flex items-end justify-around px-4 pt-2 pb-3">
          {/* More Button */}
          <button
            onClick={() => setShowActions(true)}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-muted-foreground transition-colors"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">More</span>
          </button>

          {/* Scan Button (Main Action) */}
          <button
            onClick={() => {
              impact("medium");
              openCameraScanner();
            }}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-primary"
          >
            <div className="w-14 h-14 -mt-6 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30">
              <QrCode className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-[10px] font-medium mt-1">Scan</span>
          </button>

          {/* Dispatch Button */}
          <button
            onClick={() => {
              impact("light");
              toast({
                title: "Contact Dispatch",
                description: "Feature coming soon",
              });
            }}
            className="flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl text-purple-400 transition-colors"
          >
            <Headphones className="w-5 h-5" />
            <span className="text-[10px] font-medium">Dispatch</span>
          </button>
        </div>
      </nav>

      {/* Complete Button */}
      {progress === 100 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-20 left-4 right-4 z-20"
        >
          <button
            onClick={() => navigate("/driver")}
            className="w-full py-4 bg-green-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            All Items Verified - Start Delivery
          </button>
        </motion.div>
      )}

      {/* More Actions Sheet */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowActions(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-0 left-0 right-0 bg-zinc-900 rounded-t-3xl shadow-xl pb-safe"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-zinc-100">
                    More Actions
                  </h3>
                  <button
                    onClick={() => setShowActions(false)}
                    className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center hover:bg-zinc-700 transition-colors"
                  >
                    <X className="w-4 h-4 text-zinc-400" />
                  </button>
                </div>
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-3 gap-3 p-6">
                <button
                  onClick={() => {
                    setShowActions(false);
                    fetchOrderItems();
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  <RefreshCw className="w-6 h-6 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-300">
                    Refresh
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowActions(false);
                    navigate("/driver");
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  <ArrowLeft className="w-6 h-6 text-zinc-400" />
                  <span className="text-xs font-medium text-zinc-300">
                    Back
                  </span>
                </button>

                <button
                  onClick={() => {
                    setShowActions(false);
                    openCameraScanner();
                  }}
                  className="flex flex-col items-center gap-2 p-4 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors"
                >
                  <Camera className="w-6 h-6 text-primary" />
                  <span className="text-xs font-medium text-zinc-300">
                    Scan
                  </span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DriverScanItems;
