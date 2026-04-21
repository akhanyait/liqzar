import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { CheckCircle, Package, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { verifyPaymentStatus } from "@/lib/payment-gateway";
import PayNowButton from "@/components/PayNowButton";

const PaymentSuccessPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get("orderId");
  const paymentId = searchParams.get("paymentId");

  const [status, setStatus] = useState<
    "loading" | "paid" | "pending" | "failed"
  >("loading");

  useEffect(() => {
    if (!orderId) {
      navigate("/orders");
      return;
    }

    verifyPaymentStatus(orderId).then(({ paid, status: s }) => {
      if (paid) {
        setStatus("paid");
      } else if (s === "awaiting_payment" || s === "pending") {
        // Webhook may not have fired yet — poll once more after 3s
        setTimeout(() => {
          verifyPaymentStatus(orderId).then(({ paid: paid2 }) => {
            setStatus(paid2 ? "paid" : "pending");
          });
        }, 3000);
      } else {
        setStatus("failed");
      }
    });
  }, [orderId, navigate]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md text-center"
      >
        {status === "loading" && (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground">Confirming your payment…</p>
          </div>
        )}

        {status === "paid" && (
          <div className="space-y-6">
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
              <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/40 flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-primary" />
              </div>
            </motion.div>

            {/* Editorial confirmation card — matches mobile delivered-moment */}
            <div className="relative px-4">
              <div className="h-px w-10 bg-primary mx-auto" />
              <p className="text-[10px] tracking-[0.3em] text-primary font-semibold mt-3 uppercase text-center">
                Confirmed With Care
              </p>
              <h1 className="mt-2 text-2xl font-bold text-foreground text-center">
                Thank you for choosing LIQZAR.
              </h1>
              <p className="mt-2 text-sm text-muted-foreground italic text-center leading-relaxed">
                Your order is being prepared by our cellar team. We'll verify age and ID on delivery — part of how we care for every pour.
              </p>
              <div className="mt-4 flex justify-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-semibold tracking-wide uppercase text-primary bg-primary/10 border border-primary/40 rounded-full">
                  <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                  Age & ID verified on delivery
                </span>
              </div>
              <div className="h-px w-10 bg-primary mx-auto mt-4" />
            </div>

            <div className="bg-muted/40 border border-border/50 rounded-xl p-4 text-sm text-left space-y-1">
              {orderId && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order ID</span>
                  <span className="font-mono text-xs text-foreground/80">
                    {orderId.slice(0, 8)}…
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-primary/15 text-primary rounded-md">
                  Confirmed
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {orderId && (
                <Link
                  to={`/track/${orderId}`}
                  className="flex items-center justify-center gap-2 w-full py-3 warm-gradient text-primary-foreground rounded-xl font-semibold transition-all hover:opacity-90"
                >
                  <Package className="w-4 h-4" />
                  Track Order
                  <ArrowRight className="w-4 h-4" />
                </Link>
              )}
              <Link
                to="/orders"
                className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/70 text-foreground rounded-xl font-medium transition-colors"
              >
                View All Orders
              </Link>
            </div>
          </div>
        )}

        {status === "pending" && (
          <div className="space-y-6">
            <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
              <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Payment Processing
              </h1>
              <p className="mt-2 text-muted-foreground">
                Your payment is being processed. Your order will be confirmed
                shortly.
              </p>
            </div>
            {orderId && (
              <PayNowButton orderId={orderId} label="Retry Payment" className="w-full" />
            )}
            <Link
              to="/orders"
              className="inline-flex items-center gap-2 py-3 px-6 warm-gradient text-primary-foreground rounded-xl font-semibold"
            >
              View Orders
            </Link>
          </div>
        )}

        {status === "failed" && (
          <div className="space-y-6">
            <div className="w-20 h-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
              <span className="text-4xl">✕</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Payment Failed
              </h1>
              <p className="mt-2 text-muted-foreground">
                Your payment could not be processed. No charge was made.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              {orderId ? (
                <PayNowButton orderId={orderId} label="Retry Payment" className="w-full" />
              ) : (
                <Link
                  to="/checkout"
                  className="flex items-center justify-center gap-2 w-full py-3 warm-gradient text-primary-foreground rounded-xl font-semibold"
                >
                  Try Again
                </Link>
              )}
              <Link
                to="/"
                className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/70 text-foreground rounded-xl font-medium transition-colors"
              >
                Back to Home
              </Link>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentSuccessPage;
