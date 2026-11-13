import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildDigest, type DigestLead } from "@/lib/digest";
import { loadChanges } from "@/lib/digest-changes";
import type { Member } from "@/lib/names";
import { todayISO } from "@/lib/dates";

const SEND_HOUR = 8; // 8:30 in Lisbon, summer and winter

/**
 * Morning email to each founder at 8:30 Lisbon time: what changed in the CRM in the
 * last 24 hours, plus today's follow-ups. Called by the database scheduler (pg_cron job
 * "daily-digest", at 7:30 and 8:30 UTC so one of them is 8:30 in Lisbon all year) with
 * `Authorization: Bearer <Vault token>`; `Bearer $CRON_SECRET` also works.
 * `?dry=1` previews without sending; `?force=1` skips the 8:30 check.
 *
 * Needs env vars: SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, DIGEST_FROM (a verified
 * sender, e.g. "Cartise CRM <crm@cartise.pt>"); optional: CRON_SECRET, APP_URL.
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

  const params = new URL(request.url).searchParams;
  const dry = params.get("dry") === "1";
  if (!dry && params.get("force") !== "1" && lisbonHour() !== SEND_HOUR) {
    return Response.json({ skipped: "not 8:30 in Lisbon" });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!dry && !resendKey) return Response.json({ error: "RESEND_API_KEY em falta" }, { status: 500 });

  const [team, leads] = await Promise.all([
    supabase.from("team_members").select("email, nome"),
    supabase
      .from("leads")
      .select("id, empresa, contacto_nome, estado, responsavel, proxima_acao, proxima_data")
      .eq("arquivado", false)
      .eq("optout", false),
  ]);
  if (team.error || leads.error) {
    console.error("digest query failed", team.error?.message, leads.error?.message);
    return Response.json({ error: "query failed" }, { status: 500 });
  }

  const appUrl = (process.env.APP_URL ?? "https://cartise-crm.vercel.app").replace(/\/$/, "");
  const from = process.env.DIGEST_FROM ?? "Cartise CRM <onboarding@resend.dev>";
  const members = team.data as Member[];
  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  let changes;
  try {
    changes = await loadChanges(supabase, members, since);
  } catch (e) {
    console.error("digest changes failed", e);
    return Response.json({ error: "query failed" }, { status: 500 });
  }
  const today = todayISO();
  const digests = members.map((m) => buildDigest(m, leads.data as DigestLead[], appUrl, today, changes));

  if (dry) {
    return Response.json(digests.map(({ to, subject, items, changes, text }) => ({ to, subject, items, changes, text })));
  }

  const results: { to: string; status?: number; skipped?: string }[] = [];
  for (const d of digests) {
    if (d.items === 0 && d.changes === 0) {
      results.push({ to: d.to, skipped: "nothing to do" });
      continue;
    }
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
        // Vercel Cron can occasionally call twice; Resend drops the repeat.
        "Idempotency-Key": `digest-${today}-${d.to}`,
      },
      body: JSON.stringify({ from, to: [d.to], subject: d.subject, html: d.html, text: d.text }),
    });
    if (!res.ok) console.error("digest send failed", d.to, res.status, await res.text());
    results.push({ to: d.to, status: res.status });
  }
  // Fail the run when any email didn't go out, so it shows up as failed in Vercel's cron logs.
  // (Resend's test sender onboarding@resend.dev only delivers to the Resend account's own
  // address: set DIGEST_FROM to a verified cartise.pt sender to reach both founders.)
  const failed = results.some((r) => r.status !== undefined && (r.status < 200 || r.status >= 300));
  return Response.json(results, { status: failed ? 502 : 200 });
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function lisbonHour() {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Lisbon", hour: "2-digit", hourCycle: "h23" }).format(new Date()));
}
