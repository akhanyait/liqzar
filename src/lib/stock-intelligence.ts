import type { Product } from "@/data/products";

// ─── Price Tier Definitions (Industry Standard for Liquor) ──────────
export type PriceTier = "budget" | "mid_range" | "premium" | "ultra_premium" | "luxury";

export const PRICE_TIERS: Record<PriceTier, { label: string; min: number; max: number; color: string }> = {
  budget:        { label: "Budget",        min: 0,    max: 200,  color: "text-green-600" },
  mid_range:     { label: "Mid-Range",     min: 200,  max: 500,  color: "text-blue-600" },
  premium:       { label: "Premium",       min: 500,  max: 1000, color: "text-purple-600" },
  ultra_premium: { label: "Ultra Premium", min: 1000, max: 3000, color: "text-amber-600" },
  luxury:        { label: "Luxury",        min: 3000, max: Infinity, color: "text-rose-600" },
};

// Expected weekly unit sales by price tier (industry benchmarks for SA liquor retail)
export const EXPECTED_WEEKLY_VELOCITY: Record<PriceTier, { min: number; max: number }> = {
  budget:        { min: 8, max: 20 },    // Fast movers — everyday spirits/beer
  mid_range:     { min: 3, max: 8 },     // Moderate — popular whiskies, gins
  premium:       { min: 1, max: 4 },     // Slower — single malts, craft
  ultra_premium: { min: 0.3, max: 1.5 }, // Very slow — prestige bottles
  luxury:        { min: 0.05, max: 0.5 },// Rare — collectors/gifting
};

// Reorder lead time in days (typical SA supplier)
const LEAD_TIME_DAYS = 5;
// Safety stock multiplier
const SAFETY_STOCK_MULTIPLIER = 1.5;

export const getPriceTier = (price: number): PriceTier => {
  if (price < 200) return "budget";
  if (price < 500) return "mid_range";
  if (price < 1000) return "premium";
  if (price < 3000) return "ultra_premium";
  return "luxury";
};

export const getPriceTierInfo = (price: number) => {
  const tier = getPriceTier(price);
  return { tier, ...PRICE_TIERS[tier], velocity: EXPECTED_WEEKLY_VELOCITY[tier] };
};

// ─── Stock Movement Analysis ────────────────────────────────────────
export type MovementStatus = "fast_mover" | "normal" | "slow_mover" | "dead_stock" | "no_data";

export interface StockIntelligence {
  priceTier: PriceTier;
  priceTierLabel: string;
  movementStatus: MovementStatus;
  movementLabel: string;
  weeklyVelocity: number;          // Actual weekly sales rate
  expectedVelocityMin: number;
  expectedVelocityMax: number;
  daysOfSupply: number | null;     // How many days current stock will last
  reorderPoint: number;            // When to reorder
  suggestedReorderQty: number;     // How much to reorder
  stockHealthScore: number;        // 0-100
  clearanceCandidate: boolean;
  clearanceReason: string | null;
  overstocked: boolean;
  understocked: boolean;
  abcClass: "A" | "B" | "C";      // ABC analysis classification
}

