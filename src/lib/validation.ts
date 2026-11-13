/** Same rule in the browser (input pattern) and on the server. */
export const EMAIL_PATTERN = "[^\\s@]+@[^\\s@]+\\.[^\\s@]+";
export const EMAIL_RE = new RegExp(`^${EMAIL_PATTERN}$`);

/**
 * Text that is safe to store: non-strings become "", control characters (incl. NUL) are
 * removed, and cutting to `max` never leaves half an emoji (a lone surrogate Postgres rejects).
 */
export function cleanText(value: unknown, max = 300) {
  if (typeof value !== "string") return "";
  const s = value
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, max);
  // With the u flag a valid pair is one code point, so only lone surrogates match (no lookbehind:
  // this also runs in the browser, and older Safari can't parse lookbehind).
  return s.replace(/\p{Cs}/gu, "");
}
