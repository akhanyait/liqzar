import { useState } from "react";
import { motion } from "framer-motion";
import {
  RefreshCw,
  Package,
  Fingerprint,
  ScanFace,
  Clock,
  Check,
} from "lucide-react";
import { useHaptics, isIOS, isNativeApp } from "@/hooks/useNativeFeatures";
import { useCart } from "@/context/CartContext";
import { toast } from "@/hooks/use-toast";
import BiometricAuth from "./BiometricAuth";

interface QuickReorderItem {
  id: string;
  name: string;
  price: number;
  image?: string;
  lastOrdered: string;
  quantity: number;
  category?: string;
}

interface QuickReorderWidgetProps {
  recentOrders: QuickReorderItem[];
  onReorder?: (items: QuickReorderItem[]) => void;
}

const QuickReorderWidget = ({
  recentOrders,
  onReorder,
}: QuickReorderWidgetProps) => {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [showBiometric, setShowBiometric] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const { impact, notification } = useHaptics();
  const { addItem } = useCart();
  const isIOSDevice = isIOS();

  const toggleItem = (id: string) => {
    impact("light");
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const selectAll = () => {
    impact("light");
    if (selectedItems.length === recentOrders.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(recentOrders.map((o) => o.id));
    }
  };

  const handleReorder = () => {
    if (selectedItems.length === 0) {
      toast({ title: "Select items", description: "Choose items to reorder" });
      return;
    }

    if (isNativeApp()) {
      setShowBiometric(true);
    } else {
      processReorder();
    }
  };

  const processReorder = () => {
    setIsProcessing(true);
    impact("medium");

    const itemsToReorder = recentOrders.filter((o) =>
      selectedItems.includes(o.id),
    );

    setTimeout(() => {
      itemsToReorder.forEach((item) => {
        // Create a minimal Product object
        const product = {
          id: item.id,
          name: item.name,
          price: item.price,
          category: item.category || "Other",
          rating: 4.5,
          image_url: item.image,
        };
        addItem(product as any, item.quantity);
      });

      notification("success");
      setIsProcessing(false);
      setSelectedItems([]);
      onReorder?.(itemsToReorder);

      toast({
        title: "Items added to cart! 🎉",
        description: `${itemsToReorder.length} item${itemsToReorder.length > 1 ? "s" : ""} ready for checkout`,
      });
    }, 500);
  };

  const selectedTotal = recentOrders
    .filter((o) => selectedItems.includes(o.id))
    .reduce((sum, o) => sum + o.price * o.quantity, 0);

  if (recentOrders.length === 0) return null;

  return (
    <>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                Quick Reorder
              </h3>
              <p className="text-[10px] text-muted-foreground">
                One-tap with biometrics
              </p>
            </div>
          </div>
          <button
            onClick={selectAll}
            className="text-xs text-primary font-medium"
          >
            {selectedItems.length === recentOrders.length
              ? "Deselect All"
              : "Select All"}
          </button>
        </div>

        {/* Items */}
        <div className="divide-y divide-border">
          {recentOrders.slice(0, 3).map((item, index) => (
            <motion.button
              key={item.id}
              onClick={() => toggleItem(item.id)}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`w-full p-3 flex items-center gap-3 transition-colors ${
                selectedItems.includes(item.id) ? "bg-primary/5" : ""
              }`}
            >
              {/* Checkbox */}
              <div
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                  selectedItems.includes(item.id)
                    ? "bg-primary border-primary"
                    : "border-muted-foreground/30"
                }`}
              >
                {selectedItems.includes(item.id) && (
                  <Check className="w-3 h-3 text-primary-foreground" />
                )}
              </div>

              {/* Image */}
              <div className="w-10 h-10 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>×{item.quantity}</span>
                  <span>•</span>
                  <Clock className="w-3 h-3" />
                  <span>{item.lastOrdered}</span>
                </div>
              </div>

              {/* Price */}
              <p className="text-sm font-bold text-foreground">
                R{Math.round(item.price * item.quantity).toLocaleString('en-ZA')}
              </p>
            </motion.button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-muted/30">
          <button
            onClick={handleReorder}
            disabled={selectedItems.length === 0 || isProcessing}
            className={`w-full py-3 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all ${
              selectedItems.length > 0
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {isProcessing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : isNativeApp() ? (
              isIOSDevice ? (
                <ScanFace className="w-4 h-4" />
              ) : (
                <Fingerprint className="w-4 h-4" />
              )
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {selectedItems.length > 0
              ? `Reorder R${Math.round(selectedTotal).toLocaleString("en-ZA")}`
              : "Select items to reorder"}
          </button>
        </div>
      </div>

      {/* Biometric Auth Modal */}
      <BiometricAuth
        isOpen={showBiometric}
        onClose={() => setShowBiometric(false)}
        onSuccess={() => {
          setShowBiometric(false);
          processReorder();
        }}
        purpose="reorder"
        title="Confirm Reorder"
        subtitle="Quick reorder your favorites"
      />
    </>
  );
};

export default QuickReorderWidget;
