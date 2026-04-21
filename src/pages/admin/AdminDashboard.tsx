import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ShoppingCart,
  Users,
  Package,
  TrendingUp,
  DollarSign,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  useAdminDashboard,
  type AdminDashboardPeriod,
} from "@/hooks/useAdminDashboard";

// ─────────────────────────────────────────────────────────────────────────────
// Presentation helpers
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CHIP: Record<string, string> = {
  pending: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400",
  awaiting_payment: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  payment_failed: "bg-red-500/15 text-red-700 dark:text-red-400",
  confirmed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  preparing: "bg-purple-500/15 text-purple-700 dark:text-purple-400",
  ready: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
  driver_assigned: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  picked_up: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  en_route: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  cancelled: "bg-red-500/15 text-red-700 dark:text-red-400",
  refunded: "bg-neutral-500/15 text-neutral-700 dark:text-neutral-400",
  delivery_failed: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
  rescheduled: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
  return_to_store: "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400",
  return_received: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
};

const formatZar = (n: number) =>
  `R ${n.toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;

const prettyStatus = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

const timeAgo = (iso: string) => {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton + error primitives — premium loading state
// ─────────────────────────────────────────────────────────────────────────────

const SkeletonCard = ({ className = "" }: { className?: string }) => (
  <div
    className={`skeleton-shimmer rounded-2xl border border-border ${className}`}
    aria-hidden="true"
  />
);

const ErrorPanel = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <div
    className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-3 text-center"
    role="alert"
  >
    <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center">
      <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
    </div>
    <div>
      <h3 className="font-bold text-foreground">Couldn't load dashboard</h3>
      <p className="text-sm text-muted-foreground mt-1">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition min-h-[44px]"
    >
      <RefreshCw className="w-4 h-4" /> Retry
    </button>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

const AdminDashboard = () => {
  const [period, setPeriod] = useState<AdminDashboardPeriod>("week");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const { data, isLoading, isError, error, refetch } =
    useAdminDashboard(period);
  const queryClient = useQueryClient();

  // Supabase realtime: any orders INSERT/UPDATE/DELETE invalidates the
  // dashboard query so KPIs, charts and recent-orders list refresh without a
  // manual reload. Channel is scoped per-period so switching tabs reconnects.
  useEffect(() => {
    const channel = supabase
      .channel("admin-dashboard-orders")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["admin-dashboard"] });
        },
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const kpiCards = data
    ? [
        {
          label:
            period === "today"
              ? "Today's Revenue"
              : period === "week"
                ? "Revenue (7d)"
                : "Revenue (30d)",
          value: formatZar(data.kpi.revenue),
          change:
            data.kpi.revenueChangePct === null
              ? "—"
              : `${data.kpi.revenueChangePct >= 0 ? "+" : ""}${data.kpi.revenueChangePct.toFixed(1)}%`,
          up: (data.kpi.revenueChangePct ?? 0) >= 0,
          icon: DollarSign,
        },
        {
          label: "Orders",
          value: data.kpi.orderCount.toLocaleString(),
          change:
            data.kpi.orderCountChangePct === null
              ? "—"
              : `${data.kpi.orderCountChangePct >= 0 ? "+" : ""}${data.kpi.orderCountChangePct.toFixed(1)}%`,
          up: (data.kpi.orderCountChangePct ?? 0) >= 0,
          icon: ShoppingCart,
        },
        {
          label: "Active Customers (30d)",
          value: data.kpi.activeCustomers.toLocaleString(),
          change: "live",
          up: true,
          icon: Users,
        },
        {
          label: "Products Listed",
          value: data.kpi.productsListed.toLocaleString(),
          change: "active",
          up: true,
          icon: Package,
        },
        {
          label: "Avg Order Value",
          value: formatZar(data.kpi.avgOrderValue),
          change: "—",
          up: true,
          icon: TrendingUp,
        },
        {
          label: "In-flight Deliveries",
          value: data.kpi.deliveriesInFlight.toLocaleString(),
          change: "now",
          up: true,
          icon: Truck,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dashboard</h2>
          <p className="text-sm text-muted-foreground">
            Overview of your business performance
          </p>
        </div>
        <div
          className="flex gap-1 bg-secondary rounded-xl p-1"
          role="tablist"
          aria-label="Time period"
        >
          {(["today", "week", "month"] as AdminDashboardPeriod[]).map((p) => (
            <button
              key={p}
              role="tab"
              aria-selected={period === p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                period === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isError && (
        <ErrorPanel
          message={
            error instanceof Error ? error.message : "Something went wrong"
          }
          onRetry={() => refetch()}
        />
      )}

      {/* KPI Cards */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        role="region"
        aria-label="Key performance indicators"
      >
        {isLoading &&
          Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} className="h-32" />
          ))}
        {!isLoading &&
          kpiCards.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card border border-border rounded-2xl p-5 premium-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-foreground" />
                </div>
                <span
                  className={`flex items-center gap-0.5 text-xs font-semibold ${stat.up ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}
                  aria-label={`Change: ${stat.change}`}
                >
                  {stat.up ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-5 premium-shadow">
          <h3 className="font-bold text-foreground mb-4">Revenue Trend</h3>
          {isLoading ? (
            <div className="skeleton-shimmer h-[260px] rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data?.revenueTrend ?? []}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#D4AF37" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(128,128,128,0.15)"
                />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 11 }}
                  stroke="rgba(128,128,128,0.5)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="rgba(128,128,128,0.5)"
                  tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(v: number) => [
                    `R ${v.toLocaleString("en-ZA")}`,
                    "Revenue",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#D4AF37"
                  fill="url(#revenueGrad)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 premium-shadow">
          <h3 className="font-bold text-foreground mb-4">Sales by Category</h3>
          {isLoading ? (
            <div className="skeleton-shimmer h-[180px] rounded-xl" />
          ) : (data?.categoryBreakdown.length ?? 0) === 0 ? (
            <div className="h-[180px] flex items-center justify-center text-sm text-muted-foreground">
              No sales in this window yet.
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data?.categoryBreakdown ?? []}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    dataKey="value"
                    paddingAngle={3}
                  >
                    {(data?.categoryBreakdown ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`${v}%`, "Share"]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {(data?.categoryBreakdown ?? []).map((c) => (
                  <span
                    key={c.name}
                    className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: c.color }}
                    />
                    {c.name} {c.value}%
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Second Row: Hourly Orders + Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 premium-shadow">
          <h3 className="font-bold text-foreground mb-4">
            Order Volume (Today)
          </h3>
          {isLoading ? (
            <div className="skeleton-shimmer h-[200px] rounded-xl" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.hourlyOrders ?? []}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(128,128,128,0.15)"
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 10 }}
                  stroke="rgba(128,128,128,0.5)"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  stroke="rgba(128,128,128,0.5)"
                />
                <Tooltip />
                <Bar dataKey="orders" fill="#D4AF37" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5 premium-shadow">
          <h3 className="font-bold text-foreground mb-4">
            Top Selling Products
          </h3>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div
                  key={i}
                  className="skeleton-shimmer h-8 rounded-lg"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : (data?.topProducts.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              No product sales yet in this window.
            </p>
          ) : (
            <div className="space-y-3">
              {data?.topProducts.map((p, i) => (
                <div key={p.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {p.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.sales} units sold
                    </p>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {formatZar(p.revenue)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-2xl premium-shadow">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-foreground">Recent Orders</h3>
          <span
            className={`text-xs flex items-center gap-1.5 font-semibold ${
              realtimeConnected
                ? "text-green-600 dark:text-green-400"
                : "text-muted-foreground"
            }`}
            aria-live="polite"
          >
            <span className="relative flex h-2 w-2">
              {realtimeConnected && (
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-500 opacity-75 animate-ping" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  realtimeConnected ? "bg-green-500" : "bg-neutral-400"
                }`}
              />
            </span>
            {realtimeConnected ? "Live" : "Connecting…"}
          </span>
        </div>
        <div className="divide-y divide-border">
          {isLoading &&
            Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="px-5 py-4 skeleton-shimmer h-14"
                aria-hidden="true"
              />
            ))}
          {!isLoading && (data?.recentOrders.length ?? 0) === 0 && (
            <p className="p-5 text-sm text-muted-foreground">
              No orders yet — check again soon.
            </p>
          )}
          {!isLoading &&
            data?.recentOrders.map((order) => (
              <div
                key={order.id}
                className="px-5 py-4 flex items-center gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">
                      {order.order_number}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_CHIP[order.status] ?? "bg-neutral-500/15 text-neutral-700 dark:text-neutral-400"}`}
                    >
                      {prettyStatus(order.status)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {order.customer} • {timeAgo(order.created_at)}
                  </p>
                </div>
                <span className="font-bold text-sm text-foreground">
                  {formatZar(order.total)}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
