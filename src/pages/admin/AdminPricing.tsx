import { useProducts } from "@/hooks/useProducts";
import { getAvailableRetailerPrices } from "@/lib/product-utils";
import { getProductImageUrl } from "@/data/products";
import type { Product } from "@/data/products";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  RefreshCw,
  FileText,
  ImageIcon,
  Loader2,
  Image,
  DollarSign,
  Upload,
  BarChart3,
  AlertTriangle,
  Tag,
  Percent,
  Sparkles,
  PackageX,
  ShoppingBag,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { useState, useMemo, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useScrapeImages } from "@/hooks/useScrapeImages";
import { useGenerateDescriptions } from "@/hooks/useGenerateDescriptions";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
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
} from "recharts";

const DEFAULT_MARKUP = 25;
const CHART_COLORS = [
  "hsl(142, 71%, 45%)",
  "hsl(48, 96%, 53%)",
  "hsl(0, 84%, 60%)",
  "hsl(217, 91%, 60%)",
  "hsl(280, 68%, 60%)",
  "hsl(30, 80%, 55%)",
  "hsl(180, 60%, 45%)",
  "hsl(330, 70%, 55%)",
];

// ═══════ Helpers ═══════
const getEffectiveMarkup = (product: Product, globalMarkup: number): number =>
  product.markup_pct ?? globalMarkup;

const getSellingPrice = (lowest: number, markup: number): number =>
  Math.round(lowest * (1 + markup / 100) * 100) / 100;

const getMargin = (selling: number, cost: number): number =>
  selling > 0 ? ((selling - cost) / selling) * 100 : 0;

// ═══════ Sub-components ═══════
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
  <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
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
  </div>
);

