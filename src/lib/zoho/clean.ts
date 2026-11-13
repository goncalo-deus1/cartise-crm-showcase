/**
 * Turns an email's HTML into the plain text worth keeping in the CRM: no quoted
 * thread, no signature block, no legal footer. Pure functions (no imports) so they
 * can be tested with `node --test`.
 */

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  "#39": "'",
};

function decodeEntities(s: string) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

/** HTML → text with paragraph breaks. Quoted blocks (<blockquote>) are dropped. */
export function htmlToText(html: string) {
  let s = html
    .replace(/<(script|style|head|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<blockquote[\s\S]*<\/blockquote>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(div|p|tr|li|h[1-6]|table)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<hr[^>]*>/gi, "\n----\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s).replace(/ /g, " ");
  return tidy(s);
}

function tidy(s: string) {
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Where a forwarded or quoted earlier message starts. */
const QUOTE_START = [
  /^(from|de|von)\s*:/i,
  /^(sent|enviado|enviada)\s*:/i,
  /^-{2,}\s*(original message|mensagem original|forwarded message|mensagem encaminhada)/i,
  /^-{2,}\s*(em|on)\s.+(escreveu|wrote)/i,
  /^(em|on)\s.{6,200}(escreveu|wrote)\s*:?$/i,
  /^_{5,}$/,
  /^-{4,}$/,
];

/** Lines that end the message proper: everything after belongs to a signature. */
const SIGN_OFF =
  /^(muito\s+)?(obrigad[oa]s?|cumprimentos|com os melhores cumprimentos|melhores cumprimentos|atentamente|abraço|abraços|um abraço|beijinhos|até breve|até amanhã|até já|best|best regards|kind regards|regards|thanks|thank you|many thanks|cheers|saludos|un saludo|gracias|¡gracias)[!,.]*$/i;

/** Legal footers that sometimes come before the signature. */
const FOOTER = /^(this (e-?mail|message)|esta mensagem|este e-?mail|aviso de confidencialidade|confidentiality notice|disclaimer)\b/i;

/**
 * Clean plain text: cut the quoted thread, then cut the signature after the last
 * sign-off ("Obrigado," / "Cumprimentos") and add `signer` (e.g. "Gonçalo") back
 * under it when given.
 */
export function cleanBody(text: string, signer?: string) {
  let lines = tidy(text).split("\n");

  const quote = lines.findIndex((l, i) => i > 0 && QUOTE_START.some((r) => r.test(l)));
  if (quote > 0) lines = lines.slice(0, quote);

  const footer = lines.findIndex((l, i) => i > 0 && FOOTER.test(l));
  if (footer > 0) lines = lines.slice(0, footer);

  // Last short sign-off line wins ("Obrigada pelo contacto." mid-text is not a sign-off).
  let signOff = -1;
  lines.forEach((l, i) => {
    if (SIGN_OFF.test(l)) signOff = i;
  });
  if (signOff > 0) {
    lines = lines.slice(0, signOff + 1);
    if (signer) lines.push(signer);
  }

  return tidy(lines.join("\n"));
}

const AUTO_SUBJECT =
  /^(re:\s*|fw:\s*)?(resposta automática|automatic reply|auto(matic)?[-\s]?reply|out of (the )?office|ausência|ausente|fora do escritório|respuesta automática)/i;
const AUTO_BODY =
  /(encontro-me ausente|estou ausente|estarei ausente|estarei indispon[íi]vel|out of (the )?office|i am currently (away|out)|i'?m currently (away|out)|me encuentro fuera)/i;

/** Out-of-office and other automatic replies: logged, but they don't count as a reply. */
export function isAutoReply(subject: string, body: string) {
  return AUTO_SUBJECT.test(subject.trim()) || AUTO_BODY.test(body.slice(0, 500));
}

/** All addresses in a Zoho address field like `"Ana" <ana@x.pt>, b@y.pt` (HTML-escaped or not). */
export function parseAddresses(field: string | undefined | null) {
  if (!field || field === "Not Provided") return [];
  const s = decodeEntities(field);
  return [...new Set((s.match(/[a-z0-9._%+'-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) ?? []).map((a) => a.toLowerCase()))];
}
