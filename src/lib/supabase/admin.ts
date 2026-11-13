import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for scheduled jobs only (bypasses RLS). Never import from
 * pages or actions that run for a signed-in user.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
