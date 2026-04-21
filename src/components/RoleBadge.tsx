import { useAuth, ROLE_LABELS } from "@/context/AuthContext";
import { Shield } from "lucide-react";

const roleBgMap: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  customer: "bg-accent text-accent-foreground",
  driver: "bg-muted text-muted-foreground",
};

const RoleBadge = ({ className = "" }: { className?: string }) => {
  const { role } = useAuth();
  if (!role) return null;

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${roleBgMap[role] || "bg-secondary text-foreground"} ${className}`}>
      <Shield className="w-3 h-3" />
      {ROLE_LABELS[role]}
    </span>
  );
};

export default RoleBadge;
