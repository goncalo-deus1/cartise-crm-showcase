import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ZohoClient, zohoConfig } from "@/lib/zoho/client";
import { syncMailbox } from "@/lib/zoho/sync";

export const maxDuration = 60;

/**
 * Logs new Zoho Mail emails on the matching leads. Called every 10 minutes by the
 * database scheduler (pg_cron, see supabase/migrations/20261113_zoho_mail_sync.sql), which
 * sends `Authorization: Bearer <token kept in Supabase Vault>`; `Bearer $CRON_SECRET` also works.
 *
 * Needs env vars: SUPABASE_SERVICE_ROLE_KEY, ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET,
 * ZOHO_REFRESH_TOKEN (optional: ZOHO_REGION, default "eu").
 */
export async function GET(request: Request) {
  const supabase = createAdminClient();
  if (!supabase) return Response.json({ error: "SUPABASE_SERVICE_ROLE_KEY em falta" }, { status: 503 });

  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const secret = process.env.CRON_SECRET;
  let ok = Boolean(token) && Boolean(secret) && safeEqual(token, secret!);
  if (!ok && token) {
    const { data } = await supabase.rpc("mail_sync_token_ok", { token });
    ok = data === true;
  }
  if (!ok) return Response.json({ error: "unauthorized" }, { status: 401 });

  const cfg = zohoConfig();
  if (!cfg) return Response.json({ error: "Zoho não configurado (ZOHO_CLIENT_ID / SECRET / REFRESH_TOKEN)" }, { status: 503 });

  try {
    const result = await syncMailbox(supabase, new ZohoClient(cfg));
    return Response.json(result);
  } catch (e) {
    console.error("zoho sync failed", e);
    return Response.json({ error: "sync failed" }, { status: 500 });
  }
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
