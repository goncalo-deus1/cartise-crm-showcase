import { cleanText, EMAIL_RE } from "@/lib/validation";
import { e164 } from "@/lib/phone";
import { isSegment, type StageId } from "@/lib/stages";

/** Lead fields a spreadsheet column can be mapped to, with header names we recognise. */
export const IMPORT_FIELDS = [
  { key: "empresa", label: "Empresa", required: true, synonyms: ["empresa", "company", "companhia", "organizacao", "organization", "cliente", "marca", "conta", "nome da empresa", "loja"] },
  { key: "contacto_nome", label: "Nome do contacto", synonyms: ["nome", "name", "contacto nome", "nome do contacto", "pessoa", "full name", "nome completo", "first name"] },
  { key: "email", label: "Email", synonyms: ["email", "e-mail", "mail", "correio"] },
  { key: "telefone", label: "Telefone", synonyms: ["telefone", "telemovel", "phone", "mobile", "tel", "contacto telefonico", "numero de telefone", "whatsapp"] },
  { key: "cargo", label: "Cargo", synonyms: ["cargo", "role", "title", "job title", "funcao", "posicao"] },
  { key: "cidade", label: "Cidade", synonyms: ["cidade", "city", "localidade", "local", "zona"] },
  { key: "segmento", label: "Segmento / Indústria", synonyms: ["industria", "segmento", "setor", "sector", "industry", "categoria", "tipo"] },
  { key: "estado", label: "Estado", synonyms: ["estado", "status", "fase", "stage", "estado do contacto"] },
  { key: "website", label: "Website", synonyms: ["website", "site", "url", "web", "dominio"] },
  { key: "linkedin_url", label: "LinkedIn", synonyms: ["linkedin", "linkedin url", "perfil linkedin"] },
  { key: "notas", label: "Notas", synonyms: ["notas", "notes", "observacoes", "comentarios", "obs"] },
] as const;

export type ImportField = (typeof IMPORT_FIELDS)[number]["key"];
export type Mapping = Partial<Record<ImportField, number>>;
/** One spreadsheet row reduced to the mapped fields, as plain text. */
export type RawRecord = Partial<Record<ImportField, string>>;

export const MAX_IMPORT_ROWS = 1000;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const STATUS_WORDS = /contactar|contactad|respond|reuniao|proposta|ganh|perdid|novo|interess|follow|sequencia|lost|won|reply|meeting/;
const looksLikePhone = (v: string) => /^[+\d][\d\s().-]{7,}$/.test(v);

/** What an ambiguous column ("Contacto", "Contact") actually holds, judged from its values. */
function sniffColumn(values: string[]): ImportField {
  const vals = values.map((v) => v.trim()).filter(Boolean).slice(0, 30);
  if (!vals.length) return "contacto_nome";
  const share = (test: (v: string) => boolean) => vals.filter(test).length / vals.length;
  if (share((v) => STATUS_WORDS.test(norm(v))) >= 0.6) return "estado";
  if (share(looksLikePhone) >= 0.6) return "telefone";
  if (share((v) => v.includes("@")) >= 0.6) return "email";
  return "contacto_nome";
}

/**
 * Best guess of which column holds which field, from the header row
 * (and, for ambiguous headers like "Contacto", from the values underneath).
 */
export function guessMapping(headers: string[], sample: unknown[][] = []): Mapping {
  const h = headers.map(norm);
  const mapping: Mapping = {};
  const used = new Set<number>();
  const take = (key: ImportField, i: number) => {
    mapping[key] = i;
    used.add(i);
  };
  // 1) Exact header names for every field first, so "Contacto telefónico" can't be grabbed
  //    by a loose match for another field.
  for (const f of IMPORT_FIELDS) {
    const i = h.findIndex((x, j) => !used.has(j) && (f.synonyms as readonly string[]).includes(x));
    if (i >= 0) take(f.key, i);
  }
  // 2) Then whole-word matches ("Email do contacto" → email), never substrings ("Hotel" ≠ tel).
  //    Short or ambiguous words only count as exact matches.
  const LOOSE_BLOCKLIST = new Set(["conta", "tel", "contacto", "contact", "nome", "name", "tipo", "local", "site", "url"]);
  for (const f of IMPORT_FIELDS) {
    if (mapping[f.key] !== undefined) continue;
    const words = f.synonyms.filter((s) => !LOOSE_BLOCKLIST.has(s));
    const i = h.findIndex((x, j) => !used.has(j) && words.some((s) => ` ${x} `.includes(` ${s} `)));
    if (i >= 0) take(f.key, i);
  }
  // 3) "Contacto"/"Contact" means a name, a phone or a status depending on the sheet: look at it.
  h.forEach((x, i) => {
    if (used.has(i) || !/^(contacto|contactos|contact|contacts)$/.test(x)) return;
    const field = sniffColumn(sample.map((r) => cellText(r[i])));
    if (mapping[field] === undefined) take(field, i);
  });
  return mapping;
}

export function cellText(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  return String(v).trim();
}

export function toRawRecords(rows: unknown[][], mapping: Mapping): RawRecord[] {
  return rows.map((row) => {
    const r: RawRecord = {};
    for (const [key, col] of Object.entries(mapping) as [ImportField, number][]) {
      r[key] = cellText(row[col]);
    }
    return r;
  });
}

