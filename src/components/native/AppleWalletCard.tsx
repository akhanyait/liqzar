import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  Star,
  Gift,
  ChevronRight,
  Sparkles,
  Wine,
  Crown,
  QrCode,
  Copy,
  Share2,
} from "lucide-react";
import { useHaptics } from "@/hooks/useNativeFeatures";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface AppleWalletCardProps {
  memberName: string;
  memberSince: string;
  tier: "bronze" | "silver" | "gold" | "platinum";
  points: number;
  memberId: string;
  nextTierPoints?: number;
  onAddToWallet?: () => void;
}

const AppleWalletCard = ({
  memberName,
  memberSince,
  tier,
  points,
  memberId,
  nextTierPoints,
  onAddToWallet,
}: AppleWalletCardProps) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const { impact, notification } = useHaptics();

  const tierColors = {
    bronze: {
      gradient: "from-amber-700 via-amber-600 to-amber-800",
      accent: "text-amber-200",
      icon: Star,
    },
    silver: {
      gradient: "from-slate-400 via-slate-300 to-slate-500",
      accent: "text-slate-700",
      icon: Star,
    },
    gold: {
      gradient: "from-yellow-500 via-yellow-400 to-amber-500",
      accent: "text-yellow-900",
      icon: Crown,
    },
    platinum: {
      gradient: "from-slate-700 via-slate-600 to-slate-800",
      accent: "text-slate-200",
      icon: Crown,
    },
  };

  const currentTier = tierColors[tier];
  const TierIcon = currentTier.icon;
  const progress = nextTierPoints ? (points / nextTierPoints) * 100 : 100;

  const handleCopyId = () => {
    navigator.clipboard.writeText(memberId);
    impact("light");
    toast({ title: "Copied!", description: "Member ID copied to clipboard" });
  };

  const handleShare = async () => {
    impact("light");
    if (navigator.share) {
      await navigator.share({
        title: "My LIQZAR Loyalty Card",
        text: `Join LIQZAR! Use my referral code: ${memberId}`,
        url: "https://liqzar.co.za/signup",
      });
    } else {
      handleCopyId();
    }
  };

  const handleAddToWallet = () => {
    impact("medium");
    notification("success");
    toast({
      title: "Added to Wallet",
      description: "Your loyalty card has been added to Apple Wallet",
    });
    onAddToWallet?.();
  };

  return (
    <div className="relative perspective-1000">
      <motion.div
        className="relative"
        whileTap={{ scale: 0.98 }}
        onClick={() => {
          setIsFlipped(!isFlipped);
          impact("light");
        }}
      >
        {/* Card Front */}
        <motion.div
          className={`relative w-full aspect-[1.586] rounded-2xl overflow-hidden shadow-2xl ${
            isFlipped ? "hidden" : ""
          }`}
        >
          {/* Gradient background */}
          <div
            className={`absolute inset-0 bg-gradient-to-br ${currentTier.gradient}`}
          />

          {/* Pattern overlay */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <pattern
                id="pattern"
                x="0"
                y="0"
                width="10"
                height="10"
                patternUnits="userSpaceOnUse"
              >
                <circle cx="5" cy="5" r="1" fill="currentColor" />
              </pattern>
              <rect x="0" y="0" width="100" height="100" fill="url(#pattern)" />
            </svg>
          </div>

          {/* Shine effect */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{
              x: ["-100%", "200%"],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              repeatDelay: 5,
            }}
          />

          {/* Content */}
          <div className="relative h-full p-5 flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Wine className={`w-5 h-5 ${currentTier.accent}`} />
                  <span
                    className={`text-sm font-bold ${currentTier.accent} tracking-wider`}
                  >
                    LIQZAR
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <TierIcon className={`w-4 h-4 ${currentTier.accent}`} />
                  <span
                    className={`text-xs font-bold ${currentTier.accent} uppercase tracking-widest`}
                  >
                    {tier} Member
                  </span>
                </div>
              </div>
              <Wallet className={`w-6 h-6 ${currentTier.accent}`} />
            </div>

            {/* Points */}
            <div>
              <p className={`text-3xl font-bold ${currentTier.accent}`}>
                {points.toLocaleString()}
              </p>
              <p className={`text-xs ${currentTier.accent} opacity-80`}>
                Loyalty Points
              </p>

              {/* Progress to next tier */}
              {nextTierPoints && (
                <div className="mt-2">
                  <div className="h-1.5 bg-black/20 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-white/50 rounded-full`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                  <p
                    className={`text-[10px] ${currentTier.accent} opacity-70 mt-1`}
                  >
                    {nextTierPoints - points} points to next tier
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-end justify-between">
              <div>
                <p className={`text-xs ${currentTier.accent} font-medium`}>
                  {memberName}
                </p>
                <p className={`text-[10px] ${currentTier.accent} opacity-70`}>
                  Member since {memberSince}
                </p>
              </div>
              <p
                className={`text-xs font-mono ${currentTier.accent} tracking-wider`}
              >
                {memberId}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Card Back */}
        {isFlipped && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`relative w-full aspect-[1.586] rounded-2xl overflow-hidden shadow-2xl bg-gradient-to-br ${currentTier.gradient}`}
          >
            <div className="absolute inset-0 bg-black/30" />

            <div className="relative h-full p-5 flex flex-col">
              {/* Barcode area */}
              <div className="flex-1 flex items-center justify-center">
                <div className="bg-white rounded-xl p-4 w-full max-w-[200px]">
                  {/* QR Code placeholder */}
                  <div className="aspect-square bg-black/5 rounded-lg flex items-center justify-center mb-2">
                    <QrCode className="w-16 h-16 text-foreground" />
                  </div>
                  <p className="text-center text-[10px] text-muted-foreground font-mono">
                    {memberId}
                  </p>
                </div>
              </div>

              {/* Actions */}
              <div className="grid grid-cols-2 gap-2 mt-4">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopyId();
                  }}
                  className="flex items-center justify-center gap-1 py-2 bg-white/20 rounded-lg text-xs text-white font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy ID
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleShare();
                  }}
                  className="flex items-center justify-center gap-1 py-2 bg-white/20 rounded-lg text-xs text-white font-medium"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Add to Wallet button */}
      <button
        onClick={handleAddToWallet}
        className="mt-4 w-full py-3 bg-black rounded-xl flex items-center justify-center gap-2"
      >
        <Wallet className="w-5 h-5 text-white" />
        <span className="text-white font-semibold text-sm">
          Add to Apple Wallet
        </span>
      </button>

      {/* Tap hint */}
      <p className="text-center text-xs text-muted-foreground mt-3">
        Tap card to flip • {isFlipped ? "Show front" : "Show QR code"}
      </p>
    </div>
  );
};

export default AppleWalletCard;
