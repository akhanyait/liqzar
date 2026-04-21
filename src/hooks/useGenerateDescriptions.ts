import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useGenerateDescriptions = () => {
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genStatus, setGenStatus] = useState("");
  const [generatingSingleId, setGeneratingSingleId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleBulkGenerate = async () => {
    setGenerating(true);
    setGenProgress(0);
    setGenStatus("Starting description generation...");

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      let offset = 0;
      const batchSize = 5;
      let totalUpdated = 0;
      let totalProcessed = 0;

      while (true) {
        setGenStatus(`Generating descriptions for batch starting at ${offset + 1}...`);

        const response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/generate-descriptions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ batchSize, offset }),
          }
        );

        const result = await response.json();
        if (result.error) throw new Error(result.error);

        totalUpdated += result.updated || 0;
        totalProcessed += result.processed || 0;

        const remaining = result.remaining || 0;
        const total = totalProcessed + remaining;
        const progress = total > 0 ? Math.round((totalProcessed / total) * 100) : 100;
        setGenProgress(progress);
        setGenStatus(`Generated ${totalUpdated} descriptions... (${totalProcessed} processed, ${remaining} remaining)`);

        if (result.done) {
          setGenProgress(100);
          setGenStatus(`✅ Done! Generated descriptions for ${totalUpdated} out of ${totalProcessed} products.`);
          break;
        }

        offset += batchSize;
      }

      toast({ title: "Descriptions generated", description: `${totalUpdated} products updated` });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setGenStatus(`❌ Error: ${err.message}`);
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleSingleGenerate = async (productId: string, productName: string) => {
    setGeneratingSingleId(productId);

    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/generate-descriptions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ productId }),
        }
      );

      const result = await response.json();
      if (result.error) throw new Error(result.error);

      if (result.updated > 0) {
        toast({ title: "Description generated", description: `Description created for ${productName}` });
      } else {
        toast({ title: "Failed", description: `Could not generate description for ${productName}`, variant: "destructive" });
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingSingleId(null);
    }
  };

  return {
    generating,
    genProgress,
    genStatus,
    generatingSingleId,
    handleBulkGenerate,
    handleSingleGenerate,
  };
};
