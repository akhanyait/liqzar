import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MapPin, Phone, Star, Clock, Truck, TrendingUp, Package, Users,
  MessageSquare, BarChart3, Plus, Loader2, CheckCircle2, ShieldAlert, Copy,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import LiveMap from "@/components/LiveMap";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

// ─────────────────────────────────────────────────────────────────────────────
// Types & constants
// ─────────────────────────────────────────────────────────────────────────────

type VehicleType = "scooter" | "car" | "bakkie" | "small_truck" | "medium_truck" | "large_truck";

const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: "scooter", label: "Scooter" },
  { value: "car", label: "Car" },
  { value: "bakkie", label: "Bakkie" },
  { value: "small_truck", label: "Small Truck" },
  { value: "medium_truck", label: "Medium Truck" },
  { value: "large_truck", label: "Large Truck" },
];

interface FleetDriver {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  email: string | null;
  is_verified: boolean;
  created_at: string;
  vehicle: {
    vehicle_type: string;
    make_model: string;
    license_plate: string;
    is_verified: boolean;
  } | null;
  activeAssignments: number;
  lastActivity: string | null;
}

type DriverStatus = "On Delivery" | "Available" | "Pending Verification";

function driverStatus(d: FleetDriver): DriverStatus {
  if (!d.is_verified) return "Pending Verification";
  if (d.activeAssignments > 0) return "On Delivery";
  return "Available";
}

const statusStyles: Record<DriverStatus, string> = {
  "On Delivery": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
  "Available": "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  "Pending Verification": "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};

// ─────────────────────────────────────────────────────────────────────────────
// Hooks
// ─────────────────────────────────────────────────────────────────────────────

function useFleetDrivers() {
  return useQuery<FleetDriver[]>({
    queryKey: ["admin-fleet-drivers"],
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("driver_profiles")
        .select(`
          id, user_id, full_name, phone, email, is_verified, created_at,
          driver_vehicles (vehicle_type, make_model, license_plate, is_verified)
        `)
        .order("created_at", { ascending: false });

      if (error) throw new Error(`${error.message}${error.details ? ` — ${error.details}` : ""}`);
      const rows = profiles ?? [];

      // Active assignments per driver (auth user id → assignment count in live statuses).
      const userIds = rows.map((r) => r.user_id);
      const activeMap = new Map<string, number>();
      const lastMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: assigns } = await supabase
          .from("driver_assignments")
          .select("driver_id, status, updated_at")
          .in("driver_id", userIds);
        for (const a of assigns ?? []) {
          if (["pending", "accepted", "picked_up", "in_transit"].includes(a.status)) {
            activeMap.set(a.driver_id, (activeMap.get(a.driver_id) ?? 0) + 1);
          }
          const prev = lastMap.get(a.driver_id);
          if (!prev || new Date(a.updated_at) > new Date(prev)) {
            lastMap.set(a.driver_id, a.updated_at);
          }
        }
      }

      return rows.map((r): FleetDriver => {
        const veh = Array.isArray(r.driver_vehicles)
          ? (r.driver_vehicles[0] ?? null)
          : (r.driver_vehicles ?? null);
        return {
          id: r.id,
          user_id: r.user_id,
          full_name: r.full_name,
          phone: r.phone,
          email: r.email ?? null,
          is_verified: !!r.is_verified,
          created_at: r.created_at,
          vehicle: veh
            ? {
                vehicle_type: veh.vehicle_type,
                make_model: veh.make_model,
                license_plate: veh.license_plate,
                is_verified: !!veh.is_verified,
              }
            : null,
          activeAssignments: activeMap.get(r.user_id) ?? 0,
          lastActivity: lastMap.get(r.user_id) ?? null,
        };
      });
    },
  });
}

interface CreateDriverInput {
  email: string;
  full_name: string;
  phone: string;
  id_number: string;
  vehicle: { vehicle_type: VehicleType; make_model: string; license_plate: string };
  password?: string;
}

