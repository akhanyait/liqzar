import { motion } from "framer-motion";
import { TrendingUp, Truck, Star, Clock, DollarSign, Zap, Target, Wallet, CreditCard } from "lucide-react";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";

const weeklyData = [
  { day: "Mon", deliveries: 12, earnings: 960, rating: 4.8, onTime: 92 },
  { day: "Tue", deliveries: 9, earnings: 720, rating: 4.9, onTime: 100 },
  { day: "Wed", deliveries: 14, earnings: 1120, rating: 4.7, onTime: 86 },
  { day: "Thu", deliveries: 11, earnings: 880, rating: 5.0, onTime: 100 },
  { day: "Fri", deliveries: 16, earnings: 1280, rating: 4.9, onTime: 94 },
  { day: "Sat", deliveries: 18, earnings: 1440, rating: 4.8, onTime: 89 },
  { day: "Sun", deliveries: 6, earnings: 480, rating: 5.0, onTime: 100 },
];

const monthlyTrend = [
  { week: "W1", deliveries: 58, earnings: 4640 },
  { week: "W2", deliveries: 72, earnings: 5760 },
  { week: "W3", deliveries: 65, earnings: 5200 },
  { week: "W4", deliveries: 86, earnings: 6880 },
];

const performanceMetrics = [
  { label: "On-Time Rate", value: 94, target: 95, icon: Clock, unit: "%" },
  { label: "Customer Rating", value: 4.9, target: 4.8, icon: Star, unit: "/5" },
  { label: "Avg Delivery Time", value: 22, target: 25, icon: Zap, unit: "min" },
  { label: "Completion Rate", value: 98, target: 95, icon: Target, unit: "%" },
];

const feedbackRecent = [
  { customer: "Thabo M.", rating: 5, comment: "Very fast delivery, friendly driver!", date: "Today" },
  { customer: "Naledi K.", rating: 4, comment: "Good service, arrived on time.", date: "Yesterday" },
  { customer: "Johan P.", rating: 5, comment: "Excellent! Will order again.", date: "2 days ago" },
  { customer: "Priya N.", rating: 5, comment: "Professional and courteous.", date: "3 days ago" },
];

