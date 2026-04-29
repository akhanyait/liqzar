import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Mail,
  Clock,
} from "lucide-react";

const PRIVACY_EMAIL = "privacy@liqzar.co.za";

export default function AccountDeletionPage() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = email.trim().length > 4 && email.includes("@") && confirmed;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const subject = encodeURIComponent("LIQZAR account deletion request");
    const body = encodeURIComponent(
      [
        "I would like to request permanent deletion of my LIQZAR account and associated personal data.",
        "",
        `Email: ${email}`,
        `Phone (optional): ${phone || "—"}`,
        "",
        "Reason (optional):",
        reason || "—",
        "",
        "I understand that:",
        "• All account data, saved addresses, favourites, and marketing-consent records will be permanently deleted within 30 days of verification.",
        "• Order history, payment records, and tax-related data will be retained for 5 years as required by the Liquor Products Act and SARS.",
        "• This action cannot be undone.",
      ].join("\n"),
    );

    window.location.href = `mailto:${PRIVACY_EMAIL}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle2 className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-display font-bold text-foreground mb-2">
            Request Ready To Send
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your email client should have opened with a pre-filled deletion
            request. If it didn't, please email{" "}
            <a
              href={`mailto:${PRIVACY_EMAIL}`}
              className="text-primary underline"
            >
              {PRIVACY_EMAIL}
            </a>{" "}
            directly with the subject line{" "}
            <em>"LIQZAR account deletion request"</em>.
          </p>
          <p className="text-xs text-muted-foreground mt-5">
            We'll confirm your request within 48 hours and complete deletion
            within 30 days.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 mt-8 text-sm text-primary hover:underline"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to LIQZAR
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-[hsl(222_30%_6%)] to-background border-b border-border">
        <div className="container max-w-3xl px-4 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to LIQZAR
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Trash2 className="w-6 h-6 text-destructive" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                Delete Your Account
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Request permanent deletion of your LIQZAR account and data
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-3xl px-4 py-10 space-y-10">
        {/* What gets deleted / what's retained */}
        <section className="grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-destructive mb-3">
              Permanently deleted
            </p>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li>• Your name, email, and phone</li>
              <li>• Saved delivery addresses</li>
              <li>• Wishlist &amp; favourites</li>
              <li>• Marketing-consent records</li>
              <li>• App preferences &amp; device tokens</li>
              <li>• Support chat history</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-3">
              Retained (legal obligation)
            </p>
            <ul className="space-y-1.5 text-sm text-foreground">
              <li>
                • Order &amp; payment records <span className="text-muted-foreground">(5 years — SARS)</span>
              </li>
              <li>
                • Liquor-licence compliance data <span className="text-muted-foreground">(5 years — Liquor Products Act)</span>
              </li>
              <li>
                • Tax invoices <span className="text-muted-foreground">(5 years)</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">
              Retained records are pseudonymised where possible and cannot be
              accessed by our customer-service team.
            </p>
          </div>
        </section>

        {/* Timeline */}
        <section className="rounded-2xl border border-border bg-card/50 p-5 flex items-start gap-4">
          <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground mb-1">
              Processing timeline
            </h2>
            <ul className="text-sm text-muted-foreground space-y-1 leading-relaxed">
              <li>
                <strong className="text-foreground">Within 48 hours:</strong>{" "}
                we'll email you to verify the request from the account's
                registered address.
              </li>
              <li>
                <strong className="text-foreground">Within 30 days:</strong>{" "}
                deletion is completed. You'll receive confirmation once done.
              </li>
              <li>
                <strong className="text-foreground">Before deletion:</strong>{" "}
                any active orders must be delivered or cancelled.
              </li>
            </ul>
          </div>
        </section>

        {/* Warning */}
        <section className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 flex items-start gap-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-foreground mb-1">
              This cannot be undone
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Once deletion is processed, your data cannot be restored. If you
              return to LIQZAR later, you will need to create a new account and
              any saved preferences will be lost.
            </p>
          </div>
        </section>

        {/* Deletion request form */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h2 className="text-lg font-display font-semibold text-foreground mb-1">
            Submit a deletion request
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Your details help us verify the account and process the request.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
              >
                Email address on the account{" "}
                <span className="text-destructive">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
              >
                Phone number on the account{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+27 12 345 6789"
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div>
              <label
                htmlFor="reason"
                className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2"
              >
                Reason for deletion{" "}
                <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="Helps us improve — leave blank if you'd rather not share."
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-foreground text-sm outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-border"
              />
              <span className="text-sm text-foreground leading-relaxed">
                I confirm that I am the account holder and I understand that
                this deletion is{" "}
                <strong>permanent and cannot be undone</strong>. Records
                retained for legal compliance (see above) will be kept for the
                minimum statutory period.
              </span>
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-full bg-destructive text-destructive-foreground font-semibold text-sm disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              <Trash2 className="w-4 h-4" />
              Send Deletion Request
            </button>
          </form>
        </section>

        {/* Alternative contact */}
        <section className="text-center border-t border-border pt-8">
          <Mail className="w-5 h-5 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Prefer to email directly? Write to{" "}
            <a
              href={`mailto:${PRIVACY_EMAIL}?subject=LIQZAR%20account%20deletion%20request`}
              className="text-primary underline font-medium"
            >
              {PRIVACY_EMAIL}
            </a>
            <br />
            with the subject{" "}
            <em className="text-foreground">"LIQZAR account deletion request"</em>.
          </p>
        </section>
      </div>
    </div>
  );
}
