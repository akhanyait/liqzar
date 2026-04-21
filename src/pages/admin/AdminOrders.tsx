import { useState, useEffect } from "react";
import {
  Search,
  Eye,
  ChevronRight,
  Truck,
  CheckCircle,
  Package,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAdminOrders, Order, OrderStatus } from "@/hooks/useOrders";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const allStatuses = [
  "All",
  "pending",
  "awaiting_payment",
  "confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "en_route",
  "delivered",
  "completed",
  "cancelled",
  "payment_failed",
  "delivery_failed",
];
const statusFlow: OrderStatus[] = [
  "pending",
  "confirmed",
  "preparing",
  "ready",
  "driver_assigned",
  "picked_up",
  "en_route",
  "delivered",
];

const statusLabels: Record<string, string> = {
  pending: "Pending",
  awaiting_payment: "Awaiting Payment",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  driver_assigned: "Driver Assigned",
  picked_up: "Picked Up",
  en_route: "En Route",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
  payment_failed: "Payment Failed",
  delivery_failed: "Delivery Failed",
  refunded: "Refunded",
  return_to_store: "Return to Store",
  return_received: "Return Received",
  rescheduled: "Rescheduled",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  awaiting_payment: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  preparing: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  ready: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  driver_assigned: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  picked_up: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  en_route: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  payment_failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  delivery_failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  refunded: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  return_to_store: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  return_received: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  rescheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

const statusIcons: Record<string, typeof Clock> = {
  pending: Clock,
  awaiting_payment: Clock,
  confirmed: CheckCircle,
  preparing: Package,
  ready: Package,
  driver_assigned: Truck,
  picked_up: Truck,
  en_route: Truck,
  delivered: CheckCircle,
  completed: CheckCircle,
  cancelled: XCircle,
  failed: XCircle,
  payment_failed: XCircle,
  delivery_failed: XCircle,
  refunded: RefreshCw,
  return_to_store: RefreshCw,
  return_received: CheckCircle,
  rescheduled: Clock,
};

const AdminOrders = () => {
  const {
    orders,
    loading,
    error,
    stats,
    updateOrderStatus,
    assignDriver,
    refetch,
  } = useAdminOrders();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<
    {
      id: string; // auth.users.id (matches orders.assigned_driver_id)
      name: string;
      phone: string;
      rating: number;
      vehicleLabel: string;
      vehicleType: string;
      licensePlate: string;
    }[]
  >([]);

  // Fetch verified drivers + their vehicles. Only verified drivers with a
  // registered vehicle can be assigned (prevents dispatching to unvetted users).
  useEffect(() => {
    const fetchDrivers = async () => {
      const { data: profiles, error } = await supabase
        .from("driver_profiles")
        .select("id, user_id, full_name, phone, rating, is_verified")
        .eq("is_verified", true);

      if (error || !profiles || profiles.length === 0) {
        setAvailableDrivers([]);
        return;
      }

      const profileIds = profiles.map((p: any) => p.id);
      const { data: vehicles } = await supabase
        .from("driver_vehicles")
        .select("driver_id, make_model, license_plate, vehicle_type")
        .in("driver_id", profileIds);

      const vehicleByDriver = new Map(
        (vehicles || []).map((v: any) => [v.driver_id, v]),
      );

      setAvailableDrivers(
        profiles.map((p: any) => {
          const v = vehicleByDriver.get(p.id);
          return {
            id: p.user_id,
            name: p.full_name || "Unknown Driver",
            phone: p.phone || "",
            rating: Number(p.rating ?? 5),
            vehicleLabel: v?.make_model || "No vehicle registered",
            vehicleType: v?.vehicle_type || "",
            licensePlate: v?.license_plate || "",
          };
        }),
      );
    };
    fetchDrivers();
  }, []);

  const filtered = orders.filter((o) => {
    const customerName = o.customer_name || "";
    const matchSearch =
      customerName.toLowerCase().includes(search.toLowerCase()) ||
      o.order_number.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "All" || o.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const statusCounts = allStatuses.reduce(
    (acc, s) => {
      acc[s] =
        s === "All"
          ? orders.length
          : orders.filter((o) => o.status === s).length;
      return acc;
    },
    {} as Record<string, number>,
  );

  const handleUpdateStatus = async (
    orderId: string,
    newStatus: OrderStatus,
  ) => {
    // Guard: cannot advance past driver_assigned without a driver actually
    // assigned. Admin must pick a verified driver first.
    const order = orders.find((o) => o.id === orderId);
    const requiresDriver: OrderStatus[] = [
      "driver_assigned",
      "picked_up",
      "en_route",
      "delivered",
    ];
    if (requiresDriver.includes(newStatus) && !order?.assigned_driver_id) {
      toast({
        title: "Pick a driver first",
        description:
          "Open the order and assign a verified driver before advancing to this status.",
        variant: "destructive",
      });
      return;
    }

    const success = await updateOrderStatus(orderId, newStatus);
    if (success && selectedOrder?.id === orderId) {
      setSelectedOrder((prev) =>
        prev ? { ...prev, status: newStatus } : null,
      );
    }
  };

  const handleAssignDriver = async (orderId: string, driverId: string) => {
    const success = await assignDriver(orderId, driverId);
    if (success && selectedOrder?.id === orderId) {
      setSelectedOrder((prev) =>
        prev ? { ...prev, assigned_driver_id: driverId } : null,
      );
    }
  };

  const getNextStatus = (current: OrderStatus): OrderStatus | null => {
    const idx = statusFlow.indexOf(current);
    return idx >= 0 && idx < statusFlow.length - 1 ? statusFlow[idx + 1] : null;
  };

  const formatCurrency = (amount: number) =>
    `R ${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`;
  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-ZA", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={refetch}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Orders</h2>
          <p className="text-sm text-muted-foreground">
            {stats.totalOrders} total • {formatCurrency(stats.totalRevenue)}{" "}
            revenue • {stats.pendingOrders} pending
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders..."
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {allStatuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                statusFilter === s
                  ? "bg-foreground text-background"
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {s === "All" ? s : statusLabels[s] || s}
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  statusFilter === s
                    ? "bg-background/20 text-background"
                    : "bg-muted-foreground/10 text-muted-foreground"
                }`}
              >
                {statusCounts[s]}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">
                  Order
                </th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">
                  Customer
                </th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">
                  Items
                </th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">
                  Total
                </th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">
                  Status
                </th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">
                  Driver
                </th>
                <th className="text-right p-4 text-xs font-semibold text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((order) => {
                const nextStatus = getNextStatus(order.status);
                const driverName = availableDrivers.find(
                  (d) => d.id === order.assigned_driver_id,
                )?.name;
                return (
                  <tr
                    key={order.id}
                    className="hover:bg-secondary/50 transition-colors"
                  >
                    <td className="p-4">
                      <span className="font-semibold text-sm text-foreground">
                        {order.order_number}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {formatDate(order.created_at)}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm font-medium text-foreground">
                        {order.customer_name || "Guest"}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {order.customer_phone || ""}
                      </span>
                    </td>
                    <td className="p-4 hidden md:table-cell text-sm text-muted-foreground">
                      {order.items?.length || 0}
                    </td>
                    <td className="p-4 font-bold text-sm text-foreground">
                      {formatCurrency(Number(order.total))}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-xs font-bold ${statusColors[order.status]}`}
                      >
                        {statusLabels[order.status]}
                      </span>
                    </td>
                    <td className="p-4 hidden lg:table-cell text-sm text-muted-foreground">
                      {driverName || "—"}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {nextStatus && (
                          <Button
                            size="sm"
                            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg"
                            onClick={() =>
                              handleUpdateStatus(order.id, nextStatus)
                            }
                          >
                            → {statusLabels[nextStatus]}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="p-8 text-center text-muted-foreground text-sm"
                  >
                    No orders found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      <Dialog
        open={!!selectedOrder}
        onOpenChange={() => setSelectedOrder(null)}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedOrder?.order_number}
              {selectedOrder && (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${statusColors[selectedOrder.status]}`}
                >
                  {statusLabels[selectedOrder.status]}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedOrder && (
            <div className="space-y-5">
              {/* Customer Info */}
              <div className="bg-secondary rounded-xl p-4">
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Customer
                </h4>
                <p className="text-sm font-semibold text-foreground">
                  {selectedOrder.customer_name || "Guest"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {selectedOrder.customer_phone || "No phone"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {selectedOrder.delivery_address?.addressLine1},{" "}
                  {selectedOrder.delivery_address?.suburb},{" "}
                  {selectedOrder.delivery_address?.city}
                </p>
              </div>

              {/* Items */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                  Items
                </h4>
                <div className="space-y-2">
                  {selectedOrder.items?.map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between bg-secondary/50 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-3">
                        {item.product_image && (
                          <img
                            src={item.product_image}
                            alt={item.product_name}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                        )}
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {item.product_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Qty: {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-foreground">
                        {formatCurrency(Number(item.subtotal))}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 mt-3 pt-3 border-t border-border">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Subtotal</span>
                    <span>
                      {formatCurrency(Number(selectedOrder.subtotal))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>VAT (15%)</span>
                    <span>
                      {formatCurrency(Number(selectedOrder.vat_amount))}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Delivery</span>
                    <span>
                      {formatCurrency(Number(selectedOrder.delivery_fee))}
                    </span>
                  </div>
                  {Number(selectedOrder.discount_amount) > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>Discount</span>
                      <span>
                        -{formatCurrency(Number(selectedOrder.discount_amount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-foreground pt-1">
                    <span>Total</span>
                    <span>{formatCurrency(Number(selectedOrder.total))}</span>
                  </div>
                </div>
              </div>

              {/* Status Flow */}
              <div>
                <h4 className="text-xs font-bold text-muted-foreground uppercase mb-3">
                  Order Progress
                </h4>
                <div className="flex items-center gap-1">
                  {statusFlow.map((s, i) => {
                    const currentIdx = statusFlow.indexOf(selectedOrder.status);
                    const Icon = statusIcons[s];
                    const isCompleted = i <= currentIdx;
                    return (
                      <div key={s} className="flex items-center gap-1 flex-1">
                        <div
                          className={`flex flex-col items-center gap-1 flex-1`}
                        >
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center ${
                              isCompleted
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span
                            className={`text-[9px] font-medium text-center ${isCompleted ? "text-foreground" : "text-muted-foreground"}`}
                          >
                            {statusLabels[s]}
                          </span>
                        </div>
                        {i < statusFlow.length - 1 && (
                          <div
                            className={`h-0.5 w-full mt-[-14px] ${i < currentIdx ? "bg-primary" : "bg-border"}`}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Driver Assignment — shown while pre-dispatch (pending..ready)
                   and also after driver_assigned so admin can reassign. */}
              {(selectedOrder.status === "ready" ||
                selectedOrder.status === "driver_assigned" ||
                selectedOrder.status === "preparing" ||
                selectedOrder.status === "confirmed") && (
                <div>
                  <h4 className="text-xs font-bold text-muted-foreground uppercase mb-2">
                    Assign Verified Driver
                  </h4>
                  {availableDrivers.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No verified drivers available. Verify drivers in the
                      Drivers page first.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 max-h-56 overflow-y-auto pr-1">
                      {availableDrivers.map((d) => {
                        const isSelected =
                          selectedOrder.assigned_driver_id === d.id;
                        return (
                          <button
                            key={d.id}
                            onClick={() =>
                              handleAssignDriver(selectedOrder.id, d.id)
                            }
                            className={`flex items-center justify-between gap-3 p-2.5 rounded-lg text-left transition-colors border ${
                              isSelected
                                ? "bg-primary/10 border-primary text-foreground"
                                : "bg-secondary border-transparent text-foreground hover:bg-muted"
                            }`}
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold truncate">
                                {d.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground truncate">
                                {d.vehicleLabel}
                                {d.licensePlate
                                  ? ` · ${d.licensePlate}`
                                  : ""}
                                {d.vehicleType ? ` · ${d.vehicleType}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-xs font-semibold text-amber-500">
                                ★ {d.rating.toFixed(1)}
                              </span>
                              {isSelected && (
                                <CheckCircle className="w-4 h-4 text-primary ml-1" />
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {selectedOrder.customer_notes && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-yellow-700 mb-1">
                    Customer Note
                  </p>
                  <p className="text-sm text-yellow-800">
                    {selectedOrder.customer_notes}
                  </p>
                </div>
              )}

              {/* Actions */}
              {getNextStatus(selectedOrder.status) && (
                <Button
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl h-11"
                  onClick={() =>
                    handleUpdateStatus(
                      selectedOrder.id,
                      getNextStatus(selectedOrder.status)!,
                    )
                  }
                >
                  Move to {statusLabels[getNextStatus(selectedOrder.status)!]}{" "}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminOrders;
