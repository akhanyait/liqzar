/**
 * Editorial — mobile mirror of /src/data/editorial.ts
 *
 * Keep content identical so the story on web and mobile are the same.
 * Source of truth: `/src/data/editorial.ts`. Update both together until
 * a shared package (or Supabase `editorial_articles` table) replaces both.
 */

export interface EditorialArticle {
  slug: string;
  title: string;
  dek: string;
  category: "Heritage" | "Craft" | "Pairings" | "Collecting" | "Occasion";
  readMinutes: number;
  heroImage: string;
  publishedAt: string;
  author: {
    name: string;
    role: string;
  };
  body: string[];
  pullQuote?: string;
  relatedSearchTerm?: string;
  relatedSearchLabel?: string;
  tags: string[];
}

export const EDITORIAL_ARTICLES: EditorialArticle[] = [
  {
    slug: "cape-of-good-drams",
    title: "Cape of Good Drams",
    dek: "How South Africa quietly became a world-class whisky nation — from Three Ships to Bain's, and the Cape distilleries writing the next chapter.",
    category: "Heritage",
    readMinutes: 6,
    heroImage:
      "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=1600&h=900&fit=crop",
    publishedAt: "2026-04-12",
    author: { name: "Lerato Mokoena", role: "Senior Spirits Writer" },
    pullQuote:
      "A Cape single grain walked into the Icons of Whisky awards and walked out with the trophy. Twice.",
    body: [
      "For decades, South African whisky was a footnote. Then James Sedgwick Distillery, tucked away in Wellington, started quietly winning in Glasgow. Bain's Cape Mountain Whisky — a single grain built on yellow maize — took 'World's Best Grain Whisky' at the World Whiskies Awards. Not once. Twice.",
      "The story behind Three Ships is just as unlikely. Master distiller Andy Watts, a Yorkshireman turned Capetonian, started blending in 1977 with a vision most of the industry thought was a joke — that African terroir could produce expressions that held their own against Speyside and Islay. Forty-five years later, his 10-Year-Old Single Malt sits on shelves in Tokyo and Stockholm.",
      "Today there are more craft distilleries in the Cape than in Ireland. The new generation — Drayman's, Deep South, Hope on Hopkins — is playing with honeybush-cask finishes, fynbos-forward grain bills, and expressions that couldn't exist anywhere else. Proudly local isn't a slogan anymore. It's a category.",
    ],
    relatedSearchTerm: "Bain's",
    relatedSearchLabel: "Shop Proudly South African",
    tags: ["South Africa", "Whisky", "Heritage"],
  },
  {
    slug: "the-art-of-the-pour",
    title: "The Art of the Pour",
    dek: "A glass is not a glass. The shape of your vessel shapes the whisky — literally. A master blender's guide to what to pour into what.",
    category: "Craft",
    readMinutes: 4,
    heroImage:
      "https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=1600&h=900&fit=crop",
    publishedAt: "2026-04-08",
    author: { name: "Thandiwe Nkosi", role: "Sommelier" },
    pullQuote:
      "The Glencairn isn't a snob's prop. It's a focusing lens for your nose.",
    body: [
      "Here is something most people don't know: the tumbler was invented for ice. For whisky proper — neat, or with a whisper of water — it is almost the worst possible glass. The open rim dissipates the aromatics you paid for before they reach your nose.",
      "The Glencairn, with its tulip bulb and narrow rim, concentrates the volatiles. You will smell things in a Macallan 18 from a Glencairn you cannot find in a tumbler. This is not marketing. It is fluid dynamics.",
      "For cognac, the snifter's exaggerated bowl is now considered too aggressive — it traps heat and ethanol, which numbs rather than reveals. The modern move is a smaller tulip, warmed only by the hand. For aged rum, the same.",
      "Champagne is the one most people get wrong. The flute was designed to preserve bubbles, not flavour. A white wine glass lets a vintage Krug or a Dom breathe, and you taste the brioche and the patisserie. If you are spending R3,500 on a bottle, drink it from the right glass.",
    ],
    tags: ["Craft", "Technique"],
  },
  {
    slug: "pairings-for-the-boma",
    title: "Pairings for the Boma",
    dek: "It's a South African tradition to end the evening around the fire. Here are five premium spirits built for smoke, for stars, and for slow conversation.",
    category: "Pairings",
    readMinutes: 5,
    heroImage:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1600&h=900&fit=crop",
    publishedAt: "2026-04-05",
    author: { name: "Sipho Dlamini", role: "Brand Ambassador" },
    body: [
      "The boma — that circle of chairs under open sky, fire in the middle — is where South Africa actually talks. Not the dinner table. Not the boardroom. The boma. What you drink here should match the register: unhurried, warming, worth sitting with.",
      "Our five picks: a peated Islay like Lagavulin 16 — the smoke meets the wood smoke and both deepen. A Van Ryn's 15-Year Cape Brandy — spicy, layered, and proudly local. A Bourbon for after the food — Woodford Reserve, with its orange peel and honey. A Japanese like Hibiki Harmony — for the second wind, when the conversation turns quiet. And to finish, an Amarula over one hand-cut cube — the last drink, the one that ends the night.",
      "Do not serve these with plastic cups. Do not pour them too full. The boma is a place of ceremony without formality — respect it, and it respects you back.",
    ],
    relatedSearchTerm: "Lagavulin",
    relatedSearchLabel: "Build the Boma Selection",
    tags: ["Occasion", "South Africa"],
  },
  {
    slug: "the-quiet-collectors",
    title: "The Quiet Collectors",
    dek: "Why cellar whisky is the new cellar wine — and how to start a collection that's pleasurable now and valuable later, without ending up with a shelf of bottles you'll never open.",
    category: "Collecting",
    readMinutes: 7,
    heroImage:
      "https://images.unsplash.com/photo-1527281400683-1aae777175f8?w=1600&h=900&fit=crop",
    publishedAt: "2026-04-01",
    author: { name: "James van Wyk", role: "Contributing Editor" },
    pullQuote:
      "The Macallan 18 you bought for R4,000 in 2018 is R14,000 today. Still drinkable. More valuable. That's the rare intersection.",
    body: [
      "The first rule of a whisky collection, from every collector we interviewed: buy to drink. Speculating on bottles you do not actually like is the surest way to end up with expensive regret.",
      "The second rule: buy the distillery's core range before the limited editions. A well-cellared 18-Year-Old core expression is always appreciating. Limited editions are volatile, and half of them lose steam within a year.",
      "The third, and most underrated: keep the box, keep the receipt, keep the provenance. The resale market pays for documentation. A bottle without a box is worth 20-40% less. A bottle without a receipt can be questioned.",
      "Start with three: one Speyside (Macallan 18, Glenfiddich 21), one Islay (Lagavulin 16, Ardbeg Uigeadail), one Japanese (Hibiki 17, Yamazaki 12 if you can find it). Drink a glass a year from each. Refill the collection on your birthday. In ten years you have something real.",
    ],
    relatedSearchTerm: "Macallan",
    relatedSearchLabel: "Begin Your Cellar",
    tags: ["Collecting", "Investment"],
  },
  {
    slug: "the-midnight-champagne-rule",
    title: "The Midnight Champagne Rule",
    dek: "Every good night has one bottle that changes its direction. A field guide to when to uncork — and what to uncork — for the moment the evening tilts.",
    category: "Occasion",
    readMinutes: 4,
    heroImage:
      "https://images.unsplash.com/photo-1594372365401-44f01f5aae65?w=1600&h=900&fit=crop",
    publishedAt: "2026-03-28",
    author: { name: "Zanele Moyo", role: "Features Editor" },
    body: [
      "There is a rule — unwritten, passed down — that champagne should never be opened before dinner and never after midnight. Dinner-before is too early: the acidity cuts through what you are about to eat. Midnight-after is too late: the palate is tired, and the bubbles turn thin.",
      "The right window is the hour between dinner and whatever comes next. That moment when the table is cleared, the lights go softer, and the evening has not yet decided what it wants to be. That is the champagne window.",
      "Our picks: Moët Impérial for a crowd who appreciates but does not obsess. Dom Pérignon 2013 when the night matters. Krug Grande Cuvée for the three people who will remember it forever. And — if you are serving six and the occasion is quietly big — a magnum of Bollinger La Grande Année. Nothing raises a room like a magnum.",
      "Serve cold, not frozen. Serve in white wine glasses, not flutes. Pour for others first. And never, ever, pop the cork. A gentle twist, a quiet hiss. The bottle has waited a decade to get here — let it exhale.",
    ],
    relatedSearchTerm: "Moët",
    relatedSearchLabel: "Shop Champagne",
    tags: ["Champagne", "Occasion"],
  },
];

export const getEditorialBySlug = (slug: string): EditorialArticle | undefined =>
  EDITORIAL_ARTICLES.find((a) => a.slug === slug);

export const getRelatedEditorial = (
  currentSlug: string,
  limit = 3,
): EditorialArticle[] =>
  EDITORIAL_ARTICLES.filter((a) => a.slug !== currentSlug).slice(0, limit);
