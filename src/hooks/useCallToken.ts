import { useState } from "react";
import { supabase as typedSupabase } from "@/integrations/supabase/client";

 
const supabase = typedSupabase as any;

export interface CallToken {
  roomUrl: string;
  token: string;
  expiresAt: string;
}

/**
 * useCallToken — requests a per-order Daily.co meeting token from the
 * `issue-call-token` Edge Function. The caller's Supabase JWT authorizes
 * the request; the EF verifies they are either the customer or the driver
 * assigned to that order.
 *
 * Returns `{ request(orderId) }` — call this once per dial attempt.
 */
export const useCallToken = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const request = async (orderId: string): Promise<CallToken | null> => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke(
        "issue-call-token",
        { body: { orderId } },
      );
      if (fnErr || !data?.ok) {
        const message =
          data?.error || fnErr?.message || "Could not start call";
        setError(message);
        return null;
      }
      return {
        roomUrl: data.roomUrl,
        token: data.token,
        expiresAt: data.expiresAt,
      };
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { request, loading, error };
};
