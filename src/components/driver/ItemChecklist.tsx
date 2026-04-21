import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  AlertTriangle,
  QrCode,
  Package,
  ChevronRight,
  ChevronDown,
  Wine,
  ScanLine,
  AlertCircle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VerifiedItem } from "@/hooks/useInventoryVerification";
import { useHaptics } from "@/hooks/useNativeFeatures";

interface ItemChecklistProps {
  items: VerifiedItem[];
  mode: "pickup" | "delivery";
  onVerifyItem: (itemId: string) => void;
  onReportIssue: (
    itemId: string,
    issue: "damaged" | "missing",
    notes: string,
  ) => void;
  onScanBarcode: (itemIndex: number) => void;
  progress: {
    total: number;
    verified: number;
    damaged: number;
    missing: number;
    percentage: number;
  };
  currentScanIndex?: number;
}

export const ItemChecklist = ({
  items,
  mode,
  onVerifyItem,
  onReportIssue,
  onScanBarcode,
  progress,
  currentScanIndex = 0,
}: ItemChecklistProps) => {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [showIssueModal, setShowIssueModal] = useState<string | null>(null);
  const [issueNotes, setIssueNotes] = useState("");
  const [issueType, setIssueType] = useState<"damaged" | "missing">("damaged");
  const { impact, notification } = useHaptics();

  const handleVerify = (itemId: string) => {
    impact("medium");
    onVerifyItem(itemId);
    notification("success");
  };

  const handleReportIssue = () => {
    if (!showIssueModal) return;
    onReportIssue(showIssueModal, issueType, issueNotes);
    setShowIssueModal(null);
    setIssueNotes("");
    impact("heavy");
  };

  const getItemIcon = (category: string) => {
    const icons: Record<string, typeof Wine> = {
      whisky: Wine,
      wine: Wine,
      champagne: Wine,
      vodka: Wine,
      gin: Wine,
      beer: Package,
      default: Package,
    };
    return icons[category.toLowerCase()] || icons.default;
  };

  const getStatusIcon = (item: VerifiedItem) => {
    if (!item.verified) return null;
    if (item.condition === "good")
      return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (item.condition === "damaged")
      return <AlertCircle className="w-5 h-5 text-amber-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  const getStatusBg = (item: VerifiedItem) => {
    if (!item.verified) return "bg-muted/50";
    if (item.condition === "good")
      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
    if (item.condition === "damaged")
      return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
  };

  return (
    <div className="space-y-4">
      {/* Progress Header */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground">
            {mode === "pickup"
              ? "Pickup Verification"
              : "Delivery Confirmation"}
          </h3>
          <span className="text-sm font-bold text-primary">
            {progress.verified}/{progress.total}
          </span>
        </div>

        {/* Progress Bar */}
        <div className="h-3 bg-muted rounded-full overflow-hidden mb-2">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress.percentage}%` }}
            className="h-full bg-gradient-to-r from-primary to-green-500 rounded-full"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="text-center p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <p className="text-lg font-bold text-green-600">
              {progress.verified - progress.damaged - progress.missing}
            </p>
            <p className="text-[10px] text-green-600">Verified</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20">
            <p className="text-lg font-bold text-amber-600">
              {progress.damaged}
            </p>
            <p className="text-[10px] text-amber-600">Damaged</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
            <p className="text-lg font-bold text-red-600">{progress.missing}</p>
            <p className="text-[10px] text-red-600">Missing</p>
          </div>
        </div>
      </div>

      {/* Sequential Scan Button */}
      {progress.verified < progress.total &&
        (() => {
          const unverifiedItems = items.filter((item) => !item.verified);
          const nextItem = unverifiedItems[0];
          const nextIndex = items.findIndex((item) => item.id === nextItem?.id);
          return (
            <Button
              onClick={() => onScanBarcode(nextIndex)}
              className="w-full h-16 rounded-2xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 gap-3 flex-col py-2"
            >
              <div className="flex items-center gap-2">
                <ScanLine className="w-5 h-5" />
                <span className="font-bold">
                  Scan Item ({progress.verified + 1} of {progress.total})
                </span>
              </div>
              <span className="text-xs opacity-90 truncate max-w-[90%]">
                {nextItem?.name}
              </span>
            </Button>
          );
        })()}

      {/* Items List */}
      <div className="space-y-2">
        {items.map((item, index) => {
          const Icon = getItemIcon(item.category);
          const isExpanded = expandedItem === item.id;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`rounded-2xl border transition-all ${getStatusBg(item)}`}
            >
              {/* Item Row */}
              <div
                className="p-4 flex items-center gap-3 cursor-pointer"
                onClick={() => setExpandedItem(isExpanded ? null : item.id)}
              >
                {/* Status/Icon */}
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    item.verified
                      ? item.condition === "good"
                        ? "bg-green-100 dark:bg-green-900/40"
                        : item.condition === "damaged"
                          ? "bg-amber-100 dark:bg-amber-900/40"
                          : "bg-red-100 dark:bg-red-900/40"
                      : "bg-muted"
                  }`}
                >
                  {item.verified ? (
                    getStatusIcon(item)
                  ) : (
                    <Icon className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>

                {/* Item Info */}
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">
                    {item.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Qty: {item.quantity}</span>
                    {item.size && <span>• {item.size}</span>}
                    {item.barcode && (
                      <span className="flex items-center gap-1">
                        <QrCode className="w-3 h-3" />
                        {item.barcode.slice(-6)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Price & Expand */}
                <div className="text-right">
                  <p className="font-bold text-foreground">
                    R
                    {item.price.toLocaleString("en-ZA", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
                  )}
                </div>
              </div>

              {/* Expanded Actions */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0 border-t border-border/50">
                      {/* Item Image */}
                      {item.imageUrl && (
                        <div className="mb-3 mt-3">
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-32 object-contain rounded-xl bg-white"
                          />
                        </div>
                      )}

                      {/* Actions */}
                      {!item.verified ? (
                        <div className="grid grid-cols-3 gap-2 mt-3">
                          <Button
                            onClick={() => handleVerify(item.id)}
                            className="h-12 rounded-xl bg-green-500 hover:bg-green-600"
                          >
                            <Check className="w-4 h-4 mr-1" />
                            OK
                          </Button>
                          <Button
                            onClick={() => {
                              setShowIssueModal(item.id);
                              setIssueType("damaged");
                            }}
                            variant="outline"
                            className="h-12 rounded-xl border-amber-300 text-amber-600"
                          >
                            <AlertTriangle className="w-4 h-4 mr-1" />
                            Damaged
                          </Button>
                          <Button
                            onClick={() => {
                              setShowIssueModal(item.id);
                              setIssueType("missing");
                            }}
                            variant="outline"
                            className="h-12 rounded-xl border-red-300 text-red-600"
                          >
                            <X className="w-4 h-4 mr-1" />
                            Missing
                          </Button>
                        </div>
                      ) : (
                        <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-muted/50">
                          {getStatusIcon(item)}
                          <div>
                            <p className="text-sm font-medium">
                              {item.condition === "good"
                                ? "Verified"
                                : item.condition === "damaged"
                                  ? "Reported Damaged"
                                  : "Reported Missing"}
                            </p>
                            {item.verifiedAt && (
                              <p className="text-xs text-muted-foreground">
                                at{" "}
                                {new Date(item.verifiedAt).toLocaleTimeString()}
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Scan this item button */}
                      {!item.verified && (
                        <Button
                          onClick={() => onScanBarcode(index)}
                          className="w-full mt-2 h-10 rounded-xl bg-blue-500 hover:bg-blue-600"
                        >
                          <ScanLine className="w-4 h-4 mr-2" />
                          Scan This Item
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Issue Report Modal */}
      <AnimatePresence>
        {showIssueModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="bg-card rounded-3xl w-full max-w-md p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    issueType === "damaged" ? "bg-amber-100" : "bg-red-100"
                  }`}
                >
                  {issueType === "damaged" ? (
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-600" />
                  )}
                </div>
                <div>
                  <h3 className="font-bold text-lg">
                    Report {issueType === "damaged" ? "Damaged" : "Missing"}{" "}
                    Item
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {items.find((i) => i.id === showIssueModal)?.name}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex gap-2">
                  <Button
                    variant={issueType === "damaged" ? "default" : "outline"}
                    onClick={() => setIssueType("damaged")}
                    className="flex-1 h-12 rounded-xl"
                  >
                    <AlertTriangle className="w-4 h-4 mr-2" />
                    Damaged
                  </Button>
                  <Button
                    variant={issueType === "missing" ? "default" : "outline"}
                    onClick={() => setIssueType("missing")}
                    className="flex-1 h-12 rounded-xl"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Missing
                  </Button>
                </div>

                <textarea
                  value={issueNotes}
                  onChange={(e) => setIssueNotes(e.target.value)}
                  placeholder="Add notes about the issue..."
                  className="w-full h-24 p-3 rounded-xl bg-muted text-foreground resize-none"
                />

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowIssueModal(null)}
                    className="flex-1 h-12 rounded-xl"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleReportIssue}
                    className={`flex-1 h-12 rounded-xl ${
                      issueType === "damaged"
                        ? "bg-amber-500 hover:bg-amber-600"
                        : "bg-red-500 hover:bg-red-600"
                    }`}
                  >
                    Report Issue
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ItemChecklist;
