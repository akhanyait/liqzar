import { useState } from "react";
import { supabase as typedSupabase } from "../lib/supabase";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const supabase = typedSupabase as any;

export interface CallToken {
  roomUrl: string;
  token: string;
  expiresAt: string;
}

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
        setError(data?.error || fnErr?.message || "Could not start call");
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
