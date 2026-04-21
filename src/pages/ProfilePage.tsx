import { motion } from "framer-motion";
import {
  User,
  MapPin,
  Heart,
  Package,
  Settings,
  ChevronRight,
  LogOut,
  CreditCard,
  Crown,
  Gift,
  Star,
  Shield,
  Bell,
  HelpCircle,
  FileText,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const memberStats = [
  { label: "Orders", value: "24" },
  { label: "Points", value: "4,850" },
  { label: "Saved", value: "R312" },
];

const menuSections = [
  {
    title: "My Account",
    items: [
      { icon: Package, label: "Order History", to: "/orders", badge: "3" },
      { icon: Heart, label: "Wishlist", to: "/wishlist" },
      { icon: MapPin, label: "Saved Addresses", to: "/addresses" },
      { icon: CreditCard, label: "Payment Methods", to: "/payments" },
    ],
  },
  {
    title: "Membership",
    items: [
      { icon: Crown, label: "Loyalty & Rewards", to: "/loyalty" },
      { icon: Gift, label: "Refer a Friend", to: "/referral" },
      { icon: Star, label: "Rate & Review", to: "/reviews" },
    ],
  },
  {
    title: "Settings",
    items: [
      { icon: Bell, label: "Notifications", to: "/notifications" },
      { icon: Shield, label: "Privacy & Security", to: "/security" },
      { icon: Settings, label: "Preferences", to: "/settings" },
      { icon: HelpCircle, label: "Help & Support", to: "/support" },
      { icon: FileText, label: "Legal", to: "/legal" },
    ],
  },
];

const ProfilePage = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth");
  };

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      {/* Profile Header */}
      <div className="bg-secondary pt-8 pb-6 px-4">
        <div className="container flex flex-col items-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
          >
            <div className="w-20 h-20 rounded-full bg-foreground flex items-center justify-center">
              <User className="w-8 h-8 text-background" />
            </div>
          </motion.div>
          <h1 className="text-xl font-bold text-foreground mt-3">
            Guest Member
          </h1>
          <span className="mt-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground">
            Gold Member
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="container px-4 -mt-3">
        <div className="grid grid-cols-3 gap-2">
          {memberStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-background border border-border rounded-2xl p-3 text-center uber-shadow"
            >
              <p className="text-lg font-bold text-foreground">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {stat.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Sign In CTA — only for guests */}
      {!user && (
        <div className="container px-4 mt-4">
          <div className="p-5 rounded-2xl bg-foreground text-background">
            <h3 className="font-bold text-lg">Unlock Full Access</h3>
            <p className="text-xs text-background/70 mt-1 mb-4">
              Sign in to track orders, earn loyalty points, and access exclusive
              member benefits.
            </p>
            <Link
              to="/auth"
              className="inline-flex bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold text-sm"
            >
              Sign In / Sign Up
            </Link>
          </div>
        </div>
      )}

      {/* Menu Sections */}
      {menuSections.map((section) => (
        <div key={section.title} className="container px-4 mt-6">
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 px-1">
            {section.title}
          </h3>
          <div className="bg-background border border-border rounded-2xl overflow-hidden divide-y divide-border uber-shadow">
            {section.items.map(({ icon: Icon, label, to, badge }) => (
              <Link
                key={label}
                to={to}
                className="flex items-center gap-3 p-4 hover:bg-secondary transition-colors"
              >
                <Icon
                  className="w-5 h-5 text-muted-foreground"
                  strokeWidth={1.5}
                />
                <span className="flex-1 text-sm font-medium text-foreground">
                  {label}
                </span>
                {badge && (
                  <span className="w-5 h-5 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge}
                  </span>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* Logout */}
      <div className="container px-4 mt-6">
        <button
          onClick={handleSignOut}
          className="w-full bg-background border border-border rounded-2xl p-4 flex items-center gap-3 hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-5 h-5 text-destructive" strokeWidth={1.5} />
          <span className="text-sm font-medium text-destructive">Sign Out</span>
        </button>
      </div>

      <div className="container px-4 mt-8 text-center">
        <p className="text-[10px] text-muted-foreground">
          LIQZAR v1.0 — Premium Lifestyle Delivery
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          © 2026 LIQZAR. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ProfilePage;
