import { useEffect, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Clock,
  Truck,
  Gift,
  TrendingUp,
  Star,
  Sparkles,
  Award,
  ShieldCheck,
  Wine,
  Sun,
  Moon,
  CloudSun,
  Mic,
} from "lucide-react";
import ProductCard from "@/components/ProductCard";
import HappyHourDeals from "@/components/HappyHourDeals";
import TrendingNow from "@/components/TrendingNow";
import LookingForInspiration from "@/components/LookingForInspiration";
import ShopByBrand from "@/components/ShopByBrand";
import ShopByCountry from "@/components/ShopByCountry";
import EditorialTeaser from "@/components/EditorialTeaser";
import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/AuthContext";

// Native mobile components
import QuickReorderWidget from "@/components/native/QuickReorderWidget";
import PullToRefresh from "@/components/native/PullToRefresh";
import ShakeToDiscover from "@/components/native/ShakeToDiscover";
import VoiceSearch from "@/components/native/VoiceSearch";
import { isNativeApp, useHaptics } from "@/hooks/useNativeFeatures";
import { toast } from "@/hooks/use-toast";

/* ── Hero slides — celebrating South Africa's connoisseurs ──
   Image URLs are Unsplash photo IDs known to resolve; each <img> below also
   has an onError fallback to the whisky hero so the slider never shows a
   broken image if Unsplash changes anything. */
/* Fallback is a neutral amber-whisky editorial shot with no identifiable
   brand labels — used only until each slide's real curated image is on disk.
   Keeps the hero brand-safe in all states (no competitor logos, no people). */
const HERO_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1582053433976-25c00369fc93?w=1400&h=900&fit=crop";

const heroSlides = [
  {
    title: "The Pour That",
    highlight: "Earned Its Place.",
    subtitle:
      "For the executives who closed the deal, signed the term sheet, made the call. Premium spirits, in 2–4 hours, to the address that matters.",
    cta: "Enter The Vault",
    link: "/catalogue?sort=trending",
    image: "/hero/hero-lounge-executive.jpg",
  },
  {
    title: "Africa Built This.",
    highlight: "Africa Toasts To It.",
    subtitle:
      "The builders, the visionaries, the rainmakers — gathered around the table that changes everything. LIQZAR delivers the dram worthy of the room.",
    cta: "Honour The Moment",
    link: "/catalogue",
    image: "/hero/hero-dining-toast.jpg",
  },
  {
    title: "Sandton Skyline,",
    highlight: "Glass In Hand.",
    subtitle:
      "Sunset over the city you helped build. The terrace is yours. The bottle is on its way — premium delivery in 2–4 hours across Joburg.",
    cta: "Shop The Sunset Collection",
    link: "/catalogue?sort=trending",
    image: "/hero/hero-rooftop-sunset.jpg",
  },
  {
    title: "One Boardroom.",
    highlight: "One Unforgettable Toast.",
    subtitle:
      "When the deal is done, the pour matters. Curated whisky, champagne, and rare spirits — delivered with discretion to where the toast belongs.",
    cta: "Be Part Of The Few",
    link: "/catalogue",
    image: "/hero/hero-boardroom-toast.jpg",
  },
];

/* ── Featured category tiles (top 6 with images) ── */
const featuredCategories = categories.slice(0, 6);

/* ── Animations ── */
const staggerContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};
const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" as const },
  },
};

/* ── Product Grid Section ── */
function ProductGrid({
  title,
  products,
  isLoading,
}: {
  title: string;
  products: any[];
  isLoading: boolean;
}) {
  return (
    <section className="container px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground section-title-accent">
            {title}
          </h2>
        </div>
        <Link
          to="/catalogue"
          className="text-sm font-semibold text-primary flex items-center gap-1.5 hover:gap-2.5 transition-all duration-200 bg-primary/8 px-3 py-1.5 rounded-full hover:bg-primary/15"
        >
          View all <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : (
        <motion.div
          className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4"
          variants={staggerContainer}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-50px" }}
        >
          {products.slice(0, 10).map((p, i) => (
            <motion.div key={p.id} variants={staggerItem}>
              <ProductCard product={p} index={i} />
            </motion.div>
          ))}
        </motion.div>
      )}
    </section>
  );
}

