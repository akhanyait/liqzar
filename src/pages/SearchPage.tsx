import { useState, useEffect, useRef } from "react";
import { Search, X, Clock, Mic, MapPin, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";
import { Link, useSearchParams } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { useHaptics } from "@/hooks/useNativeFeatures";
import VoiceSearch from "@/components/native/VoiceSearch";
import { useCart } from "@/context/CartContext";

const quickFilters = [
  { id: "all", label: "All", icon: "🍾" },
  { id: "whisky", label: "Whisky", icon: "🥃" },
  { id: "wine", label: "Wine", icon: "🍷" },
  { id: "vodka", label: "Vodka", icon: "🍸" },
  { id: "gin", label: "Gin", icon: "🫐" },
  { id: "beer", label: "Beer", icon: "🍺" },
  { id: "champagne", label: "Champagne", icon: "🥂" },
];

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState("all");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { impact } = useHaptics();
  const { addItem } = useCart();

  useEffect(() => {
    const saved = localStorage.getItem("recentSearches");
    if (saved) setRecentSearches(JSON.parse(saved));
  }, []);

  const saveSearch = (term: string) => {
    if (!term.trim()) return;
    const updated = [term, ...recentSearches.filter((s) => s !== term)].slice(
      0,
      5,
    );
    setRecentSearches(updated);
    localStorage.setItem("recentSearches", JSON.stringify(updated));
  };

  const handleSearch = (term: string) => {
    impact("light");
    setQuery(term);
    saveSearch(term);
  };

  const { data: results = [], isLoading } = useProducts({
    search: query.trim() || undefined,
    category: activeFilter !== "all" ? activeFilter : undefined,
    limit: 50,
  });

  const showResults = !!query.trim() || activeFilter !== "all";

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Clean Header */}
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100">
        {/* Search Bar */}
        <div className="px-4 pt-3 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center h-12 px-4 rounded-full bg-gray-100">
              <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && query.trim()) {
                    saveSearch(query.trim());
                    inputRef.current?.blur();
                  }
                }}
                placeholder="Search for drinks..."
                className="flex-1 h-full bg-transparent border-none text-gray-900 placeholder:text-gray-400 focus:outline-none text-base ml-3"
              />
              {query && (
                <button onClick={() => setQuery("")} className="p-1">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              )}
            </div>
            <button
              onClick={() => setShowVoiceSearch(true)}
              className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <Mic className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  impact("light");
                  setActiveFilter(filter.id);
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeFilter === filter.id
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <span>{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Voice Search Modal */}
      <VoiceSearch
        isOpen={showVoiceSearch}
        onClose={() => setShowVoiceSearch(false)}
        onResult={(text) => {
          setShowVoiceSearch(false);
          handleSearch(text);
        }}
      />

      {/* Content */}
      <div className="px-4 pt-4">
        {!showResults ? (
          <div className="space-y-6">
            {/* Recent Searches */}
            {recentSearches.length > 0 && (
              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-semibold text-gray-900">
                    Recent
                  </h3>
                  <button
                    onClick={() => {
                      setRecentSearches([]);
                      localStorage.removeItem("recentSearches");
                    }}
                    className="text-sm text-primary font-medium"
                  >
                    Clear
                  </button>
                </div>
                <div className="space-y-1">
                  {recentSearches.map((term) => (
                    <button
                      key={term}
                      onClick={() => handleSearch(term)}
                      className="flex items-center gap-3 w-full py-3 text-left"
                    >
                      <Clock className="w-5 h-5 text-gray-400" />
                      <span className="flex-1 text-gray-700">{term}</span>
                      <ChevronRight className="w-5 h-5 text-gray-300" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Browse Categories */}
            <section>
              <h3 className="text-base font-semibold text-gray-900 mb-3">
                Browse Categories
              </h3>
              <div className="space-y-1">
                {categories.slice(0, 8).map((cat) => (
                  <Link
                    key={cat.id}
                    to={`/category/${cat.id}`}
                    className="flex items-center gap-4 py-3 border-b border-gray-50"
                  >
                    <span className="text-2xl">{cat.icon}</span>
                    <span className="flex-1 text-gray-900 font-medium">
                      {cat.name}
                    </span>
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* Results */
          <div>
            <p className="text-sm text-gray-500 mb-4">
              {isLoading ? "Searching..." : `${results.length} results`}
            </p>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-24 rounded-2xl" />
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-3">
                {results.map((product) => (
                  <motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    <Link
                      to={`/product/${product.id}`}
                      className="flex gap-4 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm"
                    >
                      {/* Product Image */}
                      <div className="w-20 h-20 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-gray-900 truncate">
                          {product.name}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">
                          {product.category} •{" "}
                          {product.bottle_size || product.volume}
                        </p>
                        <div className="flex items-center justify-between mt-2">
                          <span className="font-bold text-gray-900">
                            R
                            {product.price.toLocaleString("en-ZA", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              impact("medium");
                              addItem({
                                ...product,
                                image: product.image || product.image_url || "",
                              });
                            }}
                            className="w-8 h-8 rounded-full bg-primary flex items-center justify-center"
                          >
                            <span className="text-white text-lg font-bold">
                              +
                            </span>
                          </button>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                  <Search className="w-7 h-7 text-gray-400" />
                </div>
                <p className="text-lg font-semibold text-gray-900">
                  No results
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  Try a different search
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
