"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, ChevronDown } from "lucide-react";
import type { Company, IndustryStat } from "@/lib/companies";
import { displayName, type Member } from "@/lib/names";
import { STAGES, segmentLabel } from "@/lib/stages";
import { dueLabel, dueState } from "@/lib/dates";
import { Avatar } from "@/components/avatar";
import { CompanyLogo } from "@/components/company-logo";
import { SearchBox, matchesQuery } from "@/components/owner-filter";
import { Card, StageBadge } from "@/components/ui";

const PAGE = 10;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Overview section: which companies we have and in which industries. */
export function Companies({
  companies,
  industries,
  team,
  today,
}: {
  companies: Company[];
  industries: IndustryStat[];
  team: Member[];
  today: string;
}) {
  const [industry, setIndustry] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const contacts = companies.reduce((n, c) => n + c.contacts.length, 0);
  const max = Math.max(1, ...industries.map((i) => i.companies));

  const visible = useMemo(
    () =>
      companies.filter(
        (c) =>
          (!industry || c.segmento === industry) &&
          matchesQuery([c.empresa, c.cidade, ...c.contacts.map((x) => x.nome)], query),
      ),
    [companies, industry, query],
  );
  const shown = showAll ? visible : visible.slice(0, PAGE);

  if (companies.length === 0) return null;

  return (
    <Card>
      <div className="mb-5">
        <h2 className="font-display text-lg font-semibold">Empresas e indústrias</h2>
        <p className="text-sm text-ink-2">
          {plural(companies.length, "empresa", "empresas")} · {plural(contacts, "contacto", "contactos")} ·{" "}
          {plural(industries.length, "indústria", "indústrias")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(260px,1fr)_2fr]">
        {/* Industries: one neutral bar per industry (owner colours stay reserved for people). */}
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-2">Por indústria</h3>
          <ul className="grid grid-cols-2 gap-1 lg:grid-cols-1" aria-label="Empresas por indústria">
            {industries.map((i) => {
              const active = industry === i.segmento;
              return (
                <li key={i.segmento}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setIndustry(active ? null : i.segmento);
                      setShowAll(false);
                    }}
                    title={`${segmentLabel(i.segmento)}: ${plural(i.companies, "empresa", "empresas")}, ${plural(i.contacts, "contacto", "contactos")}`}
                    className={`w-full rounded-2xl px-3 py-2 text-left transition ${
                      active ? "bg-ink text-white" : "hover:bg-surface-2"
                    }`}
                  >
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="truncate font-medium">{segmentLabel(i.segmento)}</span>
                      <span className={`shrink-0 tabular-nums ${active ? "text-white/80" : "text-ink-2"}`}>
                        {i.companies}
                        <span className="hidden text-xs sm:inline"> · {i.contacts} cont.</span>
                      </span>
                    </span>
                    <span className={`mt-1.5 block h-2 rounded-full ${active ? "bg-white/20" : "bg-surface-2"}`}>
                      <span
                        className={`block h-2 rounded-full ${active ? "bg-white" : "bg-ink-2"}`}
                        style={{ width: `${Math.max(4, (i.companies / max) * 100)}%` }}
                      />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {industry && (
            <button
              type="button"
              onClick={() => setIndustry(null)}
              className="mt-2 px-3 text-sm font-medium text-ink-2 hover:text-ink"
            >
              Mostrar todas as indústrias
            </button>
          )}
        </div>

        {/* Companies */}
        <div className="min-w-0">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-2">
              {industry ? segmentLabel(industry) : "Todas as empresas"} · {visible.length}
            </h3>
            <SearchBox value={query} onChange={setQuery} placeholder="Procurar empresa" onCard />
          </div>
          {visible.length === 0 ? (
            <p className="rounded-2xl bg-surface-2 px-4 py-3 text-sm text-ink-2">Nenhuma empresa com esta pesquisa.</p>
          ) : (
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {shown.map((c) => (
                <CompanyRow key={c.key} company={c} team={team} today={today} />
              ))}
            </ul>
          )}
          {visible.length > PAGE && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-sm font-medium text-ink-2 hover:text-ink"
            >
              {showAll ? "Mostrar menos" : `Mostrar todas (${visible.length})`}
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}

function CompanyRow({ company: c, team, today }: { company: Company; team: Member[]; today: string }) {
  const stage = STAGES.find((s) => s.id === c.stage)!;
  const due = dueState(c.nextDate, today);
  const single = c.contacts.length === 1;

  const summary = (
    <>
      <CompanyLogo name={c.empresa} domain={c.domain} size={32} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{c.empresa}</span>
        <span className="block truncate text-xs text-ink-2">
          <span className="sm:hidden">
            <span className={`mr-1 inline-block size-1.5 rounded-full align-middle ${stage.dot}`} />
            {stage.label} ·{" "}
          </span>
          {segmentLabel(c.segmento)}
          {c.cidade && ` · ${c.cidade}`} · {plural(c.contacts.length, "contacto", "contactos")}
        </span>
      </span>
      <span className="hidden items-center sm:flex">
        {c.owners.length ? (
          <span className="flex -space-x-1.5">
            {c.owners.map((o) => (
              <Avatar key={o} member={team.find((m) => m.email === o)} team={team} size={24} />
            ))}
          </span>
        ) : (
          <Avatar member={null} team={team} size={24} />
        )}
      </span>
      {c.nextDate && (
        <span
          className={`hidden shrink-0 items-center gap-1 text-xs font-semibold md:flex ${
            due === "overdue" ? "text-bad" : due === "today" ? "text-warn" : "text-ink-2"
          }`}
        >
          <CalendarClock size={13} aria-hidden /> {dueLabel(c.nextDate, today)}
        </span>
      )}
      <span className="hidden sm:block">
        <StageBadge label={stage.label} dot={stage.dot} />
      </span>
    </>
  );

  if (single) {
    return (
      <li>
        <Link href={`/leads/${c.contacts[0].id}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-surface-2">
          {summary}
          <span className="w-4" aria-hidden />
        </Link>
      </li>
    );
  }

  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3 hover:bg-surface-2 [&::-webkit-details-marker]:hidden">
          {summary}
          <ChevronDown size={16} className="shrink-0 text-ink-3 transition group-open:rotate-180" aria-hidden />
        </summary>
        <ul className="space-y-1 px-3.5 pb-3">
          {c.contacts.map((p) => {
            const s = STAGES.find((x) => x.id === p.estado)!;
            const owner = team.find((m) => m.email === p.responsavel);
            return (
              <li key={p.id}>
                <Link
                  href={`/leads/${p.id}`}
                  className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2 text-sm hover:bg-line"
                >
                  <Avatar member={owner} team={team} size={22} />
                  <span className="min-w-0 flex-1 truncate">
                    {p.nome || "Sem nome"}
                    {p.cargo && <span className="text-ink-3"> · {p.cargo}</span>}
                    <span className="sr-only"> · {displayName(owner)}</span>
                  </span>
                  <StageBadge label={s.label} dot={s.dot} />
                </Link>
              </li>
            );
          })}
        </ul>
      </details>
    </li>
  );
}
