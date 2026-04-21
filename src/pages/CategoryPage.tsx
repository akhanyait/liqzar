import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { categories } from "@/data/products";
import { useProducts } from "@/hooks/useProducts";
import { useState, useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";

const sortOptions = ["Popular", "Price: Low", "Price: High", "Rating"];

const CategoryPage = () => {
  const { id } = useParams<{ id: string }>();
  const [sortBy, setSortBy] = useState("Popular");

  const category = categories.find((c) => c.id === id);
  const { data: rawProducts = [], isLoading } = useProducts({
    category: category?.slug,
  });

  const categoryProducts = useMemo(() => {
    const sorted = [...rawProducts];
    if (sortBy === "Price: Low") sorted.sort((a, b) => a.price - b.price);
    if (sortBy === "Price: High") sorted.sort((a, b) => b.price - a.price);
    if (sortBy === "Rating") sorted.sort((a, b) => b.rating - a.rating);
    return sorted;
  }, [rawProducts, sortBy]);

  return (
    <div className="pb-28 overflow-x-hidden">
      {/* Header */}
      <div className="relative h-[200px] overflow-hidden">
        <img
          src={
            category?.image ||
            "https://images.unsplash.com/photo-1569529465841-dfecdab7503b?w=1200&h=400&fit=crop"
          }
          alt={category?.name || "All Products"}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-background/30" />
        <div className="absolute inset-0 flex flex-col justify-end p-4">
          <Link
            to="/"
            className="absolute top-4 left-4 w-8 h-8 glass-card flex items-center justify-center rounded-full"
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </Link>
          <h1 className="font-serif text-2xl font-bold text-foreground">
            {category?.name || "All Products"}
          </h1>
          <p className="text-muted-foreground text-sm">
            {categoryProducts.length} products
          </p>
        </div>
      </div>

      {/* Sort */}
      <div className="container px-4 mt-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
          <SlidersHorizontal className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          {sortOptions.map((opt) => (
            <button
              key={opt}
              onClick={() => setSortBy(opt)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                sortBy === opt
                  ? "gold-gradient text-primary-foreground"
                  : "glass-card text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="container px-4 mt-4">
        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-[260px] rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {categoryProducts.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
        {!isLoading && categoryProducts.length === 0 && (
          <div className="text-center py-20 text-muted-foreground">
            <p className="font-serif text-lg">No products found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CategoryPage;
