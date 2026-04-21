import { useQuery } from "@tanstack/react-query";
import { supabase, supabaseConfigError } from "@/integrations/supabase/client";

export const useSupabaseHealth = () => {
  return useQuery({
    queryKey: ["supabase-health"],
    queryFn: async () => {
      if (supabaseConfigError) {
        throw new Error(supabaseConfigError);
      }

      const { error } = await supabase.from("products").select("id", { count: "exact", head: true });
      if (error) {
        throw error;
      }

      return true;
    },
    retry: false,
  });
};