interface CreateDriverResult {
  user_id: string;
  email: string;
  temp_password: string;
  driver_profile_id: string;
  is_verified: boolean;
}

function useCreateDriver() {
  const qc = useQueryClient();
  return useMutation<CreateDriverResult, Error, CreateDriverInput>({
    mutationFn: async (input) => {
      const { data, error } = await supabase.functions.invoke<CreateDriverResult>(
        "admin-create-driver",
        { body: input },
      );
      if (error) {
        let msg = error.message || "Failed to create driver";
        // Surface structured EF errors when present.
        const ctx = (error as { context?: { body?: string } }).context;
        if (ctx?.body) {
          try { msg = JSON.parse(ctx.body).error ?? msg; } catch { /* ignore */ }
        }
        throw new Error(msg);
      }
      if (!data) throw new Error("Edge Function returned no data");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-fleet-drivers"] });
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Static sections (tracking / pipeline / analytics / feedback still illustrative)
// ─────────────────────────────────────────────────────────────────────────────

const heatPoints = [
  { lat: -26.1076, lng: 28.0567, intensity: 0.9 },
  { lat: -26.1455, lng: 28.0404, intensity: 0.7 },
  { lat: -26.2041, lng: 28.0473, intensity: 0.5 },
  { lat: -26.0875, lng: 28.0900, intensity: 0.85 },
  { lat: -26.1300, lng: 28.0100, intensity: 0.4 },
  { lat: -26.0600, lng: 28.0700, intensity: 0.6 },
  { lat: -26.1800, lng: 28.0600, intensity: 0.3 },
];

const weeklyPerf = [
  { day: "Mon", deliveries: 12 },
  { day: "Tue", deliveries: 9 },
  { day: "Wed", deliveries: 14 },
  { day: "Thu", deliveries: 11 },
  { day: "Fri", deliveries: 16 },
  { day: "Sat", deliveries: 18 },
  { day: "Sun", deliveries: 6 },
];

const PIE_COLORS = ["#D4AF37", "#B8962E", "#8C6B1F", "#E8CC6A"];

// ─────────────────────────────────────────────────────────────────────────────
// Add Driver Dialog
// ─────────────────────────────────────────────────────────────────────────────

function AddDriverDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const createDriver = useCreateDriver();
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    phone: "",
    id_number: "",
    vehicle_type: "car" as VehicleType,
    make_model: "",
    license_plate: "",
  });
  const [result, setResult] = useState<CreateDriverResult | null>(null);

  const reset = () => {
    setForm({ email: "", full_name: "", phone: "", id_number: "", vehicle_type: "car", make_model: "", license_plate: "" });
    setResult(null);
    createDriver.reset();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await createDriver.mutateAsync({
        email: form.email.trim().toLowerCase(),
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        id_number: form.id_number.trim(),
        vehicle: {
          vehicle_type: form.vehicle_type,
          make_model: form.make_model.trim(),
          license_plate: form.license_plate.trim().toUpperCase(),
        },
      });
      setResult(res);
      toast({
        title: "Driver created",
        description: `${form.full_name} can now sign in with the temporary password.`,
      });
    } catch (err) {
      toast({
        title: "Could not create driver",
        description: err instanceof Error ? err.message : "Unexpected error",
        variant: "destructive",
      });
    }
  };

  const copyCredentials = async () => {
    if (!result) return;
    const text = `Email: ${result.email}\nTemporary password: ${result.temp_password}`;
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Credentials copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", description: "Select the text manually.", variant: "destructive" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        {result ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
                Driver account created
              </DialogTitle>
              <DialogDescription>
                Share these credentials with the driver. The password is only shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Email</p>
                <p className="font-mono text-sm text-foreground break-all">{result.email}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Temporary password</p>
                <p className="font-mono text-sm text-foreground break-all">{result.temp_password}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Driver is marked as <span className="font-semibold">{result.is_verified ? "verified" : "pending verification"}</span>.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={copyCredentials} className="gap-2">
                <Copy className="w-4 h-4" /> Copy credentials
              </Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Add new driver</DialogTitle>
              <DialogDescription>
                Creates the auth account, driver profile, and vehicle record. A temporary
                password is generated and shown once.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name" required autoComplete="off"
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="Mandla Nkosi"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone" required type="tel" autoComplete="off"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+27 82 000 0000"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email" required type="email" autoComplete="off"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="driver@liqzar.co.za"
                />
              </div>
              <div>
                <Label htmlFor="id_number">ID number</Label>
                <Input
                  id="id_number" required autoComplete="off"
                  value={form.id_number}
                  onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                  placeholder="13 digit RSA ID"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Vehicle type</Label>
                  <Select
                    value={form.vehicle_type}
                    onValueChange={(v) => setForm({ ...form, vehicle_type: v as VehicleType })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((v) => (
                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="license_plate">Licence plate</Label>
                  <Input
                    id="license_plate" required autoComplete="off"
                    value={form.license_plate}
                    onChange={(e) => setForm({ ...form, license_plate: e.target.value })}
                    placeholder="CA 123 456"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="make_model">Make &amp; model</Label>
                <Input
                  id="make_model" required autoComplete="off"
                  value={form.make_model}
                  onChange={(e) => setForm({ ...form, make_model: e.target.value })}
                  placeholder="Toyota Hilux 2.4 GD"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { reset(); onOpenChange(false); }}>
                Cancel
              </Button>
              <Button type="submit" disabled={createDriver.isPending}>
                {createDriver.isPending ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                ) : (
                  <><Plus className="w-4 h-4 mr-2" /> Create driver</>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const AdminDrivers = () => {
  const [activeTab, setActiveTab] = useState("fleet");
  const [addOpen, setAddOpen] = useState(false);
  const { data: drivers = [], isLoading, error, refetch } = useFleetDrivers();

  const activeCount = drivers.filter((d) => d.is_verified).length;
  const inTransit = drivers.reduce((s, d) => s + d.activeAssignments, 0);
  const pending = drivers.filter((d) => !d.is_verified).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Drivers &amp; Logistics</h2>
          <p className="text-sm text-muted-foreground">Fleet management, live tracking, and performance intelligence</p>
        </div>
        <Button onClick={() => setAddOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Driver
        </Button>
      </div>

      <AddDriverDialog open={addOpen} onOpenChange={setAddOpen} />

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Drivers", value: drivers.length, icon: Users, color: "text-primary" },
          { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-green-600" },
          { label: "In Transit", value: inTransit, icon: Truck, color: "text-amber-500" },
          { label: "Pending Verify", value: pending, icon: ShieldAlert, color: "text-amber-600" },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4">
            <s.icon className={`w-4 h-4 ${s.color} mb-1`} />
            <p className="text-lg font-bold text-foreground">
              {isLoading ? <Skeleton className="h-5 w-10" /> : s.value}
            </p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full grid grid-cols-5">
          <TabsTrigger value="fleet" className="text-xs gap-1"><Users className="w-3 h-3" /> Fleet</TabsTrigger>
          <TabsTrigger value="tracking" className="text-xs gap-1"><MapPin className="w-3 h-3" /> Tracking</TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs gap-1"><Package className="w-3 h-3" /> Pipeline</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><BarChart3 className="w-3 h-3" /> Analytics</TabsTrigger>
          <TabsTrigger value="feedback" className="text-xs gap-1"><MessageSquare className="w-3 h-3" /> Feedback</TabsTrigger>
        </TabsList>

        {/* Fleet Tab — REAL DATA */}
        <TabsContent value="fleet" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-[140px] rounded-2xl" />
              ))}
            </div>
          ) : error ? (
            <div className="bg-card border border-destructive/40 rounded-2xl p-6 text-center">
              <ShieldAlert className="w-6 h-6 text-destructive mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">Couldn't load drivers</p>
              <p className="text-xs text-muted-foreground mb-3">
                {error instanceof Error ? error.message : "Something went wrong"}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
            </div>
          ) : drivers.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <Truck className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">No drivers yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Add your first driver — they'll appear here immediately.
              </p>
              <Button onClick={() => setAddOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Add Driver
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {drivers.map((d) => {
                const status = driverStatus(d);
                const initials = d.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("");
                return (
                  <div key={d.id} className="bg-card border border-border rounded-2xl p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                          <span className="text-sm font-bold text-foreground">{initials || "?"}</span>
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-foreground truncate">{d.full_name}</h3>
                          <p className="text-xs text-muted-foreground truncate">
                            {d.vehicle ? `${d.vehicle.make_model} • ${d.vehicle.license_plate}` : "No vehicle recorded"}
                          </p>
                        </div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold whitespace-nowrap ${statusStyles[status]}`}>
                        {status}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {d.phone}
                      </span>
                      {d.vehicle?.vehicle_type && (
                        <span className="flex items-center gap-1">
                          <Truck className="w-3 h-3" /> {d.vehicle.vehicle_type.replace("_", " ")}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {d.activeAssignments} active
                      </span>
                      {d.lastActivity && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3" /> {new Date(d.lastActivity).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {!d.is_verified && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
                        <ShieldAlert className="w-3 h-3" />
                        Awaiting document verification
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tracking Tab */}
        <TabsContent value="tracking" className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Live Driver Locations</h3>
              <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold animate-pulse">● LIVE</span>
            </div>
            <LiveMap markers={[]} height="350px" />
            <p className="text-[10px] text-muted-foreground mt-1">Live driver pins appear when drivers are on active deliveries.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-foreground">Delivery Heatmap</h3>
              <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded font-bold">Density</span>
            </div>
            <LiveMap heatPoints={heatPoints} height="300px" zoom={11} />
            <p className="text-[10px] text-muted-foreground mt-1">Circle size &amp; color = delivery density. Red = high demand, green = low.</p>
          </div>
        </TabsContent>

        {/* Pipeline Tab */}
        <TabsContent value="pipeline" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <Package className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Live pipeline coming soon</p>
            <p className="text-xs text-muted-foreground">
              Real-time order status flow across picking → packed → dispatched → delivered.
            </p>
          </div>
        </TabsContent>

        {/* Analytics Tab */}
        <TabsContent value="analytics" className="mt-4 space-y-4">
          <div className="bg-card border border-border rounded-2xl p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Weekly Deliveries (all drivers)</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={weeklyPerf}>
                <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 11, border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="deliveries" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-[10px] text-muted-foreground mt-2">Illustrative — wire to order_history once more deliveries exist.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Verification Status</h3>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Verified", value: activeCount },
                      { name: "Pending", value: pending },
                    ]}
                    cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {[0, 1].map((i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-card border border-border rounded-2xl p-4">
              <h3 className="text-sm font-bold text-foreground mb-3">Fleet Activity</h3>
              <div className="space-y-3">
                {drivers.slice(0, 6).map((d) => (
                  <div key={d.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium truncate">{d.full_name}</span>
                      <span className="text-muted-foreground">{d.activeAssignments} active</span>
                    </div>
                    <Progress value={Math.min(100, d.activeAssignments * 25)} className="h-1.5" />
                  </div>
                ))}
                {drivers.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No drivers yet.</p>
                )}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Feedback Tab */}
        <TabsContent value="feedback" className="mt-4">
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-semibold text-foreground">Customer feedback coming soon</p>
            <p className="text-xs text-muted-foreground">
              Delivery ratings &amp; comments will appear here once customers start reviewing orders.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDrivers;
