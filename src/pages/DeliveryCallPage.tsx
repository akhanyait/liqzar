import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PhoneOff, Loader2, AlertTriangle } from "lucide-react";
import { useCallToken } from "@/hooks/useCallToken";

/**
 * DeliveryCallPage — in-app voice/video call between the customer and the
 * driver for a given order. Uses a Daily.co room loaded in an iframe for a
 * zero-SDK, zero-native-dep experience. Joining is gated by
 * `issue-call-token` which verifies the caller is authorized for the order.
 */
const DeliveryCallPage = () => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { request, error } = useCallToken();
  const [joining, setJoining] = useState(true);
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      const result = await request(orderId);
      if (cancelled) return;
      if (result) {
        const sep = result.roomUrl.includes("?") ? "&" : "?";
        setJoinUrl(`${result.roomUrl}${sep}t=${encodeURIComponent(result.token)}`);
      }
      setJoining(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const hangUp = () => navigate(-1);

  if (joining) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm text-white/70">Connecting call…</p>
      </div>
    );
  }

  if (error || !joinUrl) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-400" />
        <div>
          <h1 className="text-xl font-bold">Can't start the call</h1>
          <p className="text-sm text-white/70 mt-1">
            {error || "The call service is not configured yet."}
          </p>
        </div>
        <button
          onClick={hangUp}
          className="mt-4 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-white/10 hover:bg-white/20 transition"
        >
          <PhoneOff className="w-4 h-4" /> Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <iframe
        ref={iframeRef}
        title="Delivery call"
        src={joinUrl}
        allow="camera; microphone; fullscreen; speaker; display-capture; autoplay"
        className="flex-1 w-full border-0"
      />
      <div className="p-4 bg-black flex justify-center">
        <button
          onClick={hangUp}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-red-600 hover:bg-red-500 text-white font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          aria-label="End call"
        >
          <PhoneOff className="w-5 h-5" /> End call
        </button>
      </div>
    </div>
  );
};

export default DeliveryCallPage;
