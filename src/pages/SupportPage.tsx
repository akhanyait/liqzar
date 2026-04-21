import { HelpCircle, MessageCircle, Phone, Mail } from "lucide-react";
import BackButton from "@/components/BackButton";

const SupportPage = () => (
  <div className="pb-28 bg-background overflow-x-hidden">
    <div className="bg-primary pt-6 pb-4 px-4">
      <div className="container flex items-center gap-3">
        <BackButton />
        <div>
          <h1 className="text-xl font-bold text-primary-foreground">
            Help & Support
          </h1>
          <p className="text-xs text-primary-foreground/70 mt-0.5">
            We're here to help
          </p>
        </div>
      </div>
    </div>
    <div className="container px-4 mt-6 space-y-4">
      {[
        {
          icon: MessageCircle,
          label: "Live Chat",
          desc: "Chat with our support team",
          action: "Start Chat",
        },
        {
          icon: Phone,
          label: "Call Us",
          desc: "0800 LIQZAR",
          action: "Call Now",
        },
        {
          icon: Mail,
          label: "Email Support",
          desc: "support@liqzar.co.za",
          action: "Send Email",
        },
      ].map(({ icon: Icon, label, desc, action }) => (
        <div
          key={label}
          className="bg-background border border-border rounded-2xl p-4 flex items-center gap-4"
        >
          <Icon className="w-5 h-5 text-primary" strokeWidth={1.5} />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">{desc}</p>
          </div>
          <button className="text-xs font-bold text-primary">{action}</button>
        </div>
      ))}

      <div className="bg-background border border-border rounded-2xl p-4">
        <h3 className="font-bold text-foreground text-sm mb-3">FAQs</h3>
        {[
          "How do I track my order?",
          "What is your return policy?",
          "How do loyalty points work?",
        ].map((q) => (
          <div
            key={q}
            className="py-3 border-b border-border last:border-0 flex items-center gap-3"
          >
            <HelpCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-sm text-foreground">{q}</span>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default SupportPage;
