import { useState } from "react";
import { Search, UserPlus, Phone, Mail, Crown, Star } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const customers = [
  { id: 1, name: "Thabo Mokoena", email: "thabo@email.com", phone: "+27 82 123 4567", orders: 24, spent: "R 12,450", tier: "Platinum", status: "Active", lastOrder: "2 hrs ago" },
  { id: 2, name: "Naledi Khumalo", email: "naledi@email.com", phone: "+27 83 234 5678", orders: 18, spent: "R 8,900", tier: "Gold", status: "Active", lastOrder: "1 day ago" },
  { id: 3, name: "James van der Walt", email: "james@email.com", phone: "+27 84 345 6789", orders: 32, spent: "R 18,200", tier: "Platinum", status: "Active", lastOrder: "3 hrs ago" },
  { id: 4, name: "Priya Naidoo", email: "priya@email.com", phone: "+27 71 456 7890", orders: 8, spent: "R 3,200", tier: "Silver", status: "Active", lastOrder: "5 days ago" },
  { id: 5, name: "Sipho Dlamini", email: "sipho@email.com", phone: "+27 72 567 8901", orders: 45, spent: "R 28,500", tier: "Platinum", status: "VIP", lastOrder: "6 hrs ago" },
  { id: 6, name: "Lize Botha", email: "lize@email.com", phone: "+27 81 678 9012", orders: 3, spent: "R 1,100", tier: "Bronze", status: "Inactive", lastOrder: "30 days ago" },
];

const tierColors: Record<string, string> = {
  Bronze: "bg-amber-100 text-amber-700",
  Silver: "bg-gray-100 text-gray-700",
  Gold: "bg-yellow-100 text-yellow-700",
  Platinum: "bg-purple-100 text-purple-700",
};

const AdminCustomers = () => {
  const [search, setSearch] = useState("");
  const filtered = customers.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Customers</h2>
          <p className="text-sm text-muted-foreground">{customers.length} registered customers</p>
        </div>
        <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-xl gap-2">
          <UserPlus className="w-4 h-4" /> Invite Customer
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="pl-10 h-11 rounded-xl" />
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Customer</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase hidden md:table-cell">Contact</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Orders</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Total Spent</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase">Tier</th>
                <th className="text-left p-4 text-xs font-semibold text-muted-foreground uppercase hidden lg:table-cell">Last Order</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/50 transition-colors cursor-pointer">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-foreground">{c.name.split(" ").map(n => n[0]).join("")}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-sm text-foreground flex items-center gap-1">
                          {c.name}
                          {c.status === "VIP" && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />}
                        </span>
                        <span className="text-xs text-muted-foreground">{c.status}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 hidden md:table-cell">
                    <span className="text-xs text-muted-foreground block">{c.email}</span>
                    <span className="text-xs text-muted-foreground">{c.phone}</span>
                  </td>
                  <td className="p-4 text-sm font-medium text-foreground">{c.orders}</td>
                  <td className="p-4 font-bold text-sm text-foreground">{c.spent}</td>
                  <td className="p-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${tierColors[c.tier]}`}>{c.tier}</span>
                  </td>
                  <td className="p-4 hidden lg:table-cell text-xs text-muted-foreground">{c.lastOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminCustomers;
