import { Link } from "react-router-dom";
import { ShieldCheck, ArrowLeft } from "lucide-react";

const EFFECTIVE_DATE = "23 April 2026";

const sections = [
  { id: "who-we-are", label: "1. Who We Are" },
  { id: "information-we-collect", label: "2. Information We Collect" },
  { id: "how-we-use", label: "3. How We Use Your Information" },
  { id: "legal-basis", label: "4. Legal Basis For Processing" },
  { id: "third-parties", label: "5. Third-Party Services & Sharing" },
  { id: "age-restriction", label: "6. Age Restriction (18+)" },
  { id: "retention", label: "7. Data Retention" },
  { id: "security", label: "8. Security" },
  { id: "your-rights", label: "9. Your Rights" },
  { id: "cross-border", label: "10. Cross-Border Transfers" },
  { id: "cookies", label: "11. Cookies & Tracking" },
  { id: "children", label: "12. Children's Privacy" },
  { id: "changes", label: "13. Changes To This Policy" },
  { id: "contact", label: "14. Contact Us" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-b from-[hsl(222_30%_6%)] to-background border-b border-border">
        <div className="container max-w-4xl px-4 py-8">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to LIQZAR
          </Link>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground">
                Privacy Policy
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Effective date: {EFFECTIVE_DATE}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container max-w-4xl px-4 py-10 grid md:grid-cols-[220px_1fr] gap-10">
        {/* Table of contents */}
        <aside className="md:sticky md:top-6 md:self-start hidden md:block">
          <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-muted-foreground mb-3">
            On this page
          </p>
          <nav className="space-y-1.5 text-sm">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block text-muted-foreground hover:text-primary transition-colors leading-tight"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <article className="prose prose-sm md:prose-base max-w-none text-foreground [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-foreground [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-foreground [&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground [&_li]:leading-relaxed [&_strong]:text-foreground [&_a]:text-primary [&_a]:underline">
          <p>
            LIQZAR (<strong>"LIQZAR"</strong>, <strong>"we"</strong>,{" "}
            <strong>"us"</strong>, or <strong>"our"</strong>) is committed to
            protecting your privacy. This Privacy Policy explains how we collect,
            use, disclose, and safeguard your information when you use our
            website (<a href="https://liqzar.co.za">liqzar.co.za</a>) and our
            mobile applications for iOS and Android (together, the{" "}
            <strong>"Services"</strong>).
          </p>
          <p>
            We process personal information in accordance with the{" "}
            <strong>Protection of Personal Information Act, 2013 (POPIA)</strong>{" "}
            of South Africa and, where applicable, the{" "}
            <strong>General Data Protection Regulation (GDPR)</strong> of the
            European Union.
          </p>

          <h2 id="who-we-are">1. Who We Are</h2>
          <p>
            LIQZAR is a licensed premium liquor delivery service operating in
            South Africa. For the purposes of POPIA, the{" "}
            <strong>responsible party</strong> is:
          </p>
          <ul>
            <li>
              <strong>LIQZAR</strong> — operated by Akhanya IT (Pty) Ltd
            </li>
            <li>Registered in: South Africa</li>
            <li>
              Contact:{" "}
              <a href="mailto:privacy@liqzar.co.za">privacy@liqzar.co.za</a>
            </li>
          </ul>

          <h2 id="information-we-collect">2. Information We Collect</h2>

          <h3>2.1 Information you provide directly</h3>
          <ul>
            <li>
              <strong>Account information:</strong> name, mobile phone number,
              email address, and password (stored hashed).
            </li>
            <li>
              <strong>Age verification:</strong> date of birth (used solely to
              confirm you are 18 years or older).
            </li>
            <li>
              <strong>Delivery information:</strong> delivery address, recipient
              name, recipient phone, optional gift note.
            </li>
            <li>
              <strong>Payment information:</strong> card details are collected
              and processed directly by our payment processor (Yoco). LIQZAR
              does not store full card numbers; we retain only a masked last-4,
              card brand, and a payment token for refund purposes.
            </li>
            <li>
              <strong>Identity verification (drivers only):</strong> ID number,
              driver's licence details, and a selfie photograph for KYC.
            </li>
            <li>
              <strong>Communications:</strong> messages you send to our support
              channels or concierge service.
            </li>
          </ul>

          <h3>2.2 Information collected automatically</h3>
          <ul>
            <li>
              <strong>Device information:</strong> device model, operating
              system, app version, and a unique app install identifier.
            </li>
            <li>
              <strong>Location data:</strong> with your permission, we access
              your precise location to auto-fill delivery addresses and to
              calculate delivery estimates. Drivers' locations are tracked
              during active deliveries only.
            </li>
            <li>
              <strong>Usage data:</strong> pages visited, products viewed,
              orders placed, approximate session duration.
            </li>
            <li>
              <strong>Log data:</strong> IP address, browser type, timestamps
              of requests, and diagnostic logs.
            </li>
          </ul>

          <h2 id="how-we-use">3. How We Use Your Information</h2>
          <p>We use the information we collect to:</p>
          <ul>
            <li>Create and maintain your LIQZAR account.</li>
            <li>
              Verify your age (18+) as required by South African alcohol
              legislation.
            </li>
            <li>Process, fulfil, and deliver your orders.</li>
            <li>
              Process payments and issue refunds via our payment gateway.
            </li>
            <li>
              Send order confirmations, delivery updates, and customer-service
              messages by SMS, email, or push notification.
            </li>
            <li>
              Improve our Services — including product recommendations and
              personalised content.
            </li>
            <li>
              Prevent fraud, enforce our Terms of Service, and comply with
              applicable laws.
            </li>
            <li>
              Send marketing communications where you have consented (you may
              withdraw consent at any time).
            </li>
          </ul>

          <h2 id="legal-basis">4. Legal Basis For Processing</h2>
          <p>Under POPIA and GDPR, we process personal information where:</p>
          <ul>
            <li>
              <strong>You have given consent</strong> (for example, marketing
              communications and precise location access).
            </li>
            <li>
              <strong>Processing is necessary for a contract</strong> with you
              (fulfilling your order, enabling payment).
            </li>
            <li>
              <strong>We have a legitimate interest</strong> that is not
              overridden by your rights (fraud prevention, service improvement).
            </li>
            <li>
              <strong>We are legally obliged</strong> to process it (age
              verification, tax records, liquor licence compliance).
            </li>
          </ul>

          <h2 id="third-parties">5. Third-Party Services & Sharing</h2>
          <p>
            We share personal information only with trusted partners required
            to deliver our Services:
          </p>
          <ul>
            <li>
              <strong>Supabase</strong> (database &amp; authentication) —
              hosted in the EU. Stores your account and order data.
            </li>
            <li>
              <strong>Yoco</strong> (payment processor, South Africa) — handles
              card and EFT payments. Subject to PCI-DSS.
            </li>
            <li>
              <strong>Google Maps Platform</strong> — used for address
              autocomplete and delivery routing.
            </li>
            <li>
              <strong>Mapbox</strong> — used for interactive delivery maps.
            </li>
            <li>
              <strong>Expo Push Notification Service</strong> — used to deliver
              order updates to your device.
            </li>
            <li>
              <strong>Our licensed delivery drivers</strong> — receive the
              minimum information needed to complete delivery (name, phone,
              delivery address).
            </li>
            <li>
              <strong>Law enforcement &amp; regulators</strong> — where
              lawfully required (for example, SAPS warrants, SARS audits, or
              the Information Regulator of South Africa).
            </li>
          </ul>
          <p>
            <strong>We do not sell your personal information to third parties.</strong>
          </p>

          <h2 id="age-restriction">6. Age Restriction (18+)</h2>
          <p>
            LIQZAR is strictly for users 18 years of age or older. We enforce
            an age gate at account creation, require proof of age at delivery,
            and reserve the right to refuse any order where the age of the
            recipient cannot be verified.
          </p>
          <p>
            If we become aware that a user under 18 has created an account, we
            will delete that account immediately and refund any active orders
            in full.
          </p>

          <h2 id="retention">7. Data Retention</h2>
          <ul>
            <li>
              <strong>Account data:</strong> retained while your account is
              active and for 5 years after closure, as required by the Liquor
              Products Act and SARS.
            </li>
            <li>
              <strong>Order records:</strong> 5 years (tax &amp; licensing
              compliance).
            </li>
            <li>
              <strong>Payment records:</strong> 5 years (financial audit).
            </li>
            <li>
              <strong>Marketing-consent records:</strong> until you unsubscribe.
            </li>
            <li>
              <strong>Diagnostic logs:</strong> 90 days.
            </li>
            <li>
              <strong>Driver location history:</strong> 30 days post-delivery.
            </li>
          </ul>

          <h2 id="security">8. Security</h2>
          <p>
            We take reasonable and appropriate technical and organisational
            measures to safeguard your information, including:
          </p>
          <ul>
            <li>TLS 1.2+ encryption for all data in transit.</li>
            <li>AES-256 encryption at rest for our database.</li>
            <li>Row-level security policies on every database table.</li>
            <li>
              Role-based access controls; admin access is MFA-protected.
            </li>
            <li>
              Payment card data is tokenised and never stored on our systems.
            </li>
            <li>Regular security reviews and penetration testing.</li>
          </ul>
          <p>
            No system is ever perfectly secure. If we become aware of a
            security incident affecting your personal information, we will
            notify you and the Information Regulator of South Africa without
            undue delay, as required by POPIA.
          </p>

          <h2 id="your-rights">9. Your Rights</h2>
          <p>Under POPIA and GDPR, you have the right to:</p>
          <ul>
            <li>
              <strong>Access</strong> — request a copy of the personal
              information we hold about you.
            </li>
            <li>
              <strong>Correct</strong> — ask us to correct inaccurate or
              incomplete data.
            </li>
            <li>
              <strong>Delete</strong> — ask us to delete your account and
              personal information (subject to legal retention obligations).
            </li>
            <li>
              <strong>Object</strong> — object to the processing of your
              personal information for direct marketing or on legitimate-interest
              grounds.
            </li>
            <li>
              <strong>Restrict</strong> — restrict processing while a
              correction or objection is resolved.
            </li>
            <li>
              <strong>Port</strong> — receive your data in a structured,
              machine-readable format.
            </li>
            <li>
              <strong>Withdraw consent</strong> — at any time, without
              affecting the lawfulness of prior processing.
            </li>
            <li>
              <strong>Lodge a complaint</strong> — with the Information
              Regulator of South Africa at{" "}
              <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">
                inforegulator.org.za
              </a>
              .
            </li>
          </ul>
          <p>
            To exercise any of these rights, email us at{" "}
            <a href="mailto:privacy@liqzar.co.za">privacy@liqzar.co.za</a>. We
            will respond within 30 days.
          </p>

          <h2 id="cross-border">10. Cross-Border Transfers</h2>
          <p>
            Some of our service providers (including Supabase) store data in
            the European Union. When we transfer personal information outside
            South Africa, we ensure the destination country provides an
            adequate level of protection, or we put in place appropriate
            safeguards (such as Standard Contractual Clauses) as required by
            POPIA section 72.
          </p>

          <h2 id="cookies">11. Cookies & Tracking</h2>
          <p>
            Our website uses a small number of cookies and similar technologies
            to keep you signed in, remember your cart, and measure site
            performance. We do not use third-party advertising or behavioural
            tracking cookies.
          </p>
          <p>
            You can disable cookies in your browser settings. Doing so may
            limit some functionality (such as the persistent shopping cart).
          </p>

          <h2 id="children">12. Children's Privacy</h2>
          <p>
            Our Services are not directed to, nor intended for, persons under
            the age of 18. We do not knowingly collect personal information
            from anyone under 18. See Section 6 above for our enforcement
            policy.
          </p>

          <h2 id="changes">13. Changes To This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make
            material changes, we will notify you by email or a prominent
            in-app message. The "effective date" at the top of this page
            reflects the most recent revision.
          </p>

          <h2 id="contact">14. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy or how we
            handle your personal information, please contact us at:
          </p>
          <ul>
            <li>
              Email:{" "}
              <a href="mailto:privacy@liqzar.co.za">privacy@liqzar.co.za</a>
            </li>
            <li>
              Website:{" "}
              <a href="https://liqzar.co.za">liqzar.co.za</a>
            </li>
          </ul>
          <p>
            For complaints, you may also contact the Information Regulator of
            South Africa:
          </p>
          <ul>
            <li>
              Website:{" "}
              <a href="https://inforegulator.org.za" target="_blank" rel="noopener noreferrer">
                inforegulator.org.za
              </a>
            </li>
            <li>
              Email:{" "}
              <a href="mailto:inforeg@justice.gov.za">inforeg@justice.gov.za</a>
            </li>
          </ul>
        </article>
      </div>
    </div>
  );
}
