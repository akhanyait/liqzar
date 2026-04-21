import { MessageSquare, Phone, Mail, AlertCircle, TrendingDown } from "lucide-react";

const interactions = [
  { customer: "Sipho D.", type: "call", summary: "Enquired about bulk order for corporate event", agent: "Sarah", time: "2 hrs ago", sentiment: "positive" },
  { customer: "Lize B.", type: "email", summary: "Requested product sourcing - imported Italian sparkling water", agent: "Mike", time: "1 day ago", sentiment: "neutral" },
  { customer: "Thabo M.", type: "chat", summary: "Delivery delay complaint - resolved with discount", agent: "Sarah", time: "2 days ago", sentiment: "negative" },
  { customer: "Naledi K.", type: "call", summary: "VIP tasting event invitation follow-up", agent: "Admin", time: "3 days ago", sentiment: "positive" },
];

const churnRisk = [
  { name: "Lize Botha", lastOrder: "30 days ago", risk: "High", action: "Send 15% discount" },
  { name: "Peter Smit", lastOrder: "21 days ago", risk: "Medium", action: "Reorder reminder" },
  { name: "Grace Mabena", lastOrder: "14 days ago", risk: "Low", action: "New arrivals email" },
];

const sentimentColors: Record<string, string> = {
  positive: "text-green-600",
  neutral: "text-yellow-600",
  negative: "text-red-500",
};

const typeIcons: Record<string, any> = {
  call: Phone,
  email: Mail,
  chat: MessageSquare,
};

const AdminCRM = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">CRM</h2>
      <p className="text-sm text-muted-foreground">Customer relationship management & engagement</p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-card border border-border rounded-2xl">
        <div className="p-5 border-b border-border">
          <h3 className="font-bold text-foreground">Recent Interactions</h3>
        </div>
        <div className="divide-y divide-border">
          {interactions.map((item, i) => {
            const Icon = typeIcons[item.type];
            return (
              <div key={i} className="p-4 flex gap-3">
                <div className="w-8 h-8 bg-secondary rounded-lg flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">{item.customer}</span>
                    <span className={`text-xs font-medium ${sentimentColors[item.sentiment]}`}>● {item.sentiment}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.summary}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{item.agent} • {item.time}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-card border border-border rounded-2xl">
        <div className="p-5 border-b border-border flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-red-500" />
          <h3 className="font-bold text-foreground">Churn Risk</h3>
        </div>
        <div className="divide-y divide-border">
          {churnRisk.map((c, i) => (
            <div key={i} className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 bg-secondary rounded-full flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{c.name.split(" ").map(n => n[0]).join("")}</span>
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-sm text-foreground">{c.name}</span>
                <span className="block text-xs text-muted-foreground">Last order: {c.lastOrder}</span>
              </div>
              <div className="text-right">
                <span className={`text-xs font-bold ${c.risk === "High" ? "text-red-500" : c.risk === "Medium" ? "text-yellow-600" : "text-green-600"}`}>
                  {c.risk} Risk
                </span>
                <span className="block text-[10px] text-muted-foreground">{c.action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

export default AdminCRM;
