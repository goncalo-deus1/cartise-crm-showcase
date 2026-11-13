import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DigestChanges } from "@/lib/digest";
import { displayName, type Member } from "@/lib/names";
import { stageLabel } from "@/lib/stages";

type Lead = { id: string; empresa: string; contacto_nome: string; arquivado: boolean };

/** Who made a change: a team member's name, or the email sync. */
function author(autor: string | null, team: Member[]) {
  if (!autor) return "";
  if (autor === "zoho") return "pelo email";
  const m = team.find((t) => t.email === autor);
  return m ? displayName(m) : "";
}

const snippet = (s: string) => {
  const flat = s.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
};

/** Replies, stage moves, new leads and sent emails since `since` (ISO timestamp). */
export async function loadChanges(supabase: SupabaseClient, team: Member[], since: string): Promise<DigestChanges> {
  const [msgs, acts] = await Promise.all([
    supabase
      .from("messages")
      .select("lead_id, direcao, estado, corpo, enviado_em")
      .gte("enviado_em", since)
      .neq("estado", "descartado")
      .order("enviado_em", { ascending: false }),
    supabase
      .from("activities")
      .select("lead_id, tipo, texto, autor, data")
      .gte("data", since)
      .in("tipo", ["estado", "criado"])
      .order("data", { ascending: false }),
  ]);
  if (msgs.error || acts.error) throw new Error(`changes query failed: ${msgs.error?.message ?? acts.error?.message}`);

  const ids = [...new Set([...(msgs.data ?? []), ...(acts.data ?? [])].map((r) => r.lead_id as string))];
  const leads = new Map<string, Lead>();
  if (ids.length) {
    const { data, error } = await supabase.from("leads").select("id, empresa, contacto_nome, arquivado").in("id", ids);
    if (error) throw new Error(`changes leads query failed: ${error.message}`);
    for (const l of (data ?? []) as Lead[]) leads.set(l.id, l);
  }
  // Deleted leads don't belong in the morning email.
  const live = (id: string) => {
    const l = leads.get(id);
    return l && !l.arquivado ? l : null;
  };

  const replies: DigestChanges["replies"] = [];
  const sentBy = new Map<string, number>();
  for (const m of msgs.data ?? []) {
    const l = live(m.lead_id);
    if (!l) continue;
    if (m.direcao === "recebida") {
      replies.push({ leadId: l.id, empresa: l.empresa, contacto: l.contacto_nome, snippet: snippet(m.corpo ?? "") });
    } else if (m.estado === "enviado") {
      sentBy.set(l.empresa, (sentBy.get(l.empresa) ?? 0) + 1);
    }
  }

  const moves: DigestChanges["moves"] = [];
  const newLeads: DigestChanges["newLeads"] = [];
  const seenMove = new Set<string>();
  for (const a of acts.data ?? []) {
    const l = live(a.lead_id);
    if (!l) continue;
    if (a.tipo === "criado") {
      newLeads.push({ leadId: l.id, empresa: l.empresa, contacto: l.contacto_nome });
    } else if (!seenMove.has(l.id)) {
      // Newest first, so this is where the lead ended up.
      seenMove.add(l.id);
      const stage = /“(.+)”/.exec(a.texto ?? "")?.[1] ?? stageLabel("");
      moves.push({ leadId: l.id, empresa: l.empresa, stage, by: author(a.autor, team) });
    }
  }

  return {
    replies,
    moves,
    newLeads,
    sent: [...sentBy].map(([empresa, count]) => ({ empresa, count })).sort((a, b) => b.count - a.count),
  };
}
