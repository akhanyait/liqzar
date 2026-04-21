import { supabase } from "@/integrations/supabase/client";

export type CellarHolding = {
  user_id: string;
  product_id: string;
  name: string;
  category: string;
  image_url: string | null;
  bottle_size: string | null;
  qty_owned: number;
  paid_total: number;
  last_acquired_at: string;
  current_unit_price: number;
  current_value: number;
};

export type CellarSummary = {
  user_id: string;
  unique_skus: number;
  total_bottles: number;
  total_paid: number;
  current_value: number;
  unrealised_gain: number;
};

export type CellarCategoryRow = {
  user_id: string;
  category: string;
  bottles: number;
  value: number;
};

export async function fetchCellarHoldings(userId: string): Promise<CellarHolding[]> {
  const { data, error } = await supabase
    .from("v_cellar_holdings" as any)
    .select("*")
    .eq("user_id", userId)
    .order("current_value", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown) as CellarHolding[];
}

export async function fetchCellarSummary(userId: string): Promise<CellarSummary | null> {
  const { data, error } = await supabase
    .from("v_cellar_summary" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return ((data ?? null) as unknown) as CellarSummary | null;
}

export async function fetchCellarCategories(userId: string): Promise<CellarCategoryRow[]> {
  const { data, error } = await supabase
    .from("v_cellar_categories" as any)
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return ((data ?? []) as unknown) as CellarCategoryRow[];
}
