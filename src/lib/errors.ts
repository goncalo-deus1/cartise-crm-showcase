/** Next.js redirects (e.g. an expired session) are thrown errors; never swallow them. */
export function isNextRedirect(e: unknown) {
  const digest = (e as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
