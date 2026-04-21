import { useState, useRef, useMemo } from "react";
import {
  Search,
  Upload,
  RefreshCw,
  Package,
  AlertTriangle,
  FileSpreadsheet,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Eye,
  EyeOff,
  Star,
  Zap,
  ShoppingCart,
  Globe,
  Wine,
  CheckCircle2,
  XCircle,
  Layers,
  ArrowDown,
  ArrowUp,
  Gauge,
  Tag,
  PackageMinus,
  PackagePlus,
  Timer,
  Activity,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { getProductImageUrl, type Product } from "@/data/products";
import { hasValidImage } from "@/lib/product-utils";
import {
  analyzeProduct,
  buildInventorySnapshot,
  getPriceTierInfo,
  PRICE_TIERS,
  EXPECTED_WEEKLY_VELOCITY,
  type StockIntelligence,
  type MovementStatus,
  type PriceTier,
} from "@/lib/stock-intelligence";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from "recharts";

// ═══════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════

const KpiCard = ({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
  >
    <div
      className={`w-10 h-10 ${color} rounded-xl flex items-center justify-center`}
    >
      <Icon className="w-5 h-5" />
    </div>
    <div>
      <p className="text-lg font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </div>
  </motion.div>
);

const ProgressPanel = ({
  icon: Icon,
  label,
  progress,
  status,
}: {
  icon: any;
  label: string;
  progress: number;
  status: string;
}) => (
  <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="w-5 h-5 text-muted-foreground" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </div>
    <Progress value={progress} className="h-2" />
    <p className="text-xs text-muted-foreground">{status}</p>
  </div>
);

const HealthBar = ({ label, value }: { label: string; value: number }) => (
  <div>
    <div className="flex items-center justify-between mb-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={`text-xs font-bold ${value >= 80 ? "text-green-600" : value >= 50 ? "text-amber-600" : "text-red-600"}`}
      >
        {value}%
      </span>
    </div>
    <Progress value={value} className="h-1.5" />
  </div>
);

const MovementBadge = ({ status }: { status: MovementStatus }) => {
  const config: Record<
    MovementStatus,
    { label: string; className: string; icon: any }
  > = {
    fast_mover: {
      label: "Fast",
      className: "border-green-500/40 text-green-700 bg-green-50",
      icon: TrendingUp,
    },
    normal: {
      label: "Normal",
      className: "border-blue-500/40 text-blue-700 bg-blue-50",
      icon: Activity,
    },
    slow_mover: {
      label: "Slow",
      className: "border-amber-500/40 text-amber-700 bg-amber-50",
      icon: TrendingDown,
    },
    dead_stock: {
      label: "Dead",
      className: "border-red-500/40 text-red-700 bg-red-50",
      icon: XCircle,
    },
    no_data: {
      label: "N/A",
      className: "border-border text-muted-foreground",
      icon: Timer,
    },
  };
  const c = config[status];
  const IconComp = c.icon;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] gap-1 px-1.5 py-0.5 ${c.className}`}
    >
      <IconComp className="w-3 h-3" /> {c.label}
    </Badge>
  );
};

const ABCBadge = ({ cls }: { cls: "A" | "B" | "C" }) => {
  const colors = {
    A: "bg-green-100 text-green-800",
    B: "bg-blue-100 text-blue-800",
    C: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors[cls]}`}
    >
      {cls}
    </span>
  );
};

