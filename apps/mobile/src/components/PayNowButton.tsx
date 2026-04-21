import React, { useState } from "react";
import { Alert, Linking, ViewStyle } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { GoldGradientButton } from "./ui/GoldGradientButton";
import { PaymentService, PaymentMethod } from "../services/PaymentService";

interface PayNowButtonProps {
  orderId: string;
  amount: number;
  paymentMethod: string | undefined;
  customerEmail?: string;
  customerPhone?: string;
  title?: string;
  style?: ViewStyle;
  onPaid?: () => void;
}

const RESUMABLE_METHODS: PaymentMethod[] = ["card", "instant_eft", "snapscan"];

/**
 * Mobile Pay Now CTA — used when an order is stuck in awaiting_payment.
 * Delegates to PaymentService.initiatePayment which already has idempotency
 * (resets stuck pending/awaiting_payment rows to failed before creating a fresh attempt).
 */
export const PayNowButton: React.FC<PayNowButtonProps> = ({
  orderId,
  amount,
  paymentMethod,
  customerEmail,
  customerPhone,
  title = "Pay Now",
  style,
  onPaid,
}) => {
  const [loading, setLoading] = useState(false);

  const handlePress = async () => {
    const method = (paymentMethod ?? "card") as PaymentMethod;
    if (!RESUMABLE_METHODS.includes(method)) {
      Alert.alert("Payment not required", "This order does not require online payment.");
      return;
    }

    setLoading(true);
    try {
      const result = await PaymentService.initiatePayment({
        orderId,
        amount,
        paymentMethod: method,
        customerEmail,
        customerPhone,
        metadata: { resumed: true },
      });

      if (!result.success) {
        Alert.alert("Payment failed", result.error ?? "Please try again.");
        return;
      }

      if (result.redirectUrl) {
        try {
          await WebBrowser.openBrowserAsync(result.redirectUrl, {
            dismissButtonStyle: "done",
          });
        } catch {
          await Linking.openURL(result.redirectUrl);
        }
      }

      onPaid?.();
    } catch (err: any) {
      console.warn("[PayNowButton]", err?.message ?? err);
      Alert.alert("Payment error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <GoldGradientButton
      title={title}
      onPress={handlePress}
      loading={loading}
      style={style}
    />
  );
};

export default PayNowButton;
