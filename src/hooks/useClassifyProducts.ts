import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useClassifyProducts = () => {
  const [isClassifying, setIsClassifying] = useState(false);
  const { toast } = useToast();

  const classify = async () => {
    setIsClassifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("classify-products");

      if (error) throw error;

      if (data?.error) {
        toast({
          title: "Classification failed",
          description: data.error,
          variant: "destructive",
        });
        return null;
      }

      toast({
        title: "AI Classification Complete",
        description: `${data.trending} trending, ${data.best_sellers} best sellers, ${data.new_arrivals} new arrivals`,
      });

      return data;
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to classify products",
        variant: "destructive",
      });
      return null;
    } finally {
      setIsClassifying(false);
    }
  };

  return { classify, isClassifying };
};
