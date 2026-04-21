import { Home, Search, Grid3X3, ShoppingBag, User } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/catalogue", icon: Grid3X3, label: "Browse" },
  { to: "/search", icon: Search, label: "Search" },
  { to: "/cart", icon: ShoppingBag, label: "Cart" },
  { to: "/profile", icon: User, label: "Account" },
];

const BottomNav = () => {
  const { totalItems } = useCart();
  const { user } = useAuth();

  // Always show bottom nav on mobile for native app experience
  return (
    <nav
      aria-label="Main navigation"
      className="fixed bottom-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-xl border-t border-amber-500/10 md:hidden safe-area-bottom"
    >
      <div className="flex items-stretch justify-around px-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            aria-label={label}
            end={to === "/"}
            className={({ isActive }) =>
              [
                "flex flex-col items-center justify-center gap-0.5",
                "min-h-[52px] min-w-[52px] flex-1 px-1 pt-1.5 pb-1 rounded-none",
                "transition-all duration-150 focus-visible:outline-none",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                "active:scale-95 transform-gpu will-change-transform",
                isActive ? "" : "text-muted-foreground hover:text-foreground",
              ].join(" ")
            }
          >
            {({ isActive }) => (
              <>
                <div className="relative">
                  {isActive && (
                    <div
                      className="absolute -inset-1.5 rounded-full"
                      style={{ backgroundColor: "rgba(212, 175, 55, 0.1)" }}
                    />
                  )}
                  <Icon
                    className={`relative z-10 transition-all duration-200 ${isActive ? "w-[22px] h-[22px]" : "w-5 h-5"}`}
                    strokeWidth={isActive ? 2.5 : 1.5}
                    style={isActive ? { color: "#D4AF37" } : undefined}
                    aria-hidden="true"
                  />
                  {label === "Cart" && totalItems > 0 && (
                    <span
                      aria-label={`${totalItems} items in cart`}
                      className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] text-[10px] font-bold rounded-full flex items-center justify-center px-1 z-20"
                      style={{
                        background: "linear-gradient(135deg, #D4AF37, #B8962E)",
                        color: "#0d0b08",
                      }}
                    >
                      {totalItems > 9 ? "9+" : totalItems}
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] transition-all duration-200 ${isActive ? "font-bold" : "font-medium"}`}
                  style={isActive ? { color: "#D4AF37" } : undefined}
                >
                  {label}
                </span>
                {isActive && (
                  <div
                    className="w-5 h-0.5 rounded-full mt-0.5"
                    style={{ backgroundColor: "#D4AF37" }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default BottomNav;
