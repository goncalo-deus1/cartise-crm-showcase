/** Personal mailboxes: their domain says nothing about the company. */
const FREE_MAIL = new Set([
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "outlook.com",
  "outlook.pt",
  "live.com",
  "live.com.pt",
  "msn.com",
  "yahoo.com",
  "icloud.com",
  "me.com",
  "sapo.pt",
  "aol.com",
  "gmx.com",
  "proton.me",
  "protonmail.com",
  "mail.com",
  "hotmail.pt",
  "hotmail.es",
  "hotmail.fr",
  "hotmail.co.uk",
  "outlook.es",
  "outlook.com.pt",
  "ymail.com",
  "yahoo.com.br",
  "yahoo.es",
  "netcabo.pt",
  "clix.pt",
  "iol.pt",
  "mail.pt",
  "portugalmail.pt",
  "telepac.pt",
  "gmx.pt",
  "gmx.de",
  "web.de",
  "pm.me",
  "protonmail.ch",
  "tutanota.com",
  "zoho.com",
]);

/** Pages on these sites aren't the company's own site: their logo would be Facebook's etc. */
const NOT_A_COMPANY_SITE = [
  "facebook.com",
  "fb.com",
  "instagram.com",
  "linkedin.com",
  "linktr.ee",
  "wa.me",
  "whatsapp.com",
  "sites.google.com",
  "google.com",
  "goo.gl",
  "youtube.com",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "bit.ly",
];
const isPlatform = (host: string) => NOT_A_COMPANY_SITE.some((p) => host === p || host.endsWith(`.${p}`));

export const DOMAIN_RE = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/** "https://www.smileup.pt/contactos" → "smileup.pt"; anything unusable → null. */
export function hostOf(url: string) {
  const raw = url.trim();
  if (!raw) return null;
  try {
    const host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`).hostname.toLowerCase();
    const bare = host.replace(/^www\./, "");
    return DOMAIN_RE.test(bare) ? bare : null;
  } catch {
    return null;
  }
}

/** Domain of the company's own website (not a Facebook / Instagram / Linktree page). */
export function siteDomain(website: string | null | undefined) {
  const host = hostOf(website ?? "");
  return host && !isPlatform(host) ? host : null;
}

/** Domain of a work email (not Gmail, Sapo, …). */
export function emailDomain(email: string | null | undefined) {
  const at = (email ?? "").trim().toLowerCase().split("@")[1] ?? "";
  return DOMAIN_RE.test(at) && !FREE_MAIL.has(at) ? at : null;
}

/** The company's web domain: from its website, else from a work email. */
export function companyDomain(lead: { website?: string | null; email?: string | null }) {
  return siteDomain(lead.website) ?? emailDomain(lead.email);
}
