import type { Lead } from "@/lib/leads";
import { daysFrom } from "@/lib/dates";
import { isOpen, STAGES, stageOf, type StageId } from "@/lib/stages";
import { isValidPhone } from "@/lib/phone";

/** "all", "none" (no owner) or a team member's email. */
export type OwnerFilterValue = "all" | "none" | string;

export const DUE_OPTIONS = [
  { id: "overdue", label: "Atrasado" },
  { id: "today", label: "Hoje" },
  { id: "week", label: "Próximos 7 dias" },
  { id: "later", label: "Mais tarde" },
  { id: "none", label: "Sem próximo passo" },
] as const;
export type DueFilter = (typeof DUE_OPTIONS)[number]["id"];

export const REACH_OPTIONS = [
  { id: "email", label: "Tem email" },
  { id: "phone", label: "Tem telefone" },
  { id: "linkedin", label: "Tem LinkedIn" },
  { id: "nothing", label: "Sem contactos" },
] as const;
export type ReachFilter = (typeof REACH_OPTIONS)[number]["id"];

/** Empty list = no filter on that field. Several values in one field match any of them. */
export type LeadFilters = {
  owner: OwnerFilterValue;
  stages: StageId[];
  due: DueFilter[];
  reach: ReachFilter[];
  query: string;
};

export const NO_FILTERS: LeadFilters = { owner: "all", stages: [], due: [], reach: [], query: "" };

export function matchesOwner(responsavel: string | null, filter: OwnerFilterValue) {
  if (filter === "all") return true;
  if (filter === "none") return !responsavel;
  return responsavel === filter;
}

export function matchesQuery(fields: (string | null | undefined)[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((v) => v?.toLowerCase().includes(q));
}

/** Closed leads (ganho / perdido) never count as having a pending next step. */
export function dueBucket(lead: Pick<Lead, "proxima_data" | "estado">, today: string): DueFilter {
  if (!lead.proxima_data || !isOpen(lead.estado)) return "none";
  const d = daysFrom(lead.proxima_data, today);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= 7 ? "week" : "later";
}

export const hasEmail = (l: Lead) => l.email.trim() !== "";
export const hasPhone = (l: Lead) => isValidPhone(l.telefone);
export const hasLinkedin = (l: Lead) => /^https?:\/\//i.test(l.linkedin_url.trim());

function matchesReach(l: Lead, reach: ReachFilter[]) {
  if (reach.length === 0) return true;
  return reach.some((r) =>
    r === "email"
      ? hasEmail(l)
      : r === "phone"
        ? hasPhone(l)
        : r === "linkedin"
          ? hasLinkedin(l)
          : !hasEmail(l) && !hasPhone(l) && !hasLinkedin(l),
  );
}

/** Apply every filter; `skip` leaves one out (used to count options of that filter). */
export function filterLeads(leads: Lead[], f: LeadFilters, today: string, skip?: keyof LeadFilters) {
  return leads.filter(
    (l) =>
      (skip === "owner" || matchesOwner(l.responsavel, f.owner)) &&
      (skip === "stages" || f.stages.length === 0 || f.stages.includes(stageOf(l.estado))) &&
      (skip === "due" || f.due.length === 0 || f.due.includes(dueBucket(l, today))) &&
      (skip === "reach" || matchesReach(l, f.reach)) &&
      (skip === "query" ||
        matchesQuery([l.empresa, l.contacto_nome, l.email, l.cidade, l.cargo, l.telefone], f.query)),
  );
}

export function activeFilterCount(f: LeadFilters) {
  return (f.owner !== "all" ? 1 : 0) + (f.stages.length ? 1 : 0) + (f.due.length ? 1 : 0) + (f.reach.length ? 1 : 0);
}

/* Sorting for the table. */

export type SortKey = "empresa" | "contacto" | "estado" | "owner" | "proximo" | "ultimo" | "segmento" | "cidade";
export type Sort = { key: SortKey; dir: "asc" | "desc" };

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i])) as Record<StageId, number>;
const collator = new Intl.Collator("pt-PT", { sensitivity: "base", numeric: true });

/** Stable sort; empty values always go last, whatever the direction. */
export function sortLeads(leads: Lead[], sort: Sort, ownerName: (email: string | null) => string) {
  const value = (l: Lead): string | number | null => {
    switch (sort.key) {
      case "empresa":
        return l.empresa || null;
      case "contacto":
        return l.contacto_nome || null;
      case "estado":
        return STAGE_ORDER[stageOf(l.estado)];
      case "owner":
        return l.responsavel ? ownerName(l.responsavel) : null;
      case "proximo":
        return l.proxima_data;
      case "ultimo":
        return l.ultimo_contacto;
      case "segmento":
        return l.segmento || null;
      case "cidade":
        return l.cidade || null;
    }
  };
  const sign = sort.dir === "asc" ? 1 : -1;
  return leads
    .map((l, i) => ({ l, i, v: value(l) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c = typeof a.v === "number" && typeof b.v === "number" ? a.v - b.v : collator.compare(String(a.v), String(b.v));
      return c === 0 ? a.i - b.i : c * sign;
    })
    .map((x) => x.l);
}
