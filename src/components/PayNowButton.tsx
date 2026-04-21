import { useState } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resumePayment } from "@/lib/payment-gateway";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface PayNowButtonProps {
  orderId: string;
  className?: string;
  size?: "sm" | "default" | "lg";
  label?: string;
}

/**
 * Pay Now CTA for orders stuck in awaiting_payment.
 * Calls resumePayment → redirects the browser to Ozow's hosted checkout.
 */
const PayNowButton = ({
  orderId,
  className,
  size = "default",
  label = "Pay Now",
}: PayNowButtonProps) => {
  const [loading, setLoading] = useState(false);

  const handlePay = async () => {
    console.log("[PayNowButton] click → orderId:", orderId);
    if (!orderId) {
      window.alert("No order ID provided — cannot start payment.");
      return;
    }
    setLoading(true);
    try {
      const result = await resumePayment(orderId);
      console.log("[PayNowButton] resumePayment result:", result);

      if (!result.success) {
        const msg = result.error ?? "Please try again.";
        console.error("[PayNowButton] failed:", msg);
        toast({
          title: "Payment could not start",
          description: msg,
          variant: "destructive",
        });
        window.alert(`Payment could not start: ${msg}`);
        setLoading(false);
        return;
      }

      if (result.redirectUrl) {
        console.log("[PayNowButton] redirecting to:", result.redirectUrl);
        window.location.assign(result.redirectUrl);
        return;
      }

      // No redirectUrl but success → already paid or COD-style inline auth.
      toast({ title: "Order already paid", description: "Refreshing your order…" });
      window.location.reload();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[PayNowButton] unexpected error:", err);
      toast({
        title: "Payment error",
        description: msg,
        variant: "destructive",
      });
      window.alert(`Payment error: ${msg}`);
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handlePay}
      disabled={loading}
      size={size}
      className={cn(
        "bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-md min-h-[44px]",
        className,
      )}
      aria-label={`${label} for order ${orderId}`}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" /> Starting payment…
        </>
      ) : (
        <>
          <CreditCard className="w-4 h-4" /> {label}
        </>
      )}
    </Button>
  );
};

export default PayNowButton;
