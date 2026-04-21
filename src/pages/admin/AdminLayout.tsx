import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Package,
  Users,
  ShoppingCart,
  Warehouse,
  TrendingUp,
  Settings,
  LogOut,
  Menu,
  X,
  Tag,
  BarChart3,
  MessageSquare,
  Truck,
  Gift,
  ClipboardList,
} from "lucide-react";
import RoleBadge from "@/components/RoleBadge";

const sidebarItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { to: "/admin/products", icon: Package, label: "Products" },
  { to: "/admin/customers", icon: Users, label: "Customers" },
  { to: "/admin/inventory", icon: Warehouse, label: "Inventory" },
  { to: "/admin/pricing", icon: Tag, label: "Pricing" },
  { to: "/admin/crm", icon: MessageSquare, label: "CRM" },
  { to: "/admin/drivers", icon: Truck, label: "Drivers" },
  {
    to: "/admin/assign-deliveries",
    icon: ClipboardList,
    label: "Assign Deliveries",
  },
  { to: "/admin/loyalty", icon: Gift, label: "Loyalty" },
  { to: "/admin/reports", icon: BarChart3, label: "Reports" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-foreground/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-foreground text-background transform transition-transform lg:translate-x-0 flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        role="navigation"
        aria-label="Admin sidebar"
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-background/10">
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center border border-amber-500/30"
              style={{
                background: "linear-gradient(135deg, #1c1810 0%, #0f0d09 100%)",
              }}
            >
              <span
                className="text-[10px] font-extrabold"
                style={{
                  background:
                    "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                LQ
              </span>
            </div>
            <div>
              <span className="font-bold text-sm">LIQZAR</span>
              <span className="block text-[10px] text-background/50">
                Admin Portal
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-background/70"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="p-3 space-y-0.5 flex-1">
          {sidebarItems.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  isActive
                    ? "bg-primary/15 text-primary shadow-[inset_3px_0_0_0_hsl(var(--primary))]"
                    : "text-background/60 hover:text-background hover:bg-background/10"
                }`
              }
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-background/10">
          <div className="px-3 py-2 text-xs text-background/40 truncate">
            {user?.phone}
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-background/60 hover:text-red-400 hover:bg-background/10 w-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border flex items-center px-4 gap-4 bg-background sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-bold text-foreground">Admin Portal</h1>
          <RoleBadge />
        </header>
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
        <footer className="border-t border-border px-4 py-3 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} LIQZAR · Developed by{" "}
          <span className="font-semibold text-primary">
            Akhanya IT Innovations
          </span>
        </footer>
      </div>
    </div>
  );
};

export default AdminLayout;
