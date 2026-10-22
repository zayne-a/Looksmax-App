import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-side admin gate for API routes (Zayne, 2026-10-21). Same
 * verification pattern as /api/coach: the caller's Bearer JWT is
 * resolved with a service-role client, the profile is loaded, and
 * is_admin must be exactly true. Used by the funnel-media admin
 * routes; profiles has no client write path for these tables, so
 * this check IS the write security.
 */

export function serviceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export type AdminClient = NonNullable<ReturnType<typeof serviceClient>>;

/**
 * Resolve the request's Bearer token to an admin, or null. Null for:
 * no service client, no/invalid token, no profile, or
 * is_admin !== true — callers answer 404 for all of them (no oracle
 * about which check failed).
 */
export async function requireAdmin(
  req: Request
): Promise<{ admin: AdminClient; userId: string } | null> {
  const admin = serviceClient();
  if (!admin) return null;
  const authHeader = req.headers.get("authorization") ?? "";
  const tok = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!tok) return null;
  try {
    const { data: userData } = await admin.auth.getUser(tok);
    const uid = userData?.user?.id;
    if (!uid) return null;
    const { data: profile } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", uid)
      .single();
    if (!profile || profile.is_admin !== true) return null;
    return { admin, userId: uid };
  } catch {
    return null;
  }
}
