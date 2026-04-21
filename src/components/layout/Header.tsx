import {
  ShoppingBag,
  Search,
  User,
  Menu,
  LogOut,
  X,
  Home,
  Grid3X3,
  Heart,
  Package,
  Settings,
  Mic,
  Sun,
  Moon,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth, ROLE_LABELS } from "@/context/AuthContext";
import { categories } from "@/data/products";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import VoiceSearch from "@/components/native/VoiceSearch";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";
const TIER_COPY: Record<LoyaltyTier, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const navCategories = categories.slice(0, 8);

const Header = () => {
  const { totalItems, setIsCartOpen } = useCart();
  const { user, role, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");

  const [tier, setTier] = useState<LoyaltyTier | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setTier(null);
      return;
    }
    (async () => {
      try {
        const { data } = await supabase
          .from("loyalty_accounts")
          .select("tier")
          .eq("user_id", user.id)
          .maybeSingle();
        if (!cancelled && data?.tier) {
          setTier(data.tier as LoyaltyTier);
        }
      } catch {
        // Silent — tier chip is optional.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-40 safe-area-top bg-header border-b border-amber-500/10 backdrop-blur-xl">
      {/* Single consolidated bar */}
      <div className="bg-header/80">
        <div className="container flex items-center h-14 px-4 gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
            <img
              src="/liqzar-logo.png"
              alt="LIQZAR"
              className="w-9 h-9 object-contain"
              style={{ filter: "drop-shadow(0 0 8px rgba(212,175,55,0.3))" }}
            />
            <span
              className="text-lg font-extrabold font-display tracking-widest"
              style={{
                background:
                  "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              LIQZAR
            </span>
          </Link>

          {/* Search — fills center */}
          <div className="flex flex-1 max-w-xl">
            <div className="flex items-center gap-2 w-full">
              <Link
                to="/search"
                className="flex items-center gap-2.5 flex-1 h-10 px-4 rounded-full bg-header-foreground/10 backdrop-blur-sm text-header-foreground/70 text-sm hover:bg-header-foreground/20 transition-colors ring-1 ring-white/5 focus-within:ring-1 focus-within:ring-amber-500/30"
                style={{
                  background: "rgba(255,255,255,0.04)",
                }}
              >
                <Search className="w-4 h-4" />
                <span className="hidden sm:inline">
                  Search for your perfect bottle...
                </span>
                <span className="sm:hidden">Search...</span>
              </Link>
              {/* Voice Search Button */}
              <button
                onClick={() => setShowVoiceSearch(true)}
                className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30 transition-colors"
                aria-label="Voice search"
              >
                <Mic className="w-4 h-4 text-header-foreground" />
              </button>
            </div>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1 ml-auto">
            {/* Mobile hamburger menu */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-full text-header-foreground/80 hover:bg-header-foreground/10 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            {user && role && (
              <span className="hidden lg:inline-flex items-center px-2.5 py-1 rounded-full bg-header-foreground/15 text-[10px] font-bold text-header-foreground uppercase tracking-wider">
                {ROLE_LABELS[role]}
              </span>
            )}

            {user && tier && (
              <Link
                to="/loyalty"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-bold uppercase tracking-[0.15em] transition-colors"
                style={{
                  background: "linear-gradient(135deg, rgba(212,175,55,0.18), rgba(245,230,163,0.12))",
                  borderColor: "rgba(212,175,55,0.45)",
                  color: "#F5E6A3",
                }}
                aria-label={`Loyalty tier ${TIER_COPY[tier]}`}
              >
                <span>◆</span>
                {TIER_COPY[tier]} Member
              </Link>
            )}

            <button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className="hidden md:flex p-2 rounded-full text-header-foreground/80 hover:bg-header-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {mounted && isDark ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>

            <Link
              to="/profile"
              className="hidden md:flex p-2 rounded-full text-header-foreground/80 hover:bg-header-foreground/10 transition-colors"
              aria-label="Account"
            >
              <User className="w-5 h-5" />
            </Link>

            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center gap-1.5 h-8 px-3.5 rounded-full text-sm font-bold hover:opacity-90 transition-opacity"
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8962E)",
                color: "#0d0b08",
                boxShadow: "0 2px 12px rgba(212,175,55,0.25)",
              }}
            >
              <ShoppingBag className="w-4 h-4" />
              {totalItems > 0 ? (
                <span>{totalItems}</span>
              ) : (
                <span className="hidden sm:inline">Cart</span>
              )}
            </button>

            {user && (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1.5 h-8 px-3 rounded-full text-header-foreground/80 hover:bg-header-foreground/10 transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Category nav — subtle secondary row */}
      <div className="hidden md:block bg-background border-t border-amber-500/15">
        <div className="container px-4">
          <nav className="flex items-center gap-0.5 h-9 overflow-x-auto scrollbar-none">
            {navCategories.map((cat) => (
              <Link
                key={cat.id}
                to={`/category/${cat.id}`}
                className="flex-shrink-0 px-3 py-1.5 text-[11px] font-semibold font-display text-muted-foreground hover:text-primary transition-colors uppercase tracking-wider"
              >
                {cat.name}
              </Link>
            ))}
            <Link
              to="/catalogue"
              className="flex-shrink-0 px-3.5 py-1 ml-1 text-[11px] font-bold uppercase tracking-wider rounded-full transition-colors"
              style={{
                background: "linear-gradient(135deg, #D4AF37, #B8962E)",
                color: "#0d0b08",
                boxShadow: "0 1px 6px rgba(212,175,55,0.2)",
              }}
            >
              View All
            </Link>
          </nav>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Menu Panel */}
          <div className="absolute top-0 left-0 w-72 h-full bg-background shadow-xl safe-area-top">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src="/liqzar-logo.png"
                  alt="LIQZAR"
                  className="w-10 h-10 object-contain"
                  style={{ filter: "drop-shadow(0 0 8px rgba(212,175,55,0.3))" }}
                />
                <span
                  className="text-lg font-extrabold font-display tracking-widest"
                  style={{
                    background:
                      "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  LIQZAR
                </span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-full hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {/* Gold accent line */}
            <div
              className="h-[1px]"
              style={{
                background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
              }}
            />

            <nav className="p-4 space-y-1">
              <Link
                to="/"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <Home className="w-5 h-5 text-primary" />
                <span className="font-medium">Home</span>
              </Link>
              <Link
                to="/catalogue"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <Grid3X3 className="w-5 h-5 text-primary" />
                <span className="font-medium">Browse All</span>
              </Link>
              <Link
                to="/wishlist"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <Heart className="w-5 h-5 text-primary" />
                <span className="font-medium">Wishlist</span>
              </Link>
              <Link
                to="/orders"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <Package className="w-5 h-5 text-primary" />
                <span className="font-medium">My Orders</span>
              </Link>
              <Link
                to="/profile"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <User className="w-5 h-5 text-primary" />
                <span className="font-medium">Profile</span>
              </Link>
              <Link
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-secondary transition-colors"
              >
                <Settings className="w-5 h-5 text-primary" />
                <span className="font-medium">Settings</span>
              </Link>
            </nav>

            <div className="px-4 pb-2">
              <button
                onClick={() => {
                  toggleTheme();
                }}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl hover:bg-secondary transition-colors border border-border/50"
                aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              >
                <span className="flex items-center gap-3">
                  {mounted && isDark ? (
                    <Sun className="w-5 h-5 text-primary" />
                  ) : (
                    <Moon className="w-5 h-5 text-primary" />
                  )}
                  <span className="font-medium text-sm">
                    {mounted && isDark ? "Light mode" : "Dark mode"}
                  </span>
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {mounted && isDark ? "Dark" : "Light"}
                </span>
              </button>
            </div>

            <div className="p-4 border-t border-border">
              <p className="text-xs text-muted-foreground mb-3">Categories</p>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {navCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="block px-4 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            </div>

            {user && (
              <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-border safe-area-bottom">
                <button
                  onClick={() => {
                    handleSignOut();
                    setMobileMenuOpen(false);
                  }}
                  className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  <span className="font-medium">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Voice Search Modal */}
      <VoiceSearch
        isOpen={showVoiceSearch}
        onClose={() => setShowVoiceSearch(false)}
        onResult={(text: string) => {
          setShowVoiceSearch(false);
          navigate(`/search?q=${encodeURIComponent(text)}`);
          toast({
            title: "Searching...",
            description: `Looking for "${text}"`,
          });
        }}
      />
    </header>
  );
};

export default Header;
