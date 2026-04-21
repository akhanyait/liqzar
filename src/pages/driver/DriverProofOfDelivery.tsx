import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  RotateCcw,
} from "lucide-react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "@/hooks/use-toast";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

const MAX_FILE_BYTES = 8 * 1024 * 1024;

const DriverProofOfDelivery = () => {
  const { orderId = "" } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [notes, setNotes] = useState("");
  const [gps, setGps] = useState<{
    lat: number;
    lng: number;
    accuracy: number | null;
  } | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsError("GPS not available on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setGps({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => setGpsError(err.message),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_FILE_BYTES) {
      toast({
        title: "Photo too large",
        description: "Please keep photos under 8 MB.",
        variant: "destructive",
      });
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const reset = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submit = async () => {
    if (!file) {
      toast({ title: "Photo required", variant: "destructive" });
      return;
    }
    if (!user?.id) {
      toast({ title: "Please sign in", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const ext = file.type === "image/png" ? "png" : "jpg";
      // Path convention enforced by RLS: {driverId}/{orderId}/{filename}
      const path = `${user.id}/${orderId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("delivery-proofs")
        .upload(path, file, {
          contentType: file.type || "image/jpeg",
          upsert: false,
        });
      if (upErr) throw upErr;

      const { data: signed } = await supabase.storage
        .from("delivery-proofs")
        .createSignedUrl(path, 60 * 60 * 24 * 30);

      const { error: insErr } = await supabase
        .from("proof_of_delivery")
        .insert({
          order_id: orderId,
          driver_id: user.id,
          photo_url: signed?.signedUrl ?? null,
          photo_storage_path: path,
          gps_latitude: gps?.lat ?? null,
          gps_longitude: gps?.lng ?? null,
          gps_accuracy: gps?.accuracy ?? null,
          recipient_name: recipientName || null,
          notes: notes || null,
        });
      if (insErr) throw insErr;

      await supabase
        .from("orders")
        .update({
          status: "delivered",
          delivered_at: new Date().toISOString(),
        })
        .eq("id", orderId);

      toast({
        title: "Delivery complete",
        description: "Proof uploaded and customer notified.",
      });
      navigate("/driver");
    } catch (e) {
      toast({
        title: "Could not submit proof",
        description: (e as Error).message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const gpsLabel = useMemo(() => {
    if (gpsError) return `GPS: ${gpsError}`;
    if (!gps) return "Locating…";
    return `${gps.lat.toFixed(5)}, ${gps.lng.toFixed(5)}${
      gps.accuracy ? ` (±${Math.round(gps.accuracy)} m)` : ""
    }`;
  }, [gps, gpsError]);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-card border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="w-10 h-10 rounded-xl hover:bg-secondary flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-foreground">
              Proof of Delivery
            </h1>
            <p className="text-xs text-muted-foreground">Order {orderId}</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl overflow-hidden"
        >
          {preview ? (
            <img
              src={preview}
              alt="Delivery proof preview"
              className="w-full aspect-[4/3] object-cover"
            />
          ) : (
            <div className="aspect-[4/3] bg-neutral-900 flex flex-col items-center justify-center text-white/40">
              <Camera className="w-12 h-12" />
              <p className="text-sm mt-2">Take or upload a photo</p>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            onChange={onPick}
            className="sr-only"
            aria-label="Capture delivery photo"
          />
          <div className="p-4 flex gap-3">
            {!preview ? (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Camera className="w-4 h-4" /> Take photo
              </button>
            ) : (
              <button
                onClick={reset}
                className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-xl border border-border text-foreground font-semibold"
              >
                <RotateCcw className="w-4 h-4" /> Retake
              </button>
            )}
          </div>
        </motion.div>

        <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Recipient name
            </span>
            <input
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="Who received the order?"
              className="mt-1 w-full h-11 rounded-xl bg-background border border-border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">
              Delivery notes
            </span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any notes about the handoff…"
              className="mt-1 w-full rounded-xl bg-background border border-border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            />
          </label>
        </div>

        <div
          className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3"
          role="status"
          aria-live="polite"
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              gps ? "bg-green-500/15" : "bg-amber-500/15"
            }`}
          >
            <MapPin
              className={`w-5 h-5 ${
                gps ? "text-green-600" : "text-amber-600"
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {gps ? "Location verified" : "Waiting for GPS"}
            </p>
            <p className="text-xs text-muted-foreground truncate">{gpsLabel}</p>
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!preview || submitting}
          className="w-full inline-flex items-center justify-center gap-2 h-14 rounded-2xl bg-gradient-to-r from-[#D4AF37] to-[#B8962E] text-[#1c1810] font-bold disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          {submitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5" />
          )}
          {submitting ? "Submitting…" : "Submit proof & complete"}
        </button>
      </div>
    </div>
  );
};

export default DriverProofOfDelivery;
