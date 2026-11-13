import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { stageLabel, stageOf } from "@/lib/stages";
import { cleanBody, htmlToText, isAutoReply, parseAddresses } from "./clean";
import type { ZohoClient, ZohoMessage } from "./client";

/** Our own domains: emails only between these are internal and never logged. */
const OWN_DOMAINS = ["cartise.pt", "cartisemedia.pt"];
/** Stages that move forward automatically on email activity. */
const BEFORE_CONTACT = ["novo", "rascunho"];
const AWAITING_REPLY = ["novo", "rascunho", "em_sequencia"];
const PAGE = 50;
const MAX_SCAN = 200;
const LOCK_MS = 3 * 60_000;
const AUTHOR = "zoho";

type Direction = "enviada" | "recebida";
type Item = ZohoMessage & { direcao: Direction; at: number; counterparts: string[] };
type LeadRow = {
  id: string;
  email: string;
  estado: string;
  ultimo_contacto: string | null;
  primeiro_contacto: string | null;
};

export type SyncResult = {
  mailbox: string;
  scanned: number;
  logged: number;
  autoReplies: number;
  movedStage: number;
  unmatched: { address: string; subject: string; direcao: Direction }[];
  more: boolean;
  skipped?: string;
};

const isOwn = (address: string, mailboxDomain: string) => {
  const domain = address.split("@")[1] ?? "";
  return domain === mailboxDomain || OWN_DOMAINS.includes(domain);
};

const dateOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const later = (a: string | null, b: string) => (!a || b > a ? b : a);

/**
 * One sync pass over the mailbox's Inbox and Sent folders: every email since the last
 * run whose other side is a lead (by email address) is stored on that lead, oldest first,
 * and the lead's last contact / stage move on. Emails nobody in the CRM matches are only
 * listed in the run result. Safe to run repeatedly: (lead_id, zoho_id) is unique.
 */
export async function syncMailbox(
  supabase: SupabaseClient,
  zoho: ZohoClient,
  { maxMessages = 40 }: { maxMessages?: number } = {},
): Promise<SyncResult> {
  const account = await zoho.primaryAccount();
  const mailbox = account.email;
  const mailboxDomain = mailbox.split("@")[1] ?? "";
  const result: SyncResult = {
    mailbox,
    scanned: 0,
    logged: 0,
    autoReplies: 0,
    movedStage: 0,
    unmatched: [],
    more: false,
  };

  // State + lock (so two overlapping runs don't both work the same emails).
  const now = Date.now();
  const { data: state, error: stateError } = await supabase
    .from("mail_sync")
    .select("cursor_ms, locked_until")
    .eq("mailbox", mailbox)
    .maybeSingle();
  if (stateError) throw new Error(`mail_sync read failed: ${stateError.message}`);
  if (!state) {
    // First run: start from now, don't backfill the whole mailbox.
    await supabase.from("mail_sync").insert({ mailbox, cursor_ms: now, last_run_at: new Date().toISOString() });
    return { ...result, skipped: "first run: starting from now" };
  }
  const { data: locked } = await supabase
    .from("mail_sync")
    .update({ locked_until: new Date(now + LOCK_MS).toISOString() })
    .eq("mailbox", mailbox)
    .or(`locked_until.is.null,locked_until.lt.${new Date(now).toISOString()}`)
    .select("mailbox");
  if (!locked?.length) return { ...result, skipped: "another run is in progress" };

  try {
    const cursor = Number(state.cursor_ms);
    const folders = await zoho.folders(account.accountId);

    // Everything newer than the cursor, in both folders.
    const items: Item[] = [];
    for (const [folderId, direcao] of [
      [folders.inbox, "recebida"],
      [folders.sent, "enviada"],
    ] as const) {
      for (let start = 1; start <= MAX_SCAN; start += PAGE) {
        const page = await zoho.listMessages(account.accountId, folderId, start, PAGE);
        const fresh = page.filter((m) => Number(m.receivedTime) > cursor);
        for (const m of fresh) {
          const addresses =
            direcao === "recebida" ? parseAddresses(m.fromAddress) : parseAddresses(`${m.toAddress},${m.ccAddress ?? ""}`);
          items.push({
            ...m,
            folderId,
            direcao,
            at: Number(m.receivedTime),
            counterparts: addresses.filter((a) => !isOwn(a, mailboxDomain)),
          });
        }
        if (page.length < PAGE || fresh.length < page.length) break;
      }
    }
    items.sort((a, b) => a.at - b.at);
    result.scanned = items.length;
    const batch = items.slice(0, maxMessages);
    result.more = items.length > batch.length;

    // Leads for every address in this batch (active leads only; matched case-insensitively).
    const addresses = [...new Set(batch.flatMap((m) => m.counterparts))];
    const leadsByEmail = new Map<string, LeadRow>();
    if (addresses.length) {
      const { data, error } = await supabase
        .from("leads")
        .select("id, email, estado, ultimo_contacto, primeiro_contacto")
        .eq("arquivado", false)
        .or(addresses.map((a) => `email.ilike.${a}`).join(","));
      if (error) throw new Error(`leads lookup failed: ${error.message}`);
      for (const l of (data ?? []) as LeadRow[]) leadsByEmail.set(l.email.toLowerCase(), l);
    }

    for (const m of batch) {
      const leads = m.counterparts.map((a) => leadsByEmail.get(a)).filter((l): l is LeadRow => Boolean(l));
      for (const a of m.counterparts) {
        if (!leadsByEmail.has(a) && result.unmatched.length < 50) {
          result.unmatched.push({ address: a, subject: m.subject, direcao: m.direcao });
        }
      }
      if (!leads.length) continue;

      const html = await zoho.content(account.accountId, m.folderId, m.messageId);
      const signer = m.direcao === "enviada" ? account.firstName || undefined : undefined;
      const corpo = cleanBody(htmlToText(html), signer) || (m.summary ?? "");
      const auto = m.direcao === "recebida" && isAutoReply(m.subject, corpo);
      if (auto) result.autoReplies++;

      for (const lead of leads) {
        if (await logEmail(supabase, lead, m, corpo, auto)) {
          result.logged++;
          if (!auto && (await advanceLead(supabase, lead, m, corpo))) result.movedStage++;
        }
      }
    }

    const last = batch.at(-1);
    await supabase
      .from("mail_sync")
      .update({
        cursor_ms: last ? last.at : cursor,
        last_run_at: new Date().toISOString(),
        last_result: result,
        locked_until: null,
      })
      .eq("mailbox", mailbox);
    return result;
  } catch (e) {
    await supabase
      .from("mail_sync")
      .update({ locked_until: null, last_run_at: new Date().toISOString(), last_result: { error: String(e) } })
      .eq("mailbox", mailbox);
    throw e;
  }
}

