import { MapPin, User, StickyNote, Camera } from "lucide-react";
import { useProofOfDelivery } from "@/hooks/useProofOfDelivery";

interface Props {
  orderId: string | undefined;
}

/**
 * ProofOfDeliveryCard — shown to the customer once the driver has uploaded
 * a delivery photo. Silent until proof exists (Realtime subscribed).
 */
export const ProofOfDeliveryCard = ({ orderId }: Props) => {
  const { proof, signedPhotoUrl, loading } = useProofOfDelivery(orderId);

  if (loading) return null;
  if (!proof) return null;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden premium-shadow">
      <div className="p-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-green-500/15 flex items-center justify-center">
          <Camera className="w-4 h-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            Delivery confirmed
          </p>
          <p className="text-xs text-muted-foreground">
            Captured {new Date(proof.created_at).toLocaleString()}
          </p>
        </div>
      </div>
      {signedPhotoUrl && (
        <img
          src={signedPhotoUrl}
          alt="Delivery proof"
          className="w-full aspect-[4/3] object-cover"
        />
      )}
      <div className="p-4 space-y-2 text-sm">
        {proof.recipient_name && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <User className="w-4 h-4 text-primary" />
            <span>
              Received by{" "}
              <span className="text-foreground font-medium">
                {proof.recipient_name}
              </span>
            </span>
          </div>
        )}
        {proof.notes && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <StickyNote className="w-4 h-4 text-primary mt-0.5" />
            <span>{proof.notes}</span>
          </div>
        )}
        {proof.gps_latitude && proof.gps_longitude && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary" />
            <span>
              {proof.gps_latitude.toFixed(5)},{" "}
              {proof.gps_longitude.toFixed(5)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProofOfDeliveryCard;
