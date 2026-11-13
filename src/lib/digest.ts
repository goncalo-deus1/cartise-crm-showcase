import { daysFrom, dueLabel, todayISO } from "@/lib/dates";
import { displayName, type Member } from "@/lib/names";
import { isOpen } from "@/lib/stages";
import { SHOW_NEXT_STEP } from "@/lib/features";

export type DigestLead = {
  id: string;
  empresa: string;
  contacto_nome: string;
  estado: string;
  responsavel: string | null;
  proxima_acao: string;
  proxima_data: string | null;
};

export type Digest = { to: string; subject: string; html: string; text: string; items: number; changes: number };

/** What happened in the CRM in the last 24 hours (the whole team's leads). */
export type DigestChanges = {
  /** Replies received (auto-replies excluded), newest first. */
  replies: { leadId: string; empresa: string; contacto: string; snippet: string }[];
  /** Last stage move per lead. */
  moves: { leadId: string; empresa: string; stage: string; by: string }[];
  newLeads: { leadId: string; empresa: string; contacto: string }[];
  /** Emails sent, per company. */
  sent: { empresa: string; count: number }[];
};

export const NO_CHANGES: DigestChanges = { replies: [], moves: [], newLeads: [], sent: [] };

export function countChanges(c: DigestChanges) {
  return c.replies.length + c.moves.length + c.newLeads.length + c.sent.length;
}

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Morning email for one founder: overdue + today, the next 3 days, and leads nobody owns. */
export function buildDigest(
  member: Member,
  leads: DigestLead[],
  appUrl: string,
  today = todayISO(),
  changes: DigestChanges = NO_CHANGES,
): Digest {
  const open = leads.filter((l) => isOpen(l.estado));
  // Follow-ups come from "Próximo passo", which is switched off for now (see features.ts).
  const mine = SHOW_NEXT_STEP ? open.filter((l) => l.responsavel === member.email && l.proxima_data) : [];
  const byDate = (a: DigestLead, b: DigestLead) => (a.proxima_data! < b.proxima_data! ? -1 : 1);
  const due = mine.filter((l) => daysFrom(l.proxima_data!, today) <= 0).sort(byDate);
  const soon = mine.filter((l) => daysFrom(l.proxima_data!, today) > 0 && daysFrom(l.proxima_data!, today) <= 3).sort(byDate);
  const overdue = due.filter((l) => daysFrom(l.proxima_data!, today) < 0).length;
  const unassigned = open.filter((l) => !l.responsavel).length;

  const name = displayName(member);
  const nChanges = countChanges(changes);
  const replyPart = changes.replies.length
    ? `${changes.replies.length} ${changes.replies.length === 1 ? "resposta nova" : "respostas novas"} · `
    : "";
  const subject =
    replyPart +
    (due.length > 0
      ? `Hoje: ${due.length} ${due.length === 1 ? "seguimento" : "seguimentos"}${overdue ? ` (${overdue} em atraso)` : ""}`
      : SHOW_NEXT_STEP && unassigned > 0
        ? `${unassigned} ${unassigned === 1 ? "lead sem dono" : "leads sem dono"}`
        : nChanges
          ? "O que mudou no CRM"
          : "Nada marcado para hoje");

  const row = (l: DigestLead) => {
    const late = daysFrom(l.proxima_data!, today) < 0;
    return `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #eceae6">
    <a href="${appUrl}/leads/${encodeURIComponent(l.id)}" style="color:#0e0e0e;font-weight:600;text-decoration:none">${esc(l.empresa)}</a>
    <div style="color:#55545a;font-size:13px">${esc(l.proxima_acao || l.contacto_nome || "Seguimento")}</div>
  </td>
  <td style="padding:10px 0;border-bottom:1px solid #eceae6;text-align:right;white-space:nowrap;font-size:13px;font-weight:600;color:${late ? "#b13535" : "#55545a"}">${esc(dueLabel(l.proxima_data, today))}</td>
</tr>`;
  };
  const section = (title: string, list: DigestLead[]) =>
    list.length
      ? `<h3 style="margin:24px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#55545a">${title}</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${list.map(row).join("")}</table>`
      : "";

  const html = `<!doctype html><html lang="pt-PT"><body style="margin:0;background:#f3f2ef;font-family:-apple-system,Segoe UI,Inter,Arial,sans-serif;color:#0e0e0e">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
  <div style="background:#fff;border-radius:20px;padding:24px">
    <div style="font-size:13px;color:#6b6a70">Cartise CRM</div>
    <h1 style="margin:4px 0 0;font-size:22px">Bom dia, ${esc(name)}</h1>
    <p style="margin:8px 0 0;color:#55545a">${
      due.length
        ? `Tens <strong>${due.length}</strong> ${due.length === 1 ? "seguimento" : "seguimentos"} para hoje${overdue ? `, ${overdue} em atraso` : ""}.`
        : SHOW_NEXT_STEP
          ? "Não tens nada marcado para hoje."
          : "Isto foi o que mudou no CRM desde ontem."
    }</p>
    ${changesHtml(changes, appUrl)}
    ${section("Hoje e em atraso", due)}
    ${section("Próximos 3 dias", soon)}
    ${
      unassigned
        ? `<p style="margin:24px 0 0;padding:12px 14px;border:1.5px dashed #b9b8b4;border-radius:14px;color:#55545a">${unassigned} ${
            unassigned === 1 ? "lead ainda não tem" : "leads ainda não têm"
          } dono. <a href="${appUrl}/" style="color:#6252c1;font-weight:600">Dividir agora</a></p>`
        : ""
    }
    <p style="margin:24px 0 0"><a href="${appUrl}/" style="display:inline-block;background:#0e0e0e;color:#fff;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:999px">Abrir o CRM</a></p>
  </div>
</div></body></html>`;

  const lines = (list: DigestLead[]) => list.map((l) => `- ${l.empresa}: ${l.proxima_acao || "seguimento"} (${dueLabel(l.proxima_data, today)})`);
  const text = [
    `Bom dia, ${name}`,
    changesText(changes),
    due.length ? `Hoje e em atraso:\n${lines(due).join("\n")}` : SHOW_NEXT_STEP ? "Nada marcado para hoje." : "",
    soon.length ? `Próximos 3 dias:\n${lines(soon).join("\n")}` : "",
    unassigned ? `${unassigned} leads sem dono: ${appUrl}/` : "",
    `Abrir o CRM: ${appUrl}/`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { to: member.email, subject, html, text, items: SHOW_NEXT_STEP ? due.length + soon.length + unassigned : 0, changes: nChanges };
}

const LINK = "color:#0e0e0e;font-weight:600;text-decoration:none";
const H3 = "margin:24px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#55545a";
const ROW = "padding:8px 0;border-bottom:1px solid #eceae6;font-size:14px";

function changesHtml(c: DigestChanges, appUrl: string) {
  if (!countChanges(c)) return "";
  const lead = (id: string, empresa: string) =>
    `<a href="${appUrl}/leads/${encodeURIComponent(id)}" style="${LINK}">${esc(empresa)}</a>`;
  const block = (title: string, rows: string[]) =>
    rows.length
      ? `<h3 style="${H3}">${title}</h3><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows
          .map((r) => `<tr><td style="${ROW}">${r}</td></tr>`)
          .join("")}</table>`
      : "";
  const sentTotal = c.sent.reduce((n, s) => n + s.count, 0);
  return `<div style="margin-top:20px;padding:4px 16px 16px;background:#f2f0fc;border-radius:16px">
    ${block(
      "Respostas",
      c.replies.map(
        (r) =>
          `${lead(r.leadId, r.empresa)}${r.contacto ? ` <span style="color:#55545a">· ${esc(r.contacto)}</span>` : ""}<div style="color:#55545a;font-size:13px;margin-top:2px">“${esc(r.snippet)}”</div>`,
      ),
    )}
    ${block(
      "Mudaram de estado",
      c.moves.map((m) => `${lead(m.leadId, m.empresa)} → ${esc(m.stage)}<span style="color:#6b6a70;font-size:12px"> · ${esc(m.by)}</span>`),
    )}
    ${block(
      "Leads novas",
      c.newLeads.map((n) => `${lead(n.leadId, n.empresa)}${n.contacto ? ` <span style="color:#55545a">· ${esc(n.contacto)}</span>` : ""}`),
    )}
    ${
      sentTotal
        ? `<h3 style="${H3}">Emails enviados</h3><p style="margin:4px 0 0;font-size:14px;color:#55545a">${sentTotal} ${
            sentTotal === 1 ? "email" : "emails"
          }: ${esc(c.sent.map((s) => (s.count > 1 ? `${s.empresa} (${s.count})` : s.empresa)).join(", "))}</p>`
        : ""
    }
  </div>`;
}

function changesText(c: DigestChanges) {
  if (!countChanges(c)) return "";
  const parts = ["O que mudou desde ontem:"];
  for (const r of c.replies) parts.push(`- Resposta de ${r.empresa}${r.contacto ? ` (${r.contacto})` : ""}: "${r.snippet}"`);
  for (const m of c.moves) parts.push(`- ${m.empresa} → ${m.stage} (${m.by})`);
  for (const n of c.newLeads) parts.push(`- Lead nova: ${n.empresa}${n.contacto ? ` (${n.contacto})` : ""}`);
  const sentTotal = c.sent.reduce((n, s) => n + s.count, 0);
  if (sentTotal) parts.push(`- ${sentTotal} emails enviados: ${c.sent.map((s) => s.empresa).join(", ")}`);
  return parts.join("\n");
}
