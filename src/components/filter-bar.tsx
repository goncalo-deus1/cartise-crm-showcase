"use client";

import { useRef, type ReactNode } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { Lead } from "@/lib/leads";
import type { Member } from "@/lib/names";
import { STAGES, stageOf, type StageId } from "@/lib/stages";
import { SHOW_NEXT_STEP } from "@/lib/features";
import {
  activeFilterCount,
  DUE_OPTIONS,
  dueBucket,
  filterLeads,
  hasEmail,
  hasLinkedin,
  hasPhone,
  NO_FILTERS,
  REACH_OPTIONS,
  type DueFilter,
  type LeadFilters,
  type ReachFilter,
} from "@/lib/lead-filters";
import { OwnerFilter, SearchBox } from "@/components/owner-filter";
import { MenuItem, MenuLabel, Popover } from "@/components/popover";

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/**
 * Filters for the lead table and board: owner (segmented), then Estado / Próximo passo / Contacto
 * as multi-select chips, plus search. Option counts reflect the other active filters.
 */
export function FilterBar({
  leads,
  filters,
  onChange,
  team,
  me,
  today,
  shown,
  trailing,
  extra,
  allLeads,
}: {
  leads: Lead[];
  /** Leads used for the Estado counts (includes closed ones even when they're hidden). */
  allLeads?: Lead[];
  /** Extra control before the count on the second row. */
  extra?: ReactNode;
  filters: LeadFilters;
  onChange: (f: LeadFilters) => void;
  team: Member[];
  me: string;
  today: string;
  /** How many leads pass the filters. */
  shown: number;
  /** Extra controls at the end of the first row (e.g. the view switch). */
  trailing?: ReactNode;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const set = (patch: Partial<LeadFilters>) => onChange({ ...filters, ...patch });
  /** Clearing removes the button that had focus: move focus somewhere sensible. */
  const focusLater = (selector: string) =>
    setTimeout(() => barRef.current?.querySelector<HTMLElement>(selector)?.focus(), 0);
  const active = activeFilterCount(filters) > 0 || filters.query.trim() !== "";

  const forStages = filterLeads(allLeads ?? leads, filters, today, "stages");
  const forDue = filterLeads(leads, filters, today, "due");
  const forReach = filterLeads(leads, filters, today, "reach");
  const reachCount: Record<ReachFilter, number> = {
    email: forReach.filter(hasEmail).length,
    phone: forReach.filter(hasPhone).length,
    linkedin: forReach.filter(hasLinkedin).length,
    nothing: forReach.filter((l) => !hasEmail(l) && !hasPhone(l) && !hasLinkedin(l)).length,
  };

  return (
    <div ref={barRef} className="mb-4 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <OwnerFilter
          value={filters.owner}
          onChange={(owner) => set({ owner })}
          team={team}
          me={me}
          owners={filterLeads(leads, filters, today, "owner").map((l) => l.responsavel)}
        />
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchBox value={filters.query} onChange={(query) => set({ query })} />
          </div>
          {trailing}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <FilterChip
          label="Estado"
          selected={filters.stages.map((id) => STAGES.find((s) => s.id === id)!.label)}
          onClear={() => {
            set({ stages: [] });
            focusLater('[data-filter="Estado"]');
          }}
        >
          {STAGES.map((s) => (
            <Option
              key={s.id}
              checked={filters.stages.includes(s.id)}
              onToggle={() => set({ stages: toggle<StageId>(filters.stages, s.id) })}
              count={forStages.filter((l) => stageOf(l.estado) === s.id).length}
            >
              <span className={`size-2 rounded-full ${s.dot}`} />
              {s.label}
            </Option>
          ))}
        </FilterChip>

        {SHOW_NEXT_STEP && (
          <FilterChip
            label="Próximo passo"
            selected={filters.due.map((id) => DUE_OPTIONS.find((d) => d.id === id)!.label)}
            onClear={() => {
              set({ due: [] });
              focusLater('[data-filter="Próximo passo"]');
            }}
          >
            {DUE_OPTIONS.map((d) => (
              <Option
                key={d.id}
                checked={filters.due.includes(d.id)}
                onToggle={() => set({ due: toggle<DueFilter>(filters.due, d.id) })}
                count={forDue.filter((l) => dueBucket(l, today) === d.id).length}
              >
                {d.label}
              </Option>
            ))}
          </FilterChip>
        )}

        <FilterChip
          label="Contacto"
          selected={filters.reach.map((id) => REACH_OPTIONS.find((r) => r.id === id)!.label)}
          onClear={() => {
            set({ reach: [] });
            focusLater('[data-filter="Contacto"]');
          }}
        >
          {REACH_OPTIONS.map((r) => (
            <Option
              key={r.id}
              checked={filters.reach.includes(r.id)}
              onToggle={() => set({ reach: toggle<ReachFilter>(filters.reach, r.id) })}
              count={reachCount[r.id]}
            >
              {r.label}
            </Option>
          ))}
        </FilterChip>

        {active && (
          <button
            type="button"
            onClick={() => {
              onChange(NO_FILTERS);
              focusLater('input[type="search"]');
            }}
            className="h-9 rounded-full px-3 text-sm font-medium text-ink-2 hover:text-ink"
          >
            Limpar filtros
          </button>
        )}
        {extra}
        <p className="ml-auto text-sm tabular-nums text-ink-2" aria-live="polite">
          {shown === leads.length
            ? `${leads.length} ${leads.length === 1 ? "lead" : "leads"}`
            : `${shown} de ${leads.length} ${leads.length === 1 ? "lead" : "leads"}`}
        </p>
      </div>
    </div>
  );
}

/** "Estado ▾" chip; when something is picked it turns dark, shows the choice and gets an × to clear. */
function FilterChip({
  label,
  selected,
  onClear,
  children,
}: {
  label: string;
  selected: string[];
  onClear: () => void;
  children: ReactNode;
}) {
  const on = selected.length > 0;
  const summary = on ? (selected.length <= 2 ? selected.join(", ") : `${selected[0]} +${selected.length - 1}`) : "";
  return (
    <span className={`inline-flex h-9 items-center rounded-full ${on ? "bg-ink text-white" : "bg-surface text-ink-2"}`}>
      <Popover
        align="left"
        label={on ? `Filtro ${label}: ${selected.join(", ")}` : `Filtrar por ${label}`}
        title={label}
        triggerProps={{ "data-filter": label }}
        trigger={
          <>
            <span className={on ? "text-white/70" : ""}>{label}</span>
            {on && <span className="max-w-[12rem] truncate font-semibold">{summary}</span>}
            <ChevronDown size={14} aria-hidden className={on ? "text-white/70" : "text-ink-3"} />
          </>
        }
        className={`flex h-9 items-center gap-1.5 rounded-full text-sm font-medium transition ${
          on ? "pl-3.5 pr-1.5" : "px-3.5 hover:bg-surface-2 hover:text-ink"
        }`}
      >
        {() => (
          <>
            <MenuLabel>Mostrar só</MenuLabel>
            {children}
          </>
        )}
      </Popover>
      {on && (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Limpar filtro ${label}`}
          className="mr-1 grid size-7 place-items-center rounded-full text-white/70 hover:bg-white/15 hover:text-white"
        >
          <X size={14} aria-hidden />
        </button>
      )}
    </span>
  );
}

function Option({
  checked,
  onToggle,
  count,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  count: number;
  children: ReactNode;
}) {
  return (
    <MenuItem kind="checkbox" active={checked} onSelect={onToggle}>
      <span
        aria-hidden
        className={`grid size-4 shrink-0 place-items-center rounded border ${
          checked ? "border-ink bg-ink text-white" : "border-line-strong bg-surface"
        }`}
      >
        {checked && <Check size={11} strokeWidth={3} />}
      </span>
      <span className="flex flex-1 items-center gap-2">{children}</span>
      <span className="text-xs tabular-nums text-ink-3">{count}</span>
    </MenuItem>
  );
}
