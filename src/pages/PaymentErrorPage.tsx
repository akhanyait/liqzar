import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, Home, MessageCircle } from "lucide-react";
import PayNowButton from "@/components/PayNowButton";

const PaymentErrorPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const reason = searchParams.get("reason");

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center space-y-6"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{
            type: "spring",
            stiffness: 200,
            damping: 18,
            delay: 0.1,
          }}
          className="flex justify-center"
        >
          <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-destructive" />
          </div>
        </motion.div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Something went wrong
          </h1>
          <p className="mt-2 text-muted-foreground">
            We couldn't complete your payment just now.
            {reason ? ` Reason: ${reason}.` : ""} No funds have been taken —
            you can try again or switch to Cash on Delivery.
          </p>
        </div>

        <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-xs text-left text-muted-foreground">
          <p>
            If your bank shows a pending hold, it will be released
            automatically within 1–3 business days.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          {orderId ? (
            <PayNowButton orderId={orderId} label="Retry payment" className="w-full" />
          ) : (
            <Link
              to="/checkout"
              className="flex items-center justify-center gap-2 w-full py-3 warm-gradient text-primary-foreground rounded-xl font-semibold"
            >
              <RotateCcw className="w-4 h-4" />
              Try again
            </Link>
          )}
          <Link
            to="/support"
            className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/70 text-foreground rounded-xl font-medium transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Contact support
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentErrorPage;