const AdminPricing = () => {
  const { data: products = [], isLoading } = useProducts({ limit: 500 });
  const [search, setSearch] = useState("");
  const [globalMarkup, setGlobalMarkup] = useState(DEFAULT_MARKUP);
  const [refreshing, setRefreshing] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [editingMarkupId, setEditingMarkupId] = useState<string | null>(null);
  const [editMarkupValue, setEditMarkupValue] = useState("");
  const [applyingGlobal, setApplyingGlobal] = useState(false);
  const {
    scrapingImages,
    scrapeProgress,
    scrapeStatus,
    scrapingSingleId,
    handleScrapeImages,
    handleScrapeSingleImage,
  } = useScrapeImages();
  const {
    generating,
    genProgress,
    genStatus,
    generatingSingleId,
    handleBulkGenerate,
    handleSingleGenerate,
  } = useGenerateDescriptions();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<string | null>(null);

  // ═══════ Handlers ═══════
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const productId = uploadTargetRef.current;
    if (!file || !productId) return;
    e.target.value = "";
    setUploadingId(productId);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${productId}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);
      await supabase
        .from("products")
        .update({ image_url: urlData.publicUrl })
        .eq("id", productId);
      toast({ title: "Image uploaded" });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({
        title: "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploadingId(null);
    }
  };

  const triggerUpload = (productId: string) => {
    uploadTargetRef.current = productId;
    fileInputRef.current?.click();
  };

  const handleSyncPrices = async () => {
    setRefreshing(true);
    try {
      const { data: allProducts } = await supabase.from("products").select("*");
      if (!allProducts) return;
      let updated = 0;
      for (const p of allProducts) {
        const prices = [
          p.checkers_price,
          p.pnp_price,
          p.tops_price,
          p.woolworths_price,
          p.norman_price,
          p.makro_price,
        ].filter((v): v is number => v !== null && v > 0);
        if (prices.length > 0) {
          const cheapest = Math.min(...prices);
          const retailers = [
            { name: "Checkers", price: p.checkers_price },
            { name: "Pick n Pay", price: p.pnp_price },
            { name: "TOPS", price: p.tops_price },
            { name: "Woolworths", price: p.woolworths_price },
            { name: "Norman Goodfellows", price: p.norman_price },
            { name: "Makro", price: p.makro_price },
          ];
          const cheapestRetailer =
            retailers
              .filter((r) => r.price && r.price > 0)
              .sort((a, b) => a.price! - b.price!)[0]?.name || null;
          await supabase
            .from("products")
            .update({
              price: cheapest,
              cheapest_retailer: cheapestRetailer,
              updated_at: new Date().toISOString(),
            })
            .eq("id", p.id);
          updated++;
        }
      }
      toast({
        title: "Prices synced",
        description: `${updated} products updated`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveProductMarkup = async (productId: string) => {
    const val =
      editMarkupValue.trim() === "" ? null : parseFloat(editMarkupValue);
    if (val !== null && (isNaN(val) || val < 0 || val > 500)) {
      toast({
        title: "Invalid markup",
        description: "Enter 0–500 or leave blank for global default",
        variant: "destructive",
      });
      return;
    }
    await supabase
      .from("products")
      .update({ markup_pct: val } as any)
      .eq("id", productId);
    toast({ title: "Markup updated" });
    setEditingMarkupId(null);
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const handleApplyGlobalMarkup = async () => {
    setApplyingGlobal(true);
    try {
      // Clear all per-product overrides, rely on computed pricing
      await supabase
        .from("products")
        .update({ markup_pct: null } as any)
        .neq("id", "00000000-0000-0000-0000-000000000000");
      toast({
        title: "Global markup applied",
        description: `All products set to ${globalMarkup}% markup`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setApplyingGlobal(false);
    }
  };

  // ═══════ Computed ═══════
  const filtered = useMemo(
    () =>
      products.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [products, search],
  );

  const missingImages = useMemo(
    () => products.filter((p) => !p.image_url).length,
    [products],
  );
  const missingDescriptions = useMemo(
    () => products.filter((p) => !p.description).length,
    [products],
  );

  const pricingAnalytics = useMemo(() => {
    const withPrices = products.filter(
      (p) => getAvailableRetailerPrices(p).length > 0,
    );
    const margins = withPrices.map((p) => {
      const lowest = getAvailableRetailerPrices(p)[0]?.price || 0;
      const markup = getEffectiveMarkup(p, globalMarkup);
      const selling = getSellingPrice(lowest, markup);
      return {
        product: p,
        lowest,
        markup,
        selling,
        margin: getMargin(selling, lowest),
        category: p.category,
      };
    });

    // Category margins
    const catMap = new Map<
      string,
      { totalMargin: number; count: number; revenue: number }
    >();
    margins.forEach((m) => {
      const entry = catMap.get(m.category) || {
        totalMargin: 0,
        count: 0,
        revenue: 0,
      };
      entry.totalMargin += m.margin;
      entry.count++;
      entry.revenue += m.selling;
      catMap.set(m.category, entry);
    });
    const categoryMargins = [...catMap.entries()]
      .map(([cat, v]) => ({
        category: cat.length > 18 ? cat.slice(0, 18) + "…" : cat,
        avgMargin: v.count > 0 ? v.totalMargin / v.count : 0,
        revenue: v.revenue,
        count: v.count,
      }))
      .sort((a, b) => b.avgMargin - a.avgMargin);

    // Margin distribution
    const low = margins.filter((m) => m.margin < 15).length;
    const mid = margins.filter((m) => m.margin >= 15 && m.margin < 25).length;
    const high = margins.filter((m) => m.margin >= 25 && m.margin < 35).length;
    const premium = margins.filter((m) => m.margin >= 35).length;
    const marginDist = [
      { name: "< 15%", value: low },
      { name: "15–25%", value: mid },
      { name: "25–35%", value: high },
      { name: "35%+", value: premium },
    ].filter((d) => d.value > 0);

    const avgMargin =
      margins.length > 0
        ? margins.reduce((s, m) => s + m.margin, 0) / margins.length
        : 0;
    const totalRevenue = margins.reduce((s, m) => s + m.selling, 0);
    const totalCost = margins.reduce((s, m) => s + m.lowest, 0);

    // Top & bottom margin products
    const sorted = [...margins].sort((a, b) => b.margin - a.margin);
    const topMargin = sorted.slice(0, 5);
    const bottomMargin = sorted
      .filter((m) => m.margin > 0)
      .slice(-5)
      .reverse();

    // Price alerts: products where competitor price is significantly below selling
    const alerts = margins.filter((m) => m.margin < 10 && m.lowest > 0);

    // Clearance candidates: slow movers with high stock
    const clearanceCandidates = products.filter((p) => {
      const velocity = p.units_sold_7d ?? 0;
      const stock = p.stock_quantity ?? 0;
      return velocity === 0 && stock > 10;
    });

    // Bundle opportunities: same category, complementary price tiers
    const bundleOps = categoryMargins.filter((c) => c.count >= 3).slice(0, 5);

    return {
      margins,
      categoryMargins,
      marginDist,
      avgMargin,
      totalRevenue,
      totalCost,
      topMargin,
      bottomMargin,
      alerts,
      clearanceCandidates,
      bundleOps,
      withPricesCount: withPrices.length,
    };
  }, [products, globalMarkup]);

  const overrideCount = useMemo(
    () => products.filter((p) => p.markup_pct != null).length,
    [products],
  );

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageUpload}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            Pricing & Content Intelligence
          </h2>
          <p className="text-sm text-muted-foreground">
            Retailer comparison, margin optimization, AI content enrichment &
            markup control
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={handleSyncPrices}
            disabled={refreshing}
          >
            <DollarSign
              className={`w-4 h-4 ${refreshing ? "animate-pulse" : ""}`}
            />
            {refreshing ? "Syncing..." : "Sync Prices"}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={() => handleScrapeImages({ forceRefresh: true })}
            disabled={scrapingImages}
          >
            <RefreshCw
              className={`w-4 h-4 ${scrapingImages ? "animate-spin" : ""}`}
            />
            {scrapingImages ? "Refreshing..." : "Sync Images"}
          </Button>
          <Button
            variant="outline"
            className="rounded-xl gap-2"
            onClick={handleBulkGenerate}
            disabled={generating}
          >
            <FileText
              className={`w-4 h-4 ${generating ? "animate-pulse" : ""}`}
            />
            {generating ? "Generating..." : "AI Descriptions"}
          </Button>
        </div>
      </div>

      {/* Progress bars */}
      {(scrapingImages || scrapeStatus) && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              Image Sync Progress
            </span>
          </div>
          <Progress value={scrapeProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">{scrapeStatus}</p>
        </div>
      )}
      {(generating || genStatus) && (
        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">
              AI Description Generation
            </span>
          </div>
          <Progress value={genProgress} className="h-2" />
          <p className="text-xs text-muted-foreground">{genStatus}</p>
        </div>
      )}

      {/* Global Markup Control */}
      <div className="bg-card border border-border rounded-2xl p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 text-primary rounded-xl flex items-center justify-center">
              <Percent className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Global Markup
              </p>
              <p className="text-[11px] text-muted-foreground">
                {overrideCount} products have per-product overrides
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              max={500}
              step={1}
              value={globalMarkup}
              onChange={(e) => setGlobalMarkup(Number(e.target.value) || 0)}
              className="w-20 h-9 text-center text-sm"
            />
            <span className="text-sm text-muted-foreground">%</span>
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-9 gap-1"
              onClick={handleApplyGlobalMarkup}
              disabled={applyingGlobal}
            >
              {applyingGlobal ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Apply to All
            </Button>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <KpiCard
          icon={ShoppingBag}
          label="Total Products"
          value={products.length}
          color="bg-primary/10 text-primary"
        />
        <KpiCard
          icon={DollarSign}
          label="With Prices"
          value={pricingAnalytics.withPricesCount}
          color="bg-green-100 text-green-700"
        />
        <KpiCard
          icon={BarChart3}
          label="Avg Margin"
          value={`${pricingAnalytics.avgMargin.toFixed(1)}%`}
          color="bg-blue-100 text-blue-700"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Low Margin Alerts"
          value={pricingAnalytics.alerts.length}
          sub="< 10% margin"
          color="bg-red-100 text-red-700"
        />
        <KpiCard
          icon={PackageX}
          label="Clearance Candidates"
          value={pricingAnalytics.clearanceCandidates.length}
          sub="Dead stock"
          color="bg-amber-100 text-amber-700"
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="pricing" className="space-y-4">
        <TabsList className="bg-secondary flex-wrap">
          <TabsTrigger value="pricing">Price Comparison</TabsTrigger>
          <TabsTrigger value="margins">Margin Optimizer</TabsTrigger>
          <TabsTrigger value="alerts">Price Alerts</TabsTrigger>
          <TabsTrigger value="clearance">Clearance Engine</TabsTrigger>
          <TabsTrigger value="content">Content & Images</TabsTrigger>
        </TabsList>

        {/* ═══ PRICING TAB ═══ */}
        <TabsContent value="pricing">
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Product
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Checkers
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        PnP
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        TOPS
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Woolworths
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Norman G.
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Makro
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Lowest
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Markup %
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Selling
                      </th>
                      <th className="text-right p-3 text-xs font-semibold text-muted-foreground uppercase">
                        Margin
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((p) => {
                      const retailers = getAvailableRetailerPrices(p);
                      const lowest =
                        retailers.length > 0 ? retailers[0].price : null;
                      const effectiveMarkup = getEffectiveMarkup(
                        p,
                        globalMarkup,
                      );
                      const sellingPrice = lowest
                        ? getSellingPrice(lowest, effectiveMarkup)
                        : p.price;
                      const margin = lowest
                        ? getMargin(sellingPrice, lowest)
                        : 0;
                      const hasOverride = p.markup_pct != null;
                      const isEditing = editingMarkupId === p.id;

                      const priceCell = (
                        val: number | null | undefined,
                        isLowest: boolean,
                      ) => (
                        <td
                          className={`p-3 text-sm text-right ${isLowest ? "font-bold text-green-600" : "text-muted-foreground"}`}
                        >
                          {val != null ? (
                            `R ${Math.round(val).toLocaleString("en-ZA")}`
                          ) : (
                            <Minus className="w-3 h-3 inline text-muted-foreground/40" />
                          )}
                        </td>
                      );

                      return (
                        <tr
                          key={p.id}
                          className={`hover:bg-secondary/50 transition-colors ${hasOverride ? "bg-primary/5" : ""}`}
                        >
                          <td className="p-3">
                            <p className="text-sm font-medium text-foreground line-clamp-1">
                              {p.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {p.category}
                            </p>
                          </td>
                          {priceCell(
                            p.checkers_price,
                            retailers[0]?.retailer === "Checkers",
                          )}
                          {priceCell(
                            p.pnp_price,
                            retailers[0]?.retailer === "Pick n Pay",
                          )}
                          {priceCell(
                            p.tops_price,
                            retailers[0]?.retailer === "TOPS",
                          )}
                          {priceCell(
                            p.woolworths_price,
                            retailers[0]?.retailer === "Woolworths",
                          )}
                          {priceCell(
                            p.norman_price,
                            retailers[0]?.retailer === "Norman Goodfellows",
                          )}
                          {priceCell(
                            p.makro_price ?? null,
                            retailers[0]?.retailer === "Makro",
                          )}
                          <td className="p-3 text-sm text-right font-semibold text-foreground">
                            {lowest
                              ? `R ${Math.round(lowest).toLocaleString("en-ZA")}`
                              : "—"}
                          </td>
                          <td className="p-3 text-right">
                            {isEditing ? (
                              <div className="flex items-center justify-end gap-1">
                                <Input
                                  type="number"
                                  min={0}
                                  max={500}
                                  step={1}
                                  value={editMarkupValue}
                                  onChange={(e) =>
                                    setEditMarkupValue(e.target.value)
                                  }
                                  className="w-16 h-7 text-xs text-center p-1"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleSaveProductMarkup(p.id);
                                    if (e.key === "Escape")
                                      setEditingMarkupId(null);
                                  }}
                                />
                                <button
                                  onClick={() => handleSaveProductMarkup(p.id)}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingMarkupId(null)}
                                  className="text-muted-foreground hover:text-foreground"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                className={`inline-flex items-center gap-1 text-xs font-mono ${hasOverride ? "text-primary font-bold" : "text-muted-foreground"} hover:text-foreground`}
                                onClick={() => {
                                  setEditingMarkupId(p.id);
                                  setEditMarkupValue(
                                    p.markup_pct != null
                                      ? String(p.markup_pct)
                                      : "",
                                  );
                                }}
                                title="Click to override markup"
                              >
                                {effectiveMarkup}%
                                <Edit2 className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </td>
                          <td className="p-3 text-sm text-right font-bold text-foreground">
                            R {Math.round(sellingPrice).toLocaleString("en-ZA")}
                          </td>
                          <td className="p-3 text-right">
                            {lowest ? (
                              <span
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${margin >= 20 ? "text-green-600" : margin >= 10 ? "text-amber-600" : "text-red-600"}`}
                              >
                                {margin >= 20 ? (
                                  <TrendingUp className="w-3 h-3" />
                                ) : (
                                  <TrendingDown className="w-3 h-3" />
                                )}
                                {margin.toFixed(0)}%
                              </span>
                            ) : (
                              <Minus className="w-3 h-3 inline text-muted-foreground/40" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ═══ MARGIN OPTIMIZER TAB ═══ */}
        <TabsContent value="margins">
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Margin Distribution */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Margin Distribution
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pricingAnalytics.marginDist}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {pricingAnalytics.marginDist.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <ReTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Category Margins */}
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-4">
                  Avg Margin by Category
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart
                    data={pricingAnalytics.categoryMargins.slice(0, 8)}
                    layout="vertical"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="hsl(var(--border))"
                    />
                    <XAxis
                      type="number"
                      domain={[0, "auto"]}
                      tick={{ fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="category"
                      width={120}
                      tick={{ fontSize: 10 }}
                    />
                    <ReTooltip />
                    <Bar
                      dataKey="avgMargin"
                      fill="hsl(142, 71%, 45%)"
                      radius={[0, 4, 4, 0]}
                      name="Avg Margin %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top & Bottom margin tables */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ArrowUpRight className="w-4 h-4 text-green-600" /> Highest
                  Margin Products
                </h3>
                <div className="space-y-2">
                  {pricingAnalytics.topMargin.map((m) => (
                    <div
                      key={m.product.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground truncate max-w-[200px]">
                        {m.product.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          R {Math.round(m.selling).toLocaleString("en-ZA")}
                        </span>
                        <span className="text-green-600 font-bold text-xs">
                          {m.margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ArrowDownRight className="w-4 h-4 text-red-600" /> Lowest
                  Margin Products
                </h3>
                <div className="space-y-2">
                  {pricingAnalytics.bottomMargin.map((m) => (
                    <div
                      key={m.product.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-foreground truncate max-w-[200px]">
                        {m.product.name}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground text-xs">
                          R {Math.round(m.selling).toLocaleString("en-ZA")}
                        </span>
                        <span className="text-red-600 font-bold text-xs">
                          {m.margin.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Revenue summary */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-3">
                Revenue & Profitability Summary
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    R{" "}
                    {Math.round(
                      pricingAnalytics.totalRevenue / 1000,
                    ).toLocaleString("en-ZA")}
                    k
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total Selling Value
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">
                    R{" "}
                    {Math.round(
                      pricingAnalytics.totalCost / 1000,
                    ).toLocaleString("en-ZA")}
                    k
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Total Cost (Lowest)
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-green-600">
                    R{" "}
                    {(
                      (pricingAnalytics.totalRevenue -
                        pricingAnalytics.totalCost) /
                      1000
                    ).toFixed(0)}
                    k
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Gross Profit
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-primary">
                    {pricingAnalytics.avgMargin.toFixed(1)}%
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Average Margin
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* ═══ PRICE ALERTS TAB ═══ */}
        <TabsContent value="alerts">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600" /> Low Margin
                Alerts ({pricingAnalytics.alerts.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Products with less than 10% margin need attention — consider
                increasing markup or finding cheaper sourcing.
              </p>
              {pricingAnalytics.alerts.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  ✅ All products have healthy margins above 10%
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                          Product
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Cost
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Selling
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Margin
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Suggested Markup
                        </th>
                        <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pricingAnalytics.alerts.slice(0, 30).map((m) => {
                        const suggestedMarkup = Math.ceil(
                          ((m.lowest * 1.2) / m.lowest - 1) * 100,
                        );
                        return (
                          <tr
                            key={m.product.id}
                            className="hover:bg-secondary/50"
                          >
                            <td className="p-3">
                              <p className="text-sm font-medium text-foreground">
                                {m.product.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {m.product.category}
                              </p>
                            </td>
                            <td className="p-3 text-sm text-right text-muted-foreground">
                              R {Math.round(m.lowest).toLocaleString("en-ZA")}
                            </td>
                            <td className="p-3 text-sm text-right text-foreground font-semibold">
                              R {Math.round(m.selling).toLocaleString("en-ZA")}
                            </td>
                            <td className="p-3 text-right">
                              <span className="text-red-600 font-bold text-xs">
                                {m.margin.toFixed(1)}%
                              </span>
                            </td>
                            <td className="p-3 text-right text-xs text-muted-foreground">
                              {suggestedMarkup}%
                            </td>
                            <td className="p-3 text-center">
                              <button
                                className="text-xs text-primary hover:underline font-medium"
                                onClick={() => {
                                  setEditingMarkupId(m.product.id);
                                  setEditMarkupValue(String(suggestedMarkup));
                                }}
                              >
                                Override
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ CLEARANCE ENGINE TAB ═══ */}
        <TabsContent value="clearance">
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
                <Tag className="w-4 h-4 text-amber-600" /> Clearance Candidates
                ({pricingAnalytics.clearanceCandidates.length})
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Dead stock (zero velocity, stock &gt; 10 units). Consider
                markdown pricing to clear inventory.
              </p>
              {pricingAnalytics.clearanceCandidates.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  ✅ No clearance candidates — all products are moving
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 text-xs font-semibold text-muted-foreground">
                          Product
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Stock
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          7d Sales
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Current Price
                        </th>
                        <th className="text-right p-3 text-xs font-semibold text-muted-foreground">
                          Suggested Discount
                        </th>
                        <th className="text-center p-3 text-xs font-semibold text-muted-foreground">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {pricingAnalytics.clearanceCandidates
                        .slice(0, 30)
                        .map((p) => {
                          const stock = p.stock_quantity ?? 0;
                          const suggestedDiscount =
                            stock > 50 ? 30 : stock > 30 ? 20 : 10;
                          const discountedMarkup = Math.max(
                            0,
                            globalMarkup - suggestedDiscount,
                          );
                          return (
                            <tr key={p.id} className="hover:bg-secondary/50">
                              <td className="p-3">
                                <p className="text-sm font-medium text-foreground">
                                  {p.name}
                                </p>
                                <p className="text-[10px] text-muted-foreground">
                                  {p.category}
                                </p>
                              </td>
                              <td className="p-3 text-sm text-right font-semibold text-red-600">
                                {stock} units
                              </td>
                              <td className="p-3 text-sm text-right text-muted-foreground">
                                {p.units_sold_7d ?? 0}
                              </td>
                              <td className="p-3 text-sm text-right text-foreground">
                                R {Math.round(p.price).toLocaleString("en-ZA")}
                              </td>
                              <td className="p-3 text-right">
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">
                                  -{suggestedDiscount}% → {discountedMarkup}%
                                  markup
                                </span>
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  className="text-xs text-primary hover:underline font-medium"
                                  onClick={async () => {
                                    await supabase
                                      .from("products")
                                      .update({
                                        markup_pct: discountedMarkup,
                                      } as any)
                                      .eq("id", p.id);
                                    toast({
                                      title: "Clearance markup set",
                                      description: `${p.name} set to ${discountedMarkup}%`,
                                    });
                                    queryClient.invalidateQueries({
                                      queryKey: ["products"],
                                    });
                                  }}
                                >
                                  Apply
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* ═══ CONTENT & IMAGES TAB ═══ */}
        <TabsContent value="content">
          {isLoading ? (
            <Skeleton className="h-[400px] rounded-2xl" />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.slice(0, 60).map((product) => {
                const hasImage =
                  !!product.image_url &&
                  !product.image_url.includes("placehold");
                const hasDescription = !!product.description;
                return (
                  <div
                    key={product.id}
                    className="bg-card border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors"
                  >
                    <div className="flex gap-3">
                      <div className="w-16 h-16 bg-secondary rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden relative group">
                        <img
                          src={getProductImageUrl(product)}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              getProductImageUrl(product);
                          }}
                        />
                        <button
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          onClick={() =>
                            handleScrapeSingleImage(product.id, product.name)
                          }
                          disabled={scrapingSingleId === product.id}
                        >
                          {scrapingSingleId === product.id ? (
                            <Loader2 className="w-4 h-4 text-white animate-spin" />
                          ) : (
                            <RefreshCw className="w-4 h-4 text-white" />
                          )}
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                          {product.name}
                        </h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.category}
                        </p>
                        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hasImage ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {hasImage ? "✓ Image" : "✗ No Image"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${hasDescription ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
                          >
                            {hasDescription ? "✓ Description" : "✗ No Desc"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1 self-start">
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() => triggerUpload(product.id)}
                          disabled={uploadingId === product.id}
                          title="Upload image"
                        >
                          {uploadingId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            handleScrapeSingleImage(product.id, product.name)
                          }
                          disabled={scrapingSingleId === product.id}
                          title="AI image search"
                        >
                          {scrapingSingleId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Image className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          className="text-muted-foreground hover:text-foreground"
                          onClick={() =>
                            handleSingleGenerate(product.id, product.name)
                          }
                          disabled={generatingSingleId === product.id}
                          title="Generate description & tasting notes"
                        >
                          {generatingSingleId === product.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <FileText className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                      {product.description ||
                        "No description yet — click the document icon to generate one with AI."}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminPricing;
