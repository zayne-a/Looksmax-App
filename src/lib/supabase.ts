import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser Supabase client (auth + the user's own rows via RLS).
// Returns null when the env vars are absent so the app keeps working
// account-free (e.g. a preview without Supabase configured) — every
// account feature must null-check this.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cached: SupabaseClient | null | undefined;

export function getSupabase(): SupabaseClient | null {
  if (cached !== undefined) return cached;
  cached = url && anonKey ? createClient(url, anonKey) : null;
  return cached;
}

export function supabaseConfigured(): boolean {
  return getSupabase() !== null;
}
