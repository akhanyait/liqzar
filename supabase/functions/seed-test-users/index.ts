// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const testUsers = [
      { email: "admin@liqzar.co.za", password: "admin123", full_name: "Admin User", role: "admin" },
      { email: "customer@liqzar.co.za", password: "customer123", full_name: "Premium Customer", role: "customer" },
      { email: "driver@liqzar.co.za", password: "driver123", full_name: "Mandla Nkosi", role: "driver" },
    ];

    // Legacy emails from the pre-rebrand seed — removed so the Auth table
    // doesn't carry orphaned rows that could confuse login flows.
    const legacyEmails = [
      "admin@liquorlux.co.za",
      "customer@liquorlux.co.za",
      "driver@liquorlux.co.za",
      "warehouse@liquorlux.co.za",
    ];

    const results: any[] = [];

    // ── 1. Purge legacy @liquorlux.co.za test accounts ─────────────────────
    const { data: legacyLookup } = await supabase.auth.admin.listUsers();
    for (const legacy of legacyEmails) {
      const match = legacyLookup?.users?.find((u: any) => u.email === legacy);
      if (!match) continue;
      const { error: delErr } = await supabase.auth.admin.deleteUser(match.id);
      results.push({
        email: legacy,
        status: delErr ? "legacy_delete_error" : "legacy_deleted",
        error: delErr?.message,
      });
    }

    for (const user of testUsers) {
      // Check if user already exists
      const { data: existing } = await supabase.auth.admin.listUsers();
      const found = existing?.users?.find((u: any) => u.email === user.email);

      if (found) {
        // Ensure role is correct
        await supabase.from("user_roles").upsert(
          { user_id: found.id, role: user.role },
          { onConflict: "user_id,role" }
        );
        results.push({ email: user.email, status: "exists", role: user.role });
        continue;
      }

      // Create user
      const { data: created, error } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
        user_metadata: { full_name: user.full_name },
      });

      if (error) {
        results.push({ email: user.email, status: "error", error: error.message });
        continue;
      }

      // Update role (trigger sets customer by default, override for others)
      if (user.role !== "customer" && created.user) {
        await supabase.from("user_roles")
          .update({ role: user.role })
          .eq("user_id", created.user.id);
      }

      results.push({ email: user.email, status: "created", role: user.role });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
