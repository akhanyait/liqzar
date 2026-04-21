import type { Product } from "@/data/products";

const CATEGORY_PALETTE: Record<string, readonly [string, string, string]> = {
  "Whisky - Blended Scotch":    ["#7B3F00", "#C8860A", "#F5D060"],
  "Whisky - Single Malt Scotch":["#6B3000", "#B8680A", "#FFD700"],
  "Whisky - Bourbon & American":["#9A3A10", "#D06020", "#F5E050"],
  "Whisky - Japanese & World":  ["#704820", "#C08030", "#FFE890"],
  "Whisky - Irish":             ["#1E5A32", "#2E8B57", "#90D8A0"],
  "Cognac & Brandy":            ["#4A1878", "#8040C0", "#C890FF"],
  "Vodka":                      ["#101028", "#2838A0", "#A0B8E0"],
  "Gin":                        ["#0A3A20", "#1E7A48", "#80E8A0"],
  "Tequila & Mezcal":           ["#3A4010", "#708020", "#D8E060"],
  "Rum":                        ["#680000", "#B01818", "#FF8080"],
  "Beer - Premium":             ["#1C1200", "#503808", "#C89020"],
  "Champagne & Sparkling":      ["#580018", "#900830", "#FFD050"],
  "Wine - Premium":             ["#380018", "#600828", "#E0A0B0"],
  "Liqueurs & Cream":           ["#003838", "#006868", "#60D8D8"],
  "Premium Non-Alcoholic":      ["#0A2850", "#1848A8", "#80C0F8"],
  "Ready-to-Drink (RTD)":       ["#2A1858", "#5840A8", "#B8A8F0"],
  "Ciders & Flavoured Alcoholic Beverages": ["#502000", "#A84000", "#FFB850"],
};

