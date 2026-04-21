import { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  Upload,
  FileSpreadsheet,
  ShoppingCart,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/context/CartContext";
import { useProducts } from "@/hooks/useProducts";
import { getProductImageUrl, type Product } from "@/data/products";
import { useToast } from "@/hooks/use-toast";

interface BulkItem {
  productName: string;
  quantity: number;
  matched?: Product;
  status: "pending" | "matched" | "not_found";
}

const BulkOrderPage = () => {
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  const [parsing, setParsing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: allProducts } = useProducts();
  const { addItem } = useCart();
  const { toast } = useToast();

  const matchProduct = (
    name: string,
    products: Product[],
  ): Product | undefined => {
    const lower = name.toLowerCase().trim();
    // Exact match
    let match = products.find((p) => p.name.toLowerCase() === lower);
    if (match) return match;
    // Partial match
    match = products.find(
      (p) =>
        p.name.toLowerCase().includes(lower) ||
        lower.includes(p.name.toLowerCase()),
    );
    return match;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !allProducts) return;

    setParsing(true);

    try {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const items: BulkItem[] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Try CSV format: product_name, quantity
        const parts = line.split(",").map((p) => p.trim().replace(/"/g, ""));
        if (parts.length >= 2) {
          const productName = parts[0];
          const quantity = parseInt(parts[1]) || 1;
          if (
            productName &&
            !productName.toLowerCase().includes("product name")
          ) {
            const matched = matchProduct(productName, allProducts);
            items.push({
              productName,
              quantity,
              matched,
              status: matched ? "matched" : "not_found",
            });
          }
        } else if (
          parts[0] &&
          !parts[0].toLowerCase().includes("product name")
        ) {
          const matched = matchProduct(parts[0], allProducts);
          items.push({
            productName: parts[0],
            quantity: 1,
            matched,
            status: matched ? "matched" : "not_found",
          });
        }
      }

      setBulkItems(items);
      const matchedCount = items.filter((i) => i.status === "matched").length;
      toast({
        title: `${items.length} items parsed`,
        description: `${matchedCount} matched, ${items.length - matchedCount} need attention`,
      });
    } catch {
      toast({ title: "Error parsing file", variant: "destructive" });
    } finally {
      setParsing(false);
    }
  };

  const updateQuantity = (index: number, delta: number) => {
    setBulkItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, quantity: Math.max(1, item.quantity + delta) }
          : item,
      ),
    );
  };

  const removeItem = (index: number) => {
    setBulkItems((prev) => prev.filter((_, i) => i !== index));
  };

  const addAllToCart = () => {
    const matched = bulkItems.filter((i) => i.matched);
    matched.forEach((item) => {
      if (item.matched) {
        addItem(item.matched as any, item.quantity);
      }
    });
    toast({ title: `${matched.length} items added to cart` });
    setBulkItems([]);
  };

  const matchedItems = bulkItems.filter((i) => i.status === "matched");
  const unmatchedItems = bulkItems.filter((i) => i.status === "not_found");
  const totalValue = matchedItems.reduce(
    (sum, i) => sum + (i.matched?.price || 0) * i.quantity,
    0,
  );

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <div className="container px-4 pt-6">
        <h1 className="text-2xl font-bold text-foreground">Bulk Order</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload a CSV or spreadsheet to order multiple products at once
        </p>

        {/* Upload Area */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-foreground/30 transition-colors cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <FileSpreadsheet className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="font-semibold text-foreground mb-1">
            {parsing ? "Parsing..." : "Upload Your Order List"}
          </h3>
          <p className="text-xs text-muted-foreground mb-4">
            CSV format: Product Name, Quantity (one per line)
          </p>
          <Button variant="outline" className="rounded-xl gap-2">
            <Upload className="w-4 h-4" /> Choose File
          </Button>
        </motion.div>

        {/* Template Download */}
        <div className="mt-4 p-4 bg-secondary rounded-2xl">
          <p className="text-xs font-semibold text-foreground mb-2">
            CSV Template Format:
          </p>
          <code className="text-[11px] text-muted-foreground block bg-background p-3 rounded-xl">
            Product Name,Quantity{"\n"}
            Johnnie Walker Black Label 12 Year Old,2{"\n"}
            Hennessy XO,1{"\n"}
            Don Julio 1942,3{"\n"}
            Moët & Chandon Impérial Brut,6
          </code>
        </div>

        {/* Results */}
        {bulkItems.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Summary */}
            <div className="flex items-center justify-between p-4 bg-card border border-border rounded-2xl">
              <div>
                <span className="text-sm font-bold text-foreground">
                  {matchedItems.length} matched
                </span>
                {unmatchedItems.length > 0 && (
                  <span className="text-sm text-destructive ml-2">
                    {unmatchedItems.length} not found
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-foreground">
                  R {totalValue.toLocaleString()}
                </span>
                <span className="block text-[10px] text-muted-foreground">
                  estimated total
                </span>
              </div>
            </div>

            {/* Matched Items */}
            {matchedItems.length > 0 && (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-sm text-foreground">
                    Matched Products
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {matchedItems.map((item, i) => {
                    const originalIndex = bulkItems.indexOf(item);
                    return (
                      <div key={i} className="p-4 flex items-center gap-3">
                        <div className="w-10 h-10 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                          <img
                            src={getProductImageUrl(item.matched!)}
                            alt={item.matched!.name}
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                "/placeholder.svg";
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {item.matched!.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            R {item.matched!.price} each
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateQuantity(originalIndex, -1)}
                            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => updateQuantity(originalIndex, 1)}
                            className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-sm font-bold text-foreground w-20 text-right">
                          R{" "}
                          {(
                            item.matched!.price * item.quantity
                          ).toLocaleString()}
                        </span>
                        <button
                          onClick={() => removeItem(originalIndex)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Unmatched Items */}
            {unmatchedItems.length > 0 && (
              <div className="bg-card border border-destructive/20 rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-border flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  <span className="font-semibold text-sm text-foreground">
                    Not Found
                  </span>
                </div>
                <div className="divide-y divide-border">
                  {unmatchedItems.map((item, i) => (
                    <div key={i} className="p-4 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm text-muted-foreground">
                          {item.productName}
                        </p>
                        <p className="text-[10px] text-destructive">
                          No matching product found
                        </p>
                      </div>
                      <button
                        onClick={() => removeItem(bulkItems.indexOf(item))}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart */}
            {matchedItems.length > 0 && (
              <Button
                onClick={addAllToCart}
                className="w-full h-14 rounded-2xl bg-foreground text-background hover:bg-foreground/90 text-base font-semibold gap-2"
              >
                <ShoppingCart className="w-5 h-5" />
                Add {matchedItems.length} Items to Cart — R{" "}
                {totalValue.toLocaleString()}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BulkOrderPage;
