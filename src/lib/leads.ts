import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Lead = {
  id: string;
  empresa: string;
  segmento: string;
  cidade: string;
  website: string;
  contacto_nome: string;
  cargo: string;
  email: string;
  telefone: string;
  linkedin_url: string;
  notas: string;
  estado: string;
  origem: string;
  proxima_acao: string;
  proxima_data: string | null;
  ultimo_contacto: string | null;
  responsavel: string | null;
  criado_em: string;
  atualizado_em: string;
};

const LEAD_COLUMNS =
  "id, empresa, segmento, cidade, website, contacto_nome, cargo, email, telefone, linkedin_url, notas, estado, origem, proxima_acao, proxima_data, ultimo_contacto, responsavel, criado_em, atualizado_em";

/** All non-archived leads, newest activity first. RLS limits this to the team. */
export async function getActiveLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("arquivado", false)
    .order("atualizado_em", { ascending: false });
  if (error) {
    console.error("getActiveLeads failed", error.message);
    throw new Error("Não foi possível carregar as leads.");
  }
  return (data ?? []) as Lead[];
}

/** Leads deleted from the table ("Apagar"), most recently changed first. */
export async function getArchivedLeads(): Promise<Lead[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_COLUMNS)
    .eq("arquivado", true)
    .order("atualizado_em", { ascending: false });
  if (error) {
    console.error("getArchivedLeads failed", error.message);
    throw new Error("Não foi possível carregar as leads apagadas.");
  }
  return (data ?? []) as Lead[];
}

/** One lead, deleted or not (the page says when it's deleted). */
export async function getLead(id: string): Promise<(Lead & { arquivado: boolean }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .select(`${LEAD_COLUMNS}, arquivado`)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("getLead failed", id, error.message);
    throw new Error("Não foi possível carregar a lead.");
  }
  return (data as (Lead & { arquivado: boolean }) | null) ?? null;
}

export type TimelineItem = {
  id: string;
  kind: "activity" | "message";
  date: string;
  author: string;
  title: string;
  body: string;
  tag: string;
};

/** Activities and sent/received messages for one lead, newest first. */
export async function getTimeline(leadId: string): Promise<TimelineItem[]> {
  const supabase = await createClient();
  const [acts, msgs] = await Promise.all([
    supabase.from("activities").select("id, tipo, texto, autor, data").eq("lead_id", leadId),
    supabase
      .from("messages")
      .select("id, canal, assunto, corpo, estado, direcao, enviado_em, enviar_em, criado_em")
      .eq("lead_id", leadId),
  ]);
  if (acts.error || msgs.error) {
    console.error("getTimeline failed", leadId, acts.error?.message, msgs.error?.message);
    throw new Error("Não foi possível carregar o histórico.");
  }

  const items: TimelineItem[] = [
    ...(acts.data ?? []).map((a) => ({
      id: `a-${a.id}`,
      kind: "activity" as const,
      date: a.data as string,
      author: (a.autor as string) ?? "",
      title: (a.texto as string) ?? "",
      body: "",
      tag: (a.tipo as string) ?? "",
    })),
    ...(msgs.data ?? [])
      // Only what really happened: sent messages and replies (no drafts, scheduled ones or
      // out-of-office auto-replies, which the Zoho sync stores as "descartado").
      .filter((m) => (m.direcao === "recebida" && m.estado !== "descartado") || (m.estado === "enviado" && m.enviado_em))
      .map((m) => ({
        id: `m-${m.id}`,
        kind: "message" as const,
        date: (m.enviado_em ?? m.criado_em) as string,
        author: m.direcao === "recebida" ? "Resposta" : "Enviada",
        title: (m.assunto as string) || (m.canal === "linkedin" ? "Mensagem LinkedIn" : "Email"),
        body: (m.corpo as string) ?? "",
        tag: (m.canal as string) ?? "",
      })),
  ];
  const t = (d: string) => Date.parse(d) || 0;
  return items.sort((a, b) => t(b.date) - t(a.date) || b.id.localeCompare(a.id));
}
