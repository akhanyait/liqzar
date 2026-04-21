import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Archive, Loader2, TrendingUp, TrendingDown, Wine } from "lucide-react";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { useAuth } from "@/context/AuthContext";
import {
  CellarHolding,
  CellarSummary,
  CellarCategoryRow,
  fetchCellarHoldings,
  fetchCellarSummary,
  fetchCellarCategories,
} from "@/lib/cellar-valuation";
import { format } from "date-fns";

const fmtR = (amount: number) =>
  `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MyCellarPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<CellarSummary | null>(null);
  const [holdings, setHoldings] = useState<CellarHolding[]>([]);
  const [categories, setCategories] = useState<CellarCategoryRow[]>([]);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    Promise.all([
      fetchCellarSummary(user.id),
      fetchCellarHoldings(user.id),
      fetchCellarCategories(user.id),
    ])
      .then(([s, h, c]) => {
        setSummary(s);
        setHoldings(h);
        setCategories(c);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const gain = summary?.unrealised_gain ?? 0;
  const gainPositive = gain >= 0;

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Editorial header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="h-px w-10 bg-primary mx-auto" />
            <p className="text-[10px] tracking-[0.3em] text-primary font-semibold mt-3 uppercase">
              Your Private Collection
            </p>
            <h1 className="font-display text-3xl font-bold mt-2">My Cellar</h1>
            <p className="text-sm text-muted-foreground italic mt-2 leading-relaxed max-w-md mx-auto">
              A living record of every bottle you've collected through LIQZAR,
              valued at today's prices.
            </p>
            <div className="h-px w-10 bg-primary mx-auto mt-4" />
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : !summary || summary.total_bottles === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
              <Archive className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="text-sm font-semibold text-foreground">Your cellar is empty</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                Once your first delivery arrives, it will appear here with a live valuation.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Valuation card */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Current Value
                </p>
                <p className="font-display text-4xl font-bold text-foreground mt-1">
                  {fmtR(summary.current_value)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  {gainPositive ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-destructive" />
                  )}
                  <span
                    className={`text-sm font-semibold ${
                      gainPositive ? "text-emerald-600" : "text-destructive"
                    }`}
                  >
                    {gainPositive ? "+" : "−"}
                    {fmtR(Math.abs(gain))}
                  </span>
                  <span className="text-xs text-muted-foreground">vs paid</span>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-primary/20">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Bottles
                    </p>
                    <p className="text-lg font-bold mt-0.5">{summary.total_bottles}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Unique SKUs
                    </p>
                    <p className="text-lg font-bold mt-0.5">{summary.unique_skus}</p>
                  </div>
                </div>
              </div>

              {/* Category breakdown */}
              {categories.length > 0 && (
                <div>
                  <h2 className="font-display font-bold text-lg mb-3">By Category</h2>
                  <div className="space-y-2">
                    {categories.map((c) => {
                      const pct =
                        summary.current_value > 0
                          ? (c.value / summary.current_value) * 100
                          : 0;
                      return (
                        <div key={c.category} className="rounded-xl border border-border bg-card p-3">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-semibold capitalize">{c.category}</span>
                            <span className="text-xs text-muted-foreground">
                              {c.bottles} · {fmtR(c.value)}
                            </span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Holdings list */}
              <div>
                <h2 className="font-display font-bold text-lg mb-3">Holdings</h2>
                <div className="space-y-2">
                  {holdings.map((h) => (
                    <div
                      key={h.product_id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                    >
                      {h.image_url ? (
                        <img
                          src={h.image_url}
                          alt=""
                          className="w-12 h-12 rounded-lg object-cover bg-secondary"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-secondary flex items-center justify-center">
                          <Wine className="w-5 h-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{h.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          ×{h.qty_owned} · last {format(new Date(h.last_acquired_at), "d MMM yyyy")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{fmtR(h.current_value)}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {fmtR(h.current_unit_price)} ea.
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
