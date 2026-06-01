import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

 
const supabase = typedSupabase as any;

interface Props {
  orderId: string;
  expiresInHours?: number;
}

const generateToken = () => {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  // URL-safe base64 without padding.
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
};

/**
 * ShareTripButton — creates a single-use-ish share token and copies the
 * public trip URL (/track/:token) to clipboard. Token valid for
 * `expiresInHours` (default 6h) and can be revoked from Order History later.
 */
export const ShareTripButton = ({ orderId, expiresInHours = 6 }: Props) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    if (!user?.id || loading) return;
    setLoading(true);
    try {
      const token = generateToken();
      const expiresAt = new Date(
        Date.now() + expiresInHours * 60 * 60 * 1000,
      ).toISOString();

      const { error } = await supabase.from("order_share_tokens").insert({
        token,
        order_id: orderId,
        created_by: user.id,
        expires_at: expiresAt,
      });
      if (error) {
        console.error("[ShareTripButton] insert failed", error);
        toast({
          title: "Could not create share link",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      const url = `${window.location.origin}/trip/${token}`;

      // Prefer native share sheet on mobile; fall back to clipboard.
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        try {
          await navigator.share({
            title: "Follow my LIQZAR delivery",
            text: "Live track my order",
            url,
          });
          return;
        } catch {
          // user cancelled; fall through to clipboard
        }
      }

      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2_000);
      toast({
        title: "Share link copied",
        description: `Valid for ${expiresInHours} hours.`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={onShare}
      variant="outline"
      disabled={loading}
      className="w-12 h-12 rounded-xl"
      aria-label="Share trip"
    >
      {copied ? (
        <Check className="w-5 h-5 text-green-600" />
      ) : (
        <Share2 className="w-5 h-5" />
      )}
    </Button>
  );
};
