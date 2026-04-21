// @ts-nocheck
// Admin-only Edge Function: create a new driver account end-to-end.
//
// Input JSON:
//   {
//     email, password?, full_name, phone, id_number,
//     vehicle: { vehicle_type, make_model, license_plate },
//     is_verified?: boolean     // default true — admin-created drivers are trusted
//   }
//
// What it does (atomic-ish; best-effort rollback on mid-flight failure):
//   1. Creates an auth.users record via admin API (email_confirm=true).
//   2. Upserts `profiles` (full_name, phone).
//   3. Inserts a `driver` role in `user_roles`.
//   4. Inserts a `driver_profiles` row.
//   5. Inserts a `driver_vehicles` row.
//
// Returns { user_id, email, temp_password } so the admin can hand credentials
// to the driver on first sign-in.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword(length = 14): string {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  let out = "";
  for (let i = 0; i < length; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Caller authorisation — must be an admin user.
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    if (!jwt) return json({ error: "Missing Authorization" }, 401);

    const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
    if (callerErr || !caller?.user) {
      return json({ error: "Invalid session" }, 401);
    }

    const { data: isAdminRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!isAdminRow) {
      return json({ error: "Admin role required" }, 403);
    }

    const body = await req.json();
    const {
      email,
      password,
      full_name,
      phone,
      id_number,
      vehicle,
      is_verified = true,
    } = body ?? {};

    if (!email || !full_name || !phone || !id_number || !vehicle) {
      return json(
        {
          error:
            "email, full_name, phone, id_number and vehicle are required",
        },
        400,
      );
    }
    if (!vehicle.vehicle_type || !vehicle.make_model || !vehicle.license_plate) {
      return json(
        {
          error:
            "vehicle.vehicle_type, vehicle.make_model and vehicle.license_plate are required",
        },
        400,
      );
    }

    const tempPassword = password || randomPassword(14);

    // 1) Create auth user.
    const { data: createdAuth, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { full_name, role: "driver" },
      });

    if (createErr || !createdAuth?.user) {
      return json(
        { error: createErr?.message || "Failed to create auth user" },
        400,
      );
    }

    const userId = createdAuth.user.id;

    // Helper — best-effort cleanup if a later step fails.
    const rollback = async (reason: string) => {
      console.error(`[admin-create-driver] Rolling back ${userId}: ${reason}`);
      await admin.auth.admin.deleteUser(userId).catch(() => {});
      await admin.from("profiles").delete().eq("id", userId);
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("driver_profiles").delete().eq("user_id", userId);
    };

    // 2) Profile row (upsert — trigger may already have inserted one).
    {
      const { error } = await admin
        .from("profiles")
        .upsert(
          { id: userId, full_name, phone },
          { onConflict: "id" },
        );
      if (error) {
        await rollback(`profiles upsert: ${error.message}`);
        return json({ error: error.message }, 500);
      }
    }

    // 3) user_roles → 'driver'. Remove default 'customer' the trigger may add.
    {
      const { error: delErr } = await admin
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (delErr) {
        await rollback(`user_roles delete: ${delErr.message}`);
        return json({ error: delErr.message }, 500);
      }
      const { error: insErr } = await admin
        .from("user_roles")
        .insert({ user_id: userId, role: "driver" });
      if (insErr) {
        await rollback(`user_roles insert: ${insErr.message}`);
        return json({ error: insErr.message }, 500);
      }
    }

    // 4) driver_profiles
    const { data: driverProfile, error: dpErr } = await admin
      .from("driver_profiles")
      .insert({
        user_id: userId,
        full_name,
        phone,
        email,
        id_number,
        is_verified,
      })
      .select("id")
      .single();

    if (dpErr || !driverProfile) {
      await rollback(`driver_profiles: ${dpErr?.message || "no row"}`);
      return json({ error: dpErr?.message || "driver_profiles insert failed" }, 500);
    }

    // 5) driver_vehicles
    const { error: dvErr } = await admin.from("driver_vehicles").insert({
      driver_id: driverProfile.id,
      vehicle_type: vehicle.vehicle_type,
      make_model: vehicle.make_model,
      license_plate: vehicle.license_plate,
      is_verified,
    });

    if (dvErr) {
      await rollback(`driver_vehicles: ${dvErr.message}`);
      return json({ error: dvErr.message }, 500);
    }

    return json({
      user_id: userId,
      email,
      temp_password: tempPassword,
      driver_profile_id: driverProfile.id,
      is_verified,
    });
  } catch (err) {
    console.error("[admin-create-driver] fatal:", err);
    return json(
      { error: err instanceof Error ? err.message : "Unexpected error" },
      500,
    );
  }
});