/** Stores the email on the lead. False when it was already there (earlier run). */
async function logEmail(supabase: SupabaseClient, lead: LeadRow, m: Item, corpo: string, auto: boolean) {
  const { data: prev } = await supabase
    .from("messages")
    .select("passo")
    .eq("lead_id", lead.id)
    .order("passo", { ascending: false })
    .limit(1);
  const passo = (prev?.[0]?.passo ?? 0) + 1;
  const { data, error } = await supabase
    .from("messages")
    .upsert(
      {
        lead_id: lead.id,
        canal: "email",
        passo,
        assunto: m.subject.slice(0, 500),
        corpo,
        // Out-of-office replies are kept for reference but don't count as a conversation.
        estado: auto ? "descartado" : "enviado",
        enviado_em: new Date(m.at).toISOString(),
        direcao: m.direcao,
        zoho_id: m.messageId,
      },
      { onConflict: "lead_id,zoho_id", ignoreDuplicates: true },
    )
    .select("id");
  if (error) throw new Error(`messages insert failed: ${error.message}`);
  if (!data?.length) return false;

  // The message itself shows in the lead's history; an auto-reply only gets a note.
  if (auto) {
    await supabase
      .from("activities")
      .insert({ lead_id: lead.id, tipo: "contacto", texto: `Resposta automática (ausência): ${m.subject}`, autor: AUTHOR });
  }
  return true;
}

/** Last contact date, first contact date, and the stage: sent → "Em contacto", reply → "Respondeu". */
async function advanceLead(supabase: SupabaseClient, lead: LeadRow, m: Item, corpo: string) {
  const day = dateOf(m.at);
  const stage = stageOf(lead.estado);
  const next =
    m.direcao === "recebida" && AWAITING_REPLY.includes(lead.estado)
      ? "respondeu"
      : m.direcao === "enviada" && BEFORE_CONTACT.includes(lead.estado)
        ? "em_sequencia"
        : null;

  const patch: Record<string, string> = { ultimo_contacto: later(lead.ultimo_contacto, day) };
  if (!lead.primeiro_contacto) patch.primeiro_contacto = day;
  if (m.direcao === "recebida") patch.ultima_resposta = corpo.slice(0, 500);
  if (next && next !== stage) patch.estado = next;

  const { error } = await supabase.from("leads").update(patch).eq("id", lead.id);
  if (error) throw new Error(`lead update failed: ${error.message}`);
  // Keep the in-memory row current for the next email in this batch.
  lead.ultimo_contacto = patch.ultimo_contacto;
  lead.primeiro_contacto = lead.primeiro_contacto ?? day;
  if (!patch.estado) return false;
  lead.estado = patch.estado;
  await supabase.from("activities").insert({
    lead_id: lead.id,
    tipo: "estado",
    texto: `Movida para “${stageLabel(patch.estado)}”`,
    autor: AUTHOR,
  });
  return true;
}
