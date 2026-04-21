import { Gift, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";
import BackButton from "@/components/BackButton";

const ReferralPage = () => {
  const [copied, setCopied] = useState(false);
  const code = "LUXFRIEND50";

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="pb-28 bg-background overflow-x-hidden">
      <div className="bg-primary pt-6 pb-4 px-4">
        <div className="container flex items-center gap-3">
          <BackButton />
          <div>
            <h1 className="text-xl font-bold text-primary-foreground">
              Refer a Friend
            </h1>
            <p className="text-xs text-primary-foreground/70 mt-0.5">
              Share the love, earn rewards
            </p>
          </div>
        </div>
      </div>
      <div className="container px-4 mt-6 space-y-4">
        <div className="bg-foreground text-background rounded-2xl p-6 text-center">
          <Gift className="w-12 h-12 text-accent mx-auto mb-3" />
          <h3 className="text-lg font-bold">Give R50, Get R50</h3>
          <p className="text-sm text-background/60 mt-2">
            Share your code with friends. When they make their first order, you
            both get R50 off!
          </p>
          <div className="mt-5 flex items-center gap-2 justify-center">
            <div className="bg-background/10 border border-background/20 rounded-xl px-5 py-3">
              <span className="font-mono font-bold text-lg tracking-wider">
                {code}
              </span>
            </div>
            <button
              onClick={handleCopy}
              className="p-3 rounded-xl bg-accent text-accent-foreground hover:opacity-90 transition-opacity"
            >
              {copied ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Copy className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
        <div className="bg-background border border-border rounded-2xl p-4">
          <h3 className="font-bold text-foreground text-sm mb-2">
            Your Referrals
          </h3>
          <p className="text-sm text-muted-foreground">
            No referrals yet. Share your code to get started!
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
