import { Gift, Crown, Star, Users } from "lucide-react";

const tiers = [
  { name: "Bronze", min: 0, max: 999, members: 45, color: "bg-orange-100 text-orange-700" },
  { name: "Silver", min: 1000, max: 4999, members: 28, color: "bg-gray-100 text-gray-700" },
  { name: "Gold", min: 5000, max: 14999, members: 16, color: "bg-yellow-100 text-yellow-700" },
  { name: "Platinum", min: 15000, max: null, members: 8, color: "bg-purple-100 text-purple-700" },
];

const recentRedemptions = [
  { customer: "Sipho D.", reward: "R100 Store Credit", points: 2000, date: "Today" },
  { customer: "James vdW.", reward: "Free Delivery x5", points: 1500, date: "Yesterday" },
  { customer: "Naledi K.", reward: "Gift Hamper Upgrade", points: 3000, date: "2 days ago" },
];

const AdminLoyalty = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Loyalty & Rewards</h2>
      <p className="text-sm text-muted-foreground">Manage tier levels, points, and reward redemptions</p>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {tiers.map((tier) => (
        <div key={tier.name} className="bg-card border border-border rounded-2xl p-4 text-center">
          <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold mb-3 ${tier.color}`}>{tier.name}</span>
          <p className="text-2xl font-bold text-foreground">{tier.members}</p>
          <p className="text-xs text-muted-foreground">members</p>
          <p className="text-[10px] text-muted-foreground mt-1">{tier.min.toLocaleString()}+ points</p>
        </div>
      ))}
    </div>

    <div className="bg-card border border-border rounded-2xl">
      <div className="p-5 border-b border-border">
        <h3 className="font-bold text-foreground">Recent Redemptions</h3>
      </div>
      <div className="divide-y divide-border">
        {recentRedemptions.map((r, i) => (
          <div key={i} className="p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center">
              <Gift className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1">
              <span className="font-semibold text-sm text-foreground">{r.customer}</span>
              <span className="block text-xs text-muted-foreground">{r.reward}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-foreground">{r.points.toLocaleString()} pts</span>
              <span className="block text-[10px] text-muted-foreground">{r.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AdminLoyalty;
