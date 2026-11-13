"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/team";
import { isStage, segmentLabel, stageLabel, stageOf } from "@/lib/stages";
import { decideTouch, isTouch, TOUCHES } from "@/lib/cadence";
import { todayISO } from "@/lib/dates";
import { displayName } from "@/lib/names";
import { checkField, checkNextStep, EDITABLE_FIELDS, isEditableField } from "@/lib/fields";

export type ActionResult = { ok: true } | { ok: false; error: string };

const GONE = "Esta lead já não existe ou não tens acesso.";

async function logActivity(leadId: string, tipo: string, texto: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({ lead_id: leadId, tipo, texto });
  if (error) console.error("activities insert failed", leadId, error.message);
}

export async function moveLead(leadId: string, estado: string): Promise<ActionResult> {
  await requireMember();
  if (!isStage(estado)) return { ok: false, error: "Estado inválido." };

  const supabase = await createClient();
  // A manual stage change restarts the outreach cadence.
  const { data, error } = await supabase
    .from("leads")
    .update({ estado, passo_cadencia: 0 })
    .eq("id", leadId)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível mover a lead." };
  if (!data.length) return { ok: false, error: GONE };

  await logActivity(leadId, "estado", `Movida para “${stageLabel(estado)}”`);
  refresh();
  return { ok: true };
}

export async function setOwner(leadId: string, email: string | null): Promise<ActionResult> {
  const { team } = await requireMember();
  const owner = email ? team.find((m) => m.email.toLowerCase() === email.toLowerCase()) : null;
  if (email && !owner) return { ok: false, error: "Pessoa desconhecida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ responsavel: owner?.email ?? null })
    .eq("id", leadId)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível mudar o responsável." };
  if (!data.length) return { ok: false, error: GONE };

  await logActivity(
    leadId,
    "responsavel",
    owner ? `${displayName(owner)} vai contactar` : "Responsável removido",
  );
  refresh();
  return { ok: true };
}

/**
 * Take an unassigned lead. Only succeeds while nobody owns it, so two founders
 * clicking at the same time can't silently overwrite each other.
 */
export async function claimLead(leadId: string, email: string): Promise<ActionResult> {
  const { team } = await requireMember();
  const owner = team.find((m) => m.email === email);
  if (!owner) return { ok: false, error: "Pessoa desconhecida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ responsavel: owner.email })
    .eq("id", leadId)
    .is("responsavel", null)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível atribuir a lead." };
  if (!data.length) {
    refresh();
    return { ok: false, error: "Alguém já ficou com esta lead." };
  }

  await logActivity(leadId, "responsavel", `${displayName(owner)} vai contactar`);
  refresh();
  return { ok: true };
}

export type TouchResult =
  | { ok: true; acao: string | null; data: string | null }
  | { ok: false; error: string };

/**
 * One tap: log an email / LinkedIn / call / reply / meeting, update last contact,
 * move the stage forward if needed and schedule the next step from the cadence.
 * The step counter is compare-and-set, so two taps at once can't both count.
 */
export async function logTouch(leadId: string, kind: string): Promise<TouchResult> {
  await requireMember();
  if (!isTouch(kind)) return { ok: false, error: "Tipo de contacto inválido." };

  const supabase = await createClient();
  const { data: lead, error: leadError } = await supabase
    .from("leads")
    .select("id, estado, primeiro_contacto, passo_cadencia")
    .eq("id", leadId)
    .maybeSingle();
  if (leadError) return { ok: false, error: "Não foi possível registar o contacto." };
  if (!lead) return { ok: false, error: GONE };

  const today = todayISO();
  const current = stageOf(lead.estado as string);
  const step = (lead.passo_cadencia as number) ?? 0;
  const d = decideTouch(kind, step, current, today);

  const { data, error } = await supabase
    .from("leads")
    .update({
      ultimo_contacto: today,
      primeiro_contacto: lead.primeiro_contacto ?? today,
      passo_cadencia: d.step === "bump" ? step + 1 : d.step === "reset" ? 0 : step,
      ...(d.next ? { proxima_acao: d.next.acao, proxima_data: d.next.data } : {}),
      ...(d.estado ? { estado: d.estado } : {}),
    })
    .eq("id", leadId)
    .eq("passo_cadencia", step)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível registar o contacto." };
  if (!data.length) {
    refresh();
    return { ok: false, error: "Esta lead acabou de ser atualizada. Vê o histórico antes de registar outra vez." };
  }

  await logActivity(leadId, "contacto", TOUCHES[kind].done);
  if (d.estado) await logActivity(leadId, "estado", `Movida para “${stageLabel(d.estado)}”`);
  refresh();
  return { ok: true, acao: d.next?.acao ?? null, data: d.next?.data ?? null };
}

// Ids travel in the request URL (.in filter): keep batches well under URL limits.
const MAX_BULK = 200;
const isIdList = (ids: unknown): ids is string[] =>
  Array.isArray(ids) &&
  ids.length > 0 &&
  ids.length <= MAX_BULK &&
  ids.every((id) => typeof id === "string" && id.length > 0 && id.length <= 64);

export type BulkResult = { ok: true; count: number } | { ok: false; error: string };

/** Some leads may have been deleted or archived meanwhile: say so instead of a silent revert. */
const partial = (done: number, asked: number): BulkResult =>
  done === asked ? { ok: true, count: done } : { ok: false, error: `Só ${done} de ${asked} leads foram alteradas.` };

/** Move several leads to one stage at once (from the table's selection). */
export async function moveLeads(ids: string[], estado: string): Promise<BulkResult> {
  await requireMember();
  if (!isIdList(ids)) return { ok: false, error: "Seleção inválida." };
  if (!isStage(estado)) return { ok: false, error: "Estado inválido." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ estado, passo_cadencia: 0 })
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível mover as leads." };
  if (data.length === 0) return { ok: false, error: GONE };

  const texto = `Movida para “${stageLabel(estado)}”`;
  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "estado", texto })));
  if (actError) console.error("bulk move activities failed", actError.message);
  refresh();
  return partial(data.length, ids.length);
}

