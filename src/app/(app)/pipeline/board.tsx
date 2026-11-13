"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarClock, Check, MoreHorizontal } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { CLOSED_STAGES, STAGES, stageOf, segmentLabel, type StageId } from "@/lib/stages";
import { dueLabel, dueState } from "@/lib/dates";
import { SHOW_NEXT_STEP } from "@/lib/features";
import { TOUCHES, type TouchKind } from "@/lib/cadence";
import { TOUCH_ICONS } from "@/components/quick-log";
import { Avatar, ownerTone } from "@/components/avatar";
import { MenuItem, MenuLabel, Popover } from "@/components/popover";
import { refocus } from "./use-lead-actions";
import { CompanyLogo } from "@/components/company-logo";
import { companyDomain } from "@/lib/domain";

// Custom type so files or text dragged in from outside are ignored.
const DRAG_TYPE = "application/x-cartise-lead";

/** Kanban view. Leads arrive already filtered; changes go through the shared lead actions. */
export function Board({
  leads,
  team,
  today,
  filtering,
  showClosed,
  stageFilter,
  onMove,
  onAssign,
  onLog,
}: {
  leads: Lead[];
  team: Member[];
  today: string;
  filtering: boolean;
  /** Show the Ganho / Perdido columns. */
  showClosed: boolean;
  /** Stages picked in the Estado filter (empty = no filter). */
  stageFilter: StageId[];
  onMove: (id: string, stage: StageId) => void;
  onAssign: (id: string, email: string | null) => void;
  onLog: (lead: Lead, kind: TouchKind) => void;
}) {
  const [dragOver, setDragOver] = useState<StageId | null>(null);
  // A column shows when its stage is picked (or nothing is picked and it's open / closed
  // ones are on), and always when a visible lead is in it (e.g. one just moved there).
  const present = new Set(leads.map((l) => stageOf(l.estado)));
  const stages = STAGES.filter(
    (s) =>
      present.has(s.id) ||
      (stageFilter.length ? stageFilter.includes(s.id) : showClosed || !CLOSED_STAGES.includes(s.id)),
  );
  const visible = leads;

  return (
    <div>
      {filtering && leads.length === 0 && (
        <p className="mb-4 rounded-2xl bg-surface px-4 py-3 text-sm text-ink-2">Nenhuma lead com estes filtros.</p>
      )}

      <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-4 md:-mx-8 md:scroll-px-8 md:px-8 xl:gap-4">
        {stages.map((stage) => {
          const items = visible.filter((l) => stageOf(l.estado) === stage.id);
          return (
            <section
              key={stage.id}
              aria-label={stage.label}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(DRAG_TYPE)) return;
                e.preventDefault();
                setDragOver(stage.id);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver((s) => (s === stage.id ? null : s));
              }}
              onDrop={(e) => {
                setDragOver(null);
                const id = e.dataTransfer.getData(DRAG_TYPE);
                if (!id) return;
                e.preventDefault();
                onMove(id, stage.id);
              }}
              className={`flex w-[272px] shrink-0 snap-start flex-col rounded-[28px] p-2 transition xl:w-auto xl:min-w-[200px] xl:flex-1 ${
                dragOver === stage.id ? "bg-brand-softer ring-2 ring-brand/40" : ""
              }`}
            >
              <header className="mb-2 flex items-center gap-2 px-2 pt-1">
                <span className={`size-2 rounded-full ${stage.dot}`} />
                <h2 className="text-sm font-semibold">{stage.label}</h2>
                <span className="rounded-full bg-surface px-2 py-0.5 text-xs font-medium tabular-nums text-ink-2">
                  {items.length}
                </span>
              </header>
              <div className={`h-1 rounded-full mx-2 mb-3 ${items.length ? stage.dot : "bg-line"} opacity-60`} />
              <ul className="flex min-h-24 flex-col gap-3">
                {items.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    team={team}
                    today={today}
                    onMove={(s) => {
                      onMove(lead.id, s);
                      refocus(lead.id);
                    }}
                    onDragEnd={() => setDragOver(null)}
                    onLog={(kind) => onLog(lead, kind)}
                    onAssign={(email) => onAssign(lead.id, email)}
                  />
                ))}
                {items.length === 0 && (
                  <li className="grid h-24 place-items-center rounded-3xl border-[1.5px] border-dashed border-line px-3 text-center text-xs text-ink-3">
                    {filtering ? "—" : "Arrasta uma lead para aqui"}
                  </li>
                )}
              </ul>
            </section>
          );
        })}
      </div>

    </div>
  );
}

