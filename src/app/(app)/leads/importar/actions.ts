"use server";

import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMember } from "@/lib/team";
import { checkRecord, dedupeKeys, type ImportRow, type RawRecord } from "@/lib/import";
import { cleanText } from "@/lib/validation";

/** Rows per call: keeps each request well under the 1 MB server action limit. */
const CHUNK = 100;
const LOOKUP_CHUNK = 200;

export type Existing = Record<string, "ativa" | "arquivada">;
type Probe = Pick<ImportRow, "email" | "empresa" | "contacto_nome">;
type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Which of these contacts are already in the CRM (active or archived). Only looks up the
 * emails and companies being imported, so it works at any CRM size and sends nothing else back.
 */
async function lookupExisting(supabase: Supabase, probes: Probe[]): Promise<Existing> {
  const emails = [...new Set(probes.map((p) => p.email.toLowerCase()).filter(Boolean))];
  const companies = [...new Set(probes.map((p) => p.empresa).filter(Boolean))];
  const found: { email: string; empresa: string; contacto_nome: string; arquivado: boolean }[] = [];

  const fetchBy = async (column: "email" | "empresa", values: string[]) => {
    for (let i = 0; i < values.length; i += LOOKUP_CHUNK) {
      const { data, error } = await supabase
        .from("leads")
        .select("email, empresa, contacto_nome, arquivado")
        .in(column, values.slice(i, i + LOOKUP_CHUNK));
      if (error) throw new Error("Não foi possível verificar duplicados.");
      found.push(...(data ?? []));
    }
  };
  await fetchBy("email", emails);
  await fetchBy("empresa", companies);

  const out: Existing = {};
  for (const l of found) {
    for (const key of dedupeKeys({ email: l.email ?? "", empresa: l.empresa ?? "", contacto_nome: l.contacto_nome ?? "" })) {
      if (out[key] !== "ativa") out[key] = l.arquivado ? "arquivada" : "ativa";
    }
  }
  return out;
}

const toProbe = (p: Partial<Probe>): Probe => ({
  email: cleanText(p?.email).toLowerCase(),
  empresa: cleanText(p?.empresa),
  contacto_nome: cleanText(p?.contacto_nome),
});

/** For the preview: which of these contacts already exist (only their keys are returned). */
export async function findExisting(probes: Partial<Probe>[]): Promise<Existing> {
  await requireMember();
  if (!Array.isArray(probes)) return {};
  const supabase = await createClient();
  const clean = probes.slice(0, 1000).map(toProbe);
  const existing = await lookupExisting(supabase, clean);
  // Only answer about the keys that were asked for.
  const asked = new Set(clean.flatMap(dedupeKeys));
  return Object.fromEntries(Object.entries(existing).filter(([k]) => asked.has(k)));
}

export type ImportResult =
  | { ok: true; imported: number; skipped: { line: number; reason: string }[] }
  | { ok: false; error: string };

/**
 * Import one chunk of spreadsheet rows (the page sends them in chunks of 100).
 * Everything is re-validated here (never trust the browser): rows with errors and contacts
 * that already exist are skipped. `lines` are the spreadsheet row numbers for the report.
 */
export async function importLeads(
  records: RawRecord[],
  lines: number[],
  owner: string | null,
  fileName: string,
): Promise<ImportResult> {
  const { team } = await requireMember();
  if (!Array.isArray(records) || records.length === 0) return { ok: false, error: "Não há linhas para importar." };
  if (records.length > CHUNK) return { ok: false, error: `Máximo ${CHUNK} linhas por pedido.` };
  const responsavel = owner ? (team.find((m) => m.email === owner)?.email ?? null) : null;
  if (owner && !responsavel) return { ok: false, error: "Pessoa desconhecida." };

  const checked = records.map((r, i) => ({
    ...checkRecord(r && typeof r === "object" ? r : {}),
    line: Number(lines?.[i]) || i + 2,
  }));
  const supabase = await createClient();
  const existing = await lookupExisting(supabase, checked.filter((c) => !c.errors.length).map((c) => c.row));

  const seen = new Set<string>();
  const skipped: { line: number; reason: string }[] = [];
  const rows: (ImportRow & { line: number })[] = [];
  for (const { row, errors, line } of checked) {
    if (errors.length) {
      skipped.push({ line, reason: errors.join(", ") });
      continue;
    }
    const keys = dedupeKeys(row);
    const hit = keys.map((k) => existing[k]).find(Boolean);
    if (hit) {
      skipped.push({ line, reason: hit === "arquivada" ? "Já existe (arquivada)" : "Já existe no CRM" });
      continue;
    }
    if (keys.some((k) => seen.has(k))) {
      skipped.push({ line, reason: "Repetida na folha" });
      continue;
    }
    keys.forEach((k) => seen.add(k));
    rows.push({ ...row, line });
  }
  if (rows.length === 0) return { ok: true, imported: 0, skipped };

  const insertRows = (list: typeof rows) =>
    supabase
      .from("leads")
      .insert(
        list.map((r) => {
          const row: Partial<typeof r> = { ...r };
          delete row.line;
          return { ...row, origem: "outbound", responsavel };
        }),
      )
      .select("id");

  const ids: string[] = [];
  const { data, error } = await insertRows(rows);
  if (!error && data) {
    ids.push(...data.map((d) => d.id as string));
  } else if (error?.code === "23505") {
    // Someone added one of these emails a moment ago: insert one by one and skip the clashes.
    for (const r of rows) {
      const one = await insertRows([r]);
      if (one.data?.length) ids.push(one.data[0].id as string);
      else skipped.push({ line: r.line, reason: one.error?.code === "23505" ? "Já existe no CRM" : "Erro ao guardar" });
    }
  } else {
    console.error("import insert failed", error?.message);
    return { ok: false, error: "Não foi possível importar este bloco. Nada dele foi guardado." };
  }

  if (ids.length) {
    const name = cleanText(fileName, 120) || "folha";
    const { error: actError } = await supabase
      .from("activities")
      .insert(ids.map((id) => ({ lead_id: id, tipo: "importacao", texto: `Importada de ${name}` })));
    if (actError) console.error("import activities failed", actError.message);
    refresh();
  }
  return { ok: true, imported: ids.length, skipped };
}
