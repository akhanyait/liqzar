import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Search,
  Plus,
  Edit,
  Eye,
  RefreshCw,
  Loader2,
  Upload,
  ImageOff,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useProducts } from "@/hooks/useProducts";
import { useScrapeImages } from "@/hooks/useScrapeImages";
import { supabase } from "@/integrations/supabase/client";
import { getProductImageUrl } from "@/data/products";
import {
  buildPlaceholderImageUrl,
  getComputedBasePrice,
  getComputedCheapestRetailer,
} from "@/lib/product-utils";

type ImageStatus = "real" | "generated" | "none";

function getImageStatus(imageUrl?: string | null): ImageStatus {
  if (!imageUrl || imageUrl === "") return "none";
  if (imageUrl.startsWith("data:")) return "none"; // old inline SVG — not yet synced
  if (imageUrl.includes("generated-") && imageUrl.includes("supabase.co")) return "generated";
  if (imageUrl.includes("supabase.co/storage")) return "real";
  if (imageUrl.startsWith("http")) return "real"; // external URL stored pre-download
  return "none";
}

const ImageStatusBadge = ({ status }: { status: ImageStatus }) => {
  if (status === "real")
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-green-600">
        <CheckCircle2 className="w-3 h-3" /> Real photo
      </span>
    );
  if (status === "generated")
    return (
      <span className="flex items-center gap-1 text-[10px] font-medium text-amber-500">
        <Sparkles className="w-3 h-3" /> Generated
      </span>
    );
  return (
    <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
      <ImageOff className="w-3 h-3" /> No image
    </span>
  );
};