/* ── Main Page ── */
/* ── Personalised suggestions based on time of day ── */
function getGreetingData() {
  const h = new Date().getHours();
  if (h < 12)
    return {
      text: "Good morning",
      icon: Sun,
      suggestion: "Start your day with a fine coffee or tea",
    };
  if (h < 17)
    return {
      text: "Good afternoon",
      icon: CloudSun,
      suggestion: "Perfect time for a refreshing drink",
    };
  return {
    text: "Good evening",
    icon: Moon,
    suggestion: "Unwind with something special tonight",
  };
}

const timeSuggestions = [
  { icon: Wine, label: "Whisky", link: "/category/whisky" },
  { icon: Gift, label: "Gifts", link: "/category/gifts" },
  { icon: Sparkles, label: "New", link: "/catalogue?sort=newest" },
  { icon: TrendingUp, label: "Trending", link: "/catalogue?sort=trending" },
];

export default function Index() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { impact } = useHaptics();

  // Fetch products - combine featured and best sellers for single "For You" section
  const { data: forYouProducts = [], isLoading: loadingForYou } = useProducts({
    featured: true,
    limit: 10,
  });
  const { data: trending = [], isLoading: loadingTrending } = useProducts({
    trending: true,
    limit: 10,
  });
  const { data: fallbackProducts = [], isLoading: loadingFallback } =
    useProducts({ limit: 10 });

  const [heroIdx, setHeroIdx] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);

  // All products for shake to discover
  const allProducts = [...forYouProducts, ...trending, ...fallbackProducts];

  // Mock recent orders for quick reorder
  const recentOrders = [
    {
      id: "1",
      name: "Johnnie Walker Black",
      price: 549,
      lastOrdered: "2 days ago",
      quantity: 1,
    },
    {
      id: "2",
      name: "Glenfiddich 12yr",
      price: 699,
      lastOrdered: "1 week ago",
      quantity: 1,
    },
    {
      id: "3",
      name: "Hendrick's Gin",
      price: 499,
      lastOrdered: "2 weeks ago",
      quantity: 2,
    },
  ];

  const greetingData = getGreetingData();

  const nextHero = useCallback(
    () => setHeroIdx((i) => (i + 1) % heroSlides.length),
    [],
  );
  const prevHero = useCallback(
    () =>
      setHeroIdx((i) => (i - 1 + heroSlides.length) % heroSlides.length),
    [],
  );

  useEffect(() => {
    const t = setInterval(nextHero, 5000);
    return () => clearInterval(t);
  }, [nextHero]);

  const slide = heroSlides[heroIdx];

  const displayTrending = trending.length > 0 ? trending : fallbackProducts;
  const displayForYou =
    forYouProducts.length > 0 ? forYouProducts : fallbackProducts;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setIsRefreshing(false);
    toast({ title: "Refreshed!", description: "Content updated" });
  };

  const handleVoiceSearchResult = (text: string) => {
    impact("light");
    navigate(`/search?q=${encodeURIComponent(text)}`);
    setShowVoiceSearch(false);
  };

  const isMobile =
    isNativeApp() || (typeof window !== "undefined" && window.innerWidth < 768);
  const GreetingIcon = greetingData.icon;

  return (
    <PullToRefresh
      onRefresh={handleRefresh}
      className="pb-28 overflow-x-hidden max-w-full"
    >
      {/* ── Voice Search Modal ── */}
      <VoiceSearch
        isOpen={showVoiceSearch}
        onClose={() => setShowVoiceSearch(false)}
        onResult={handleVoiceSearchResult}
      />

      {/* ── Shake to Discover (Native Feature) ── */}
      {isMobile && allProducts.length > 0 && (
        <ShakeToDiscover products={allProducts} />
      )}

      {/* ── Greeting Section ── */}
      <section className="bg-gradient-to-r from-primary/10 via-accent/5 to-transparent">
        <div className="container px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
              <GreetingIcon className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-foreground">
                {greetingData.text}
                {user?.phone ? `, ${user.phone}` : ""}
              </h1>
              <p className="text-xs text-muted-foreground">
                {greetingData.suggestion}
              </p>
            </div>
            {/* Voice Search Button */}
            <button
              onClick={() => {
                impact("light");
                setShowVoiceSearch(true);
              }}
              className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
              aria-label="Voice search"
            >
              <Mic className="w-5 h-5 text-primary" />
            </button>
          </div>

          {/* Quick Category Pills */}
          <div className="flex gap-2 mt-3 overflow-x-auto scrollbar-none pb-1">
            {timeSuggestions.map((s) => (
              <Link
                key={s.label}
                to={s.link}
                onClick={() => impact("light")}
                className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border/50 text-xs font-medium text-foreground hover:border-primary/40 hover:bg-primary/5 transition-colors"
              >
                <s.icon className="w-3.5 h-3.5 text-primary" />
                {s.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust Strip ── */}
      <div className="bg-foreground" style={{ color: "hsl(var(--header-fg))" }}>
        <div
          className="px-4 flex items-center justify-center gap-6 md:gap-10 py-2 text-[11px] md:text-xs font-medium overflow-x-auto scrollbar-none whitespace-nowrap"
          style={{ color: "hsl(var(--header-fg))" }}
        >
          <span className="flex items-center gap-1.5 opacity-90">
            <Award className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} />{" "}
            Retailer of the Year
          </span>
          <span className="hidden sm:flex items-center gap-1.5 opacity-90">
            <Truck className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} /> Free
            delivery over R150
          </span>
          <span className="flex items-center gap-1.5 opacity-90">
            <Star className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} /> 4.8/5
            · 2,500+ reviews
          </span>
          <span className="hidden md:flex items-center gap-1.5 opacity-90">
            <ShieldCheck className="w-3.5 h-3.5" style={{ color: "#D4AF37" }} />{" "}
            100% Authentic
          </span>
        </div>
      </div>

      {/* ── Editorial Hero — cinematic, oversized display, Ken Burns zoom ── */}
      <section className="editorial-vignette relative h-[68vh] md:h-[78vh] min-h-[520px] max-h-[820px] overflow-hidden bg-[hsl(222_30%_6%)]">
        <AnimatePresence mode="wait">
          <motion.img
            key={heroIdx}
            src={slide.image}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 w-full h-full object-cover ken-burns"
            onError={(e) => {
              const img = e.currentTarget as HTMLImageElement;
              if (img.dataset.fallback !== "1") {
                img.dataset.fallback = "1";
                img.src = HERO_FALLBACK_IMAGE;
              }
            }}
          />
        </AnimatePresence>

        {/* Editorial gradient — left-to-right + deep bottom fade */}
        <div className="absolute inset-0 bg-gradient-to-r from-[hsl(222_30%_5%/0.85)] via-[hsl(222_30%_5%/0.45)] to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-[hsl(222_30%_5%/0.9)] via-transparent to-transparent" />

        {/* Gold top hairline */}
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />

        <div className="relative container h-full flex flex-col justify-end md:justify-center pb-14 md:pb-0 px-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={heroIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="max-w-3xl"
            >
              {/* Eyebrow kicker */}
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className="font-display text-[11px] md:text-xs font-semibold tracking-[0.3em] uppercase text-[#D4AF37] mb-4 md:mb-5"
              >
                <span className="inline-block w-8 h-px bg-[#D4AF37] mr-3 align-middle" />
                The LIQZAR Collection
              </motion.p>

              {/* Oversized editorial display */}
              <h1 className="font-display font-bold text-white leading-[0.95] tracking-tight mb-4 md:mb-6">
                <motion.span
                  key={`t-${heroIdx}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
                  className="block text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem]"
                >
                  {slide.title}
                </motion.span>
                <motion.span
                  key={`h-${heroIdx}`}
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
                  className="block text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] italic font-display"
                  style={{
                    background:
                      "linear-gradient(135deg, #F5E6A3 0%, #D4AF37 45%, #B8962E 100%)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  {slide.highlight}
                </motion.span>
              </h1>

              <motion.p
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.5 }}
                className="text-white/80 text-sm md:text-base max-w-xl mb-6 md:mb-8 leading-relaxed"
              >
                {slide.subtitle}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="flex items-center gap-3"
              >
                <Link
                  to={slide.link}
                  onClick={() => impact("medium")}
                  className="cta-gold inline-flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-sm md:text-base"
                >
                  {slide.cta} <ArrowRight className="w-4 h-4 md:w-4.5 md:h-4.5" />
                </Link>
                <Link
                  to="/editorial"
                  className="hidden sm:inline-flex items-center gap-1.5 px-5 py-3.5 rounded-full text-sm font-medium text-white/90 hover:text-white border border-white/20 hover:border-white/40 backdrop-blur-sm transition-colors"
                >
                  Our story
                </Link>
              </motion.div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation arrows — premium ghost buttons, keyboard + a11y friendly */}
          <button
            type="button"
            onClick={() => {
              impact("light");
              prevHero();
            }}
            aria-label="Previous slide"
            className="hidden sm:flex absolute left-4 md:left-8 top-1/2 -translate-y-1/2 z-10 w-11 h-11 md:w-12 md:h-12 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-sm text-white/90 hover:text-[#D4AF37] hover:border-[#D4AF37]/60 hover:bg-black/40 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/80"
          >
            <ChevronLeft className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={2} />
          </button>
          <button
            type="button"
            onClick={() => {
              impact("light");
              nextHero();
            }}
            aria-label="Next slide"
            className="hidden sm:flex absolute right-4 md:right-8 top-1/2 -translate-y-1/2 z-10 w-11 h-11 md:w-12 md:h-12 items-center justify-center rounded-full border border-white/20 bg-black/25 backdrop-blur-sm text-white/90 hover:text-[#D4AF37] hover:border-[#D4AF37]/60 hover:bg-black/40 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D4AF37]/80"
          >
            <ChevronRight className="w-5 h-5 md:w-5.5 md:h-5.5" strokeWidth={2} />
          </button>

          {/* Slide indicators — refined gold rule */}
          <div className="absolute bottom-6 md:bottom-10 left-5 md:left-auto md:right-10 flex items-center gap-3">
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-white/60">
              {String(heroIdx + 1).padStart(2, "0")}
              <span className="mx-2 text-white/30">/</span>
              {String(heroSlides.length).padStart(2, "0")}
            </span>
            <div className="flex gap-1.5">
              {heroSlides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    impact("light");
                    setHeroIdx(i);
                  }}
                  aria-label={`Go to slide ${i + 1}`}
                  className={`h-0.5 rounded-full transition-all duration-500 ${
                    i === heroIdx ? "w-10 bg-[#D4AF37]" : "w-5 bg-white/25 hover:bg-white/45"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Delivery Strip ── */}
      <section className="container px-4 -mt-6 relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              icon: Clock,
              label: "Same-Day Delivery",
              sub: "Within 20km · 2-4 hours",
            },
            { icon: Truck, label: "Complimentary Delivery", sub: "On orders over R1,500" },
            {
              icon: Gift,
              label: "Gift Wrapping",
              sub: "Premium packaging available",
            },
            {
              icon: ShieldCheck,
              label: "Secure Checkout",
              sub: "256-bit SSL encryption",
            },
          ].map(({ icon: Icon, label, sub }) => (
            <div
              key={label}
              className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 warm-shadow"
            >
              <div className="w-9 h-9 rounded-lg warm-gradient flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {label}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {sub}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Category Tiles (TWE/MoM style) ── */}
      <section className="container px-4 mt-10">
        <div className="flex items-center justify-center mb-6">
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground section-title-accent">
            Shop by Category
          </h2>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {featuredCategories.map((cat, i) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Link
                to={`/category/${cat.id}`}
                className="group relative block aspect-[4/5] rounded-2xl overflow-hidden"
              >
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget as HTMLImageElement;
                    if (img.dataset.fallback !== "1") {
                      img.dataset.fallback = "1";
                      img.src = HERO_FALLBACK_IMAGE;
                    }
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-foreground/70 via-foreground/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-sm font-bold text-primary-foreground leading-tight">
                    {cat.name}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        {/* More categories row */}
        <div className="flex flex-wrap justify-center gap-2 mt-4">
          {categories.slice(6).map((cat) => (
            <Link
              key={cat.id}
              to={`/category/${cat.id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-secondary text-xs font-medium text-foreground hover:bg-primary hover:text-primary-foreground transition-all border border-border/50"
            >
              <span>{cat.icon}</span>
              {cat.name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Trending Now (TWE-inspired circular images) ── */}
      <TrendingNow
        products={displayTrending}
        isLoading={loadingTrending && loadingFallback}
      />

      {/* ── Premium Whisky Promo — full-width editorial banner ── */}
      <section className="container px-4 mt-12">
        <Link to="/catalogue?category=whisky" className="block group">
          <div className="relative aspect-[16/9] md:aspect-[3/1] rounded-3xl overflow-hidden shadow-2xl">
            <img
              src="/hero/promo-premium.jpg"
              alt="The rare single malt collection — curated premium whisky"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/55 to-black/20" />
            <div className="absolute inset-0 flex flex-col justify-center p-6 md:p-12 max-w-2xl">
              <span className="text-[10px] md:text-xs uppercase tracking-[3px] text-[#D4AF37] mb-2 md:mb-3">
                Featured · Allocated Release
              </span>
              <h3 className="font-display text-2xl md:text-4xl lg:text-5xl text-white mb-2 md:mb-3 leading-tight">
                The Rare Single Malt Collection
              </h3>
              <p className="hidden md:block text-white/80 mb-6 max-w-md text-sm md:text-base leading-relaxed">
                Hand-selected from Speyside, Islay, and the Highland masters. Limited bottles. Allocated to the few who know the difference.
              </p>
              <span
                className="inline-flex w-fit items-center gap-2 px-5 md:px-6 py-2.5 md:py-3 rounded-xl text-sm font-semibold border-0 mt-2"
                style={{
                  background: "linear-gradient(135deg, #D4AF37, #B8962E, #D4AF37)",
                  color: "#0d0b08",
                  boxShadow: "0 4px 20px rgba(212,175,55,0.35)",
                }}
              >
                Explore The Collection
                <ArrowRight className="w-4 h-4" />
              </span>
            </div>
          </div>
        </Link>
      </section>

      {/* ── Shop by Country — proudly local + global diversity ── */}
      <ShopByCountry />

      {/* ── Editorial Teaser — story-led content for premium buyers ── */}
      <EditorialTeaser />

      {/* ── Happy Hour Deals ── */}
      <HappyHourDeals />

      {/* ── Atmospheric whisky banner — editorial mood break ── */}
      <section className="container px-4 mt-12">
        <div className="relative aspect-[16/9] md:aspect-[21/7] rounded-3xl overflow-hidden shadow-2xl">
          <img
            src="/hero/bottle-atmospheric.jpg"
            alt="Premium whisky decanter and tumbler"
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-black/80 via-black/30 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-center items-end p-6 md:p-12 text-right">
            <span className="text-[10px] md:text-xs uppercase tracking-[4px] text-[#D4AF37] mb-3">
              Curated · Delivered · Discreet
            </span>
            <h3 className="font-display text-2xl md:text-4xl lg:text-5xl text-white mb-3 leading-tight max-w-md">
              The Dram That Earns The Hour.
            </h3>
            <p className="hidden md:block text-white/75 max-w-sm text-sm md:text-base leading-relaxed">
              Premium spirits. 2–4 hour delivery across Gauteng. Nothing else needs saying.
            </p>
          </div>
        </div>
      </section>

      {/* ── Looking For Inspiration? ── */}
      <LookingForInspiration />

      {/* ── Quick Reorder Widget (Mobile Only - for logged in users) ── */}
      {isMobile && user && (
        <div className="container px-4 mt-10">
          <QuickReorderWidget recentOrders={recentOrders} />
        </div>
      )}

      {/* ── For You - Personalized Recommendations ── */}
      <div className="mt-10">
        <ProductGrid
          title="For You"
          products={displayForYou}
          isLoading={loadingForYou}
        />
      </div>

      {/* ── Shop by Brand ── */}
      <ShopByBrand />
    </PullToRefresh>
  );
}
