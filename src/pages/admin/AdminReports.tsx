import { BarChart3, DollarSign, Users, ShoppingCart, TrendingUp, Package } from "lucide-react";

const reportCards = [
  { title: "Revenue This Month", value: "R 487,250", change: "+18.2%", icon: DollarSign },
  { title: "Average Order Value", value: "R 523", change: "+5.1%", icon: ShoppingCart },
  { title: "Customer Retention", value: "87%", change: "+2.4%", icon: Users },
  { title: "Gross Profit Margin", value: "42.3%", change: "+1.8%", icon: TrendingUp },
];

const topProducts = [
  { name: "Appletiser Original 750ml", sold: 342, revenue: "R 17,100" },
  { name: "Truth Coffee Cold Brew", sold: 256, revenue: "R 15,360" },
  { name: "Fever-Tree Premium Tonic", sold: 198, revenue: "R 11,880" },
  { name: "Biltong Board Gift Set", sold: 87, revenue: "R 34,800" },
  { name: "Cape Rooibos Reserve", sold: 156, revenue: "R 10,920" },
];

const topCustomers = [
  { name: "Sipho Dlamini", orders: 45, value: "R 28,500" },
  { name: "James van der Walt", orders: 32, value: "R 18,200" },
  { name: "Thabo Mokoena", orders: 24, value: "R 12,450" },
  { name: "Naledi Khumalo", orders: 18, value: "R 8,900" },
];

const AdminReports = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Reports & Analytics</h2>
      <p className="text-sm text-muted-foreground">Business intelligence and performance metrics</p>
    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {reportCards.map((c) => (
        <div key={c.title} className="bg-card border border-border rounded-2xl p-5">
          <div className="w-10 h-10 bg-secondary rounded-xl flex items-center justify-center mb-3">
            <c.icon className="w-5 h-5 text-foreground" />
          </div>
          <p className="text-2xl font-bold text-foreground">{c.value}</p>
          <p className="text-xs text-muted-foreground mt-1">{c.title}</p>
          <span className="text-xs font-semibold text-green-600">{c.change}</span>
        </div>
      ))}
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-2xl">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Package className="w-4 h-4 text-foreground" />
          <h3 className="font-bold text-foreground">Top Products</h3>
        </div>
        <div className="divide-y divide-border">
          {topProducts.map((p, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <span className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-xs font-bold text-foreground">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground truncate block">{p.name}</span>
                <span className="text-xs text-muted-foreground">{p.sold} units sold</span>
              </div>
              <span className="font-bold text-sm text-foreground">{p.revenue}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-foreground" />
          <h3 className="font-bold text-foreground">Top Customers</h3>
        </div>
        <div className="divide-y divide-border">
          {topCustomers.map((c, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <span className="w-6 h-6 bg-secondary rounded-full flex items-center justify-center text-xs font-bold text-foreground">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-sm text-foreground">{c.name}</span>
                <span className="text-xs text-muted-foreground block">{c.orders} orders</span>
              </div>
              <span className="font-bold text-sm text-foreground">{c.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default AdminReports;
