"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Columns3, Pencil, Table2, Trash2, X } from "lucide-react";
import type { Lead } from "@/lib/leads";
import type { Member } from "@/lib/names";
import { activeFilterCount, filterLeads, NO_FILTERS, type LeadFilters, type Sort } from "@/lib/lead-filters";
import { CLOSED_STAGES, isOpen, type StageId } from "@/lib/stages";
import { FilterBar } from "@/components/filter-bar";
import { useLeadActions } from "./use-lead-actions";
import { LeadGrid } from "./lead-grid";
import { SHOW_NEXT_STEP } from "@/lib/features";
import { Board } from "./board";
import { displayName } from "@/lib/names";
import { SEGMENTS, STAGES } from "@/lib/stages";
import { Avatar } from "@/components/avatar";
import { MenuItem, MenuLabel, Popover } from "@/components/popover";

type View = "tabela" | "quadro";
const VIEWS: { id: View; label: string; icon: typeof Table2 }[] = [
  { id: "tabela", label: "Tabela", icon: Table2 },
  { id: "quadro", label: "Quadro", icon: Columns3 },
];

/** Filters + table (and, on Pipeline, a board view) over the same leads. */
export function LeadsWorkspace({
  leads,
  team,
  me,
  today,
  withBoard = false,
  demo = false,
}: {
  leads: Lead[];
  team: Member[];
  me: string;
  today: string;
  /** Offer the Tabela / Quadro switch (the choice is kept in the URL: ?vista=quadro). */
  withBoard?: boolean;
  demo?: boolean;
}) {
  const params = useSearchParams();
  const view: View = withBoard && params.get("vista") === "quadro" ? "quadro" : "tabela";
  const [filters, setFilters] = useState<LeadFilters>(NO_FILTERS);
  const [showClosed, setShowClosed] = useState(false);
  const [sort, setSort] = useState<Sort>(SHOW_NEXT_STEP ? { key: "proximo", dir: "asc" } : { key: "ultimo", dir: "desc" });
  // Leads edited in place stay visible until the filters change, even if they no longer match.
  const [pinned, setPinned] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const actions = useLeadActions({ leads, team, today, demo, raiseToast: view === "tabela" && selected.length > 0 });

  const closedPicked = filters.stages.some((s) => CLOSED_STAGES.includes(s));
  const scoped = actions.leads.filter((l) => showClosed || closedPicked || isOpen(l.estado));
  const passing = new Set(filterLeads(scoped, filters, today).map((l) => l.id));
  const visible = actions.leads.filter((l) => passing.has(l.id) || pinned.includes(l.id));
  const closedCount = actions.leads.length - actions.leads.filter((l) => isOpen(l.estado)).length;
  const filtering = activeFilterCount(filters) > 0 || filters.query.trim() !== "";

  // Ticked rows survive filter changes; only those still on screen are acted on.
  const changeFilters = (f: LeadFilters) => {
    setFilters(f);
    setPinned([]);
  };
  // Only rows still on screen count as selected.
  const picked = selected.filter((id) => visible.some((l) => l.id === id));
  const pinMany = (ids: string[]) => setPinned((p) => [...new Set([...p, ...ids])]);
  const pin = (id: string) => setPinned((p) => (p.includes(id) ? p : [...p, id]));
  const move = (id: string, stage: StageId) => {
    pin(id);
    actions.move(id, stage);
  };
  const assign = (id: string, email: string | null) => {
    pin(id);
    actions.assign(id, email);
  };

  // Only the URL changes: no server round trip, and the filters / sort stay as they are.
  const setView = (v: View) => {
    const next = new URLSearchParams(params);
    setSelected([]);
    if (v === "quadro") next.set("vista", "quadro");
    else next.delete("vista");
    const qs = next.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const switcher = withBoard && (
    <div role="group" aria-label="Vista" className="flex shrink-0 gap-1 rounded-full bg-surface p-1">
      {VIEWS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => setView(id)}
          className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium transition ${
            view === id ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
          }`}
        >
          <Icon size={15} aria-hidden />
          <span className="hidden sm:inline">{label}</span>
          <span className="sr-only sm:hidden">{label}</span>
        </button>
      ))}
    </div>
  );

  const closedToggle = closedCount > 0 && !closedPicked && (
    <button
      type="button"
      aria-pressed={showClosed}
      onClick={() => {
        setShowClosed((v) => !v);
        setPinned([]);
        setSelected([]);
      }}
      className={`h-9 rounded-full px-3.5 text-sm font-medium transition ${
        showClosed ? "bg-ink text-white" : "bg-surface text-ink-2 hover:text-ink"
      }`}
    >
      {showClosed ? "Esconder fechadas" : `Mostrar fechadas (${closedCount})`}
    </button>
  );

  return (
    // Room under the table so the floating selection bar never covers the last rows.
    <div className={view === "tabela" && picked.length > 0 ? "pb-24" : ""}>
      <FilterBar
        leads={scoped}
        allLeads={actions.leads}
        filters={filters}
        onChange={changeFilters}
        team={team}
        me={me}
        today={today}
        shown={visible.length}
        trailing={switcher}
        extra={closedToggle}
      />
      {actions.feedback}
      {view === "quadro" ? (
        <Board
          leads={visible}
          team={team}
          today={today}
          filtering={filtering}
          showClosed={showClosed}
          stageFilter={filters.stages}
          onMove={move}
          onAssign={assign}
          onLog={actions.log}
        />
      ) : (
        <LeadGrid
          leads={visible}
          team={team}
          today={today}
          sort={sort}
          onSort={setSort}
          onMove={move}
          onAssign={assign}
          onUpdate={(id, field, value) => {
            // A company rename changes all its contacts: keep them all on screen.
            const lead = actions.leads.find((l) => l.id === id);
            if (field === "empresa" && lead) pinMany(actions.leads.filter((l) => l.empresa === lead.empresa).map((l) => l.id));
            else pin(id);
            actions.update(id, field, value);
          }}
          onUpdateNext={(id, acao, data) => {
            pin(id);
            actions.updateNext(id, acao, data);
          }}
          selected={picked}
          onSelect={setSelected}
        />
      )}
      {view === "tabela" && picked.length > 0 && (
        <BulkBar
          ids={picked}
          team={team}
          onMove={(stage) => {
            pinMany(picked);
            actions.moveMany(picked, stage);
          }}
          onAssign={(email) => {
            pinMany(picked);
            actions.assignMany(picked, email);
          }}
          onSegment={(segmento) => {
            pinMany(picked);
            actions.segmentMany(picked, segmento);
          }}
          onDelete={() => {
            actions.removeMany(picked);
            setSelected([]);
          }}
          onClear={() => setSelected([])}
        />
      )}
    </div>
  );
}

/** Floating bar for the ticked rows: change stage or owner of all of them at once. */
function BulkBar({
  ids,
  team,
  onMove,
  onAssign,
  onSegment,
  onDelete,
  onClear,
}: {
  ids: string[];
  team: Member[];
  onMove: (stage: StageId) => void;
  onAssign: (email: string | null) => void;
  onSegment: (segmento: string) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const count = ids.length;
  const btn =
    "flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium text-white outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center px-4 md:bottom-6">
      <div
        role="group"
        aria-label={`${count} selecionadas`}
        className="pointer-events-auto flex items-center gap-1 rounded-full bg-ink p-1.5 pl-4 text-white shadow-[0_12px_40px_rgba(0,0,0,.25)]"
      >
        <span className="mr-1 text-sm font-semibold tabular-nums">
          {count} {count === 1 ? "selecionada" : "selecionadas"}
        </span>
        <Popover
          align="left"
          label={`Mudar estado de ${count} leads`}
          title={`${count} ${count === 1 ? "lead" : "leads"}`}
          trigger={
            <>
              Mudar estado <ChevronDown size={14} aria-hidden className="text-white/70" />
            </>
          }
          className={btn}
        >
          {(close) => (
            <>
              <MenuLabel>Mover para</MenuLabel>
              {STAGES.map((s) => (
                <MenuItem
                  key={s.id}
                  kind="action"
                  onSelect={() => {
                    onMove(s.id);
                    close();
                  }}
                >
                  <span className={`size-2 rounded-full ${s.dot}`} />
                  <span className="flex-1">{s.label}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
        <Popover
          align="left"
          label={`Mudar quem contacta ${count} leads`}
          title={`${count} ${count === 1 ? "lead" : "leads"}`}
          trigger={
            <>
              Quem contacta <ChevronDown size={14} aria-hidden className="text-white/70" />
            </>
          }
          className={btn}
        >
          {(close) => (
            <>
              <MenuLabel>Quem contacta</MenuLabel>
              {[...team, null].map((m) => (
                <MenuItem
                  key={m?.email ?? "none"}
                  kind="action"
                  onSelect={() => {
                    onAssign(m?.email ?? null);
                    close();
                  }}
                >
                  <Avatar member={m} team={team} size={20} />
                  <span className="flex-1">{m ? displayName(m) : "Sem dono"}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
        <Popover
          align="left"
          label={`Mudar indústria de ${count} leads`}
          title={`${count} ${count === 1 ? "lead" : "leads"}`}
          trigger={
            <>
              Indústria <ChevronDown size={14} aria-hidden className="text-white/70" />
            </>
          }
          className={btn}
        >
          {(close) => (
            <>
              <MenuLabel>Indústria</MenuLabel>
              {Object.entries(SEGMENTS).map(([id, label]) => (
                <MenuItem
                  key={id}
                  kind="action"
                  onSelect={() => {
                    onSegment(id);
                    close();
                  }}
                >
                  <span className="flex-1">{label}</span>
                </MenuItem>
              ))}
            </>
          )}
        </Popover>
        {count === 1 && (
          <Link href={`/leads/${ids[0]}/editar`} className={btn}>
            <Pencil size={14} aria-hidden /> Editar ficha
          </Link>
        )}
        <Popover
          align="right"
          label={`Apagar ${count} ${count === 1 ? "lead" : "leads"}`}
          title={`Apagar ${count} ${count === 1 ? "lead" : "leads"}?`}
          trigger={
            <>
              <Trash2 size={14} aria-hidden /> Apagar
            </>
          }
          className={btn}
        >
          {(close) => (
            <>
              <p role="presentation" className="px-2.5 py-2 text-sm text-ink-2">
                Saem do pipeline e das listas. O histórico fica guardado e podes anular logo a seguir.
              </p>
              <MenuItem
                kind="action"
                onSelect={() => {
                  close();
                  onDelete();
                }}
              >
                <Trash2 size={15} aria-hidden className="text-bad" />
                <span className="flex-1 font-semibold text-bad">
                  {count === 1 ? "Sim, apagar" : `Sim, apagar ${count} leads`}
                </span>
              </MenuItem>
            </>
          )}
        </Popover>
        <button type="button" onClick={onClear} aria-label="Limpar seleção" className={`${btn} px-2.5`}>
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
