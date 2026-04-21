import { supabase } from "@/integrations/supabase/client";

export type CellarClubTier = "founder" | "grand_cru" | "premier";

export const CELLAR_CLUB_TIERS: Array<{
  key: CellarClubTier;
  name: string;
  tagline: string;
  monthlyCents: number;
  bottlesPerMonth: number;
  perks: string[];
}> = [
  {
    key: "founder",
    name: "Founder",
    tagline: "One curated bottle each month",
    monthlyCents: 49900,
    bottlesPerMonth: 1,
    perks: [
      "Sommelier-selected bottle each month",
      "Complimentary delivery on Cellar Club boxes",
      "Invitation to quarterly tastings",
    ],
  },
  {
    key: "grand_cru",
    name: "Grand Cru",
    tagline: "Two hand-picked releases + tasting invites",
    monthlyCents: 129900,
    bottlesPerMonth: 2,
    perks: [
      "Two curated bottles each month",
      "Priority allocations on scarce releases",
      "Invites to private in-cellar events",
    ],
  },
  {
    key: "premier",
    name: "Premier",
    tagline: "Three rare releases + first access to allocations",
    monthlyCents: 299900,
    bottlesPerMonth: 3,
    perks: [
      "Three curated bottles — includes cellar reserves",
      "First access to allocated releases",
      "Concierge sommelier line + home tasting twice yearly",
    ],
  },
];

export async function getMyCellarClubSubscription(userId: string) {
  const { data, error } = await supabase
    .from("cellar_club_subscriptions" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data };
}

export async function joinCellarClub(
  userId: string,
  tier: CellarClubTier,
  deliveryAddress: Record<string, string>,
) {
  const tierConfig = CELLAR_CLUB_TIERS.find((t) => t.key === tier);
  if (!tierConfig) return { success: false as const, error: "Invalid tier" };

  const { data, error } = await supabase
    .from("cellar_club_subscriptions" as any)
    .upsert(
      {
        user_id: userId,
        tier,
        monthly_amount_cents: tierConfig.monthlyCents,
        status: "active",
        delivery_address: deliveryAddress,
      } as any,
      { onConflict: "user_id" },
    )
    .select("*")
    .single();
  if (error) return { success: false as const, error: error.message };
  return { success: true as const, data };
}

export async function pauseCellarClub(
  userId: string,
  reason: string | null,
) {
  const { error } = await supabase
    .from("cellar_club_subscriptions" as any)
    .update({ status: "paused", paused_reason: reason } as any)
    .eq("user_id", userId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

export async function cancelCellarClub(
  userId: string,
  reason: string | null,
) {
  const { error } = await supabase
    .from("cellar_club_subscriptions" as any)
    .update({
      status: "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_reason: reason,
    } as any)
    .eq("user_id", userId);
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}
