import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, ShieldCheck, Wine, Crown, Diamond } from "lucide-react";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { useAuth } from "@/context/AuthContext";
import {
  CELLAR_CLUB_TIERS,
  CellarClubTier,
  getMyCellarClubSubscription,
  joinCellarClub,
  cancelCellarClub,
} from "@/lib/cellar-club";
import { toast } from "@/hooks/use-toast";

const TIER_ICON: Record<CellarClubTier, typeof Wine> = {
  founder: Wine,
  grand_cru: Crown,
  premier: Diamond,
};

export default function CellarClubPage() {
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<CellarClubTier>("grand_cru");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [current, setCurrent] = useState<any | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    getMyCellarClubSubscription(user.id).then((res) => {
      setLoading(false);
      if (res.success) setCurrent(res.data);
    });
  }, [user?.id]);

  const handleJoin = async () => {
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to join the Cellar Club.",
      });
      return;
    }
    setJoining(true);
    const res = await joinCellarClub(user.id, selectedTier, {});
    setJoining(false);
    if (!res.success) {
      toast({
        title: "Could not join",
        description: res.error,
        variant: "destructive" as any,
      });
      return;
    }
    setCurrent(res.data);
    toast({ title: "Welcome to the Cellar Club" });
  };

  const handleCancel = async () => {
    if (!user?.id) return;
    const res = await cancelCellarClub(user.id, null);
    if (res.success) {
      setCurrent({ ...current, status: "cancelled" });
      toast({ title: "Subscription cancelled" });
    } else {
      toast({
        title: "Could not cancel",
        description: res.error,
        variant: "destructive" as any,
      });
    }
  };

  return (
    <>
      <Header />
      <div className="pb-28 bg-background overflow-x-hidden">
        <div className="container px-4 py-8 max-w-3xl mx-auto">
          <div className="text-center mb-6">
            <div className="h-px w-10 bg-primary mx-auto" />
            <p className="text-[10px] tracking-[0.3em] uppercase text-primary font-semibold mt-3">
              The Cellar Club
            </p>
            <h1 className="mt-2 text-3xl font-display font-bold text-foreground">
              Your monthly cellar, curated.
            </h1>
            <p className="mt-3 text-sm text-muted-foreground italic max-w-lg mx-auto">
              Hand-selected releases from our sommeliers, delivered to your
              door. Pause or cancel anytime.
            </p>
            <div className="h-px w-10 bg-primary mx-auto mt-5" />
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : current && current.status === "active" ? (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-primary/40 bg-primary/5 p-6 text-center"
            >
              <CheckCircle2 className="w-10 h-10 text-primary mx-auto" />
              <p className="mt-3 text-[10px] tracking-[0.28em] uppercase text-primary font-semibold">
                Active member
              </p>
              <h2 className="mt-1 text-xl font-display font-bold text-foreground capitalize">
                {current.tier?.replace("_", " ")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Next curated box arrives on{" "}
                {new Date(current.current_period_end).toLocaleDateString(
                  "en-ZA",
                  { day: "numeric", month: "long" },
                )}
              </p>
              <button
                onClick={handleCancel}
                className="mt-5 text-xs text-muted-foreground underline hover:text-foreground transition-colors"
              >
                Pause or cancel
              </button>
            </motion.div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                {CELLAR_CLUB_TIERS.map((tier) => {
                  const selected = selectedTier === tier.key;
                  const Icon = TIER_ICON[tier.key];
                  return (
                    <motion.button
                      key={tier.key}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedTier(tier.key)}
                      className={`text-left rounded-2xl border p-5 transition-all ${
                        selected
                          ? "border-primary bg-primary/5 shadow-[0_10px_30px_hsl(var(--gold)/0.12)]"
                          : "border-border bg-card hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                          <Icon className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[10px] tracking-[0.24em] uppercase text-primary font-semibold">
                            Tier
                          </p>
                          <p className="text-sm font-semibold text-foreground">
                            {tier.name}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground italic mb-3">
                        {tier.tagline}
                      </p>
                      <p className="text-2xl font-display font-bold text-foreground">
                        R{(tier.monthlyCents / 100).toLocaleString("en-ZA")}
                        <span className="text-xs text-muted-foreground font-normal">
                          {" "}
                          / month
                        </span>
                      </p>
                      <ul className="mt-3 space-y-1.5">
                        {tier.perks.map((p) => (
                          <li
                            key={p}
                            className="text-xs text-muted-foreground flex items-start gap-1.5"
                          >
                            <CheckCircle2 className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                            {p}
                          </li>
                        ))}
                      </ul>
                    </motion.button>
                  );
                })}
              </div>

              <button
                onClick={handleJoin}
                disabled={joining}
                className="mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl warm-gradient text-primary-foreground font-semibold disabled:opacity-50"
              >
                {joining ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Joining…
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    Join the Cellar Club
                  </>
                )}
              </button>
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                First charge occurs on your next curation day. Pause anytime.
              </p>
            </>
          )}
        </div>
      </div>
      <BottomNav />
    </>
  );
}
