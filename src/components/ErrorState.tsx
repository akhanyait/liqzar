import { motion } from "framer-motion";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export default function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load this right now. Please try again in a moment.",
  onRetry,
  className = "",
}: ErrorStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}
      role="alert"
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-destructive/15 blur-2xl" aria-hidden />
        <div className="relative w-14 h-14 rounded-full bg-card border border-destructive/30 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" strokeWidth={1.75} />
        </div>
      </div>
      <h3 className="font-display text-lg font-bold text-foreground mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {onRetry && (
        <Button
          variant="outline"
          onClick={onRetry}
          className="mt-5 rounded-full border-primary/40 hover:bg-primary/5 gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </Button>
      )}
    </motion.div>
  );
}