/** Free-text industry → our segment ids. Unknown values become "outro" (original kept in notes). */
export function segmentFromText(raw: string): { segmento: string; unmatched: boolean } {
  const t = norm(raw);
  if (!t) return { segmento: "outro", unmatched: false };
  if (isSegment(t.replace(/ /g, "_"))) return { segmento: t.replace(/ /g, "_"), unmatched: false };
  const rules: [RegExp, string][] = [
    [/dent/, "clinica_dentaria"],
    [/clinic|saude|medic|hospital|capilar|estetic/, "clinica"],
    [/educa|escola|ensino|lingua|universidade|formacao|colegio/, "educacao"],
    [/oficina|auto|mecanic|carro|pneu/, "oficina"],
    [/bem estar|wellness|spa|massag|beleza/, "bem_estar"],
    [/ginasio|gym|fitness|desporto|crossfit/, "ginasio"],
    [/imobil|real estate|casa/, "imobiliaria"],
    [/agencia|agency/, "agencia"],
    [/frota|fleet|transport|logistic/, "frota"],
    [/marca/, "marca_nacional"],
  ];
  const hit = rules.find(([re]) => re.test(t));
  return hit ? { segmento: hit[1], unmatched: false } : { segmento: "outro", unmatched: true };
}

/** Free-text status → stage. Anything unknown starts as "Por contactar". */
export function stageFromText(raw: string): StageId {
  const t = norm(raw);
  // Order matters: negations and losses before the positive words they contain.
  if (!t || /por contactar|^novo$|^new$|to contact|nao contactad|sem contacto/.test(t)) return "novo";
  if (/perdid|lost|nao interess|not interest|sem interesse|rejeit|recus|nao ganh/.test(t)) return "perdido";
  if (/nao respond|no reply|not repl|no response|sem resposta|nao atend/.test(t)) return "em_sequencia";
  if (/respond|replied|reply|resposta/.test(t)) return "respondeu";
  if (/reuniao|meeting|call marcad/.test(t)) return "reuniao";
  if (/proposta|proposal/.test(t)) return "proposta";
  if (/ganh|won|fechad|cliente/.test(t)) return "ganho";
  if (/referid|referral/.test(t)) return "referido";
  if (/contactad|em contacto|sequencia|enviad|follow/.test(t)) return "em_sequencia";
  return "novo";
}

export type ImportRow = {
  empresa: string;
  contacto_nome: string;
  email: string;
  telefone: string;
  cargo: string;
  cidade: string;
  segmento: string;
  estado: StageId;
  website: string;
  linkedin_url: string;
  notas: string;
};

export type Checked = { row: ImportRow; errors: string[]; warnings: string[] };

const clip = (s: unknown, n = 300) => cleanText(s, n);

/** Normalise and validate one record. Same code runs in the preview and on the server. */
export function checkRecord(r: RawRecord): Checked {
  const errors: string[] = [];
  const warnings: string[] = [];

  const email = clip(r.email).toLowerCase();
  if (email && !EMAIL_RE.test(email)) errors.push("Email inválido");

  let phoneRaw = clip(r.telefone, 40);
  // Spreadsheets often store "+351 912…" as the number 351912345678 (the "+" is lost).
  if (/^351[29]\d{8}$/.test(phoneRaw.replace(/\s/g, ""))) phoneRaw = `+${phoneRaw}`;
  const telefone = phoneRaw ? e164(phoneRaw) : "";
  if (phoneRaw && !telefone) warnings.push("Telefone ignorado (formato inválido)");

  let empresa = clip(r.empresa);
  if (!empresa && email) {
    // No company column: use the email domain (smileup.pt → Smileup) rather than dropping the row.
    const domain = email.split("@")[1]?.split(".")[0] ?? "";
    if (domain && !/^(gmail|hotmail|outlook|yahoo|icloud|sapo|live|msn)$/.test(domain)) {
      empresa = domain.charAt(0).toUpperCase() + domain.slice(1);
      warnings.push("Empresa deduzida do email");
    }
  }
  if (!empresa) errors.push("Sem empresa");

  const nome = clip(r.contacto_nome);
  const industria = clip(r.segmento, 100);
  const { segmento, unmatched } = segmentFromText(industria);
  const notas = [clip(r.notas, 2000), unmatched ? `Indústria: ${industria}` : ""].filter(Boolean).join("\n");

  return {
    row: {
      empresa,
      contacto_nome: /^[-–—.]$/.test(nome) ? "" : nome,
      email,
      telefone,
      cargo: clip(r.cargo),
      cidade: clip(r.cidade),
      segmento,
      estado: stageFromText(clip(r.estado, 60)),
      website: clip(r.website),
      linkedin_url: clip(r.linkedin_url),
      notas,
    },
    errors,
    warnings,
  };
}

/**
 * Keys that identify the same contact: the email (if any) and company + name (if there is a
 * name). Two rows are the same contact when they share any key.
 */
export function dedupeKeys(row: Pick<ImportRow, "email" | "empresa" | "contacto_nome">) {
  const keys: string[] = [];
  if (row.email) keys.push(`e:${row.email.toLowerCase()}`);
  if (row.contacto_nome) keys.push(`n:${norm(row.empresa)}|${norm(row.contacto_nome)}`);
  else if (!row.email) keys.push(`n:${norm(row.empresa)}|`);
  return keys;
}

/** Normalised company name, used to look up possible duplicates. */
export const normCompany = (s: string) => norm(s);
