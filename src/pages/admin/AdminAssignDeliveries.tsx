import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MapPin,
  Package,
  User,
  Search,
  Filter,
  Truck,
  ChevronRight,
  CheckCircle,
  Clock,
  AlertCircle,
  Users,
  Calendar,
  ArrowRight,
  Building2,
  Navigation,
  Phone,
  X,
  Weight,
  Box,
  TruckIcon,
  AlertTriangle,
  Bike,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  calculateRecommendedVehicle,
  checkVehicleMismatch,
  getVehicleCapacity,
  type VehicleType,
  VEHICLE_CAPACITIES,
} from "@/lib/logistics-ai";

// Types
interface DeliveryOrder {
  id: string;
  customer: string;
  phone: string;
  address: string;
  suburb: string;
  city: string;
  province: string;
  postalCode: string;
  deliveryArea: string;
  items: number;
  total: number;
  totalWeight: number; // kg
  totalVolume: number; // m³
  distance: number; // km
  status: "pending_assignment" | "assigned" | "in_progress" | "delivered";
  orderTime: string;
  priority: "high" | "medium" | "low";
  assignedDriver?: string;
  assignedDriverId?: string;
}

interface Driver {
  id: string; // driver_profiles.id
  userId: string; // auth.users.id — used for orders.assigned_driver_id
  name: string;
  phone: string;
  photo: string;
  assignedArea: string;
  status: "available" | "busy" | "offline";
  currentDeliveries: number;
  completedToday: number;
  rating: number;
  vehicleType: VehicleType;
  licensePlate: string;
  makeModel: string;
}

// Mock data - delivery areas based on suburbs
const deliveryAreas = [
  "Sandton North",
  "Sandton South",
  "Rosebank",
  "Fourways",
  "Midrand",
  "Randburg",
  "Centurion",
  "Pretoria East",
  "Pretoria CBD",
  "Johannesburg CBD",
  "Soweto",
  "Roodepoort",
];

const mockOrders: DeliveryOrder[] = [
  {
    id: "ORD-3001",
    customer: "Thabo Mokoena",
    phone: "+27 82 123 4567",
    address: "42 Rivonia Road",
    suburb: "Sandton",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    deliveryArea: "Sandton North",
    items: 4,
    total: 1249.99,
    totalWeight: 15.5, // kg
    totalVolume: 0.12, // m³
    distance: 8.5, // km
    status: "pending_assignment",
    orderTime: "10:30 AM",
    priority: "high",
  },
  {
    id: "ORD-3002",
    customer: "Naledi Khumalo",
    phone: "+27 83 234 5678",
    address: "15 Oxford Road",
    suburb: "Rosebank",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    deliveryArea: "Rosebank",
    items: 2,
    total: 599.0,
    totalWeight: 8.2,
    totalVolume: 0.08,
    distance: 5.2,
    status: "pending_assignment",
    orderTime: "11:15 AM",
    priority: "medium",
  },
  {
    id: "ORD-3003",
    customer: "Priya Naidoo",
    phone: "+27 71 456 7890",
    address: "88 William Nicol Drive",
    suburb: "Fourways",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    deliveryArea: "Fourways",
    items: 6,
    total: 2199.0,
    totalWeight: 125.0, // Heavy load - requires car/bakkie
    totalVolume: 0.45,
    distance: 15.3,
    status: "pending_assignment",
    orderTime: "11:45 AM",
    priority: "high",
  },
  {
    id: "ORD-3004",
    customer: "James van der Merwe",
    phone: "+27 84 567 8901",
    address: "22 Maude Street",
    suburb: "Sandton",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2196",
    deliveryArea: "Sandton North",
    items: 3,
    total: 899.5,
    totalWeight: 11.0,
    totalVolume: 0.09,
    distance: 6.8,
    status: "assigned",
    orderTime: "09:00 AM",
    priority: "medium",
    assignedDriver: "Sipho M.",
    assignedDriverId: "DRV-001",
  },
  {
    id: "ORD-3005",
    customer: "Lisa Johnson",
    phone: "+27 72 678 9012",
    address: "100 Sloane Street",
    suburb: "Bryanston",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2191",
    deliveryArea: "Sandton North",
    items: 1,
    total: 349.0,
    totalWeight: 3.5,
    totalVolume: 0.04,
    distance: 4.2,
    status: "pending_assignment",
    orderTime: "12:00 PM",
    priority: "low",
  },
  {
    id: "ORD-3006",
    customer: "Michael Okonkwo",
    phone: "+27 81 789 0123",
    address: "55 Hendrik Verwoerd Dr",
    suburb: "Randburg",
    city: "Johannesburg",
    province: "Gauteng",
    postalCode: "2194",
    deliveryArea: "Randburg",
    items: 5,
    total: 1599.0,
    totalWeight: 550.0, // Very heavy - requires bakkie or truck
    totalVolume: 1.8,
    distance: 22.5,
    status: "pending_assignment",
    orderTime: "12:30 PM",
    priority: "medium",
  },
];

