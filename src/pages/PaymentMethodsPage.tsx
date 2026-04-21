import { CreditCard, Plus } from "lucide-react";
import BackButton from "@/components/BackButton";

const PaymentMethodsPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">
            Payment Methods
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            Manage your payment options
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6">
      <div className="bg-background border border-border rounded-2xl p-8 text-center">
        <CreditCard
          className="w-10 h-10 text-muted-foreground mx-auto mb-3"
          strokeWidth={1.5}
        />
        <h3 className="font-bold text-foreground">No payment methods</h3>
        <p className="text-sm text-muted-foreground mt-1 mb-4">
          Add a card or payment method for faster checkout.
        </p>
        <button className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full font-semibold text-sm">
          <Plus className="w-4 h-4" /> Add Payment Method
        </button>
      </div>
    </div>
  </div>
);

export default PaymentMethodsPage;