export const analyzeProduct = (product: Product): StockIntelligence => {
  const price = product.price || 0;
  const tierInfo = getPriceTierInfo(price);
  const qty = product.stock_quantity ?? 0;
  const sold30d = product.units_sold_30d ?? 0;
  const sold7d = product.units_sold_7d ?? 0;

  // Weekly velocity (prefer 7d if available, else derive from 30d)
  const weeklyVelocity = sold7d > 0 ? sold7d : sold30d > 0 ? (sold30d / 30) * 7 : 0;
  const dailyVelocity = weeklyVelocity / 7;

  // Movement classification vs tier expectations
  let movementStatus: MovementStatus = "no_data";
  let movementLabel = "No Data";

  if (sold30d > 0 || sold7d > 0) {
    if (weeklyVelocity > tierInfo.velocity.max) {
      movementStatus = "fast_mover";
      movementLabel = "Fast Mover";
    } else if (weeklyVelocity >= tierInfo.velocity.min) {
      movementStatus = "normal";
      movementLabel = "Normal";
    } else if (weeklyVelocity >= tierInfo.velocity.min * 0.3) {
      movementStatus = "slow_mover";
      movementLabel = "Slow Mover";
    } else {
      movementStatus = "dead_stock";
      movementLabel = "Dead Stock";
    }
  }

  // Days of supply
  const daysOfSupply = dailyVelocity > 0 ? Math.round(qty / dailyVelocity) : qty > 0 ? 999 : 0;

  // Reorder point = (daily velocity × lead time) + safety stock
  const reorderPoint = Math.max(
    Math.ceil(dailyVelocity * LEAD_TIME_DAYS * SAFETY_STOCK_MULTIPLIER),
    product.reorder_level ?? 5
  );

  // Suggested reorder quantity (Economic Order Quantity simplified)
  const maxStock = product.max_stock_level ?? 50;
  const suggestedReorderQty = Math.max(0, maxStock - qty);

  // Stock health score
  let stockHealthScore = 50;
  if (qty <= 0) stockHealthScore = 0;
  else if (qty < reorderPoint) stockHealthScore = 20;
  else if (qty <= maxStock) stockHealthScore = 80 + Math.round((qty / maxStock) * 20);
  else stockHealthScore = Math.max(30, 100 - ((qty - maxStock) / maxStock) * 50); // Overstocked penalty

  stockHealthScore = Math.min(100, Math.max(0, stockHealthScore));

  // Clearance analysis
  let clearanceCandidate = false;
  let clearanceReason: string | null = null;

  // Dead stock with inventory → clearance
  if (movementStatus === "dead_stock" && qty > 0) {
    clearanceCandidate = true;
    clearanceReason = "No meaningful sales velocity — consider markdowns";
  }
  // Slow mover with high days of supply → clearance
  else if (movementStatus === "slow_mover" && daysOfSupply !== null && daysOfSupply > 90) {
    clearanceCandidate = true;
    clearanceReason = `${daysOfSupply}+ days of supply at current velocity`;
  }
  // Overstocked slow items
  else if (qty > maxStock * 1.5 && movementStatus !== "fast_mover") {
    clearanceCandidate = true;
    clearanceReason = `Overstocked at ${qty} units (max: ${maxStock})`;
  }

  const overstocked = qty > maxStock;
  const understocked = qty > 0 && qty <= reorderPoint;

  // ABC class placeholder (needs revenue data for proper classification)
  // Approximate: fast movers with higher price = A
  const revenueProxy = weeklyVelocity * price;
  let abcClass: "A" | "B" | "C" = "C";
  if (revenueProxy > 2000) abcClass = "A";
  else if (revenueProxy > 500) abcClass = "B";

  return {
    priceTier: tierInfo.tier,
    priceTierLabel: tierInfo.label,
    movementStatus,
    movementLabel,
    weeklyVelocity: Math.round(weeklyVelocity * 10) / 10,
    expectedVelocityMin: tierInfo.velocity.min,
    expectedVelocityMax: tierInfo.velocity.max,
    daysOfSupply,
    reorderPoint,
    suggestedReorderQty,
    stockHealthScore,
    clearanceCandidate,
    clearanceReason,
    overstocked,
    understocked,
    abcClass,
  };
};

// ─── Aggregate Intelligence ─────────────────────────────────────────
export interface InventorySnapshot {
  totalUnits: number;
  totalSKUs: number;
  understockedCount: number;
  overstockedCount: number;
  clearanceCandidates: number;
  deadStockCount: number;
  fastMovers: number;
  avgStockHealth: number;
  abcBreakdown: { A: number; B: number; C: number };
  tierBreakdown: Record<PriceTier, number>;
  movementBreakdown: Record<MovementStatus, number>;
}

export const buildInventorySnapshot = (products: Product[]): InventorySnapshot => {
  const analyses = products.map(p => ({ product: p, intel: analyzeProduct(p) }));

  const totalUnits = products.reduce((s, p) => s + (p.stock_quantity ?? 0), 0);
  const healthScores = analyses.map(a => a.intel.stockHealthScore);
  const avgStockHealth = healthScores.length > 0 ? Math.round(healthScores.reduce((a, b) => a + b, 0) / healthScores.length) : 0;

  const abcBreakdown = { A: 0, B: 0, C: 0 };
  const tierBreakdown: Record<PriceTier, number> = { budget: 0, mid_range: 0, premium: 0, ultra_premium: 0, luxury: 0 };
  const movementBreakdown: Record<MovementStatus, number> = { fast_mover: 0, normal: 0, slow_mover: 0, dead_stock: 0, no_data: 0 };

  let understockedCount = 0, overstockedCount = 0, clearanceCandidates = 0, deadStockCount = 0, fastMovers = 0;

  for (const { intel } of analyses) {
    abcBreakdown[intel.abcClass]++;
    tierBreakdown[intel.priceTier]++;
    movementBreakdown[intel.movementStatus]++;
    if (intel.understocked) understockedCount++;
    if (intel.overstocked) overstockedCount++;
    if (intel.clearanceCandidate) clearanceCandidates++;
    if (intel.movementStatus === "dead_stock") deadStockCount++;
    if (intel.movementStatus === "fast_mover") fastMovers++;
  }

  return {
    totalUnits, totalSKUs: products.length,
    understockedCount, overstockedCount, clearanceCandidates,
    deadStockCount, fastMovers, avgStockHealth,
    abcBreakdown, tierBreakdown, movementBreakdown,
  };
};
