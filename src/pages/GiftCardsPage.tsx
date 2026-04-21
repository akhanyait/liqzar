import { useState } from "react";
import { motion } from "framer-motion";
import { Gift, Send, CreditCard, CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { issueGiftCard, checkGiftCardBalance } from "@/lib/gift-cards";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

const GIFT_CARD_AMOUNTS = [100, 250, 500, 1000, 2500];

const GIFT_THEMES = [
  {
    id: "birthday",
    label: "🎂 Birthday",
    color: "from-pink-500 to-purple-500",
  },
  {
    id: "celebration",
    label: "🥂 Celebration",
    color: "from-primary to-emerald-light",
  },
  {
    id: "thankyou",
    label: "💐 Thank You",
    color: "from-amber-500 to-orange-500",
  },
  { id: "holiday", label: "🎄 Holiday", color: "from-red-600 to-green-600" },
];

export default function GiftCardsPage() {
  const { user } = useAuth();
  const [amount, setAmount] = useState(500);
  const [customAmount, setCustomAmount] = useState("");
  const [theme, setTheme] = useState("celebration");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [issuedCode, setIssuedCode] = useState<string | null>(null);
  const [issuing, setIssuing] = useState(false);

  // Redeem / balance-check state
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemChecking, setRedeemChecking] = useState(false);
  const [redeemBalance, setRedeemBalance] = useState<
    { balanceCents: number; status: string; expiresAt: string | null } | null
  >(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const selectedTheme = GIFT_THEMES.find((t) => t.id === theme)!;
  const displayAmount = customAmount ? parseInt(customAmount) || 0 : amount;

  const handleSend = async () => {
    if (!recipientName || !recipientEmail || displayAmount < 50) return;
    if (!user?.id) {
      toast({
        title: "Sign in required",
        description: "Please sign in to purchase a gift card.",
      });
      return;
    }
    setIssuing(true);
    const res = await issueGiftCard(
      {
        amountCents: Math.round(displayAmount * 100),
        recipientEmail,
        recipientName,
        message: message || undefined,
      },
      user.id,
    );
    setIssuing(false);
    if (res.success === false) {
      toast({
        title: "Could not issue gift card",
        description: res.error,
        variant: "destructive" as any,
      });
      return;
    }
    setIssuedCode(res.code);
    setSent(true);
  };

  const handleCheckBalance = async () => {
    setRedeemError(null);
    setRedeemBalance(null);
    setRedeemChecking(true);
    const res = await checkGiftCardBalance(redeemCode);
    setRedeemChecking(false);
    if (res.success === false) {
      setRedeemError(res.error);
      return;
    }
    setRedeemBalance({
      balanceCents: res.balanceCents,
      status: res.status,
      expiresAt: res.expiresAt,
    });
  };

  if (sent) {
    return (
      <>
        <Header />
        <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring" }}
          >
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-primary" />
            </div>
          </motion.div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Gift Card Issued
          </h1>
          <p className="text-muted-foreground text-sm max-w-sm">
            A R{displayAmount} gift card is ready for{" "}
            <strong>{recipientName}</strong>. Share this code with them:
          </p>
          {issuedCode && (
            <div className="mt-5 px-6 py-4 rounded-xl border border-primary/40 bg-primary/5">
              <p className="text-[10px] tracking-[0.3em] uppercase text-primary font-semibold">
                Code
              </p>
              <p className="mt-1 text-2xl font-mono tracking-[0.24em] text-foreground">
                {issuedCode}
              </p>
            </div>
          )}
          <button
            onClick={() => {
              setSent(false);
              setIssuedCode(null);
              setRecipientName("");
              setRecipientEmail("");
              setMessage("");
            }}
            className="mt-6 px-6 py-2.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm"
          >
            Send Another
          </button>
        </div>
        <BottomNav />
      </>
    );
  }

  return (
    <>
      <Header />
      <div className="pb-28 bg-background overflow-x-hidden">
        <div className="container px-4 py-8 max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Gift className="w-7 h-7 text-primary" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Gift Cards
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Send a digital gift card — perfect for any occasion
            </p>
          </div>

          {/* Preview card */}
          <motion.div
            layout
            className={`bg-gradient-to-br ${selectedTheme.color} rounded-2xl p-6 text-white mb-8 shadow-lg`}
          >
            <div className="flex items-center justify-between mb-8">
              <span className="text-xs font-bold uppercase tracking-wider opacity-80">
                LIQZAR Gift Card
              </span>
              <CreditCard className="w-5 h-5 opacity-70" />
            </div>
            <p className="text-4xl font-display font-extrabold">
              R{displayAmount}
            </p>
            {recipientName && (
              <p className="text-sm opacity-80 mt-2">For {recipientName}</p>
            )}
            {message && (
              <p className="text-xs opacity-60 mt-1 italic">"{message}"</p>
            )}
          </motion.div>

          {/* Amount selection */}
          <div className="mb-6">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Select Amount
            </label>
            <div className="flex flex-wrap gap-2">
              {GIFT_CARD_AMOUNTS.map((a) => (
                <button
                  key={a}
                  onClick={() => {
                    setAmount(a);
                    setCustomAmount("");
                  }}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                    amount === a && !customAmount
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  R{a}
                </button>
              ))}
              <input
                type="number"
                placeholder="Custom"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="w-24 px-3 py-2 rounded-full text-sm border border-border bg-background text-foreground outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Theme */}
          <div className="mb-6">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">
              Card Theme
            </label>
            <div className="flex flex-wrap gap-2">
              {GIFT_THEMES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    theme === t.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:border-primary/50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipient */}
          <div className="space-y-3 mb-6">
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Recipient's name"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <input
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="Recipient's email"
              type="email"
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message (optional)"
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Send */}
          <button
            onClick={handleSend}
            disabled={
              !recipientName || !recipientEmail || displayAmount < 50 || issuing
            }
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
          >
            {issuing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Issuing…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send Gift Card · R{displayAmount}
              </>
            )}
          </button>

          {/* ── Redeem / balance check ── */}
          <div className="mt-10 pt-8 border-t border-border">
            <h2 className="text-base font-semibold text-foreground">
              Already have a card?
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Check the remaining balance before applying at checkout.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                value={redeemCode}
                onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                placeholder="ABCD-1234"
                className="flex-1 px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm tracking-[0.2em] font-mono text-center uppercase outline-none focus:ring-2 focus:ring-primary/30"
                maxLength={9}
              />
              <button
                onClick={handleCheckBalance}
                disabled={redeemChecking || redeemCode.trim().length < 8}
                className="px-4 py-3 rounded-xl warm-gradient text-primary-foreground font-semibold text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {redeemChecking ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Check"
                )}
              </button>
            </div>
            {redeemError && (
              <p className="mt-3 text-xs text-destructive">{redeemError}</p>
            )}
            {redeemBalance && (
              <div className="mt-3 rounded-xl border border-primary/40 bg-primary/5 px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] tracking-[0.28em] uppercase text-primary font-semibold">
                    Balance
                  </p>
                  <p className="text-xl font-display font-bold text-foreground">
                    R
                    {(redeemBalance.balanceCents / 100).toLocaleString(
                      "en-ZA",
                      {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      },
                    )}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-semibold tracking-wide uppercase text-primary bg-primary/10 border border-primary/40 rounded-full capitalize">
                  <ShieldCheck className="w-3 h-3" strokeWidth={2.5} />
                  {redeemBalance.status}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
      <BottomNav />
    </>
  );
}
