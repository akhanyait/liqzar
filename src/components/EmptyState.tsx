import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; onClick?: () => void; to?: string };
  className?: string;
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center justify-center text-center px-6 py-16 ${className}`}
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" aria-hidden />
        <div className="relative w-16 h-16 rounded-full bg-card border border-border/60 flex items-center justify-center shadow-sm">
          <Icon className="w-7 h-7 text-primary" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="font-display text-xl font-bold text-foreground mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action.to ? (
            <a
              href={action.to}
              className="cta-gold inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold"
            >
              {action.label}
            </a>
          ) : (
            <Button onClick={action.onClick} className="cta-gold rounded-full px-6">
              {action.label}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
