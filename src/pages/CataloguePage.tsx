import { useState, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X, Search, ChevronDown } from "lucide-react";
import { Link } from "react-router-dom";
import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/context/CartContext";
import { useHaptics } from "@/hooks/useNativeFeatures";
import CatalogueProductCard from "@/components/CatalogueProductCard";

const SORT_OPTIONS = [
  { label: "Recommended", value: "recommended" },
  { label: "Price: Low → High", value: "price-asc" },
  { label: "Price: High → Low", value: "price-desc" },
  { label: "Rating", value: "rating" },
];

const quickFilters = [
  { id: "all", label: "All", icon: "🍾" },
  { id: "whisky", label: "Whisky", icon: "🥃" },
  { id: "wine", label: "Wine", icon: "🍷" },
  { id: "vodka", label: "Vodka", icon: "🍸" },
  { id: "gin", label: "Gin", icon: "🫐" },
  { id: "beer", label: "Beer", icon: "🍺" },
  { id: "champagne", label: "Champagne", icon: "🥂" },
  { id: "brandy", label: "Brandy", icon: "🍯" },
  { id: "rum", label: "Rum", icon: "🏴‍☠️" },
];

const CataloguePage = () => {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recommended");
  const [showSort, setShowSort] = useState(false);
  const { addItem } = useCart();
  const { impact } = useHaptics();

  const { data: allProducts = [], isLoading } = useProducts({
    search: search.trim() || undefined,
    category: activeFilter !== "all" ? activeFilter : undefined,
  });

  const filtered = useMemo(() => {
    let list = [...allProducts];

    switch (sortBy) {
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "rating":
        list.sort((a, b) => b.rating - a.rating);
        break;
    }

    return list;
  }, [allProducts, sortBy]);

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Clean Header */}
      <div className="sticky top-0 z-50 bg-white">
        {/* Search Bar */}
        <div className="px-4 pt-3 pb-3 border-b border-gray-100">
          <div className="flex items-center h-12 px-4 rounded-full bg-gray-100">
            <Search className="w-5 h-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products..."
              className="flex-1 h-full bg-transparent border-none text-gray-900 placeholder:text-gray-400 focus:outline-none text-base ml-3"
            />
            {search && (
              <button onClick={() => setSearch("")} className="p-1">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Filter Chips */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-4 px-4">
            {quickFilters.map((filter) => (
              <button
                key={filter.id}
                onClick={() => {
                  impact("light");
                  setActiveFilter(filter.id);
                }}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                  activeFilter === filter.id
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                <span className="text-base">{filter.icon}</span>
                <span>{filter.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sort Bar */}
        <div className="px-4 py-2 flex items-center justify-between bg-gray-50">
          <span className="text-sm text-gray-500">
            {isLoading ? "Loading..." : `${filtered.length} products`}
          </span>
          <button
            onClick={() => setShowSort(true)}
            className="flex items-center gap-1 text-sm font-medium text-gray-700"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Sort Modal */}
      <AnimatePresence>
        {showSort && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setShowSort(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 p-6"
            >
              <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
              <h3 className="text-lg font-bold text-gray-900 mb-4">Sort by</h3>
              <div className="space-y-2">
                {SORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => {
                      setSortBy(opt.value);
                      setShowSort(false);
                    }}
                    className={`w-full text-left px-4 py-3 rounded-xl transition-colors ${
                      sortBy === opt.value
                        ? "bg-primary text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Products Grid */}
      <div className="px-4 pt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((product, i) => (
              <CatalogueProductCard
                key={product.id}
                product={product}
                index={i}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <Search className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-lg font-semibold text-gray-900">
              No products found
            </p>
            <p className="text-sm text-gray-500 mt-1">
              Try a different search or filter
            </p>
            <button
              onClick={() => {
                setSearch("");
                setActiveFilter("all");
              }}
              className="mt-4 px-6 py-3 bg-primary text-white rounded-full font-medium"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CataloguePage;
