import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import {
  LayoutDashboard,
  Truck,
  Clock,
  LogOut,
  BarChart3,
  Package,
  User,
} from "lucide-react";
import RoleBadge from "@/components/RoleBadge";
import { useOrderStatusToasts } from "@/hooks/useOrderStatusToasts";

const DriverLayout = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  useOrderStatusToasts(user?.id);

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      <header className="h-14 border-b border-zinc-800 bg-zinc-900 flex items-center justify-between px-4 sticky top-0 z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="font-bold text-zinc-100">LIQZAR</span>
          <RoleBadge className="ml-0.5" />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate("/driver/profile")}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 transition-colors rounded-full flex items-center justify-center"
          >
            <User className="w-4 h-4 text-zinc-300" />
          </button>
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-400 hover:text-red-400 flex items-center gap-1 px-2 py-1 hover:bg-zinc-800 rounded transition-colors"
          >
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 pb-20 overflow-auto">
        <Outlet />
      </main>
      <footer className="border-t border-zinc-800 px-4 py-3 text-center text-xs text-zinc-500 mb-14 bg-zinc-900">
        © {new Date().getFullYear()} LIQZAR · Developed by{" "}
        <span className="font-semibold text-primary">
          Akhanya IT Innovations
        </span>
      </footer>

      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-800 shadow-2xl">
        <div className="flex items-center justify-around py-2 px-4">
          {[
            { to: "/driver", icon: LayoutDashboard, label: "Home", end: true },
            { to: "/driver/orders", icon: Package, label: "Orders" },
            { to: "/driver/active", icon: Truck, label: "Active" },
            { to: "/driver/analytics", icon: BarChart3, label: "Stats" },
            { to: "/driver/history", icon: Clock, label: "History" },
          ].map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-1 px-3 rounded ${isActive ? "text-primary" : "text-zinc-400"}`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    className="w-5 h-5"
                    strokeWidth={isActive ? 2.5 : 1.5}
                  />
                  <span
                    className={`text-[10px] ${isActive ? "font-bold" : "font-medium"}`}
                  >
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default DriverLayout;