export const buildPlaceholderImageUrl = (
  name: string,
  category?: string | null,
): string => {
  const [darkC, midC, lightC] =
    CATEGORY_PALETTE[category ?? ""] ?? ["#1a1a2e", "#3040a0", "#90a8d0"];

  const esc = (s: string) =>
    s.replace(/&/g, "and").replace(/</g, "").replace(/>/g, "").replace(/"/g, "");

  const rawName = name || "Product";
  const line1 = esc(rawName.substring(0, 16));
  const line2 = rawName.length > 16 ? esc(rawName.substring(16, 30)) : null;
  const catShort = esc(
    (category ?? "").split(" - ").pop()?.substring(0, 15) ?? "",
  );

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 600' width='240' height='600'>
  <defs>
    <linearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'>
      <stop offset='0%25' stop-color='%230d0d1a'/>
      <stop offset='100%25' stop-color='%231a1828'/>
    </linearGradient>
    <linearGradient id='body' x1='0%25' y1='0%25' x2='100%25' y2='0%25'>
      <stop offset='0%25'   stop-color='${darkC}' stop-opacity='0.55'/>
      <stop offset='20%25'  stop-color='${darkC}'/>
      <stop offset='55%25'  stop-color='${midC}'/>
      <stop offset='80%25'  stop-color='${darkC}' stop-opacity='0.85'/>
      <stop offset='100%25' stop-color='%23000'   stop-opacity='0.75'/>
    </linearGradient>
    <linearGradient id='neck' x1='0%25' y1='0%25' x2='100%25' y2='0%25'>
      <stop offset='0%25'   stop-color='${darkC}' stop-opacity='0.7'/>
      <stop offset='50%25'  stop-color='${midC}'/>
      <stop offset='100%25' stop-color='%23000'   stop-opacity='0.6'/>
    </linearGradient>
    <linearGradient id='cap' x1='0%25' y1='0%25' x2='100%25' y2='0%25'>
      <stop offset='0%25'   stop-color='%23777'/>
      <stop offset='30%25'  stop-color='%23e0e0e0'/>
      <stop offset='70%25'  stop-color='%23a0a0a0'/>
      <stop offset='100%25' stop-color='%23444'/>
    </linearGradient>
    <linearGradient id='lbl' x1='0%25' y1='0%25' x2='0%25' y2='100%25'>
      <stop offset='0%25'   stop-color='${lightC}' stop-opacity='0.97'/>
      <stop offset='100%25' stop-color='${midC}'   stop-opacity='0.88'/>
    </linearGradient>
    <linearGradient id='shine' x1='0%25' y1='0%25' x2='100%25' y2='0%25'>
      <stop offset='0%25'   stop-color='%23fff' stop-opacity='0'/>
      <stop offset='25%25'  stop-color='%23fff' stop-opacity='0.22'/>
      <stop offset='55%25'  stop-color='%23fff' stop-opacity='0.07'/>
      <stop offset='100%25' stop-color='%23fff' stop-opacity='0'/>
    </linearGradient>
  </defs>
  <rect width='240' height='600' fill='url(%23bg)' rx='14'/>
  <ellipse cx='121' cy='572' rx='50' ry='11' fill='%23000' opacity='0.22'/>
  <path d='M88,180 L80,214 Q66,240 64,278 L64,512 Q64,544 100,548 L140,548 Q176,544 176,512 L176,278 Q174,240 160,214 L152,180 Z' fill='url(%23body)'/>
  <ellipse cx='120' cy='544' rx='38' ry='6.5' fill='${darkC}' opacity='0.95'/>
  <ellipse cx='120' cy='541' rx='32' ry='4.5' fill='${midC}'  opacity='0.55'/>
  <rect x='100' y='108' width='40' height='76' rx='9' fill='url(%23neck)'/>
  <path d='M88,180 Q102,168 120,166 Q138,168 152,180' fill='none' stroke='${midC}' stroke-width='2' opacity='0.4'/>
  <rect x='100' y='172' width='40' height='16' rx='4' fill='${midC}' opacity='0.6'/>
  <rect x='100' y='106' width='40' height='28' rx='5' fill='${lightC}' opacity='0.75'/>
  <rect x='104' y='76'  width='32' height='36' rx='7' fill='url(%23cap)'/>
  <rect x='106' y='68'  width='28' height='14' rx='4' fill='%23c8c8c8'/>
  <rect x='109' y='64'  width='22' height='9'  rx='3' fill='%23aaaaaa'/>
  <rect x='73' y='288' width='94' height='150' rx='9' fill='url(%23lbl)'/>
  <rect x='75' y='290' width='90' height='146' rx='8' fill='none' stroke='${darkC}' stroke-width='1.8' opacity='0.5'/>
  <line x1='81' y1='308' x2='159' y2='308' stroke='${darkC}' stroke-width='0.8' opacity='0.35'/>
  <line x1='81' y1='404' x2='159' y2='404' stroke='${darkC}' stroke-width='0.8' opacity='0.35'/>
  <text x='120' y='327' text-anchor='middle' font-family='Georgia,serif' font-size='11' font-weight='bold' letter-spacing='3' fill='${darkC}' opacity='0.88'>LIQZAR</text>
  <polygon points='120,336 124.5,340 120,344 115.5,340' fill='${darkC}' opacity='0.4'/>
  <text x='120' y='360' text-anchor='middle' font-family='Georgia,serif' font-size='10' font-weight='bold' fill='${darkC}'>${line1}</text>
  ${line2 ? `<text x='120' y='373' text-anchor='middle' font-family='Georgia,serif' font-size='10' font-weight='bold' fill='${darkC}'>${line2}</text>` : ""}
  <text x='120' y='${line2 ? "390" : "380"}' text-anchor='middle' font-family='Arial,sans-serif' font-size='8.5' letter-spacing='0.5' fill='${darkC}' opacity='0.7'>${catShort}</text>
  <text x='120' y='418' text-anchor='middle' font-family='Arial,sans-serif' font-size='8.5' fill='${darkC}' opacity='0.6'>750ml</text>
  <path d='M88,180 L80,214 Q66,240 64,278 L64,512 Q64,544 100,548 L104,548 Q70,544 70,512 L70,278 Q72,240 86,214 L94,180 Z' fill='url(%23shine)'/>
  <rect x='100' y='108' width='11' height='76' rx='5' fill='url(%23shine)' opacity='0.75'/>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const getAvailableRetailerPrices = (product: Partial<Product>) => {
  const priceMap = [
    { retailer: "Checkers", price: product.checkers_price },
    { retailer: "Pick n Pay", price: product.pnp_price },
    { retailer: "TOPS", price: product.tops_price },
    { retailer: "Woolworths", price: product.woolworths_price },
    { retailer: "Norman Goodfellows", price: product.norman_price },
    { retailer: "Makro", price: product.makro_price },
  ].filter(
    (entry): entry is { retailer: string; price: number } =>
      typeof entry.price === "number" && entry.price > 0,
  );

  return priceMap.sort((a, b) => a.price - b.price);
};

const DEFAULT_MARKUP = 1.25;

export const getComputedBasePrice = (
  product: Partial<Product>,
  globalMarkup?: number,
): number => {
  const markup = product.markup_pct
    ? 1 + product.markup_pct / 100
    : (globalMarkup ?? DEFAULT_MARKUP);
  const prices = getAvailableRetailerPrices(product).map(
    (entry) => entry.price,
  );
  if (prices.length > 0)
    return Math.round(Math.min(...prices) * markup * 100) / 100;
  return typeof product.price === "number" && product.price > 0
    ? product.price
    : 0;
};

export const getComputedCheapestRetailer = (
  product: Partial<Product>,
): string | null => {
  const [first] = getAvailableRetailerPrices(product);
  return first?.retailer || product.cheapest_retailer || null;
};

export const buildFallbackDescription = (product: Partial<Product>): string => {
  const pieces = [
    product.category,
    product.bottle_size,
    product.country,
  ].filter(Boolean);
  const details = pieces.length > 0 ? ` ${pieces.join(" · ")}.` : "";
  return `${product.name || "This product"} is part of the LIQZAR premium collection.${details} Price comparison is available across major South African retailers to help you position the best offer.`;
};

export const getPriceComparisonSummary = (
  product: Partial<Product>,
): string => {
  const available = getAvailableRetailerPrices(product);
  if (available.length === 0) {
    const fallbackPrice =
      typeof product.price === "number" ? product.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2}) : "0.00";
    return `LIQZAR reference price: R ${fallbackPrice}`;
  }

  const cheapest = available[0];
  const comparison = available
    .slice(0, 3)
    .map((entry) => `${entry.retailer}: R ${entry.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`)
    .join(" · ");

  return `Best market price ${cheapest.retailer}: R ${cheapest.price.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}${comparison ? ` · ${comparison}` : ""}`;
};

export const hasValidImage = (url?: string | null): boolean => {
  if (!url) return false;
  if (url.includes("placehold")) return false;
  if (url.includes("gettyimages.com")) return false;
  if (url.includes("country_default")) return false;
  if (url.includes("Cotton-Briefs") || url.includes("StayNew-COOLTECH"))
    return false;
  return true;
};

export const normalizeProduct = <T extends Partial<Product>>(product: T): T => {
  const rawImageUrl = product.image_url || product.image || null;
  return {
    ...product,
    price: getComputedBasePrice(product),
    cheapest_retailer: getComputedCheapestRetailer(product),
    image_url: hasValidImage(rawImageUrl)
      ? rawImageUrl
      : buildPlaceholderImageUrl(product.name || "Product", product.category),
    description: product.description || buildFallbackDescription(product),
  } as T;
};
