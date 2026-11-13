import type { Lead } from "@/lib/leads";
import { isOpen, STAGES, stageOf, type StageId } from "@/lib/stages";
import { emailDomain, siteDomain } from "@/lib/domain";

export type CompanyContact = { id: string; nome: string; cargo: string; estado: StageId; responsavel: string | null };

export type Company = {
  key: string;
  empresa: string;
  segmento: string;
  cidade: string;
  /** Web domain for the logo: any contact's website first, else a work-email domain. */
  domain: string | null;
  contacts: CompanyContact[];
  owners: string[];
  /** Most advanced open stage among its contacts (or the closed one if all are closed). */
  stage: StageId;
  nextDate: string | null;
};

export type IndustryStat = { segmento: string; companies: number; contacts: number };

const keyOf = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const order = (s: StageId) => STAGES.findIndex((x) => x.id === s);

/** Group contacts (leads) into companies by normalised name. */
export function groupCompanies(leads: Lead[]): Company[] {
  const map = new Map<string, Company>();
  const siteSeen = new Set<string>();
  for (const l of leads) {
    const key = keyOf(l.empresa) || l.id;
    const stage = stageOf(l.estado);
    let c = map.get(key);
    if (!c) {
      c = {
        key,
        empresa: l.empresa,
        segmento: l.segmento,
        cidade: l.cidade,
        domain: null,
        contacts: [],
        owners: [],
        stage,
        nextDate: null,
      };
      map.set(key, c);
    }
    c.contacts.push({ id: l.id, nome: l.contacto_nome, cargo: l.cargo, estado: stage, responsavel: l.responsavel });
    if (l.responsavel && !c.owners.includes(l.responsavel)) c.owners.push(l.responsavel);
    if (!c.cidade && l.cidade) c.cidade = l.cidade;
    const site = siteDomain(l.website);
    if (site && !siteSeen.has(c.key)) {
      c.domain = site;
      siteSeen.add(c.key);
    } else if (!c.domain) c.domain = emailDomain(l.email);
    if (c.segmento === "outro" && l.segmento !== "outro") c.segmento = l.segmento;
    if (isOpen(l.estado) && l.proxima_data && (!c.nextDate || l.proxima_data < c.nextDate)) c.nextDate = l.proxima_data;
  }
  for (const c of map.values()) {
    const open = c.contacts.filter((x) => isOpen(x.estado));
    const pool = open.length ? open : c.contacts;
    c.stage = pool.reduce((best, x) => (order(x.estado) > order(best) ? x.estado : best), pool[0].estado);
  }
  // Furthest along first, then most contacts, then name.
  return [...map.values()].sort(
    (a, b) =>
      Number(isOpen(b.stage)) - Number(isOpen(a.stage)) ||
      order(b.stage) - order(a.stage) ||
      b.contacts.length - a.contacts.length ||
      a.empresa.localeCompare(b.empresa, "pt"),
  );
}

/** Companies and contacts per industry, biggest first. */
export function industryStats(companies: Company[]): IndustryStat[] {
  const map = new Map<string, IndustryStat>();
  for (const c of companies) {
    const s = map.get(c.segmento) ?? { segmento: c.segmento, companies: 0, contacts: 0 };
    s.companies += 1;
    s.contacts += c.contacts.length;
    map.set(c.segmento, s);
  }
  return [...map.values()].sort((a, b) => b.companies - a.companies || b.contacts - a.contacts);
}
