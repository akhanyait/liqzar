import { useSearchParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { XCircle, ShoppingCart, Home } from "lucide-react";

const PaymentCancelPage = () => {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

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
          <div className="w-20 h-20 rounded-full bg-amber-500/10 flex items-center justify-center">
            <XCircle className="w-10 h-10 text-amber-500" />
          </div>
        </motion.div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Payment Cancelled
          </h1>
          <p className="mt-2 text-muted-foreground">
            You cancelled the payment. Your order has not been charged.
            {orderId && " You can retry payment from your orders page."}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <Link
            to="/cart"
            className="flex items-center justify-center gap-2 w-full py-3 warm-gradient text-primary-foreground rounded-xl font-semibold transition-all hover:opacity-90"
          >
            <ShoppingCart className="w-4 h-4" />
            Return to Cart
          </Link>
          <Link
            to="/"
            className="flex items-center justify-center gap-2 w-full py-3 bg-muted hover:bg-muted/70 text-foreground rounded-xl font-medium transition-colors"
          >
            <Home className="w-4 h-4" />
            Back to Home
          </Link>
        </div>
      </motion.div>
    </div>
  );
};

export default PaymentCancelPage;