const DriverAnalytics = () => (
  <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Analytics</h2>
      <p className="text-sm text-muted-foreground">Performance insights & earnings</p>
    </div>

    {/* Summary Stats */}
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "This Week", value: "R 6,880", sub: "+18%", icon: DollarSign, color: "text-green-600" },
        { label: "Deliveries", value: "86", sub: "+32%", icon: Truck, color: "text-blue-500" },
        { label: "Avg Rating", value: "4.9", sub: "Top 5%", icon: Star, color: "text-yellow-500" },
        { label: "On-Time", value: "94%", sub: "-1% target", icon: Clock, color: "text-amber-500" },
      ].map((s, i) => (
        <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
          className="bg-card border border-border rounded-2xl p-4">
          <s.icon className={`w-4 h-4 ${s.color} mb-1.5`} />
          <p className="text-lg font-bold text-foreground">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
          <p className={`text-[10px] font-bold mt-0.5 ${s.sub.startsWith("+") || s.sub.startsWith("Top") ? "text-green-600" : "text-amber-500"}`}>{s.sub}</p>
        </motion.div>
      ))}
    </div>

    <Tabs defaultValue="earnings" className="w-full">
      <TabsList className="w-full grid grid-cols-4">
        <TabsTrigger value="earnings" className="text-xs">Earnings</TabsTrigger>
        <TabsTrigger value="payouts" className="text-xs">Payouts</TabsTrigger>
        <TabsTrigger value="performance" className="text-xs">Performance</TabsTrigger>
        <TabsTrigger value="feedback" className="text-xs">Feedback</TabsTrigger>
      </TabsList>

      {/* Earnings Tab */}
      <TabsContent value="earnings" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Weekly Earnings</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              <Bar dataKey="earnings" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={150}>
            <AreaChart data={monthlyTrend}>
              <XAxis dataKey="week" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              <Area type="monotone" dataKey="earnings" fill="hsl(var(--primary) / 0.15)" stroke="hsl(var(--primary))" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Payouts Tab */}
      <TabsContent value="payouts" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5"><Wallet className="w-4 h-4 text-primary" /> Payout Summary</h3>
            <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-bold">Paid Weekly</span>
          </div>
          <div className="space-y-3">
            {[
              { period: "This Week", base: 5200, tips: 480, bonus: 300, status: "Pending" },
              { period: "Last Week", base: 4800, tips: 320, bonus: 200, status: "Paid" },
              { period: "2 Weeks Ago", base: 5600, tips: 550, bonus: 400, status: "Paid" },
            ].map((p) => (
              <div key={p.period} className="border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-foreground">{p.period}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${p.status === "Paid" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Base</span><p className="font-bold text-foreground">R {p.base.toLocaleString()}</p></div>
                  <div><span className="text-muted-foreground">Tips</span><p className="font-bold text-foreground">R {p.tips}</p></div>
                  <div><span className="text-muted-foreground">Bonus</span><p className="font-bold text-primary">R {p.bonus}</p></div>
                </div>
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-border text-xs">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-bold text-foreground">R {(p.base + p.tips + p.bonus).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 mb-3"><CreditCard className="w-4 h-4 text-muted-foreground" /> Per-Delivery Breakdown (Today)</h3>
          <div className="space-y-2">
            {[
              { id: "ORD-2401", time: "09:15", payout: 85, tip: 15, distance: "3.2 km" },
              { id: "ORD-2399", time: "10:30", payout: 120, tip: 20, distance: "5.1 km" },
              { id: "ORD-2397", time: "11:45", payout: 65, tip: 10, distance: "2.0 km" },
              { id: "ORD-2395", time: "13:00", payout: 180, tip: 30, distance: "7.8 km" },
              { id: "ORD-2393", time: "14:20", payout: 95, tip: 0, distance: "4.2 km" },
            ].map((d) => (
              <div key={d.id} className="flex items-center justify-between py-2 border-b border-border last:border-0 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">{d.id}</span>
                  <span className="text-muted-foreground">{d.time}</span>
                  <span className="text-muted-foreground">{d.distance}</span>
                </div>
                <div className="flex items-center gap-3">
                  {d.tip > 0 && <span className="text-green-600 font-medium">+R {d.tip} tip</span>}
                  <span className="font-bold text-foreground">R {d.payout}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>

      {/* Performance Tab */}
      <TabsContent value="performance" className="space-y-4 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4 space-y-4">
          <h3 className="text-sm font-bold text-foreground">Performance Metrics</h3>
          {performanceMetrics.map((m) => {
            const pct = m.unit === "%" ? m.value : m.unit === "/5" ? (m.value / 5) * 100 : Math.max(0, 100 - ((m.value / m.target) * 100 - 100));
            const isGood = m.unit === "min" ? m.value <= m.target : m.value >= m.target;
            return (
              <div key={m.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground flex items-center gap-1"><m.icon className="w-3 h-3" /> {m.label}</span>
                  <span className={`font-bold ${isGood ? "text-green-600" : "text-amber-500"}`}>
                    {m.value}{m.unit} <span className="text-muted-foreground font-normal">(target: {m.target}{m.unit})</span>
                  </span>
                </div>
                <Progress value={Math.min(pct, 100)} className="h-1.5" />
              </div>
            );
          })}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-3">Daily Deliveries</h3>
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={weeklyData}>
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12, border: "1px solid hsl(var(--border))" }} />
              <Line type="monotone" dataKey="deliveries" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              <Line type="monotone" dataKey="onTime" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </TabsContent>

      {/* Feedback Tab */}
      <TabsContent value="feedback" className="space-y-3 mt-4">
        <div className="bg-card border border-border rounded-2xl p-4">
          <h3 className="text-sm font-bold text-foreground mb-1">Customer Feedback</h3>
          <p className="text-xs text-muted-foreground mb-3">Recent ratings & comments</p>
          <div className="space-y-3">
            {feedbackRecent.map((f, i) => (
              <div key={i} className="border-b border-border last:border-0 pb-3 last:pb-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{f.customer}</span>
                  <span className="text-[10px] text-muted-foreground">{f.date}</span>
                </div>
                <div className="flex items-center gap-0.5 mb-1">
                  {Array.from({ length: 5 }, (_, j) => (
                    <Star key={j} className={`w-3 h-3 ${j < f.rating ? "text-yellow-500 fill-yellow-500" : "text-muted"}`} />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{f.comment}</p>
              </div>
            ))}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
);

export default DriverAnalytics;
