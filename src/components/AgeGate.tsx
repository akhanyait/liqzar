import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface AgeGateProps {
  onVerified: () => void;
}

const AgeGate = ({ onVerified }: AgeGateProps) => {
  const [exiting, setExiting] = useState(false);

  const handleVerify = () => {
    setExiting(true);
    setTimeout(() => {
      localStorage.setItem("liqzar-age-verified", "true");
      onVerified();
    }, 600);
  };

  return (
    <AnimatePresence>
      {!exiting && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, #1a1510 0%, #0d0b08 50%, #050403 100%)",
          }}
        >
          {/* Subtle gold ambient glow */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full opacity-[0.07] pointer-events-none"
            style={{
              background:
                "radial-gradient(circle, #D4AF37 0%, transparent 70%)",
            }}
          />

          {/* Second larger pulsing glow */}
          <div
            className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-[0.04] pointer-events-none animate-pulse"
            style={{
              background:
                "radial-gradient(circle, #D4AF37 0%, transparent 60%)",
            }}
          />

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: "easeOut" }}
            className="relative text-center px-8 max-w-sm w-full"
          >
            {/* Logo */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5 }}
              className="mx-auto mb-8"
            >
              {/* Gold ring wrapper */}
              <div
                className="w-fit mx-auto flex items-center justify-center"
                style={{
                  border: "2px solid rgba(212,175,55,0.25)",
                  borderRadius: "9999px",
                  padding: "12px",
                  boxShadow: "0 0 60px rgba(212,175,55,0.12)",
                }}
              >
                <img
                  src="/liqzar-logo.png"
                  alt="LIQZAR"
                  className="w-28 h-28 object-contain"
                  style={{
                    filter: "drop-shadow(0 0 30px rgba(212,175,55,0.25))",
                  }}
                />
              </div>
            </motion.div>

            {/* Brand name */}
            <h1
              className="text-5xl font-bold mb-1 tracking-tight"
              style={{
                background:
                  "linear-gradient(135deg, #F5F0E8, #FFFFFF, #F5F0E8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                textShadow: "0 0 40px rgba(212,175,55,0.15)",
              }}
            >
              LIQZAR
            </h1>
            <p
              className="text-xs font-medium mb-12 tracking-[0.3em] uppercase"
              style={{ color: "#9A8860" }}
            >
              — RESERVE THE FINEST.
            </p>

            {/* Divider with gold diamond dots */}
            <div className="flex items-center gap-4 mb-10">
              <div className="flex items-center flex-1">
                <span
                  className="inline-block w-1.5 h-1.5 rotate-45 flex-shrink-0"
                  style={{ background: "#D4AF37", opacity: 0.5 }}
                />
                <div className="flex-1 h-px bg-gradient-to-r from-amber-700/30 to-transparent" />
              </div>
              <span
                className="text-sm font-semibold tracking-wide"
                style={{ color: "#C9B682" }}
              >
                Age Verification
              </span>
              <div className="flex items-center flex-1">
                <div className="flex-1 h-px bg-gradient-to-l from-amber-700/30 to-transparent" />
                <span
                  className="inline-block w-1.5 h-1.5 rotate-45 flex-shrink-0"
                  style={{ background: "#D4AF37", opacity: 0.5 }}
                />
              </div>
            </div>

            <p className="text-white/70 text-base mb-8 leading-relaxed">
              You must be{" "}
              <span className="text-white font-semibold">
                18 years or older
              </span>{" "}
              to access this site.
            </p>

            {/* Buttons */}
            <div className="flex flex-col gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleVerify}
                className="w-full h-16 font-semibold text-sm rounded-2xl transition-all duration-300"
                style={{
                  background:
                    "linear-gradient(135deg, #D4AF37, #B8962E, #D4AF37)",
                  color: "#0d0b08",
                  boxShadow:
                    "0 6px 30px rgba(212,175,55,0.35), 0 2px 10px rgba(212,175,55,0.2)",
                }}
              >
                Yes, I'm 18 or older
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => (window.location.href = "https://google.com")}
                className="w-full h-16 font-medium text-sm rounded-2xl transition-all duration-300"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.4)",
                  border: "1px solid rgba(212,175,55,0.25)",
                }}
              >
                No, I'm under 18
              </motion.button>
            </div>

            {/* Legal text */}
            <p
              className="text-[11px] mt-10 leading-relaxed font-medium"
              style={{ color: "rgba(255,255,255,0.3)" }}
            >
              Not for sale to persons under the age of 18
            </p>
            <p
              className="text-[11px] mt-2 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.25)" }}
            >
              By entering, you confirm you are of legal drinking age in your
              country and agree to our Terms of Service.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default AgeGate;