function LeadCard({
  lead,
  team,
  today,
  onMove,
  onAssign,
  onDragEnd,
  onLog,
}: {
  onLog: (kind: TouchKind) => void;
  lead: Lead;
  team: Member[];
  today: string;
  onMove: (stage: StageId) => void;
  onAssign: (email: string | null) => void;
  onDragEnd: () => void;
}) {
  const owner = team.find((m) => m.email === lead.responsavel) ?? null;
  const tone = ownerTone(lead.responsavel, team);
  const due = dueState(lead.proxima_data, today);
  const current = stageOf(lead.estado);
  const chip = tone ? "bg-white/70" : "bg-surface-2";

  return (
    <li
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, lead.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragEnd={onDragEnd}
      className={`group relative cursor-grab rounded-3xl p-4 transition active:cursor-grabbing ${
        tone ? tone.card : "border-[1.5px] border-dashed border-ink-3/40 bg-surface"
      } hover:shadow-[0_6px_20px_rgba(0,0,0,.07)]`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2.5">
          <CompanyLogo name={lead.empresa} domain={companyDomain(lead)} size={28} />
          <div className="min-w-0">
          <h3 className="truncate font-display text-[15px] font-semibold leading-tight">
            <Link
              href={`/leads/${lead.id}`}
              draggable={false}
              className="rounded after:absolute after:inset-0 after:rounded-3xl hover:text-brand"
            >
              {lead.empresa}
            </Link>
          </h3>
          <p className="mt-0.5 truncate text-[13px] text-ink-2">
            {lead.contacto_nome || "Sem contacto"}
            {lead.cargo && <span className="text-ink-3"> · {lead.cargo}</span>}
          </p>
          </div>
        </div>
        <Popover
          label={`Opções para ${lead.empresa}`}
          title={lead.empresa}
          trigger={<MoreHorizontal size={16} />}
          triggerProps={{ "data-lead-trigger": lead.id }}
          className={`relative z-10 grid size-10 shrink-0 place-items-center rounded-full md:size-8 ${chip} text-ink-2 transition hover:bg-white hover:text-ink`}
        >
          {(close) => (
            <>
              <MenuLabel>Quem contacta</MenuLabel>
              {[...team, null].map((m) => (
                <MenuItem
                  key={m?.email ?? "none"}
                  active={(m?.email ?? null) === lead.responsavel}
                  onSelect={() => {
                    onAssign(m?.email ?? null);
                    close();
                  }}
                >
                  <Avatar member={m} team={team} size={20} />
                  <span className="flex-1">{m ? displayName(m) : "Sem dono"}</span>
                  {(m?.email ?? null) === lead.responsavel && <Check size={14} />}
                </MenuItem>
              ))}
              <div className="my-1 h-px bg-line" />
              <MenuLabel>Registar contacto</MenuLabel>
              {(["email", "linkedin", "chamada"] as const).map((kind) => {
                const Icon = TOUCH_ICONS[kind];
                return (
                  <MenuItem
                    kind="action"
                    key={kind}
                    onSelect={() => {
                      onLog(kind);
                      close();
                    }}
                  >
                    <Icon size={16} aria-hidden />
                    <span className="flex-1">{TOUCHES[kind].done}</span>
                  </MenuItem>
                );
              })}
              <div className="my-1 h-px bg-line" />
              <MenuLabel>Mover para</MenuLabel>
              <div>
                {STAGES.map((s) => (
                  <MenuItem
                    key={s.id}
                    active={s.id === current}
                    onSelect={() => {
                      onMove(s.id);
                      close();
                    }}
                  >
                    <span className={`size-2 rounded-full ${s.dot}`} />
                    <span className="flex-1">{s.label}</span>
                    {s.id === current && <Check size={14} />}
                  </MenuItem>
                ))}
              </div>
            </>
          )}
        </Popover>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {lead.segmento && (
          <span className={`rounded-full ${chip} px-2 py-0.5 text-[11px] font-medium text-ink-2`}>
            {segmentLabel(lead.segmento)}
          </span>
        )}
        {lead.cidade && (
          <span className={`rounded-full ${chip} px-2 py-0.5 text-[11px] font-medium text-ink-2`}>{lead.cidade}</span>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar member={owner} team={team} size={28} />
          <span className={`truncate text-[13px] font-medium ${SHOW_NEXT_STEP && lead.proxima_data ? "xl:sr-only 2xl:not-sr-only" : ""}`}>
            {owner ? displayName(owner) : "Sem dono"}
          </span>
        </div>
        {SHOW_NEXT_STEP && lead.proxima_data && (
          <span
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              due === "overdue"
                ? "bg-bad-soft text-bad"
                : due === "today"
                  ? "bg-warn-soft text-warn"
                  : `${chip} text-ink-2`
            }`}
          >
            <CalendarClock size={12} aria-hidden />
            {dueLabel(lead.proxima_data, today)}
          </span>
        )}
      </div>
      {SHOW_NEXT_STEP && lead.proxima_acao && (
        <p className="mt-2 truncate text-[12px] text-ink-2">
          <span className="font-medium text-ink">Próximo:</span> {lead.proxima_acao}
        </p>
      )}
    </li>
  );
}
