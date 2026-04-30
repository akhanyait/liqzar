// @ts-nocheck
/**
 * delete-account — Supabase Edge Function
 *
 * Permanently deletes the authenticated user's account.
 * Required for App Store / Play Store compliance (Apple Guideline 5.1.1(v)
 * and Google Play account-deletion policy).
 *
 * Flow:
 *   1. Read the caller's JWT from the Authorization header
 *   2. Verify it via supabase.auth.getUser() — returns the user record
 *   3. Call supabase.auth.admin.deleteUser(userId) using the service role key
 *      Postgres FK cascades handle deletion of profiles, user_roles, orders,
 *      addresses, loyalty, etc. (all set ON DELETE CASCADE)
 *
 * Why an Edge Function: account deletion needs the service role key, which
 * cannot be exposed to the mobile client. The EF acts as a verified proxy.
 *
 * Deployed with --no-verify-jwt because we read the JWT from the header
 * ourselves and validate it against Supabase auth — the gateway-level JWT
 * check would reject expired/refreshed tokens that we want to handle.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const jwt = authHeader.slice("Bearer ".length);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(jwt);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired session — please sign in again" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteError) {
      return new Response(
        JSON.stringify({ error: `Failed to delete account: ${deleteError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true, deletedUserId: user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: `Unexpected error: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
