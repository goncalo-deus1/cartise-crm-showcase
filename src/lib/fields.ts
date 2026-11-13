import { cleanText, EMAIL_RE } from "@/lib/validation";
import { e164, isValidPhone } from "@/lib/phone";
import { isSegment } from "@/lib/stages";

/** Lead fields that can be edited straight from the table, with their label. */
export const EDITABLE_FIELDS = {
  empresa: "Empresa",
  contacto_nome: "Contacto",
  cargo: "Cargo",
  email: "Email",
  telefone: "Telefone",
  linkedin_url: "LinkedIn",
  website: "Website",
  cidade: "Cidade",
  segmento: "Indústria",
} as const;
export type EditableField = keyof typeof EDITABLE_FIELDS;

/** Longest value we keep per field (also the input's maxLength). */
export const MAX_LENGTH: Record<EditableField, number> = {
  empresa: 200,
  contacto_nome: 200,
  cargo: 200,
  email: 200,
  telefone: 40,
  linkedin_url: 500,
  website: 500,
  cidade: 200,
  segmento: 40,
};

export function isEditableField(f: unknown): f is EditableField {
  return typeof f === "string" && Object.hasOwn(EDITABLE_FIELDS, f);
}

/** "linkedin.com/in/ana" → "https://linkedin.com/in/ana"; "" stays ""; anything else → null. */
export function normalizeUrl(raw: string) {
  const s = raw.trim();
  if (!s) return "";
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `https://${s}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.toString();
  } catch {
    return null;
  }
}

export type FieldCheck = { ok: true; value: string } | { ok: false; error: string };

/**
 * Clean and validate one value. Runs in the browser (instant feedback) and on the server
 * (the real check). Empty means "clear it", except for the company name.
 */
export function checkField(field: EditableField, raw: unknown): FieldCheck {
  const text = cleanText(raw, MAX_LENGTH[field]);
  switch (field) {
    case "empresa":
      return text ? { ok: true, value: text } : { ok: false, error: "A empresa precisa de um nome." };
    case "email": {
      const email = text.toLowerCase();
      return !email || EMAIL_RE.test(email)
        ? { ok: true, value: email }
        : { ok: false, error: "Email inválido (ex.: nome@empresa.pt)." };
    }
    case "telefone":
      if (!text) return { ok: true, value: "" };
      return isValidPhone(text)
        ? { ok: true, value: e164(text) }
        : { ok: false, error: "Telefone inválido. Usa 9 dígitos (912 345 678) ou o indicativo (+44 …)." };
    case "linkedin_url":
    case "website": {
      const url = normalizeUrl(text);
      if (url === null) return { ok: false, error: "Link inválido (ex.: empresa.pt)." };
      return url.length > 1000 ? { ok: false, error: "Link demasiado longo." } : { ok: true, value: url };
    }
    case "segmento":
      return isSegment(text) ? { ok: true, value: text } : { ok: false, error: "Indústria inválida." };
    default:
      return { ok: true, value: text };
  }
}

/** Next step: a YYYY-MM-DD date (or none) plus what to do. */
export function checkNextStep(acao: unknown, data: unknown) {
  const text = cleanText(acao, 300);
  return { acao: text, data: realDate(data) };
}

/** "2026-11-12" if it's a real calendar day (not 2026-02-31), else null. */
export function realDate(data: unknown) {
  if (typeof data !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;
  const d = new Date(`${data}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === data ? data : null;
}