const AdminProducts = () => {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingProductId, setUploadingProductId] = useState<string | null>(
    null,
  );
  const { data: products, isLoading } = useProducts({
    search: search || undefined,
  });
  const {
    scrapingImages,
    scrapeProgress,
    scrapeStatus,
    scrapingSingleId,
    handleScrapeImages,
    handleScrapeSingleImage,
    previewImage,
  } = useScrapeImages();

  const [forceRefreshAll, setForceRefreshAll] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{
    productId: string;
    name: string;
    candidates: string[];
    index: number;
  } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: string;
    description: string;
  } | null>(null);
  const [editingDescription, setEditingDescription] = useState("");

  const handleUploadImage = async (productId: string, file: File) => {
    if (!file.type.startsWith("image/")) {
      alert("Please select a valid image file");
      return;
    }

    setUploadingProductId(productId);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);

      const { error } = await supabase.functions.invoke(
        "update-product-image",
        { body: formData },
      );

      if (error) {
        throw new Error(error.message || "Failed to upload image");
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      console.error("Upload failed:", error);
      alert(
        `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    } finally {
      setUploadingProductId(null);
    }
  };

  const handleEditDescription = (product: any) => {
    setEditingProduct({
      id: product.id,
      description: product.description || "",
    });
    setEditingDescription(product.description || "");
    setEditOpen(true);
  };

  const handleSaveDescription = async () => {
    if (!editingProduct) return;
    try {
      const { error } = await supabase.functions.invoke(
        "update-product-image",
        {
          body: {
            productId: editingProduct.id,
            imageUrl:
              products?.find((p) => p.id === editingProduct.id)?.image_url ||
              "",
            description: editingDescription,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Failed to update product");
      }

      queryClient.invalidateQueries({ queryKey: ["products"] });
      setEditOpen(false);
      setEditingProduct(null);
    } catch (error) {
      console.error("Save failed:", error);
      alert(
        `Save failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }
  };

  const handlePreview = async (productId: string, name: string) => {
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const candidates = await previewImage(productId);
      if (!candidates || candidates.length === 0) {
        setPreviewError("No candidate image found.");
      } else {
        setPreviewData({
          productId,
          name,
          candidates,
          index: 0,
        });
        setPreviewOpen(true);
      }
    } catch (err: any) {
      setPreviewError(err?.message || "Unable to fetch preview image.");
    } finally {
      setPreviewLoading(false);
    }
  };

  const retryPreview = () => {
    if (!previewData) return;
    handlePreview(previewData.productId, previewData.name);
  };

  const applyPreview = async () => {
    if (!previewData) return;
    const imageUrl = previewData.candidates[previewData.index];
    await supabase
      .from("products")
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq("id", previewData.productId);
    queryClient.invalidateQueries({ queryKey: ["products"] });
    setPreviewOpen(false);
    setPreviewData(null);
    setPreviewError(null);
  };

  const nextCandidate = () => {
    if (!previewData) return;
    setPreviewData((prev) => {
      if (!prev) return null;
      const nextIndex = (prev.index + 1) % prev.candidates.length;
      return { ...prev, index: nextIndex };
    });
  };

  const previousCandidate = () => {
    if (!previewData) return;
    setPreviewData((prev) => {
      if (!prev) return null;
      const prevIndex =
        (prev.index - 1 + prev.candidates.length) % prev.candidates.length;
      return { ...prev, index: prevIndex };
    });
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const productId = fileInputRef.current?.dataset.productId;
          console.log("File input changed:", { file: file?.name, productId });
          if (file && productId) {
            handleUploadImage(productId, file);
          }
          // Reset so same file can be re-selected
          if (e.target) e.target.value = "";
        }}
      />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Products</h2>
          <p className="text-sm text-muted-foreground">
            {products?.length || 0} products in catalogue
          </p>
          {scrapeStatus ? (
            <p className="text-xs text-muted-foreground mt-1">{scrapeStatus}</p>
          ) : null}
          {scrapingImages ? (
            <div className="mt-1">
              <div className="h-2 w-44 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{ width: `${scrapeProgress}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                {scrapeProgress}%
              </p>
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center gap-3">
            <Button
              className="bg-foreground text-background hover:bg-foreground/90 rounded-xl gap-2"
              onClick={() =>
                handleScrapeImages({ forceRefresh: forceRefreshAll })
              }
              disabled={scrapingImages}
            >
              {scrapingImages ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Syncing images...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Fetch Product Images
                </>
              )}
            </Button>

            <div className="flex items-center gap-2">
              <Switch
                checked={forceRefreshAll}
                onCheckedChange={setForceRefreshAll}
              />
              <Label className="text-[11px] text-muted-foreground">
                Refresh all images
              </Label>
            </div>
          </div>
          <Button className="bg-foreground text-background hover:bg-foreground/90 rounded-xl gap-2">
            <Plus className="w-4 h-4" /> Add Product
          </Button>
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="pl-10 h-11 rounded-xl"
        />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(products || []).slice(0, 60).map((product) => {
            const basePrice = getComputedBasePrice(product);
            const cheapestRetailer =
              getComputedCheapestRetailer(product) || "LIQZAR";
            return (
              <div
                key={product.id}
                className="bg-card border border-border rounded-2xl p-4 hover:border-foreground/20 transition-colors"
              >
                <div className="flex gap-3">
                  {/* Portrait thumbnail — matches bottle proportions */}
                  <div className="w-14 h-20 bg-secondary rounded-xl flex-shrink-0 overflow-hidden">
                    <img
                      src={getProductImageUrl(product)}
                      alt={product.name}
                      className="w-full h-full object-contain p-1"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          buildPlaceholderImageUrl(
                            product.name,
                            product.category,
                          );
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-foreground truncate">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.category}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="font-bold text-foreground">
                        R {basePrice.toLocaleString('en-ZA', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </span>
                      <span className="text-[10px] text-green-700 font-medium">
                        Best at {cheapestRetailer}
                      </span>
                    </div>
                    <div className="mt-1">
                      <ImageStatusBadge status={getImageStatus(product.image_url)} />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 self-start">
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      title="Preview image"
                      onClick={() => handlePreview(product.id, product.name)}
                      disabled={
                        previewLoading || scrapingSingleId === product.id
                      }
                    >
                      {previewLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground"
                      title="Sync image"
                      onClick={() =>
                        handleScrapeSingleImage(product.id, product.name)
                      }
                      disabled={scrapingSingleId === product.id}
                    >
                      {scrapingSingleId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground self-start"
                      title="Upload image"
                      onClick={() => {
                        if (fileInputRef.current) {
                          fileInputRef.current.dataset.productId = product.id;
                          fileInputRef.current.click();
                        }
                      }}
                      disabled={uploadingProductId === product.id}
                    >
                      {uploadingProductId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      className="text-muted-foreground hover:text-foreground self-start"
                      title="Edit"
                      onClick={() => handleEditDescription(product)}
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 line-clamp-3 leading-relaxed">
                  {product.description}
                </p>
                <div className="flex items-center gap-2 mt-3">
                  <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">
                    In Stock
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    ★ {product.rating}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Preview Image</DialogTitle>
            <DialogDescription>
              Review the candidate image before saving it to the product.
            </DialogDescription>
          </DialogHeader>

          {previewError ? (
            <p className="text-sm text-red-600">{previewError}</p>
          ) : previewData ? (
            <div className="space-y-4">
              <div className="h-64 w-full overflow-hidden rounded-xl border border-border">
                <img
                  src={previewData.candidates[previewData.index]}
                  alt={`Preview for ${previewData.name}`}
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {previewData.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {previewData.index + 1}/{previewData.candidates.length}
                </p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="outline"
                  onClick={previousCandidate}
                  disabled={previewData.candidates.length <= 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  onClick={nextCandidate}
                  disabled={previewData.candidates.length <= 1}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Loading preview…</p>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPreviewOpen(false);
                setPreviewData(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={retryPreview}
              disabled={!previewData || previewLoading}
            >
              {previewLoading ? "Retrying…" : "Retry"}
            </Button>
            <Button onClick={applyPreview} disabled={!previewData}>
              Use this image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Description</DialogTitle>
            <DialogDescription>
              Update the product description.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <textarea
              value={editingDescription}
              onChange={(e) => setEditingDescription(e.target.value)}
              placeholder="Enter product description..."
              className="w-full h-32 p-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-foreground"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditOpen(false);
                setEditingProduct(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveDescription}>Save Description</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminProducts;
