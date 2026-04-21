import { Link } from "react-router-dom";
import {
  Facebook,
  Instagram,
  Youtube,
  Twitter,
  Star,
  CreditCard,
  Shield,
} from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-zinc-900 text-white mt-16">
      {/* Mobile compact footer */}
      <div className="md:hidden container px-4 pt-6 pb-24">
        <div className="flex flex-col items-center gap-4">
          {/* Social icons */}
          <div className="flex gap-3">
            {[
              { icon: Facebook, label: "Facebook" },
              { icon: Twitter, label: "X" },
              { icon: Instagram, label: "Instagram" },
              { icon: Youtube, label: "YouTube" },
            ].map(({ icon: Icon, label }) => (
              <a
                key={label}
                href="#"
                aria-label={label}
                className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center transition-all duration-300 hover:text-white hover:shadow-lg hover:shadow-amber-500/20"
                style={{}}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #D4AF37, #B8962E)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                }}
              >
                <Icon className="w-4 h-4" />
              </a>
            ))}
          </div>

          {/* Quick links row */}
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            {[
              { label: "Catalogue", to: "/catalogue" },
              { label: "Editorial", to: "/editorial" },
              { label: "Gift Cards", to: "/gift-cards" },
              { label: "Loyalty", to: "/loyalty" },
              { label: "Support", to: "/support" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="text-xs text-white/70 hover:text-accent transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* Legal links */}
          <div className="flex gap-4">
            <Link
              to="/legal"
              className="text-[10px] text-white/50 hover:text-accent"
            >
              Terms
            </Link>
            <Link
              to="/legal"
              className="text-[10px] text-white/50 hover:text-accent"
            >
              Privacy
            </Link>
          </div>

          {/* Copyright & powered by */}
          <div className="flex flex-col items-center gap-1 pt-2">
            <div className="flex items-center gap-2">
              <img
                src="/liqzar-logo.png"
                alt="LIQZAR"
                className="w-10 h-10 object-contain"
                style={{
                  filter:
                    "drop-shadow(0 0 8px rgba(212,175,55,0.2)) drop-shadow(0 0 16px rgba(212,175,55,0.15))",
                }}
              />
              <span
                className="text-base font-extrabold"
                style={{
                  background:
                    "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                LIQZAR
              </span>
            </div>
            <p className="text-[10px] text-white/50">
              &copy; {new Date().getFullYear()} LIQZAR
            </p>
            <p className="text-[10px] text-white/40">
              Powered by{" "}
              <a
                href="https://akhanya.co.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-semibold hover:underline"
              >
                Akhanya IT
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Desktop full footer grid */}
      <div className="hidden md:block">
        {/* Gold gradient line at the very top */}
        <div
          className="h-[2px] w-full"
          style={{
            background:
              "linear-gradient(90deg, transparent, #D4AF37, #F5E6A3, #D4AF37, transparent)",
          }}
        />

        <div className="container px-4 pt-12 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-6">
            {/* About Us */}
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                About Us
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Our Company", to: "/legal" },
                  { label: "Our Story", to: "/legal" },
                  { label: "Awards", to: "/legal" },
                  { label: "Careers", to: "/legal" },
                  { label: "Sustainability", to: "/legal" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-white/70 hover:text-accent transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick Links */}
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                Quick Links
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Catalogue", to: "/catalogue" },
                  { label: "Editorial", to: "/editorial" },
                  { label: "Gift Cards", to: "/gift-cards" },
                  { label: "Loyalty Programme", to: "/loyalty" },
                  { label: "Refer a Friend", to: "/referral" },
                  { label: "Bulk Orders", to: "/bulk-order" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-white/70 hover:text-accent transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                Legal
              </h4>
              <ul className="space-y-2.5">
                {[
                  { label: "Terms & Conditions", to: "/legal" },
                  { label: "Privacy Policy", to: "/legal" },
                  { label: "Cookie Policy", to: "/legal" },
                  { label: "Disclaimer", to: "/legal" },
                  { label: "Returns Policy", to: "/legal" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link
                      to={item.to}
                      className="text-sm text-white/70 hover:text-accent transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Payment & Social */}
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                Accepted Payments
              </h4>
              <div className="flex flex-wrap gap-2 mb-6">
                {[
                  "Visa",
                  "Mastercard",
                  "Amex",
                  "Apple Pay",
                  "Google Pay",
                  "PayPal",
                ].map((method) => (
                  <span
                    key={method}
                    className="px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-semibold text-white/70"
                    style={{
                      border: "1px solid rgba(212, 175, 55, 0.25)",
                    }}
                  >
                    {method}
                  </span>
                ))}
              </div>

              <h4
                className="text-xs font-bold uppercase tracking-wider mb-3"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                Follow Us
              </h4>
              <div className="flex gap-3">
                {[
                  { icon: Facebook, label: "Facebook" },
                  { icon: Twitter, label: "X" },
                  { icon: Instagram, label: "Instagram" },
                  { icon: Youtube, label: "YouTube" },
                ].map(({ icon: Icon, label }) => (
                  <a
                    key={label}
                    href="#"
                    aria-label={label}
                    className="w-9 h-9 rounded-full bg-white/10 text-white flex items-center justify-center transition-all duration-300 hover:text-white hover:shadow-lg hover:shadow-amber-500/20"
                    style={{}}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "linear-gradient(135deg, #D4AF37, #B8962E)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.1)";
                    }}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Reviews */}
            <div>
              <h4
                className="text-xs font-bold uppercase tracking-wider mb-4"
                style={{ color: "#D4AF37", letterSpacing: "0.1em" }}
              >
                Our Reviews
              </h4>
              <div className="flex items-center gap-1.5 mb-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i < 4 ? "fill-accent text-accent" : "fill-accent/50 text-accent/50"}`}
                  />
                ))}
              </div>
              <p className="text-sm font-bold text-white">2,500+ Reviews</p>
              <p className="text-xs text-white/60 mt-0.5">
                Rated excellent by our customers
              </p>

              <div className="flex items-center gap-2 mt-4">
                <Shield className="w-4 h-4 text-accent" />
                <span className="text-xs text-white/70">
                  100% Secure Shopping
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom bar - desktop only */}
      <div className="hidden md:block border-t border-white/10">
        <div className="container px-4 py-6">
          <div className="flex flex-col items-center gap-3">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <img
                src="/liqzar-logo.png"
                alt="LIQZAR"
                className="w-12 h-12 object-contain"
                style={{
                  filter: "drop-shadow(0 0 8px rgba(212,175,55,0.2))",
                }}
              />
              <div className="flex flex-col">
                <span
                  className="text-lg font-extrabold font-display"
                  style={{
                    background:
                      "linear-gradient(135deg, #D4AF37, #F5E6A3, #D4AF37)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                  }}
                >
                  LIQZAR
                </span>
                <span
                  className="text-[10px] font-semibold tracking-widest uppercase"
                  style={{ color: "rgba(212, 175, 55, 0.5)" }}
                >
                  Reserve the Finest.
                </span>
              </div>
            </div>

            {/* Gold gradient separator */}
            <div
              className="h-[1px] w-full max-w-md my-1"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #D4AF37, #F5E6A3, #D4AF37, transparent)",
              }}
            />

            <p className="text-xs text-white/50 text-center max-w-xl">
              &copy; {new Date().getFullYear()} LIQZAR. Not for sale to persons
              under 18.
            </p>

            <p className="text-[11px] text-white/40 text-center">
              Powered by{" "}
              <a
                href="https://akhanya.co.za"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent font-semibold hover:underline"
              >
                Akhanya IT
              </a>
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