const StockLevelBar = ({
  qty,
  reorder,
  max,
}: {
  qty: number;
  reorder: number;
  max: number;
}) => {
  const pct = max > 0 ? Math.min(100, (qty / max) * 100) : 0;
  const reorderPct = max > 0 ? Math.min(100, (reorder / max) * 100) : 0;
  const color =
    qty <= 0
      ? "bg-red-500"
      : qty <= reorder
        ? "bg-amber-500"
        : qty > max
          ? "bg-purple-500"
          : "bg-green-500";
  return (
    <div className="w-full">
      <div className="relative h-2 bg-secondary rounded-full overflow-visible">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${color} transition-all`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
        {reorderPct > 0 && (
          <div
            className="absolute top-[-2px] bottom-[-2px] w-0.5 bg-amber-500/80"
            style={{ left: `${reorderPct}%` }}
            title={`Reorder point: ${reorder}`}
          />
        )}
      </div>
      <div className="flex justify-between mt-0.5">
        <span className="text-[9px] text-muted-foreground">{qty} units</span>
        <span className="text-[9px] text-muted-foreground">max {max}</span>
      </div>
    </div>
  );
};

const InsightCard = ({
  icon: Icon,
  title,
  description,
  variant = "default",
}: {
  icon: any;
  title: string;
  description: string;
  variant?: "default" | "warning" | "success" | "danger";
}) => {
  const colors = {
    default: "bg-blue-50 text-blue-700 border-blue-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    success: "bg-green-50 text-green-700 border-green-200",
    danger: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div
      className={`rounded-xl border p-3 flex items-start gap-3 ${colors[variant]}`}
    >
      <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs opacity-80">{description}</p>
      </div>
    </div>
  );
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "#f59e0b",
  "#10b981",
  "#6366f1",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#06b6d4",
  "#ef4444",
  "#84cc16",
  "#a855f7",
  "#22d3ee",
  "#e11d48",
];

// ═══════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════

type ViewTab = "overview" | "clearance" | "thresholds";
type StockFilterType =
  | "all"
  | "in_stock"
  | "out_of_stock"
  | "understocked"
  | "overstocked"
  | "clearance";

const AdminInventory = () => {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [stockFilter, setStockFilter] = useState<StockFilterType>("all");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: products, isLoading } = useProducts();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ─── Computed analytics ──────────────────────────────────────────
  const productIntel = useMemo(() => {
    if (!products) return [];
    return products.map((p) => ({ product: p, intel: analyzeProduct(p) }));
  }, [products]);

  const snapshot = useMemo(() => {
    if (!products || products.length === 0) return null;
    return buildInventorySnapshot(products);
  }, [products]);

  const catalogueHealth = useMemo(() => {
    if (!products || products.length === 0) return null;
    const total = products.length;
    const withImages = products.filter((p) =>
      hasValidImage(p.image_url),
    ).length;
    const withDesc = products.filter(
      (p) =>
        p.description && !p.description.includes("LIQZAR premium collection"),
    ).length;
    const imgPct = Math.round((withImages / total) * 100);
    const descPct = Math.round((withDesc / total) * 100);
    const stockPct = snapshot ? snapshot.avgStockHealth : 0;
    return {
      imgPct,
      descPct,
      stockPct,
      overall: Math.round((imgPct + descPct + stockPct) / 3),
      withImages,
      withDesc,
    };
  }, [products, snapshot]);

  // ─── Insights ────────────────────────────────────────────────────
  const insights = useMemo(() => {
    if (!snapshot) return [];
    const list: {
      icon: any;
      title: string;
      description: string;
      variant: "default" | "warning" | "success" | "danger";
    }[] = [];

    if (snapshot.deadStockCount > 0) {
      list.push({
        icon: XCircle,
        variant: "danger",
        title: `${snapshot.deadStockCount} dead stock items detected`,
        description:
          "These products show zero or near-zero sales velocity relative to their price tier. Consider clearance pricing or bundle deals.",
      });
    }
    if (snapshot.understockedCount > 0) {
      list.push({
        icon: PackageMinus,
        variant: "warning",
        title: `${snapshot.understockedCount} products below reorder point`,
        description:
          "These items are at risk of stockout. Reorder immediately to maintain availability.",
      });
    }
    if (snapshot.overstockedCount > 0) {
      list.push({
        icon: PackagePlus,
        variant: "warning",
        title: `${snapshot.overstockedCount} products overstocked`,
        description:
          "Excess inventory ties up capital. Consider promotions or adjusting future order quantities.",
      });
    }
    if (snapshot.fastMovers > 0) {
      list.push({
        icon: TrendingUp,
        variant: "success",
        title: `${snapshot.fastMovers} fast-moving products`,
        description:
          "These items exceed expected velocity for their price tier. Ensure adequate stock levels.",
      });
    }
    if (snapshot.clearanceCandidates > 0) {
      list.push({
        icon: Tag,
        variant: "danger",
        title: `${snapshot.clearanceCandidates} clearance candidates`,
        description:
          "Based on movement velocity, days of supply, and overstock analysis. Review the Clearance tab.",
      });
    }
    if (catalogueHealth && catalogueHealth.imgPct < 80) {
      list.push({
        icon: Package,
        variant: "warning",
        title: `Image coverage at ${catalogueHealth.imgPct}%`,
        description: `${(products?.length || 0) - catalogueHealth.withImages} products lack quality images.`,
      });
    }
    return list;
  }, [snapshot, catalogueHealth, products]);

  // ─── Filtered products ──────────────────────────────────────────
  const filtered = useMemo(() => {
    return productIntel.filter(({ product: p, intel }) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());
      let matchesFilter = true;
      if (stockFilter === "in_stock")
        matchesFilter = p.in_stock !== false && (p.stock_quantity ?? 0) > 0;
      else if (stockFilter === "out_of_stock")
        matchesFilter = p.in_stock === false || (p.stock_quantity ?? 0) <= 0;
      else if (stockFilter === "understocked")
        matchesFilter = intel.understocked;
      else if (stockFilter === "overstocked") matchesFilter = intel.overstocked;
      else if (stockFilter === "clearance")
        matchesFilter = intel.clearanceCandidate;
      return matchesSearch && matchesFilter;
    });
  }, [productIntel, search, stockFilter]);

  // ─── Chart data ─────────────────────────────────────────────────
  const movementChartData = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        name: "Fast",
        value: snapshot.movementBreakdown.fast_mover,
        fill: "#10b981",
      },
      {
        name: "Normal",
        value: snapshot.movementBreakdown.normal,
        fill: "#3b82f6",
      },
      {
        name: "Slow",
        value: snapshot.movementBreakdown.slow_mover,
        fill: "#f59e0b",
      },
      {
        name: "Dead",
        value: snapshot.movementBreakdown.dead_stock,
        fill: "#ef4444",
      },
      {
        name: "No Data",
        value: snapshot.movementBreakdown.no_data,
        fill: "#94a3b8",
      },
    ].filter((d) => d.value > 0);
  }, [snapshot]);

  const abcChartData = useMemo(() => {
    if (!snapshot) return [];
    return [
      {
        name: "A — High Revenue",
        value: snapshot.abcBreakdown.A,
        fill: "#10b981",
      },
      {
        name: "B — Medium Revenue",
        value: snapshot.abcBreakdown.B,
        fill: "#3b82f6",
      },
      {
        name: "C — Low Revenue",
        value: snapshot.abcBreakdown.C,
        fill: "#94a3b8",
      },
    ].filter((d) => d.value > 0);
  }, [snapshot]);

  const tierChartData = useMemo(() => {
    if (!snapshot) return [];
    return (Object.entries(snapshot.tierBreakdown) as [PriceTier, number][])
      .map(([tier, count]) => ({ name: PRICE_TIERS[tier].label, count }))
      .filter((d) => d.count > 0);
  }, [snapshot]);

  // ─── Handlers ────────────────────────────────────────────────────
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadProgress(10);
    setUploadStatus("Reading file...");
    try {
      const text = await file.text();
      setUploadProgress(50);
      setUploadStatus("Uploading to database...");
      const { data: result, error: fnErr } = await supabase.functions.invoke(
        "upload-products",
        { body: { csvText: text, deleteExisting: true } },
      );
      if (fnErr) throw new Error(fnErr.message);
      if (result?.error) throw new Error(result.error);
      setUploadProgress(100);
      setUploadStatus(
        `✅ ${result.inserted} of ${result.total_parsed} products uploaded`,
      );
      toast({
        title: "Products uploaded",
        description: `${result.inserted} products imported`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setUploadStatus(`❌ Error: ${err.message}`);
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteAll = async () => {
    if (
      !confirm(
        "Are you sure you want to delete ALL products? This cannot be undone.",
      )
    )
      return;
    try {
      await supabase
        .from("products")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");
      toast({ title: "All products deleted" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleSeedFromTemplate = async () => {
    setUploading(true);
    setUploadProgress(10);
    setUploadStatus("Fetching product template...");
    try {
      const res = await fetch("/data/products.csv");
      const text = await res.text();
      setUploadProgress(40);
      setUploadStatus("Uploading 534 products...");
      const { data: result, error: fnErr } = await supabase.functions.invoke(
        "upload-products",
        { body: { csvText: text, deleteExisting: true } },
      );
      if (fnErr) throw new Error(fnErr.message);
      setUploadProgress(100);
      setUploadStatus(`✅ ${result.inserted} products seeded`);
      toast({
        title: "Products seeded",
        description: `${result.inserted} products imported`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setUploadStatus(`❌ Error: ${err.message}`);
      toast({
        title: "Seed failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleStock = async (product: Product) => {
    const newStock = product.in_stock === false ? true : false;
    await supabase
      .from("products")
      .update({ in_stock: newStock })
      .eq("id", product.id);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    toast({ title: newStock ? "Marked in stock" : "Marked out of stock" });
  };

  const totalProducts = products?.length || 0;

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Inventory Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Stock control, movement analysis & clearance management
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {totalProducts === 0 && (
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl gap-2"
              onClick={handleSeedFromTemplate}
              disabled={uploading}
            >
              <Package className="w-4 h-4" /> Seed Products
            </Button>
          )}
          <Button
            variant="outline"
            className="rounded-xl gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={handleDeleteAll}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button
            className="bg-foreground text-background hover:bg-foreground/90 rounded-xl gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="w-4 h-4" /> CSV Upload
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt,.xlsx"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* Progress bars */}
      {(uploading || uploadStatus) && (
        <ProgressPanel
          icon={FileSpreadsheet}
          label="Upload"
          progress={uploadProgress}
          status={uploadStatus}
        />
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-secondary/50 p-1 rounded-xl w-fit">
        {[
          { key: "overview" as ViewTab, label: "Overview", icon: BarChart3 },
          {
            key: "clearance" as ViewTab,
            label: "Clearance & Dead Stock",
            icon: Tag,
          },
          {
            key: "thresholds" as ViewTab,
            label: "Movement Thresholds",
            icon: Gauge,
          },
        ].map((tab) => (
          <Button
            key={tab.key}
            variant={activeTab === tab.key ? "default" : "ghost"}
            size="sm"
            className="rounded-lg gap-2 text-xs"
            onClick={() => setActiveTab(tab.key)}
          >
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </Button>
        ))}
      </div>

      {/* ─── OVERVIEW TAB ─────────────────────────────────────────── */}
      {activeTab === "overview" && snapshot && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <KpiCard
              icon={Package}
              label="Total SKUs"
              value={snapshot.totalSKUs}
              color="bg-blue-100 text-blue-700"
            />
            <KpiCard
              icon={Layers}
              label="Total Units"
              value={snapshot.totalUnits.toLocaleString()}
              color="bg-indigo-100 text-indigo-700"
            />
            <KpiCard
              icon={TrendingUp}
              label="Fast Movers"
              value={snapshot.fastMovers}
              color="bg-green-100 text-green-700"
            />
            <KpiCard
              icon={PackageMinus}
              label="Understocked"
              value={snapshot.understockedCount}
              color="bg-amber-100 text-amber-700"
            />
            <KpiCard
              icon={PackagePlus}
              label="Overstocked"
              value={snapshot.overstockedCount}
              color="bg-purple-100 text-purple-700"
            />
            <KpiCard
              icon={Tag}
              label="Clearance"
              value={snapshot.clearanceCandidates}
              color="bg-red-100 text-red-700"
            />
          </div>

          {/* Health Score + Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Health Score */}
            {catalogueHealth && (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <Gauge className="w-4 h-4" /> Inventory Health
                  </h3>
                  <span
                    className={`text-2xl font-bold ${snapshot.avgStockHealth >= 70 ? "text-green-600" : snapshot.avgStockHealth >= 40 ? "text-amber-600" : "text-red-600"}`}
                  >
                    {snapshot.avgStockHealth}%
                  </span>
                </div>
                <HealthBar
                  label="Stock Levels"
                  value={snapshot.avgStockHealth}
                />
                <HealthBar
                  label="Image Coverage"
                  value={catalogueHealth.imgPct}
                />
                <HealthBar
                  label="Description Quality"
                  value={catalogueHealth.descPct}
                />
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    <strong>ABC Classification:</strong>{" "}
                    {snapshot.abcBreakdown.A} A-class ·{" "}
                    {snapshot.abcBreakdown.B} B-class ·{" "}
                    {snapshot.abcBreakdown.C} C-class
                  </p>
                </div>
              </div>
            )}

            {/* Movement Distribution */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Movement Distribution
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={movementChartData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={85}
                    innerRadius={45}
                    paddingAngle={2}
                  >
                    {movementChartData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Pie>
                  <ReTooltip formatter={(value: number) => [`${value} SKUs`]} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Price Tier Breakdown */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Wine className="w-4 h-4" /> Price Tier Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={tierChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="hsl(var(--border))"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <YAxis
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                  />
                  <ReTooltip />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Intelligence Insights */}
          {insights.length > 0 && (
            <div className="space-y-2">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4" /> Stock Intelligence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {insights.map((insight, i) => (
                  <InsightCard key={i} {...insight} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ─── CLEARANCE TAB ────────────────────────────────────────── */}
      {activeTab === "clearance" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Tag className="w-4 h-4" /> Clearance & Dead Stock Analysis
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Products flagged based on industry-standard movement thresholds
              adjusted for price tier. Premium/luxury items naturally have lower
              velocity expectations.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Product
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Price Tier
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Movement
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Weekly Velocity
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Expected Range
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Stock Qty
                    </th>
                    <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Days Supply
                    </th>
                    <th className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {productIntel
                    .filter(({ intel }) => intel.clearanceCandidate)
                    .sort(
                      (a, b) =>
                        a.intel.stockHealthScore - b.intel.stockHealthScore,
                    )
                    .slice(0, 50)
                    .map(({ product, intel }) => (
                      <tr key={product.id} className="hover:bg-secondary/30">
                        <td className="p-3">
                          <p className="text-sm font-medium text-foreground truncate max-w-[200px]">
                            {product.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {product.category}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-xs font-semibold ${PRICE_TIERS[intel.priceTier].color}`}
                          >
                            {intel.priceTierLabel}
                          </span>
                          <p className="text-[10px] text-muted-foreground">
                            R {Math.round(product.price).toLocaleString('en-ZA')}
                          </p>
                        </td>
                        <td className="p-3 text-center">
                          <MovementBadge status={intel.movementStatus} />
                        </td>
                        <td className="p-3 text-center text-xs font-mono text-foreground">
                          {intel.weeklyVelocity}
                        </td>
                        <td className="p-3 text-center text-[10px] text-muted-foreground">
                          {intel.expectedVelocityMin}–
                          {intel.expectedVelocityMax}/wk
                        </td>
                        <td className="p-3 text-center text-xs font-mono text-foreground">
                          {product.stock_quantity ?? 0}
                        </td>
                        <td className="p-3 text-center">
                          <span
                            className={`text-xs font-mono ${(intel.daysOfSupply ?? 0) > 90 ? "text-red-600" : "text-foreground"}`}
                          >
                            {intel.daysOfSupply === 999
                              ? "∞"
                              : `${intel.daysOfSupply}d`}
                          </span>
                        </td>
                        <td className="p-3">
                          <p className="text-xs text-muted-foreground">
                            {intel.clearanceReason}
                          </p>
                        </td>
                      </tr>
                    ))}
                  {productIntel.filter(({ intel }) => intel.clearanceCandidate)
                    .length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-muted-foreground"
                      >
                        No clearance candidates — all products are within
                        healthy movement thresholds.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── THRESHOLDS TAB ───────────────────────────────────────── */}
      {activeTab === "thresholds" && (
        <div className="space-y-4">
          {/* Reference Table */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Gauge className="w-4 h-4" /> Industry Movement Thresholds (SA
              Liquor Retail)
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Expected weekly unit sales by price tier. Products performing
              below the minimum are flagged as slow movers; below 30% of minimum
              triggers dead stock classification.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                      Price Tier
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                      Price Range
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                      Expected Weekly Sales
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                      Slow Mover Threshold
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                      Dead Stock Threshold
                    </th>
                    <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                      Current SKUs
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(
                    Object.entries(PRICE_TIERS) as [
                      PriceTier,
                      (typeof PRICE_TIERS)[PriceTier],
                    ][]
                  ).map(([tier, info]) => {
                    const vel = EXPECTED_WEEKLY_VELOCITY[tier];
                    const count = snapshot?.tierBreakdown[tier] ?? 0;
                    return (
                      <tr key={tier} className="hover:bg-secondary/30">
                        <td className="p-3">
                          <span
                            className={`text-sm font-semibold ${info.color}`}
                          >
                            {info.label}
                          </span>
                        </td>
                        <td className="p-3 text-center text-sm text-foreground">
                          R {info.min}
                          {info.max === Infinity ? "+" : ` – R ${info.max}`}
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-mono text-foreground">
                            {vel.min} – {vel.max} units/wk
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-mono text-amber-600">
                            &lt; {vel.min} units/wk
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-mono text-red-600">
                            &lt; {(vel.min * 0.3).toFixed(1)} units/wk
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-sm font-bold text-foreground">
                            {count}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stock Control Parameters */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <h3 className="font-semibold text-foreground mb-1 flex items-center gap-2">
              <Package className="w-4 h-4" /> Stock Control Parameters
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              Reorder points are calculated as: (Daily Velocity × Lead Time ×
              Safety Multiplier). Lead time: 5 days, Safety multiplier: 1.5×
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-secondary/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Reorder Formula
                </p>
                <p className="text-sm text-foreground font-mono">
                  ROP = (V<sub>daily</sub> × 5) × 1.5
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Where V = average daily sales velocity
                </p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Days of Supply
                </p>
                <p className="text-sm text-foreground font-mono">
                  DOS = Stock ÷ V<sub>daily</sub>
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  &gt;90 days triggers clearance review
                </p>
              </div>
              <div className="bg-secondary/30 rounded-xl p-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
                  Clearance Triggers
                </p>
                <ul className="text-[11px] text-foreground space-y-1 mt-1">
                  <li>• Dead stock with any inventory</li>
                  <li>• Slow mover with &gt;90 days supply</li>
                  <li>• Stock &gt;150% of max level</li>
                </ul>
              </div>
            </div>
          </div>

          {/* ABC Analysis */}
          {snapshot && (
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> ABC Analysis (Revenue
                Classification)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={abcChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                      >
                        {abcChartData.map((d, i) => (
                          <Cell key={i} fill={d.fill} />
                        ))}
                      </Pie>
                      <ReTooltip
                        formatter={(value: number) => [`${value} SKUs`]}
                      />
                      <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-3 flex flex-col justify-center">
                  <div className="flex items-center gap-3">
                    <ABCBadge cls="A" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {snapshot.abcBreakdown.A} SKUs — High Revenue
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Top performers. Maintain stock, never run out.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ABCBadge cls="B" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {snapshot.abcBreakdown.B} SKUs — Medium Revenue
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Moderate attention. Standard reorder cycles.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <ABCBadge cls="C" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {snapshot.abcBreakdown.C} SKUs — Low Revenue
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Review regularly. Candidates for delisting or clearance.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── PRODUCT TABLE (all tabs) ─────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or categories..."
            className="pl-10 h-11 rounded-xl"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            {
              key: "all" as StockFilterType,
              label: "All",
              count: totalProducts,
            },
            {
              key: "in_stock" as StockFilterType,
              label: "In Stock",
              count: snapshot?.totalSKUs
                ? snapshot.totalSKUs -
                  snapshot.understockedCount -
                  (products?.filter((p) => (p.stock_quantity ?? 0) <= 0)
                    .length ?? 0)
                : 0,
            },
            {
              key: "understocked" as StockFilterType,
              label: "Understocked",
              count: snapshot?.understockedCount ?? 0,
            },
            {
              key: "overstocked" as StockFilterType,
              label: "Overstocked",
              count: snapshot?.overstockedCount ?? 0,
            },
            {
              key: "out_of_stock" as StockFilterType,
              label: "Out of Stock",
              count:
                products?.filter(
                  (p) => p.in_stock === false || (p.stock_quantity ?? 0) <= 0,
                ).length ?? 0,
            },
            {
              key: "clearance" as StockFilterType,
              label: "Clearance",
              count: snapshot?.clearanceCandidates ?? 0,
            },
          ].map((f) => (
            <Button
              key={f.key}
              variant={stockFilter === f.key ? "default" : "outline"}
              size="sm"
              className="rounded-xl text-[11px] gap-1"
              onClick={() => setStockFilter(f.key)}
            >
              {f.label} <span className="opacity-60">({f.count})</span>
            </Button>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                  Image
                </th>
                <th className="text-left p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                  Product
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">
                  Tier
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                  ABC
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                  Movement
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">
                  Velocity
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase w-32">
                  Stock Level
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">
                  DOS
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase hidden lg:table-cell">
                  Reorder Pt
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase hidden md:table-cell">
                  Health
                </th>
                <th className="text-center p-3 text-[10px] font-semibold text-muted-foreground uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-muted-foreground"
                  >
                    Loading products...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="p-8 text-center text-muted-foreground"
                  >
                    {totalProducts === 0
                      ? "No products. Upload a CSV to get started."
                      : "No matching products."}
                  </td>
                </tr>
              ) : (
                filtered.slice(0, 100).map(({ product, intel }) => (
                  <tr
                    key={product.id}
                    className={`hover:bg-secondary/30 transition-colors ${intel.clearanceCandidate ? "bg-red-50/30" : ""}`}
                  >
                    <td className="p-2">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-secondary flex-shrink-0">
                        <img
                          src={getProductImageUrl(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              getProductImageUrl(product);
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="text-sm font-medium text-foreground truncate max-w-[180px]">
                        {product.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {product.category}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {product.bottle_size} · R {Math.round(product.price).toLocaleString('en-ZA')}
                      </p>
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <span
                        className={`text-[11px] font-semibold ${PRICE_TIERS[intel.priceTier].color}`}
                      >
                        {intel.priceTierLabel}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <ABCBadge cls={intel.abcClass} />
                    </td>
                    <td className="p-3 text-center">
                      <MovementBadge status={intel.movementStatus} />
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <span className="text-xs font-mono text-foreground">
                        {intel.weeklyVelocity}/wk
                      </span>
                      <p className="text-[9px] text-muted-foreground">
                        exp: {intel.expectedVelocityMin}–
                        {intel.expectedVelocityMax}
                      </p>
                    </td>
                    <td className="p-3">
                      <StockLevelBar
                        qty={product.stock_quantity ?? 0}
                        reorder={intel.reorderPoint}
                        max={product.max_stock_level ?? 50}
                      />
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      <span
                        className={`text-xs font-mono ${(intel.daysOfSupply ?? 0) > 90 ? "text-red-600 font-bold" : "text-foreground"}`}
                      >
                        {intel.daysOfSupply === 999
                          ? "∞"
                          : `${intel.daysOfSupply}d`}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden lg:table-cell">
                      <span className="text-xs font-mono text-foreground">
                        {intel.reorderPoint}
                      </span>
                    </td>
                    <td className="p-3 text-center hidden md:table-cell">
                      <div className="flex flex-col items-center">
                        <span
                          className={`text-xs font-bold ${intel.stockHealthScore >= 70 ? "text-green-600" : intel.stockHealthScore >= 40 ? "text-amber-600" : "text-red-600"}`}
                        >
                          {intel.stockHealthScore}
                        </span>
                        {intel.clearanceCandidate && (
                          <Tag className="w-3 h-3 text-red-500 mt-0.5" />
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() => handleToggleStock(product)}
                          title="Toggle stock"
                        >
                          {product.in_stock !== false ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-red-500" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 100 && (
          <div className="p-3 text-center text-xs text-muted-foreground border-t border-border">
            Showing 100 of {filtered.length} products. Use search to narrow
            down.
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminInventory;