const AdminAssignDeliveries = () => {
  const [orders, setOrders] = useState<DeliveryOrder[]>(mockOrders);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  // Load VERIFIED drivers + their vehicles from Supabase. Only drivers with
  // is_verified = true are eligible for assignment; unverified drivers must
  // complete onboarding in the Drivers admin page first.
  useEffect(() => {
    const fetchVerifiedDrivers = async () => {
      const { data: profiles } = await supabase
        .from("driver_profiles")
        .select("id, user_id, full_name, phone, profile_picture_url, rating, total_deliveries, is_verified")
        .eq("is_verified", true);

      if (!profiles || profiles.length === 0) {
        setDrivers([]);
        return;
      }

      const profileIds = profiles.map((p: any) => p.id);
      const { data: vehicles } = await supabase
        .from("driver_vehicles")
        .select("driver_id, vehicle_type, license_plate, make_model, vehicle_photo_url")
        .in("driver_id", profileIds);
      const vByDriver = new Map(
        (vehicles || []).map((v: any) => [v.driver_id, v]),
      );

      // Count active deliveries per driver from driver_assignments.
      const { data: activeAssignments } = await supabase
        .from("driver_assignments")
        .select("driver_id")
        .in("status", ["pending", "accepted", "picked_up", "en_route"]);
      const activeCount = new Map<string, number>();
      (activeAssignments || []).forEach((a: any) => {
        activeCount.set(a.driver_id, (activeCount.get(a.driver_id) || 0) + 1);
      });

      setDrivers(
        profiles.map((p: any) => {
          const v = vByDriver.get(p.id);
          const current = activeCount.get(p.user_id) || 0;
          return {
            id: p.id,
            userId: p.user_id,
            name: p.full_name || "Unknown Driver",
            phone: p.phone || "",
            photo:
              p.profile_picture_url ||
              `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(p.full_name || p.id)}`,
            assignedArea: "All Areas",
            status:
              current === 0
                ? "available"
                : current < 3
                  ? "available"
                  : "busy",
            currentDeliveries: current,
            completedToday: 0,
            rating: Number(p.rating ?? 5),
            vehicleType: (v?.vehicle_type as VehicleType) || "car",
            licensePlate: v?.license_plate || "",
            makeModel: v?.make_model || "No vehicle registered",
          };
        }),
      );
    };
    fetchVerifiedDrivers();
  }, []);
  const [selectedArea, setSelectedArea] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Get AI recommendation for an order
  const getOrderRecommendation = (order: DeliveryOrder) => {
    return calculateRecommendedVehicle({
      totalWeight: order.totalWeight,
      totalVolume: order.totalVolume,
      itemCount: order.items,
      distance: order.distance,
    });
  };

  // Get vehicle icon component
  const getVehicleIcon = (vehicleType: VehicleType) => {
    switch (vehicleType) {
      case "scooter":
        return <Bike className="w-3.5 h-3.5" />;
      case "car":
        return <Car className="w-3.5 h-3.5" />;
      case "bakkie":
      case "small_truck":
      case "medium_truck":
      case "large_truck":
        return <TruckIcon className="w-3.5 h-3.5" />;
      default:
        return <Truck className="w-3.5 h-3.5" />;
    }
  };

  // Filter orders by area and search
  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesArea = !selectedArea || order.deliveryArea === selectedArea;
      const matchesSearch =
        !searchQuery ||
        order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.address.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      return matchesArea && matchesSearch && matchesStatus;
    });
  }, [orders, selectedArea, searchQuery, statusFilter]);

  // Group orders by delivery area
  const ordersByArea = useMemo(() => {
    const grouped: Record<string, DeliveryOrder[]> = {};
    filteredOrders.forEach((order) => {
      if (!grouped[order.deliveryArea]) {
        grouped[order.deliveryArea] = [];
      }
      grouped[order.deliveryArea].push(order);
    });
    return grouped;
  }, [filteredOrders]);

  // Available verified drivers (we don't track per-area assignments in schema,
  // so we show all non-offline verified drivers and rely on vehicle-fit logic
  // to surface the right picks).
  const driversForArea = useMemo(() => {
    return drivers.filter((d) => d.status !== "offline");
  }, [drivers]);

  // Toggle order selection
  const toggleOrderSelection = (orderId: string) => {
    setSelectedOrders((prev) =>
      prev.includes(orderId)
        ? prev.filter((id) => id !== orderId)
        : [...prev, orderId],
    );
  };

  // Select all orders in an area
  const selectAllInArea = (area: string) => {
    const areaOrderIds = orders
      .filter(
        (o) => o.deliveryArea === area && o.status === "pending_assignment",
      )
      .map((o) => o.id);

    const allSelected = areaOrderIds.every((id) => selectedOrders.includes(id));

    if (allSelected) {
      setSelectedOrders((prev) =>
        prev.filter((id) => !areaOrderIds.includes(id)),
      );
    } else {
      setSelectedOrders((prev) => [...new Set([...prev, ...areaOrderIds])]);
    }
  };

  // Assign deliveries to driver
  const assignDeliveries = async () => {
    if (!selectedDriver || selectedOrders.length === 0) {
      toast({ title: "Select orders and a driver", variant: "destructive" });
      return;
    }

    try {
      // Write orders.assigned_driver_id = the driver's auth.users.id (NOT
      // driver_profiles.id) — that's what the FK + customer tracking expect.
      const { error } = await supabase
        .from("orders")
        .update({
          assigned_driver_id: selectedDriver.userId,
          status: "driver_assigned",
        })
        .in("id", selectedOrders);

      if (error) {
        console.error("Error assigning orders:", error);
        toast({
          title: "Assignment Failed",
          description: error.message || "Failed to assign orders to driver",
          variant: "destructive",
        });
        return;
      }

      // Also create/refresh driver_assignments rows so the driver app picks
      // up the handoff and customer tracking can read ETA + current_location.
      const assignmentRows = selectedOrders.map((orderId) => ({
        order_id: orderId,
        driver_id: selectedDriver.userId,
        status: "pending" as const,
      }));
      const { error: assignErr } = await supabase
        .from("driver_assignments")
        .upsert(assignmentRows, { onConflict: "order_id" });
      if (assignErr) {
        console.warn("[assignDeliveries] driver_assignments upsert failed:", assignErr);
      }

      // Update local state
      setOrders((prev) =>
        prev.map((order) => {
          if (selectedOrders.includes(order.id)) {
            return {
              ...order,
              status: "assigned" as const,
              assignedDriver: selectedDriver.name,
              assignedDriverId: selectedDriver.id,
            };
          }
          return order;
        }),
      );

      toast({
        title: "Deliveries Assigned",
        description: `${selectedOrders.length} deliveries assigned to ${selectedDriver.name}`,
      });

      setSelectedOrders([]);
      setSelectedDriver(null);
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error assigning deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to assign deliveries",
        variant: "destructive",
      });
    }
  };

  // Stats
  const stats = useMemo(
    () => ({
      pendingAssignment: orders.filter((o) => o.status === "pending_assignment")
        .length,
      assigned: orders.filter((o) => o.status === "assigned").length,
      inProgress: orders.filter((o) => o.status === "in_progress").length,
      availableDrivers: drivers.filter((d) => d.status === "available").length,
    }),
    [orders, drivers],
  );

  const priorityColors = {
    high: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    medium:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const statusColors = {
    pending_assignment:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    assigned:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
    delivered:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Assign Deliveries
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Allocate deliveries to drivers based on delivery areas
          </p>
        </div>

        {selectedOrders.length > 0 && (
          <Button onClick={() => setShowAssignModal(true)} className="gap-2">
            <Users className="w-4 h-4" />
            Assign {selectedOrders.length} Selected
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-amber-500 mb-2">
            <Clock className="w-4 h-4" />
            <span className="text-xs font-medium">Pending Assignment</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.pendingAssignment}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-medium">Assigned</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{stats.assigned}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-purple-500 mb-2">
            <Truck className="w-4 h-4" />
            <span className="text-xs font-medium">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.inProgress}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-green-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-medium">Available Drivers</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {stats.availableDrivers}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders, customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl bg-secondary border border-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Area Filter */}
        <div className="flex gap-2">
          <select
            value={selectedArea}
            onChange={(e) => setSelectedArea(e.target.value)}
            className="h-10 px-4 rounded-xl bg-secondary border border-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Areas</option>
            {deliveryAreas.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 px-4 rounded-xl bg-secondary border border-transparent text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">All Status</option>
            <option value="pending_assignment">Pending Assignment</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
          </select>
        </div>
      </div>

      {/* Orders by Area */}
      <div className="space-y-6">
        {Object.entries(ordersByArea).map(([area, areaOrders]) => (
          <motion.div
            key={area}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-2xl overflow-hidden"
          >
            {/* Area Header */}
            <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{area}</h3>
                  <p className="text-xs text-muted-foreground">
                    {areaOrders.length} order
                    {areaOrders.length !== 1 ? "s" : ""} •
                    {
                      areaOrders.filter(
                        (o) => o.status === "pending_assignment",
                      ).length
                    }{" "}
                    pending
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Drivers for this area */}
                <div className="flex -space-x-2">
                  {drivers
                    .filter((d) => d.assignedArea === area)
                    .slice(0, 3)
                    .map((driver) => (
                      <img
                        key={driver.id}
                        src={driver.photo}
                        alt={driver.name}
                        className="w-8 h-8 rounded-full border-2 border-card"
                        title={`${driver.name} - ${driver.status}`}
                      />
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => selectAllInArea(area)}
                  className="text-xs"
                >
                  Select All
                </Button>
              </div>
            </div>

            {/* Orders List */}
            <div className="divide-y divide-border">
              {areaOrders.map((order) => {
                const recommendation = getOrderRecommendation(order);
                const recommendedVehicle = getVehicleCapacity(
                  recommendation.recommendedVehicle,
                );

                // Check for mismatch if driver is assigned
                let mismatchCheck = null;
                if (order.assignedDriverId) {
                  const assignedDriver = drivers.find(
                    (d) => d.id === order.assignedDriverId,
                  );
                  if (assignedDriver) {
                    mismatchCheck = checkVehicleMismatch(
                      {
                        totalWeight: order.totalWeight,
                        totalVolume: order.totalVolume,
                        itemCount: order.items,
                        distance: order.distance,
                      },
                      assignedDriver.vehicleType,
                    );
                  }
                }

                return (
                  <div
                    key={order.id}
                    className={`p-4 flex flex-col gap-3 hover:bg-muted/50 transition-colors cursor-pointer ${
                      selectedOrders.includes(order.id) ? "bg-primary/5" : ""
                    }`}
                    onClick={() =>
                      order.status === "pending_assignment" &&
                      toggleOrderSelection(order.id)
                    }
                  >
                    <div className="flex items-center gap-4">
                      {/* Checkbox */}
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors flex-shrink-0 ${
                          selectedOrders.includes(order.id)
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/30"
                        }`}
                      >
                        {selectedOrders.includes(order.id) && (
                          <CheckCircle className="w-3 h-3 text-primary-foreground" />
                        )}
                      </div>

                      {/* Order Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-bold text-foreground">
                            {order.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${priorityColors[order.priority]}`}
                          >
                            {order.priority}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[order.status]}`}
                          >
                            {order.status.replace("_", " ")}
                          </span>
                        </div>
                        <p className="text-sm text-foreground">
                          {order.customer}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {order.address}, {order.suburb}
                        </p>
                      </div>

                      {/* Order Details */}
                      <div className="text-right">
                        <p className="font-bold text-foreground">
                          R
                          {order.total.toLocaleString("en-ZA", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {order.items} items
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {order.orderTime}
                        </p>
                      </div>

                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>

                    {/* AI Recommendation & Load Details */}
                    <div className="flex items-center gap-2 flex-wrap ml-9">
                      {/* Weight & Volume */}
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 px-2 py-1 rounded-lg">
                        <Weight className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {order.totalWeight}kg
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-900/50 px-2 py-1 rounded-lg">
                        <Box className="w-3 h-3 text-slate-600 dark:text-slate-400" />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {order.totalVolume}m³
                        </span>
                      </div>

                      {/* AI Recommended Vehicle */}
                      {recommendedVehicle && (
                        <div className="flex items-center gap-1.5 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                          {getVehicleIcon(recommendation.recommendedVehicle)}
                          <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                            Recommended: {recommendedVehicle.label}
                          </span>
                          <span className="text-[10px] text-blue-600/70 dark:text-blue-400/70">
                            ({recommendation.confidence}%)
                          </span>
                        </div>
                      )}

                      {/* Assigned Driver & Mismatch Warning */}
                      {order.assignedDriver && (
                        <>
                          <div className="flex items-center gap-1.5 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-lg">
                            <Truck className="w-3 h-3 text-green-600" />
                            <span className="text-xs font-medium text-green-700 dark:text-green-400">
                              {order.assignedDriver}
                            </span>
                          </div>

                          {/* Vehicle Mismatch Warning */}
                          {mismatchCheck && mismatchCheck.isMismatch && (
                            <div
                              className={`flex items-center gap-1.5 px-2 py-1 rounded-lg ${
                                mismatchCheck.severity === "critical"
                                  ? "bg-red-100 dark:bg-red-900/30"
                                  : "bg-amber-100 dark:bg-amber-900/30"
                              }`}
                            >
                              <AlertTriangle
                                className={`w-3 h-3 ${
                                  mismatchCheck.severity === "critical"
                                    ? "text-red-600"
                                    : "text-amber-600"
                                }`}
                              />
                              <span
                                className={`text-xs font-medium ${
                                  mismatchCheck.severity === "critical"
                                    ? "text-red-700 dark:text-red-400"
                                    : "text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                {mismatchCheck.message}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        ))}

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <Package className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">
              No orders found
            </p>
            <p className="text-sm text-muted-foreground">
              Try adjusting your filters
            </p>
          </div>
        )}
      </div>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
            onClick={() => setShowAssignModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">
                    Assign Deliveries
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {selectedOrders.length} order
                    {selectedOrders.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Driver Selection */}
              <div className="p-4 max-h-80 overflow-y-auto">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  Select Driver
                </p>
                <div className="space-y-2">
                  {driversForArea.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">
                        No available drivers for this area
                      </p>
                    </div>
                  ) : (
                    driversForArea.map((driver) => {
                      // Check if driver vehicle is suitable for selected orders
                      const selectedOrdersData = orders.filter((o) =>
                        selectedOrders.includes(o.id),
                      );
                      const totalWeight = selectedOrdersData.reduce(
                        (sum, o) => sum + o.totalWeight,
                        0,
                      );
                      const totalVolume = selectedOrdersData.reduce(
                        (sum, o) => sum + o.totalVolume,
                        0,
                      );
                      const maxDistance = Math.max(
                        ...selectedOrdersData.map((o) => o.distance),
                      );

                      const recommendation = calculateRecommendedVehicle({
                        totalWeight,
                        totalVolume,
                        itemCount: selectedOrdersData.reduce(
                          (sum, o) => sum + o.items,
                          0,
                        ),
                        distance: maxDistance,
                      });

                      const mismatch = checkVehicleMismatch(
                        {
                          totalWeight,
                          totalVolume,
                          itemCount: selectedOrdersData.reduce(
                            (sum, o) => sum + o.items,
                            0,
                          ),
                          distance: maxDistance,
                        },
                        driver.vehicleType,
                      );

                      const driverVehicle = getVehicleCapacity(
                        driver.vehicleType,
                      );

                      return (
                        <button
                          key={driver.id}
                          onClick={() => setSelectedDriver(driver)}
                          className={`w-full p-4 rounded-xl border-2 transition-colors flex items-center gap-4 ${
                            selectedDriver?.id === driver.id
                              ? "border-primary bg-primary/5"
                              : mismatch?.severity === "critical"
                                ? "border-red-300 dark:border-red-800 hover:border-red-400"
                                : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img
                            src={driver.photo}
                            alt={driver.name}
                            className="w-12 h-12 rounded-full"
                          />
                          <div className="flex-1 text-left">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-foreground">
                                {driver.name}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                  driver.status === "available"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {driver.status}
                              </span>
                              {/* Driver Vehicle Badge */}
                              {driverVehicle && (
                                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900/50 px-2 py-0.5 rounded-full">
                                  {getVehicleIcon(driver.vehicleType)}
                                  <span className="text-[10px] font-medium text-slate-700 dark:text-slate-300">
                                    {driverVehicle.label}
                                  </span>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Area: {driver.assignedArea}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {driver.currentDeliveries} active •{" "}
                              {driver.completedToday} today • ⭐ {driver.rating}
                            </p>

                            {/* Mismatch Warning */}
                            {mismatch && mismatch.isMismatch && (
                              <div
                                className={`mt-2 flex items-start gap-1.5 p-2 rounded-lg text-xs ${
                                  mismatch.severity === "critical"
                                    ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400"
                                    : "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
                                }`}
                              >
                                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                                <span>{mismatch.message}</span>
                              </div>
                            )}
                          </div>
                          {selectedDriver?.id === driver.id && (
                            <CheckCircle className="w-5 h-5 text-primary flex-shrink-0" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="p-4 border-t border-border flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAssignModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 gap-2"
                  onClick={assignDeliveries}
                  disabled={!selectedDriver}
                >
                  <ArrowRight className="w-4 h-4" />
                  Assign to {selectedDriver?.name || "Driver"}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminAssignDeliveries;
