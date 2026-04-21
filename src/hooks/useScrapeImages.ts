import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

export const useScrapeImages = () => {
  const [scrapingImages, setScrapingImages] = useState(false);
  const [scrapeProgress, setScrapeProgress] = useState(0);
  const [scrapeStatus, setScrapeStatus] = useState("");
  const [scrapingSingleId, setScrapingSingleId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const callScraper = async (payload: Record<string, unknown>) => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/scrape-product-images`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      },
    );

    const result = await response.json();
    if (!response.ok || result.error) {
      throw new Error(result.error || "Image refresh failed");
    }
    return result;
  };

  const previewImage = async (productId: string) => {
    const result = await callScraper({ productId, preview: true });
    return (
      result.candidate_urls ||
      (result.candidate_url ? [result.candidate_url] : [])
    );
  };

  const handleScrapeImages = async ({
    forceRefresh = false,
  }: { forceRefresh?: boolean } = {}) => {
    setScrapingImages(true);
    setScrapeProgress(0);
    setScrapeStatus("Starting image refresh...");

    try {
      let offset = 0;
      const batchSize = 3; // 3 per batch — web search is lighter than AI gen
      let totalUpdated = 0;
      let totalProcessed = 0;

      while (true) {
        setScrapeStatus(`Refreshing images from product ${offset + 1}...`);
        const result = await callScraper({
          batchSize,
          offset,
          forceRefresh,
        });

        totalUpdated += result.updated || 0;
        totalProcessed += result.processed || 0;

        const remaining = result.remaining || 0;
        const total = totalProcessed + remaining;
        const progress =
          total > 0
            ? Math.min(100, Math.round((totalProcessed / total) * 100))
            : 100;
        setScrapeProgress(progress);
        setScrapeStatus(
          `Updated ${totalUpdated} images. ${totalProcessed} processed, ${remaining} remaining.`,
        );

        if (result.done) {
          setScrapeProgress(100);
          setScrapeStatus(`✅ Done. Every processed product now has an image.`);
          break;
        }

        offset += batchSize;
      }

      toast({
        title: "Images refreshed",
        description: `Updated ${totalUpdated} products and guaranteed an image for each processed item`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      setScrapeStatus(`❌ Error: ${err.message}`);
      toast({
        title: "Image refresh failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setScrapingImages(false);
    }
  };

  const handleScrapeSingleImage = async (
    productId: string,
    productName: string,
  ) => {
    setScrapingSingleId(productId);
    try {
      const result = await callScraper({ productId, forceRefresh: true });
      toast({
        title: "Image refreshed",
        description: result.image_url
          ? `Image saved for ${productName}`
          : `Fallback image saved for ${productName}`,
      });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast({
        title: "Image refresh failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setScrapingSingleId(null);
    }
  };

  return {
    scrapingImages,
    scrapeProgress,
    scrapeStatus,
    scrapingSingleId,
    handleScrapeImages,
    handleScrapeSingleImage,
    previewImage,
  };
};
