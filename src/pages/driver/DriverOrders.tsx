import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Package,
  MapPin,
  Clock,
  CheckCircle,
  Truck,
  Loader2,
  RefreshCw,
  Navigation,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useDriverAssignments } from "@/hooks/useOrders";

const urgencyColors: Record<string, string> = {
  "same-day": "bg-red-100 text-red-700",
  "next-day": "bg-blue-100 text-blue-700",
  scheduled: "bg-muted text-muted-foreground",
  standard: "bg-blue-100 text-blue-700",
};

const urgencyLabels: Record<string, string> = {
  "same-day": "⚡ Express",
  "next-day": "📦 Next Day",
  scheduled: "📅 Scheduled",
  standard: "📦 Standard",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(amount);

const DriverOrders = () => {
  const navigate = useNavigate();
  const { assignments, loading, refetch: fetchAssignments, updateAssignmentStatus } = useDriverAssignments();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [verifiedOrders, setVerifiedOrders] = useState<Set<string>>(new Set());

  const activeAssignments = assignments.filter(
    (a) => a.status === "accepted" || a.status === "picked_up" || a.status === "en_route"
  );
  const pendingAssignments = assignments.filter((a) => a.status === "pending");

  const acceptOrder = async (assignmentId: string) => {
    const success = await updateAssignmentStatus(assignmentId, "accepted");
    if (success) {
      toast({ title: "Order Accepted", description: "You've accepted this delivery." });
    }
  };

  const verifyStock = (assignmentId: string) => {
    setVerifiedOrders((prev) => new Set(prev).add(assignmentId));
    toast({ title: "Stock Verified", description: "All items verified." });
  };

  const startDriving = async (assignmentId: string, address: any) => {
    const success = await updateAssignmentStatus(assignmentId, "en_route");
    if (success) {
      toast({ title: "On the way!", description: "Navigation started." });
    }
  };

  const completeDelivery = async (assignmentId: string) => {
    const success = await updateAssignmentStatus(assignmentId, "delivered");
    if (success) {
      toast({ title: "Delivery Complete", description: "Order delivered successfully!" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">My Deliveries</h2>
        <Button variant="ghost" size="sm" onClick={() => fetchAssignments()}>
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      {/* Active Assignments */}
      {activeAssignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Active Orders</h3>
          {activeAssignments.map((assignment) => {
            const order = assignment.orders;
            const address = order?.delivery_address;
            const customer = address?.fullName || "Customer";
            const items = order?.order_items?.length || 0;
            const verified = verifiedOrders.has(assignment.id);
            const eta = "~15 min";
            const km = 5.2;

            return (
              <div
                key={assignment.id}
                className="bg-card border-2 border-primary rounded-2xl overflow-hidden"
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{order?.order_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${urgencyColors[order?.delivery_method || "standard"]}`}>
                        {urgencyLabels[order?.delivery_method || "standard"]}
                      </span>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      assignment.status === "en_route" ? "bg-green-100 text-green-700" :
                      assignment.status === "picked_up" ? "bg-blue-100 text-blue-700" :
                      "bg-yellow-100 text-yellow-700"
                    }`}>
                      {assignment.status === "en_route" ? "En Route" : assignment.status === "picked_up" ? "Picked Up" : "Accepted"}
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-foreground">{customer}</p>
                    <p className="text-muted-foreground flex items-center gap-1 text-xs">
                      <MapPin className="w-3 h-3" />{address?.addressLine1}, {address?.suburb}, {address?.city}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {items} items</span>
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ETA: {eta}</span>
                    <span className="flex items-center gap-1"><Navigation className="w-3 h-3" /> {km.toFixed(1)} km</span>
                    <span className="font-bold text-primary">{formatCurrency(Number(order?.total || 0))}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-4">
                    {!verified && (
                      <Button className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => verifyStock(assignment.id)}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Verify Stock
                      </Button>
                    )}
                    {assignment.status === "picked_up" && (
                      <Button className="flex-1 rounded-xl bg-green-600 hover:bg-green-700" disabled={!verified} onClick={() => startDriving(assignment.id, address)}>
                        <Truck className="w-4 h-4 mr-2" /> Start Driving
                      </Button>
                    )}
                    {assignment.status === "en_route" && (
                      <Button className="flex-1 rounded-xl bg-green-600 hover:bg-green-700" onClick={() => completeDelivery(assignment.id)}>
                        <CheckCircle className="w-4 h-4 mr-2" /> Complete Delivery
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pending Assignments List */}
      {pendingAssignments.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-foreground">Pending Orders</h3>
          <AnimatePresence>
            {pendingAssignments.map((assignment) => {
              const order = assignment.orders;
              const address = order?.delivery_address;

              return (
                <motion.div
                  key={assignment.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100, transition: { duration: 0.3 } }}
                  className="bg-card border border-border rounded-2xl overflow-hidden"
                >
                  <div
                    className="p-4 cursor-pointer"
                    onClick={() => setExpanded(expanded === assignment.id ? null : assignment.id)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground">{order?.order_number}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${urgencyColors[order?.delivery_method || "standard"]}`}>
                          {urgencyLabels[order?.delivery_method || "standard"]}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-1 text-sm">
                      <p className="font-medium text-foreground">{address?.fullName}</p>
                      <p className="text-muted-foreground flex items-center gap-1 text-xs">
                        <MapPin className="w-3 h-3" />{address?.addressLine1}, {address?.suburb}, {address?.city}
                      </p>
                    </div>

                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {order?.order_items?.length || 0} items</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(order?.created_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="font-bold text-primary">{formatCurrency(Number(order?.total || 0))}</span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  <AnimatePresence>
                    {expanded === assignment.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border"
                      >
                        <div className="p-4 space-y-3">
                          <div className="space-y-2">
                            <p className="text-[10px] font-bold text-muted-foreground uppercase">Items</p>
                            {order?.order_items?.map((item: any, i: number) => (
                              <div key={i} className="flex items-center gap-2 text-sm">
                                {item.product_image && (
                                  <img src={item.product_image} alt={item.product_name} className="w-8 h-8 rounded object-cover" />
                                )}
                                <span className="flex-1 text-foreground">{item.product_name}</span>
                                <span className="text-muted-foreground">x{item.quantity}</span>
                              </div>
                            ))}
                          </div>

                          {order?.delivery_instructions && (
                            <div className="bg-yellow-50 rounded-xl p-3">
                              <p className="text-[10px] font-bold text-yellow-700 uppercase mb-1">Delivery Instructions</p>
                              <p className="text-xs text-yellow-800">{order.delivery_instructions}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Accept Button */}
                  <div className="flex border-t border-border">
                    <button
                      onClick={() => acceptOrder(assignment.id)}
                      className="flex-1 py-3 text-xs font-semibold text-primary hover:bg-primary/5 flex items-center justify-center gap-1 transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Accept Delivery
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Empty State */}
      {assignments.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Truck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No deliveries assigned</p>
          <p className="text-xs mt-1">New orders will appear here</p>
        </div>
      )}
    </div>
  );
};

export default DriverOrders;
