import { useEffect, useState } from "react";
import { supabase as typedSupabase } from "../lib/supabase";

 
const supabase = typedSupabase as any;

export interface ProofOfDelivery {
  id: string;
  order_id: string;
  driver_id: string;
  photo_url: string | null;
  photo_storage_path: string | null;
  recipient_name: string | null;
  notes: string | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  created_at: string;
}

export const useProofOfDelivery = (orderId: string | undefined) => {
  const [proof, setProof] = useState<ProofOfDelivery | null>(null);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(orderId));

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const fetchProof = async () => {
      const { data } = await supabase
        .from("proof_of_delivery")
        .select(
          "id, order_id, driver_id, photo_url, photo_storage_path, recipient_name, notes, gps_latitude, gps_longitude, created_at",
        )
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .maybeSingle();
      if (cancelled) return;
      setProof(data ?? null);
      if (data?.photo_storage_path) {
        const { data: signed } = await supabase.storage
          .from("delivery-proofs")
          .createSignedUrl(data.photo_storage_path, 60 * 60);
        if (!cancelled) setSignedPhotoUrl(signed?.signedUrl ?? data.photo_url);
      } else if (data?.photo_url) {
        setSignedPhotoUrl(data.photo_url);
      }
      setLoading(false);
    };

    fetchProof();
    const channel = supabase
      .channel(`pod-${orderId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "proof_of_delivery",
          filter: `order_id=eq.${orderId}`,
        },
        () => fetchProof(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [orderId]);

  return { proof, signedPhotoUrl, loading };
};
