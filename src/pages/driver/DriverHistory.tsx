import { CheckCircle, MapPin, Clock } from "lucide-react";

const history = [
  { id: "ORD-2395", customer: "Grace M.", address: "Bryanston, JHB", time: "11:42 AM", date: "Today" },
  { id: "ORD-2393", customer: "David L.", address: "Melrose Arch, JHB", time: "10:15 AM", date: "Today" },
  { id: "ORD-2390", customer: "Fatima A.", address: "Norwood, JHB", time: "09:30 AM", date: "Today" },
  { id: "ORD-2387", customer: "Johan P.", address: "Centurion, PTA", time: "4:22 PM", date: "Yesterday" },
  { id: "ORD-2384", customer: "Linda M.", address: "Fourways, JHB", time: "2:10 PM", date: "Yesterday" },
];

const DriverHistory = () => (
  <div className="space-y-6">
    <div>
      <h2 className="text-2xl font-bold text-foreground">Delivery History</h2>
      <p className="text-sm text-muted-foreground">Your completed deliveries</p>
    </div>

    <div className="space-y-3">
      {history.map((d) => (
        <div key={d.id} className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <CheckCircle className="w-5 h-5 text-green-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-foreground">{d.id}</span>
              <span className="text-xs text-muted-foreground">{d.date}</span>
            </div>
            <p className="text-xs text-muted-foreground">{d.customer} • {d.address}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" /> {d.time}
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default DriverHistory;
