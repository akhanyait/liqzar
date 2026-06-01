// Lightweight Supabase REST helper for Playwright specs that need to verify
// database state OR clean up test fixtures.
//
// The pattern: read the JWT out of a storageState file (minted by *.setup.ts)
// and re-attach it to a fresh APIRequestContext. The fixture user's RLS scope
// is preserved, so any RPC or PostgREST call respects their permissions.
//
// Inspired by ArtisanZA's `tests/e2e/lib/supabase-rest.ts` (Apr 2026), trimmed
// to the parts liqZAR actually needs today. Add cleanup helpers
// (`adminDeleteOrdersByPrefix`, etc.) here as new write-specs are added —
// keeping them in one file means changing one schema doesn't break N specs.
import { readFileSync } from "node:fs";
import { request, type APIRequestContext } from "@playwright/test";

const SUPABASE_URL =
  process.env.PLAYWRIGHT_SUPABASE_URL ?? "https://deiewcktyzzeviszukqj.supabase.co";
const SUPABASE_ANON_KEY = process.env.PLAYWRIGHT_SUPABASE_ANON_KEY ?? "";

interface StorageState {
  origins: Array<{
    origin: string;
    localStorage: Array<{ name: string; value: string }>;
  }>;
}

interface SupabaseSession {
  access_token: string;
  refresh_token?: string;
  user?: { id: string };
}

/** Extract the Supabase access_token from a storageState file. */
export function tokenFromState(storageStatePath: string): string {
  const state = JSON.parse(readFileSync(storageStatePath, "utf-8")) as StorageState;
  for (const o of state.origins ?? []) {
    for (const item of o.localStorage ?? []) {
      // Supabase persists as `sb-<projectRef>-auth-token`. The shape is either
      // a stringified JSON session OR a base64-prefixed payload — handle both.
      if (!item.name.startsWith("sb-") || !item.name.endsWith("-auth-token")) continue;
      const raw = item.value.startsWith("base64-")
        ? Buffer.from(item.value.slice("base64-".length), "base64").toString("utf-8")
        : item.value;
      try {
        const parsed = JSON.parse(raw) as SupabaseSession;
        if (parsed.access_token) return parsed.access_token;
      } catch {
        /* malformed — fall through to next entry */
      }
    }
  }
  throw new Error(`No Supabase access_token found in ${storageStatePath}`);
}

/** Decode the `sub` claim (= auth.uid()) from the JWT in a storageState file. */
export function uidFromState(storageStatePath: string): string {
  const token = tokenFromState(storageStatePath);
  const payloadB64 = token.split(".")[1];
  const payload = JSON.parse(
    Buffer.from(payloadB64, "base64url").toString("utf-8"),
  ) as { sub?: string };
  if (!payload.sub) throw new Error(`JWT in ${storageStatePath} has no 'sub' claim`);
  return payload.sub;
}

/** Build an APIRequestContext that talks to Supabase REST as the fixture user. */
export async function authedRestClient(
  storageStatePath: string,
): Promise<APIRequestContext> {
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      "PLAYWRIGHT_SUPABASE_ANON_KEY not set — required for authed REST calls. " +
        "Set it in .env.test (gitignored) or as a CI secret.",
    );
  }
  const accessToken = tokenFromState(storageStatePath);
  return request.newContext({
    baseURL: `${SUPABASE_URL}/rest/v1`,
    extraHTTPHeaders: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}
