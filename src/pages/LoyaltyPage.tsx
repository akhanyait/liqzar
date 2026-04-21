import { Crown, Gift, Star, TrendingUp } from "lucide-react";
import BackButton from "@/components/BackButton";
import AppleWalletCard from "@/components/native/AppleWalletCard";
import { isNativeApp } from "@/hooks/useNativeFeatures";

const tiers = [
  { name: "Bronze", spend: "R0+", color: "bg-amber-700", active: false },
  { name: "Silver", spend: "R2,500+", color: "bg-gray-400", active: false },
  { name: "Gold", spend: "R5,000+", color: "bg-yellow-500", active: true },
  { name: "Diamond", spend: "R15,000+", color: "bg-blue-400", active: false },
];

const LoyaltyPage = () => {
  const isMobile =
    isNativeApp() || (typeof window !== "undefined" && window.innerWidth < 768);

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <div className="bg-primary pt-6 pb-4 px-4">
        <div className="container flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Loyalty & Rewards
            </h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5">
              Earn points on every purchase
            </p>
          </div>
        </div>
      </div>
      <div className="container px-4 mt-6 space-y-4">
        {/* Apple Wallet Style Card (Mobile Only) */}
        {isMobile ? (
          <AppleWalletCard
            memberName="Premium Member"
            memberSince="Jan 2024"
            tier="gold"
            points={4850}
            memberId="LUX-2024-8847"
            nextTierPoints={5000}
          />
        ) : (
          /* Desktop Points Card */
          <div className="bg-foreground text-background rounded-2xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-background/60 uppercase tracking-wider font-bold">
                  Your Points
                </p>
                <p className="text-3xl font-extrabold mt-1">4,850</p>
              </div>
              <Crown className="w-10 h-10 text-accent" />
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-bold">
                Gold Member
              </span>
              <span className="text-xs text-background/50">
                R150 until Platinum
              </span>
            </div>
          </div>
        )}

        {/* Tiers */}
        <div className="bg-background border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground text-sm mb-3">
            Membership Tiers
          </h3>
          <div className="space-y-2">
            {tiers.map((tier) => (
              <div
                key={tier.name}
                className={`flex items-center gap-3 p-3 rounded-xl ${tier.active ? "bg-primary/10 border border-primary/20" : ""}`}
              >
                <div className={`w-3 h-3 rounded-full ${tier.color}`} />
                <span
                  className={`text-sm flex-1 ${tier.active ? "font-bold text-foreground" : "text-muted-foreground"}`}
                >
                  {tier.name}
                </span>
                <span className="text-xs text-muted-foreground">
                  {tier.spend}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="bg-background border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground text-sm mb-3">
            How It Works
          </h3>
          <div className="space-y-3">
            {[
              { icon: Star, text: "Earn 1 point for every R1 spent" },
              { icon: Gift, text: "Redeem points for discounts and freebies" },
              { icon: TrendingUp, text: "Level up tiers for exclusive perks" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-primary" />
                <span className="text-sm text-muted-foreground">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoyaltyPage;