/** Give several leads to one person (or nobody) at once. */
export async function setOwnerMany(ids: string[], email: string | null): Promise<BulkResult> {
  const { team } = await requireMember();
  if (!isIdList(ids)) return { ok: false, error: "Seleção inválida." };
  const owner = email ? team.find((m) => m.email.toLowerCase() === email.toLowerCase()) : null;
  if (email && !owner) return { ok: false, error: "Pessoa desconhecida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ responsavel: owner?.email ?? null })
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível mudar o responsável." };
  if (data.length === 0) return { ok: false, error: GONE };

  const texto = owner ? `${displayName(owner)} vai contactar` : "Responsável removido";
  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "responsavel", texto })));
  if (actError) console.error("bulk owner activities failed", actError.message);
  refresh();
  return partial(data.length, ids.length);
}

/**
 * Edit one field straight from the table. A company name is changed on every active contact
 * of that company (same name), so the company doesn't split in two; anything else on this lead only.
 */
export async function updateLeadField(leadId: string, field: string, value: string): Promise<ActionResult> {
  await requireMember();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { ok: false, error: GONE };
  if (!isEditableField(field)) return { ok: false, error: "Campo inválido." };
  const check = checkField(field, value);
  if (!check.ok) return check;

  const supabase = await createClient();
  let ids = [leadId];
  if (field === "empresa") {
    const { data: lead, error: readError } = await supabase.from("leads").select("empresa").eq("id", leadId).maybeSingle();
    if (readError) return { ok: false, error: "Não foi possível guardar." };
    if (!lead) return { ok: false, error: GONE };
    const { data: same, error: sameError } = await supabase
      .from("leads")
      .select("id")
      .eq("empresa", lead.empresa)
      .eq("arquivado", false);
    if (sameError) return { ok: false, error: "Não foi possível guardar." };
    ids = [...new Set([leadId, ...(same ?? []).map((l) => l.id as string)])];
  }

  const { data, error } = await supabase
    .from("leads")
    .update({ [field]: check.value })
    .in("id", ids)
    .select("id");
  if (error?.code === "23505") {
    // The only unique index is on the email: say which lead has it (it may be archived).
    const { data: clash } = await supabase
      .from("leads")
      .select("empresa, arquivado")
      .ilike("email", check.value.replace(/[\\%_]/g, "\\$&"))
      .neq("id", leadId)
      .limit(1)
      .maybeSingle();
    return {
      ok: false,
      error: clash
        ? `Este email já é de ${clash.empresa}${clash.arquivado ? " (arquivada)" : ""}.`
        : "Já existe uma lead com este email.",
    };
  }
  if (error) return { ok: false, error: "Não foi possível guardar." };
  if (!data.length) return { ok: false, error: GONE };

  const shown = field === "segmento" ? segmentLabel(check.value) : check.value;
  const texto = `${EDITABLE_FIELDS[field]}: ${shown || "(apagado)"}`;
  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "editado", texto })));
  if (actError) console.error("field activities failed", actError.message);
  refresh();
  return { ok: true };
}

