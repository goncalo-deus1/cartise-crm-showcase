/** Keep only what a phone number can contain. */
export function cleanPhone(raw: string) {
  return raw.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

/**
 * Normalise to E.164, or "" if it isn't a usable number.
 * Without +/00 only Portuguese numbers are accepted (9 digits starting with 2 or 9), so a
 * mistyped PT number never silently turns into a foreign one (e.g. 91234567 → India).
 */
export function e164(raw: string) {
  const p = cleanPhone(raw);
  const intl = p.startsWith("+") ? p : p.startsWith("00") ? `+${p.slice(2)}` : /^[29]\d{8}$/.test(p) ? `+351${p}` : "";
  if (!/^\+[1-9]\d{7,14}$/.test(intl)) return "";
  if (intl.startsWith("+351") && !/^\+351[29]\d{8}$/.test(intl)) return "";
  return intl;
}

export function isValidPhone(raw: string) {
  return e164(raw) !== "";
}

export function telHref(raw: string) {
  return `tel:${e164(raw)}`;
}

export function whatsappHref(raw: string) {
  return `https://wa.me/${e164(raw).slice(1)}`;
}

/** "+351 912 345 678" for Portuguese numbers, otherwise as typed. */
export function formatPhone(raw: string) {
  const p = e164(raw);
  const pt = p.match(/^\+351(\d{3})(\d{3})(\d{3})$/);
  return pt ? `+351 ${pt[1]} ${pt[2]} ${pt[3]}` : raw;
}
