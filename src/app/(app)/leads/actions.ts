"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/team";
import { isSegment, isStage } from "@/lib/stages";
import { cleanText } from "@/lib/validation";
import { checkField, realDate } from "@/lib/fields";

export type FormState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  /** What was submitted, so the form can show it again after an error (React resets forms on submit). */
  values?: Record<string, string>;
  /** Changes on every failed submit so the form remounts with `values`. */
  attempt?: number;
};


function submitted(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return values;
}

function failed(formData: FormData, rest: Pick<FormState, "error" | "fieldErrors">): FormState {
  return { ...rest, values: submitted(formData), attempt: Date.now() };
}

const TEXT_FIELDS = [
  "empresa",
  "contacto_nome",
  "cargo",
  "email",
  "telefone",
  "website",
  "linkedin_url",
  "cidade",
  "proxima_acao",
  "notas",
] as const;

const MAX_LEN: Record<string, number> = { notas: 5000 };

async function parseLead(formData: FormData, { withTracking }: { withTracking: boolean }) {
  const { team } = await requireMember();
  const fieldErrors: Record<string, string> = {};
  const values: Record<string, string | null> = {};

  for (const f of TEXT_FIELDS) {
    values[f] = cleanText(formData.get(f), MAX_LEN[f] ?? 300);
  }
  // Same rules as editing in the table (normalised phone, full https links, lengths…).
  for (const f of ["empresa", "contacto_nome", "cargo", "email", "telefone", "linkedin_url", "website", "cidade"] as const) {
    const check = checkField(f, formData.get(f));
    if (check.ok) values[f] = check.value;
    else fieldErrors[f] = f === "empresa" ? "Indica a empresa." : check.error;
  }

  const segmento = String(formData.get("segmento") ?? "outro");
  values.segmento = isSegment(segmento) ? segmento : "outro";

  // Stage and owner are only set when creating; on the lead page they have their own instant controls,
  // so the edit form never overwrites a change the other founder just made.
  if (withTracking) {
    const estado = String(formData.get("estado") ?? "novo");
    values.estado = isStage(estado) ? estado : "novo";
    const responsavel = String(formData.get("responsavel") ?? "");
    values.responsavel = team.some((m) => m.email === responsavel) ? responsavel : null;
  }

  values.proxima_data = realDate(formData.get("proxima_data"));

  return { values, fieldErrors };
}

export async function createLead(_prev: FormState, formData: FormData): Promise<FormState> {
  const { values, fieldErrors } = await parseLead(formData, { withTracking: true });
  if (Object.keys(fieldErrors).length) return failed(formData, { fieldErrors });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .insert({ ...values, origem: "manual" })
    .select("id")
    .single();
  if (error?.code === "23505") return failed(formData, { fieldErrors: { email: "Já existe uma lead com este email." } });
  if (error || !data) return failed(formData, { error: "Não foi possível criar a lead." });

  await supabase.from("activities").insert({ lead_id: data.id, tipo: "criado", texto: "Lead criada" });
  redirect(`/leads/${data.id}`);
}

export async function updateLead(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { values, fieldErrors } = await parseLead(formData, { withTracking: false });
  if (Object.keys(fieldErrors).length) return failed(formData, { fieldErrors });

  const supabase = await createClient();
  const { data, error } = await supabase.from("leads").update(values).eq("id", id).select("id");
  if (error?.code === "23505") return failed(formData, { fieldErrors: { email: "Já existe outra lead com este email." } });
  if (error || !data?.length) return failed(formData, { error: "Não foi possível guardar as alterações." });

  await supabase.from("activities").insert({ lead_id: id, tipo: "editado", texto: "Dados atualizados" });
  redirect(`/leads/${id}`);
}

export async function addNote(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const texto = cleanText(formData.get("texto"), 2000);
  if (!texto) return failed(formData, { fieldErrors: { texto: "Escreve alguma coisa." } });

  const wasContact = formData.get("contacto") === "on";

  const supabase = await createClient();
  const { error } = await supabase
    .from("activities")
    .insert({ lead_id: id, tipo: wasContact ? "contacto" : "nota", texto });
  if (error) return failed(formData, { error: "Não foi possível guardar a nota." });

  if (wasContact) {
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
    await supabase.from("leads").update({ ultimo_contacto: today }).eq("id", id);
  }
  refresh();
  return {};
}

/** Set or clear the next step straight from the lead page. */
export async function setNextAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireMember();
  const acao = cleanText(formData.get("proxima_acao"), 300);
  const data = String(formData.get("proxima_data") ?? "");
  const clear = formData.get("limpar") === "1";
  const proxima_data = clear ? null : /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null;
  if (!clear && !acao && !proxima_data) {
    return failed(formData, { fieldErrors: { proxima_acao: "Diz o que fazer ou escolhe uma data." } });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("leads")
    .update({ proxima_acao: clear ? "" : acao, proxima_data })
    .eq("id", id)
    .select("id");
  if (error || !rows?.length) return failed(formData, { error: "Não foi possível guardar o próximo passo." });

  const { error: actError } = await supabase.from("activities").insert({
    lead_id: id,
    tipo: "seguimento",
    texto: clear ? "Próximo passo concluído" : `Próximo passo: ${acao || "seguimento"}${proxima_data ? ` (${proxima_data})` : ""}`,
  });
  if (actError) console.error("activities insert failed", id, actError.message);
  refresh();
  return {};
}
