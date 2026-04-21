import { supabase } from "@/integrations/supabase/client";

export type CorporateAccount = {
  id: string;
  company_name: string;
  trading_as: string | null;
  registration_no: string | null;
  vat_number: string | null;
  billing_email: string;
  billing_address: Record<string, unknown>;
  credit_limit_cents: number;
  current_balance_cents: number;
  net_terms_days: number;
  status: "pending" | "active" | "suspended" | "closed";
  owner_user_id: string | null;
  onboarded_at: string | null;
  created_at: string;
};

export type CorporateInvoice = {
  id: string;
  account_id: string;
  order_id: string | null;
  invoice_no: string;
  amount_cents: number;
  vat_cents: number;
  issued_at: string;
  due_at: string;
  paid_at: string | null;
  status: "open" | "paid" | "overdue" | "void";
  pdf_url: string | null;
  notes: string | null;
};

export async function fetchMyCorporateAccount(): Promise<CorporateAccount | null> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return null;
  const { data, error } = await supabase
    .from("corporate_accounts" as any)
    .select("*")
    .or(`owner_user_id.eq.${uid}`)
    .maybeSingle();
  if (error && error.code !== "PGRST116") throw error;
  return ((data ?? null) as unknown) as CorporateAccount | null;
}

export async function listMyInvoices(accountId: string): Promise<CorporateInvoice[]> {
  const { data, error } = await supabase
    .from("corporate_invoices" as any)
    .select("*")
    .eq("account_id", accountId)
    .order("issued_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown) as CorporateInvoice[];
}

export async function requestCorporateAccount(input: {
  company_name: string;
  trading_as?: string;
  registration_no?: string;
  vat_number?: string;
  billing_email: string;
  billing_address?: Record<string, unknown>;
}) {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("Sign in to request a corporate account");
  const { data, error } = await supabase
    .from("corporate_accounts" as any)
    .insert({
      company_name: input.company_name,
      trading_as: input.trading_as ?? null,
      registration_no: input.registration_no ?? null,
      vat_number: input.vat_number ?? null,
      billing_email: input.billing_email,
      billing_address: input.billing_address ?? {},
      owner_user_id: uid,
      status: "pending",
    })
    .select("*")
    .single();
  if (error) throw error;
  return (data as unknown) as CorporateAccount;
}

export async function issueCorporateInvoice(
  accountId: string,
  orderId: string,
  amountCents: number,
  vatCents = 0,
  notes?: string,
) {
  const { data, error } = await supabase.rpc("issue_corporate_invoice" as any, {
    p_account_id: accountId,
    p_order_id: orderId,
    p_amount_cents: amountCents,
    p_vat_cents: vatCents,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as { ok: boolean; invoice_id?: string; invoice_no?: string; error?: string };
}
