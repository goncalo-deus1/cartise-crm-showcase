const TZ = "Europe/Lisbon";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DAY = 86_400_000;

/** Today as YYYY-MM-DD in Lisbon time. */
export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

function noon(iso: string) {
  return new Date(`${iso.slice(0, 10)}T12:00:00Z`);
}

/** "4 nov" (pt-PT's own short format is "4/11"). */
export function shortDate(iso: string | null) {
  if (!iso) return "";
  // Dates here are calendar days (YYYY-MM-DD) or timestamps; read the calendar day in Lisbon.
  const [y, m, d] = (iso.length > 10 ? new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso)) : iso)
    .split("-")
    .map(Number);
  return y ? `${d} ${MONTHS[m - 1]}` : "";
}

export function daysFrom(iso: string, today = todayISO()) {
  return Math.round((noon(iso).getTime() - noon(today).getTime()) / DAY);
}

/** "Hoje", "Amanhã", "Ontem", otherwise "4 nov". */
export function relativeDate(iso: string | null, today = todayISO()) {
  if (!iso) return "";
  const d = daysFrom(iso, today);
  if (d === 0) return "Hoje";
  if (d === 1) return "Amanhã";
  if (d === -1) return "Ontem";
  return shortDate(iso);
}

export type Due = "overdue" | "today" | "soon" | "later" | "none";

export function dueState(iso: string | null, today = todayISO()): Due {
  if (!iso) return "none";
  const d = daysFrom(iso, today);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  return d <= 3 ? "soon" : "later";
}

/** Label for a follow-up chip; overdue ones say so in words, not only in red. */
export function dueLabel(iso: string | null, today = todayISO()) {
  if (!iso) return "";
  const rel = relativeDate(iso, today);
  return dueState(iso, today) === "overdue" ? `Atrasada · ${rel}` : rel;
}

export function addDays(iso: string, n: number) {
  const d = noon(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