/** Next step (what + when) from the table; both empty clears it. */
export async function updateNextStep(leadId: string, acao: string, data: string): Promise<ActionResult> {
  await requireMember();
  if (typeof leadId !== "string" || !leadId || leadId.length > 64) return { ok: false, error: GONE };
  const next = checkNextStep(acao, data);
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("leads")
    .update({ proxima_acao: next.acao, proxima_data: next.data })
    .eq("id", leadId)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível guardar o próximo passo." };
  if (!rows.length) return { ok: false, error: GONE };

  await logActivity(
    leadId,
    "seguimento",
    next.acao || next.data
      ? `Próximo passo: ${next.acao || "seguimento"}${next.data ? ` (${next.data})` : ""}`
      : "Próximo passo removido",
  );
  refresh();
  return { ok: true };
}

/** Set the industry of several leads at once. */
export async function setSegmentMany(ids: string[], segmento: string): Promise<BulkResult> {
  await requireMember();
  if (!isIdList(ids)) return { ok: false, error: "Seleção inválida." };
  const check = checkField("segmento", segmento);
  if (!check.ok) return check;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ segmento: check.value })
    .in("id", ids)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível mudar a indústria." };
  if (data.length === 0) return { ok: false, error: GONE };

  const texto = `Indústria: ${segmentLabel(check.value)}`;
  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "editado", texto })));
  if (actError) console.error("bulk segment activities failed", actError.message);
  refresh();
  return partial(data.length, ids.length);
}

/**
 * "Apagar" from the table: the leads leave the pipeline and every list, but stay in the
 * database (archived) with their history, so they can be brought back.
 */
export async function archiveLeads(ids: string[]): Promise<BulkResult> {
  await requireMember();
  if (!isIdList(ids)) return { ok: false, error: "Seleção inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ arquivado: true })
    .in("id", ids)
    .eq("arquivado", false)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível apagar." };
  if (data.length === 0) return { ok: false, error: GONE };

  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "arquivado", texto: "Apagada do pipeline" })));
  if (actError) console.error("archive activities failed", actError.message);
  refresh();
  return partial(data.length, ids.length);
}

/** Undo of archiveLeads. */
export async function restoreLeads(ids: string[]): Promise<BulkResult> {
  await requireMember();
  if (!isIdList(ids)) return { ok: false, error: "Seleção inválida." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("leads")
    .update({ arquivado: false })
    .in("id", ids)
    .eq("arquivado", true)
    .select("id");
  if (error) return { ok: false, error: "Não foi possível recuperar." };
  if (data.length === 0) return { ok: false, error: GONE };

  const { error: actError } = await supabase
    .from("activities")
    .insert(data.map((d) => ({ lead_id: d.id, tipo: "arquivado", texto: "Recuperada" })));
  if (actError) console.error("restore activities failed", actError.message);
  refresh();
  return partial(data.length, ids.length);
}
