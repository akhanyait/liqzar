import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, FileText, Loader2, ShieldCheck } from "lucide-react";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/layout/BottomNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  CorporateAccount,
  CorporateInvoice,
  fetchMyCorporateAccount,
  listMyInvoices,
  requestCorporateAccount,
} from "@/lib/corporate";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

const fmtR = (cents: number) =>
  `R${(cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function CorporateAccountsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [account, setAccount] = useState<CorporateAccount | null>(null);
  const [invoices, setInvoices] = useState<CorporateInvoice[]>([]);
  const [form, setForm] = useState({
    company_name: "",
    registration_no: "",
    vat_number: "",
    billing_email: "",
    notes: "",
  });

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    fetchMyCorporateAccount()
      .then(async (acc) => {
        setAccount(acc);
        if (acc) setInvoices(await listMyInvoices(acc.id));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleSubmit = async () => {
    if (!form.company_name.trim() || !form.billing_email.trim()) {
      toast({ title: "Company name and billing email are required" });
      return;
    }
    setSubmitting(true);
    try {
      const acc = await requestCorporateAccount({
        company_name: form.company_name.trim(),
        registration_no: form.registration_no.trim() || undefined,
        vat_number: form.vat_number.trim() || undefined,
        billing_email: form.billing_email.trim(),
      });
      setAccount(acc);
      toast({
        title: "Application submitted",
        description: "Our team will verify your details and activate your account within 1 business day.",
      });
    } catch (e: any) {
      toast({
        title: "Could not submit",
        description: e?.message ?? "Please try again later.",
        variant: "destructive" as any,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Header />
      <main className="min-h-screen bg-background pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6">
          {/* Editorial header */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="h-px w-10 bg-primary mx-auto" />
            <p className="text-[10px] tracking-[0.3em] text-primary font-semibold mt-3 uppercase">
              For Business
            </p>
            <h1 className="font-display text-3xl font-bold mt-2">Corporate Accounts</h1>
            <p className="text-sm text-muted-foreground italic mt-2 leading-relaxed max-w-md mx-auto">
              One account, dedicated concierge, consolidated invoicing on net-30 terms.
              Perfect for boardrooms, hospitality, and gifting at scale.
            </p>
            <div className="h-px w-10 bg-primary mx-auto mt-4" />
          </motion.div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
            </div>
          ) : account ? (
            <div className="space-y-6">
              {/* Account card */}
              <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{account.company_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {account.status} · net-{account.net_terms_days} days
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-primary/20">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {fmtR(account.current_balance_cents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit Limit</p>
                    <p className="text-lg font-bold text-foreground mt-0.5">
                      {fmtR(account.credit_limit_cents)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoices */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-primary" />
                  <h2 className="font-display font-bold text-lg">Invoices</h2>
                </div>
                {invoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 border border-dashed border-border rounded-2xl">
                    No invoices yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invoices.map((inv) => (
                      <div
                        key={inv.id}
                        className="flex items-center justify-between p-3 rounded-xl border border-border bg-card"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{inv.invoice_no}</p>
                          <p className="text-[11px] text-muted-foreground">
                            Due {format(new Date(inv.due_at), "d MMM yyyy")}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">{fmtR(inv.amount_cents)}</p>
                          <p
                            className={`text-[10px] uppercase tracking-wide font-semibold ${
                              inv.status === "paid"
                                ? "text-emerald-600"
                                : inv.status === "overdue"
                                  ? "text-destructive"
                                  : "text-primary"
                            }`}
                          >
                            {inv.status}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 rounded-2xl border border-border bg-card p-5">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Company Name *
                </label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
                  placeholder="Acme (Pty) Ltd"
                  className="mt-1.5"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Reg. No.
                  </label>
                  <Input
                    value={form.registration_no}
                    onChange={(e) => setForm((f) => ({ ...f, registration_no: e.target.value }))}
                    placeholder="2024/123456/07"
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    VAT No.
                  </label>
                  <Input
                    value={form.vat_number}
                    onChange={(e) => setForm((f) => ({ ...f, vat_number: e.target.value }))}
                    placeholder="4123456789"
                    className="mt-1.5"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Billing Email *
                </label>
                <Input
                  type="email"
                  value={form.billing_email}
                  onChange={(e) => setForm((f) => ({ ...f, billing_email: e.target.value }))}
                  placeholder="accounts@acme.co.za"
                  className="mt-1.5"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Notes
                </label>
                <Textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder="Anything our concierge team should know..."
                  className="mt-1.5 resize-none"
                  rows={3}
                  maxLength={500}
                />
              </div>
              <Button
                className="w-full warm-gradient text-primary-foreground rounded-xl"
                size="lg"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Apply for Corporate Account
                  </>
                )}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                Verification typically completes within 1 business day.
              </p>
            </div>
          )}
        </div>
      </main>
      <BottomNav />
    </>
  );
}
