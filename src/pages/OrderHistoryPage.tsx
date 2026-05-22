import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  ChevronRight,
  Clock,
  CheckCircle2,
  Truck,
  MapPin,
  RotateCcw,
  Star,
  ShoppingBag,
  Plus,
  ShieldCheck,
} from "lucide-react";
import BackButton from "@/components/BackButton";
import EmptyState from "@/components/EmptyState";

interface OrderItem {
  name: string;
  qty: number;
  price: number;
  image: string;
}

interface Order {
  id: string;
  date: string;
  dateISO?: string;
  status: string;
  items: OrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  address: string;
  deliveryType?: string;
  scheduledDate?: string | null;
  scheduledSlot?: string | null;
}

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof Clock }
> = {
  delivered: {
    label: "Delivered",
    color: "text-primary bg-primary/10",
    icon: CheckCircle2,
  },
  in_transit: {
    label: "In Transit",
    color: "text-blue-600 bg-blue-50",
    icon: Truck,
  },
  processing: {
    label: "Processing",
    color: "text-amber-600 bg-amber-50",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelled",
    color: "text-destructive bg-red-50",
    icon: Package,
  },
  confirmed: {
    label: "Confirmed",
    color: "text-blue-600 bg-blue-50",
    icon: CheckCircle2,
  },
  preparing: {
    label: "Preparing",
    color: "text-purple-600 bg-purple-50",
    icon: Package,
  },
  ready: {
    label: "Ready",
    color: "text-indigo-600 bg-indigo-50",
    icon: Package,
  },
  picked_up: {
    label: "Picked Up",
    color: "text-amber-600 bg-amber-50",
    icon: Truck,
  },
  en_route: {
    label: "En Route",
    color: "text-amber-600 bg-amber-50",
    icon: Truck,
  },
};

// Load orders from localStorage
const getStoredOrders = (): Order[] => {
  try {
    const stored = localStorage.getItem("liqzar-orders");
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const tabs = ["All", "Active", "Completed"] as const;

const OrderHistoryPage = () => {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("All");
  const [orders, setOrders] = useState<Order[]>(getStoredOrders);

  // Refresh orders when page is focused (in case order was placed)
  useEffect(() => {
    const handleFocus = () => setOrders(getStoredOrders());
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

  const filtered = orders.filter((o) => {
    if (activeTab === "Active")
      return [
        "in_transit",
        "processing",
        "confirmed",
        "preparing",
        "ready",
        "picked_up",
        "en_route",
      ].includes(o.status);
    if (activeTab === "Completed") return o.status === "delivered";
    return true;
  });

  return (
    <div className="pb-28 bg-background overflow-x-hidden min-h-screen">
      <div className="bg-primary pt-6 pb-4 px-4">
        <div className="container flex items-center gap-3 mb-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Order History
            </h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5">
              Track and manage your orders
            </p>
          </div>
        </div>
        <div className="container flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                activeTab === tab
                  ? "bg-primary-foreground text-primary"
                  : "bg-primary-foreground/20 text-primary-foreground"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="container px-4 mt-6 space-y-3">
        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="Your delivery history will appear here — every bottle, beautifully catalogued."
            action={{ label: "Start shopping", to: "/catalogue" }}
          />
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No {activeTab.toLowerCase()} orders
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {filtered.map((order, i) => {
              const cfg = statusConfig[order.status] || statusConfig.processing;
              const StatusIcon = cfg.icon;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-background border border-border rounded-2xl overflow-hidden uber-shadow"
                >
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-xs text-muted-foreground">
                          {order.date}
                        </p>
                        <p className="text-sm font-bold text-foreground">
                          {order.id}
                        </p>
                      </div>
                      <span
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${cfg.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex gap-2 overflow-x-auto scrollbar-none mb-3">
                      {order.items.map((item, j) => (
                        <div
                          key={j}
                          className="flex-shrink-0 flex items-center gap-2 bg-secondary p-2 rounded-xl"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-foreground truncate max-w-[120px]">
                              {item.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              x{item.qty} · R{item.price}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[180px]">
                          {order.address}
                        </span>
                      </div>
                      <span className="font-bold text-foreground">
                        R
                        {order.total.toLocaleString("en-ZA", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>

                    {order.status === "delivered" && (
                      <div className="mt-3 pt-3 border-t border-border/60">
                        <div className="h-px w-8 bg-primary/70 mx-auto" />
                        <p className="text-[9px] tracking-[0.28em] text-primary font-semibold mt-2 uppercase text-center">
                          Delivered With Care
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground italic text-center leading-snug px-2">
                          Poured, packed and handed over by a vetted courier — verified at the door.
                        </p>
                        <div className="mt-2 flex justify-center">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-semibold tracking-wide uppercase text-primary bg-primary/10 border border-primary/40 rounded-full">
                            <ShieldCheck className="w-2.5 h-2.5" strokeWidth={2.5} />
                            Age & ID verified on delivery
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex border-t border-border divide-x divide-border">
                    <button className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <RotateCcw className="w-3.5 h-3.5" /> Reorder
                    </button>
                    {order.status === "delivered" && (
                      <button className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:bg-primary/5 transition-colors">
                        <Star className="w-3.5 h-3.5" /> Rate
                      </button>
                    )}
                    <button className="flex-1 py-3 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      Details <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

export default OrderHistoryPage;
