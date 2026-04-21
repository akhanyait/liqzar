import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Smartphone, ArrowRight } from "lucide-react";

/**
 * Bridge page used as Ozow's Success/Cancel/Error URL for the mobile app.
 * Ozow requires https:// redirect URLs, so mobile tells Ozow to come back
 * here, and this page immediately re-hands control to the app via the
 * `liqzar://` deep-link scheme.
 *
 * Expo's WebBrowser.openAuthSessionAsync listens for that scheme and auto-
 * dismisses the in-app browser as soon as the link fires, so the user never
 * actually sees this bridge — but we render a graceful fallback in case the
 * scheme doesn't resolve (e.g. user opens the link on a device without the
 * app installed).
 */
const PaymentReturnBridgePage = () => {
  const [params] = useSearchParams();
  const [showFallback, setShowFallback] = useState(false);

  const status = params.get("status") ?? "unknown";
  const paymentId = params.get("paymentId") ?? "";
  const orderId = params.get("orderId") ?? "";

  useEffect(() => {
    const target = `liqzar://payment-return?status=${encodeURIComponent(
      status,
    )}&paymentId=${encodeURIComponent(paymentId)}&orderId=${encodeURIComponent(
      orderId,
    )}`;

    // Attempt the deep link immediately
    window.location.href = target;

    // After 2.5s, if we're still on this page, reveal the fallback UI
    const t = setTimeout(() => setShowFallback(true), 2500);
    return () => clearTimeout(t);
  }, [status, paymentId, orderId]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md text-center space-y-6"
      >
        <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <Smartphone className="w-10 h-10 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Returning to LIQZAR…
          </h1>
          <p className="mt-2 text-muted-foreground">
            We're handing you back to the app.
          </p>
        </div>

        {showFallback && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              Nothing happening? The app may not be installed on this device.
              Your payment status has been recorded — you can finish on the
              web.
            </p>
            <Link
              to={orderId ? `/track/${orderId}` : "/orders"}
              className="inline-flex items-center justify-center gap-2 w-full py-3 warm-gradient text-primary-foreground rounded-xl font-semibold"
            >
              View order status
              <ArrowRight className="w-4 h-4" />
            </Link>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentReturnBridgePage;
