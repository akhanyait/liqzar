import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Award, Gift, Sparkles, Tag, Star, Wine, Search } from "lucide-react";
import { useState } from "react";
import { categories } from "@/data/products";

const inspirationLinks = [
  { icon: Award, label: "Our Top 10 Picks", link: "/catalogue?sort=rating", color: "from-primary to-emerald-600" },
  { icon: Gift, label: "Gift Cards", link: "/gift-cards", color: "from-accent to-amber-500" },
  { icon: Sparkles, label: "New Arrivals", link: "/catalogue?sort=newest", color: "from-purple-500 to-violet-600" },
  { icon: Tag, label: "Best Deals", link: "/catalogue?sort=price-asc", color: "from-destructive to-rose-500" },
  { icon: Star, label: "Staff Picks", link: "/catalogue?filter=featured", color: "from-blue-500 to-cyan-500" },
  { icon: Wine, label: "Premium Collection", link: "/catalogue?filter=premium", color: "from-emerald-600 to-teal-500" },
];

const drinkOptions = [
  { label: "Any", value: "" },
  ...categories.slice(0, 10).map((c) => ({ label: c.name, value: c.slug })),
];

const budgetOptions = [
  { label: "Any Budget", value: "" },
  { label: "Under R200", value: "0-200" },
  { label: "R200 – R500", value: "200-500" },
  { label: "R500 – R1000", value: "500-1000" },
  { label: "R1000+", value: "1000+" },
];

const LookingForInspiration = () => {
  const [drink, setDrink] = useState("");
  const [budget, setBudget] = useState("");

  const buildFinderLink = () => {
    const params = new URLSearchParams();
    if (drink) params.set("category", drink);
    if (budget) params.set("budget", budget);
    return `/catalogue?${params.toString()}`;
  };

  return (
    <section className="container px-4 mt-14">
      <div className="text-center mb-8">
        <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground">
          Looking For Inspiration?
        </h2>
        <p className="text-sm text-muted-foreground mt-1">Discover your perfect bottle</p>
      </div>

      {/* Quick-link tiles */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-8">
        {inspirationLinks.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <Link
              to={item.link}
              className="group flex flex-col items-center gap-2.5 p-4 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-md transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform duration-300`}>
                <item.icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[11px] font-semibold text-foreground text-center leading-tight">
                {item.label}
              </span>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Bottle Finder Widget */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="rounded-2xl bg-secondary/60 border border-border/50 p-6 md:p-8"
      >
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
          <div className="flex-shrink-0 text-center md:text-left">
            <div className="w-14 h-14 rounded-2xl warm-gradient flex items-center justify-center mx-auto md:mx-0 mb-2">
              <Search className="w-6 h-6 text-primary-foreground" />
            </div>
            <h3 className="font-display font-bold text-foreground text-lg">Find Your Perfect Bottle</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tell us what you like</p>
          </div>

          <div className="flex-1 flex flex-col sm:flex-row gap-3 w-full">
            <select
              value={drink}
              onChange={(e) => setDrink(e.target.value)}
              aria-label="Drink type"
              className="flex-1 h-11 px-4 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">What do you like?</option>
              {drinkOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <select
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              aria-label="Budget range"
              className="flex-1 h-11 px-4 rounded-xl bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Your Budget?</option>
              {budgetOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>

            <Link
              to={buildFinderLink()}
              className="h-11 px-6 rounded-xl warm-gradient text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              Find My Bottle
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
};

export default LookingForInspiration;
