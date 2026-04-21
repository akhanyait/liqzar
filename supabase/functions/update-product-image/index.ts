// @ts-nocheck
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const contentType = req.headers.get("content-type") || "";

    // Handle multipart form data (file upload)
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File;
      const productId = formData.get("productId") as string;

      if (!file || !productId) {
        return new Response(
          JSON.stringify({ error: "file and productId are required" }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // Generate unique filename
      const timestamp = Date.now();
      const filename = `${productId}-${timestamp}-${file.name.replace(/\s+/g, "-")}`;
      const filepath = `${filename}`;

      // Upload to storage using service role (bypasses RLS)
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filepath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(filepath);

      const imageUrl = publicUrlData.publicUrl;

      // Update product in database
      const { error: updateError } = await supabase
        .from("products")
        .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
        .eq("id", productId);

      if (updateError) throw updateError;

      return new Response(JSON.stringify({ success: true, imageUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle JSON request (URL update only)
    const { productId, imageUrl, description } = await req.json();

    if (!productId) {
      return new Response(JSON.stringify({ error: "productId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (imageUrl !== undefined) {
      updateData.image_url = imageUrl;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", productId);

    if (error) throw error;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
