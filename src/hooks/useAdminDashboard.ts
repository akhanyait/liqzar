import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Types returned to the dashboard. Narrow shapes — consumers don't need rows.
// ─────────────────────────────────────────────────────────────────────────────

export type AdminDashboardPeriod = "today" | "week" | "month";

export interface AdminDashboardKpi {
  revenue: number;
  orderCount: number;
  activeCustomers: number;
  productsListed: number;
  avgOrderValue: number;
  deliveriesInFlight: number;
  revenueChangePct: number | null;
  orderCountChangePct: number | null;
}

export interface RevenuePoint {
  day: string;
  revenue: number;
  orders: number;
}

export interface CategorySlice {
  name: string;
  value: number;
  color: string;
}

export interface HourlyPoint {
  hour: string;
  orders: number;
}

export interface TopProduct {
  name: string;
  sales: number;
  revenue: number;
}

export interface RecentOrder {
  id: string;
  order_number: string;
  customer: string;
  total: number;
  status: string;
  created_at: string;
}

export interface AdminDashboardData {
  kpi: AdminDashboardKpi;
  revenueTrend: RevenuePoint[];
  categoryBreakdown: CategorySlice[];
  hourlyOrders: HourlyPoint[];
  topProducts: TopProduct[];
  recentOrders: RecentOrder[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Palette — keep in sync with AdminDashboard visual treatment (gold-ward).
// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_PALETTE = [
  "#D4AF37", // gold
  "#B8962E",
  "#8C6B1F",
  "#E8CC6A",
  "#6B5018",
  "#A88434",
  "#C9A644",
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function windowBounds(period: AdminDashboardPeriod): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now);
  const from = new Date(now);
  if (period === "today") {
    from.setHours(0, 0, 0, 0);
  } else if (period === "week") {
    from.setDate(now.getDate() - 6);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(now.getDate() - 29);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

function percentChange(current: number, prior: number): number | null {
  if (prior === 0) return current === 0 ? 0 : null;
  return ((current - prior) / prior) * 100;
}

function dayLabel(d: Date): string {
  return d.toLocaleDateString("en-ZA", { weekday: "short" });
}

function hourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main hook
// ─────────────────────────────────────────────────────────────────────────────

export function useAdminDashboard(period: AdminDashboardPeriod = "week") {
  return useQuery<AdminDashboardData>({
    queryKey: ["admin-dashboard", period],
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { from, to } = windowBounds(period);

      // Prior window (same length, immediately preceding) for % comparisons.
      const priorTo = new Date(from);
      const priorFrom = new Date(from);
      const days = Math.max(
        1,
        Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)),
      );
      priorFrom.setDate(priorFrom.getDate() - days);

      // Parallel fetch — 6 independent queries.
      const [
        currentOrdersRes,
        priorOrdersRes,
        activeCustomersRes,
        productsCountRes,
        deliveriesInFlightRes,
        recentOrdersRes,
      ] = await Promise.all([
        supabase
          .from("orders")
          .select("id, order_number, status, total, user_id, created_at")
          .gte("created_at", from.toISOString())
          .lte("created_at", to.toISOString())
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("orders")
          .select("total, status, created_at")
          .gte("created_at", priorFrom.toISOString())
          .lt("created_at", from.toISOString()),
        supabase
          .from("orders")
          .select("user_id", { count: "exact" })
          .gte(
            "created_at",
            new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          ),
        supabase
          .from("products")
          .select("id", { count: "exact", head: true })
          .eq("in_stock", true),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", [
            "driver_assigned",
            "picked_up",
            "en_route",
          ]),
        supabase
          .from("orders")
          .select(
            "id, order_number, status, total, user_id, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      // Normalise Supabase error objects (plain { message, details, code }) into
      // real Error instances so the UI's `error instanceof Error` branch picks
      // up the real message instead of the generic "Something went wrong".
      const toErr = (e: { message?: string; details?: string; code?: string }) =>
        new Error(
          `${e.message ?? "Query failed"}${e.details ? ` — ${e.details}` : ""}${e.code ? ` (${e.code})` : ""}`,
        );
      if (currentOrdersRes.error) throw toErr(currentOrdersRes.error);
      if (productsCountRes.error) throw toErr(productsCountRes.error);
      if (deliveriesInFlightRes.error) throw toErr(deliveriesInFlightRes.error);
      if (recentOrdersRes.error) throw toErr(recentOrdersRes.error);

      const currentOrders = currentOrdersRes.data ?? [];
      const priorOrders = priorOrdersRes.data ?? [];

      // Revenue — only realised (delivered/completed) orders count.
      const revenueStatuses = new Set(["delivered", "completed"]);
      const currentRevenue = currentOrders
        .filter((o) => revenueStatuses.has(o.status))
        .reduce((sum, o) => sum + Number(o.total || 0), 0);
      const priorRevenue = priorOrders
        .filter((o) => revenueStatuses.has(o.status))
        .reduce((sum, o) => sum + Number(o.total || 0), 0);
      const currentCount = currentOrders.length;
      const priorCount = priorOrders.length;

      const avgOrderValue =
        currentCount > 0 ? currentRevenue / currentCount : 0;

      // Active customers — distinct user_id in last 30d.
      const activeCustomersSet = new Set(
        (activeCustomersRes.data ?? [])
          .map((r: { user_id: string }) => r.user_id)
          .filter(Boolean),
      );

      const kpi: AdminDashboardKpi = {
        revenue: currentRevenue,
        orderCount: currentCount,
        activeCustomers: activeCustomersSet.size,
        productsListed: productsCountRes.count ?? 0,
        avgOrderValue,
        deliveriesInFlight: deliveriesInFlightRes.count ?? 0,
        revenueChangePct: percentChange(currentRevenue, priorRevenue),
        orderCountChangePct: percentChange(currentCount, priorCount),
      };

      // Revenue trend — group by day in current window.
      const daysArr: RevenuePoint[] = [];
      const dayKey = (d: Date) => d.toISOString().slice(0, 10);
      const byDay = new Map<string, { revenue: number; orders: number }>();
      for (
        let d = new Date(from);
        d <= to;
        d.setDate(d.getDate() + 1)
      ) {
        byDay.set(dayKey(d), { revenue: 0, orders: 0 });
      }
      for (const o of currentOrders) {
        const k = dayKey(new Date(o.created_at));
        const bucket = byDay.get(k);
        if (!bucket) continue;
        bucket.orders += 1;
        if (revenueStatuses.has(o.status)) {
          bucket.revenue += Number(o.total || 0);
        }
      }
      for (const [k, v] of byDay.entries()) {
        daysArr.push({
          day: dayLabel(new Date(k)),
          revenue: v.revenue,
          orders: v.orders,
        });
      }

      // Hourly orders — today only.
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const hourlyBuckets = new Map<number, number>();
      for (let h = 0; h < 24; h++) hourlyBuckets.set(h, 0);
      for (const o of currentOrders) {
        const d = new Date(o.created_at);
        if (d >= todayStart) {
          const h = d.getHours();
          hourlyBuckets.set(h, (hourlyBuckets.get(h) ?? 0) + 1);
        }
      }
      const hourlyOrders: HourlyPoint[] = Array.from(hourlyBuckets.entries())
        .filter(([h]) => h >= 8 && h <= 21) // 8am to 9pm window (delivery hours)
        .map(([h, orders]) => ({ hour: hourLabel(h), orders }));

      // Top products + category breakdown — one items+join query.
      const orderIds = currentOrders.map((o) => o.id);
      let topProducts: TopProduct[] = [];
      let categoryBreakdown: CategorySlice[] = [];
      if (orderIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("order_items")
          .select(
            "quantity, subtotal, product_name, product_id, products:products(category)",
          )
          .in("order_id", orderIds);

        const productAgg = new Map<
          string,
          { name: string; sales: number; revenue: number }
        >();
        const categoryAgg = new Map<string, number>();
        for (const item of itemsData ?? []) {
          const name = item.product_name ?? "Unknown";
          const prev = productAgg.get(name) ?? {
            name,
            sales: 0,
            revenue: 0,
          };
          prev.sales += Number(item.quantity || 0);
          prev.revenue += Number(item.subtotal || 0);
          productAgg.set(name, prev);

          const cat =
            (item as { products?: { category?: string } }).products
              ?.category || "Other";
          categoryAgg.set(cat, (categoryAgg.get(cat) ?? 0) + Number(item.subtotal || 0));
        }

        topProducts = Array.from(productAgg.values())
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 5);

        const totalCatRevenue = Array.from(categoryAgg.values()).reduce(
          (s, v) => s + v,
          0,
        );
        categoryBreakdown = Array.from(categoryAgg.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([name, revenue], i) => ({
            name,
            value:
              totalCatRevenue > 0
                ? Math.round((revenue / totalCatRevenue) * 100)
                : 0,
            color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length],
          }));
      }

      // Recent orders — enrich with customer full_name.
      const recentBase = recentOrdersRes.data ?? [];
      const customerIds = Array.from(
        new Set(recentBase.map((o) => o.user_id).filter(Boolean)),
      );
      const customerNames = new Map<string, string>();
      if (customerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", customerIds);
        for (const p of profiles ?? []) {
          customerNames.set(
            p.id as string,
            (p.full_name as string) || "Customer",
          );
        }
      }
      const recentOrders: RecentOrder[] = recentBase.map((o) => ({
        id: o.id,
        order_number: o.order_number ?? `LQ-${String(o.id).slice(0, 6)}`,
        customer: customerNames.get(o.user_id) ?? "Customer",
        total: Number(o.total || 0),
        status: o.status,
        created_at: o.created_at,
      }));

      return {
        kpi,
        revenueTrend: daysArr,
        categoryBreakdown,
        hourlyOrders,
        topProducts,
        recentOrders,
      };
    },
  });
}
