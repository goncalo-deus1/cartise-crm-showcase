"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import type { Lead } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { STAGES, stageOf, type StageId } from "@/lib/stages";
import { relativeDate } from "@/lib/dates";
import { TOUCHES, type TouchKind } from "@/lib/cadence";
import { isNextRedirect } from "@/lib/errors";
import {
  archiveLeads,
  logTouch,
  moveLead,
  moveLeads,
  restoreLeads,
  setOwner,
  setOwnerMany,
  setSegmentMany,
  updateLeadField,
  updateNextStep,
} from "../actions";
import { checkField, checkNextStep, EDITABLE_FIELDS, type EditableField } from "@/lib/fields";
import { segmentLabel } from "@/lib/stages";

type Patch = { id: string } & Partial<Omit<Lead, "id">>;

const patchLeads = (state: Lead[], patches: Patch[]) => {
  const byId = new Map(patches.map((p) => [p.id, p]));
  return state.map((l) => (byId.has(l.id) ? { ...l, ...byId.get(l.id) } : l));
};

/**
 * Optimistic lead changes shared by the table and the board: move to a stage, change owner,
 * log a contact. Returns the leads with pending changes applied, plus the feedback UI
 * (error banner, screen-reader announcement and toast) to render once.
 */
export function useLeadActions({
  leads,
  team,
  today,
  demo = false,
  raiseToast = false,
}: {
  leads: Lead[];
  team: Member[];
  today: string;
  /** Lift the toast above the floating selection bar. */
  raiseToast?: boolean;
  /** Sample-data preview: changes stay local, nothing is saved. */
  demo?: boolean;
}) {
  const [local, setLocal] = useState(leads);
  const [optimistic, apply] = useOptimistic(demo ? local : leads, patchLeads);
  // Leads being deleted disappear at once; the server refresh then leaves them out for good.
  const [gone, hide] = useOptimistic<string[], string[]>([], (s, ids) => [...s, ...ids]);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [toast, setToast] = useState<{ id: number; text: string; undo?: () => void } | null>(null);
  const toastSeq = useRef(0);

  /** Short visible confirmation for every change (the live region covers screen readers). */
  const say = (text: string, undo?: () => void) => {
    const t = { id: ++toastSeq.current, text, undo };
    setToast(t);
    // Alternate an invisible character so the same message twice is still spoken.
    setAnnouncement(t.id % 2 ? text : `${text}​`);
    // Leave time to reach the undo button.
    setTimeout(() => setToast((c) => (c?.id === t.id ? null : c)), undo ? 8000 : 2600);
  };

  const run = (patch: Patch[], message: string, action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      say(message);
      if (demo) return setLocal((s) => patchLeads(s, patch));

      apply(patch);
      try {
        const result = await action();
        if (!result.ok) setError(result.error ?? "Algo correu mal.");
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  const move = (id: string, estado: StageId) => {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead || stageOf(lead.estado) === estado) return;
    const label = STAGES.find((s) => s.id === estado)!.label;
    run([{ id, estado }], `${lead.empresa} movida para ${label}`, () => moveLead(id, estado));
  };

  const assign = (id: string, email: string | null) => {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead || lead.responsavel === email) return;
    const who = displayName(team.find((m) => m.email === email));
    run([{ id, responsavel: email }], `${lead.empresa}: ${who}`, () => setOwner(id, email));
  };

  const count = (n: number) => `${n} ${n === 1 ? "lead" : "leads"}`;

  const moveMany = (ids: string[], estado: StageId) => {
    const changing = ids.filter((id) => optimistic.some((l) => l.id === id && stageOf(l.estado) !== estado));
    if (!changing.length) return;
    const label = STAGES.find((s) => s.id === estado)!.label;
    run(
      changing.map((id) => ({ id, estado })),
      `${count(changing.length)} movidas para ${label}`,
      () => moveLeads(changing, estado),
    );
  };

  const assignMany = (ids: string[], email: string | null) => {
    const changing = ids.filter((id) => optimistic.some((l) => l.id === id && l.responsavel !== email));
    if (!changing.length) return;
    const who = displayName(team.find((m) => m.email === email));
    run(
      changing.map((id) => ({ id, responsavel: email })),
      `${count(changing.length)}: ${who}`,
      () => setOwnerMany(changing, email),
    );
  };

  /** Edit one field. A company name changes on all its contacts (same as the server does). */
  const update = (id: string, field: EditableField, value: string) => {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead) return;
    const check = checkField(field, value);
    if (!check.ok) return setError(check.error);
    if (lead[field] === check.value) return;
    const ids = field === "empresa" ? optimistic.filter((l) => l.empresa === lead.empresa).map((l) => l.id) : [id];
    const shown = field === "segmento" ? segmentLabel(check.value) : check.value;
    const where = ids.length > 1 ? ` (${ids.length} contactos)` : "";
    // Renaming to a name another company already uses joins the two: say so.
    const joins =
      field === "empresa" && optimistic.some((l) => l.empresa === check.value && !ids.includes(l.id))
        ? ` · juntada a ${check.value}`
        : "";
    run(
      ids.map((x) => ({ id: x, [field]: check.value })),
      `${lead.empresa} · ${EDITABLE_FIELDS[field]}: ${shown || "apagado"}${where}${joins}`,
      () => updateLeadField(id, field, value),
    );
  };

  const updateNext = (id: string, acao: string, data: string) => {
    const lead = optimistic.find((l) => l.id === id);
    if (!lead) return;
    const next = checkNextStep(acao, data);
    if (lead.proxima_acao === next.acao && lead.proxima_data === next.data) return;
    run(
      [{ id, proxima_acao: next.acao, proxima_data: next.data }],
      next.acao || next.data ? `${lead.empresa} · próximo passo guardado` : `${lead.empresa} · próximo passo removido`,
      () => updateNextStep(id, acao, data),
    );
  };

  const segmentMany = (ids: string[], segmento: string) => {
    const changing = ids.filter((id) => optimistic.some((l) => l.id === id && l.segmento !== segmento));
    if (!changing.length) return;
    run(
      changing.map((id) => ({ id, segmento })),
      `${count(changing.length)}: ${segmentLabel(segmento)}`,
      () => setSegmentMany(changing, segmento),
    );
  };

  /** "Apagar": archive the leads (they keep their history) with an undo in the toast. */
  const removeMany = (ids: string[]) => {
    const removing = optimistic.filter((l) => ids.includes(l.id) && !gone.includes(l.id));
    if (!removing.length) return;
    const n = removing.length;
    const label = n === 1 ? removing[0].empresa : count(n);
    const restore = () =>
      startTransition(async () => {
        setError(null);
        setToast(null);
        if (demo) {
          setLocal((s) => [...removing.filter((r) => !s.some((l) => l.id === r.id)), ...s]);
          return say(`${label} ${n === 1 ? "recuperada" : "recuperadas"}`);
        }
        try {
          const r = await restoreLeads(removing.map((l) => l.id));
          if (!r.ok) return setError(r.error);
          say(`${label} ${n === 1 ? "recuperada" : "recuperadas"}`);
        } catch (e) {
          if (isNextRedirect(e)) throw e;
          setError("Sem ligação ao servidor. Tenta outra vez.");
        }
      });
    startTransition(async () => {
      setError(null);
      say(`${label} ${n === 1 ? "apagada" : "apagadas"}`, restore);
      if (demo) return setLocal((s) => s.filter((l) => !ids.includes(l.id)));
      hide(removing.map((l) => l.id));
      try {
        const r = await archiveLeads(removing.map((l) => l.id));
        if (!r.ok) setError(r.error);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });
  };

  const log = (lead: Lead, kind: TouchKind) =>
    startTransition(async () => {
      setError(null);
      if (demo) return say(`${lead.empresa}: ${TOUCHES[kind].done}`);
      try {
        const r = await logTouch(lead.id, kind);
        if (!r.ok) return setError(r.error);
        say(
          r.acao && r.data
            ? `${lead.empresa}: ${TOUCHES[kind].done} · próximo: ${r.acao}, ${relativeDate(r.data, today)}`
            : `${lead.empresa}: ${TOUCHES[kind].done}`,
        );
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  const feedback = (
    <>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}
      {toast && (
        <div
          className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${
            raiseToast ? "bottom-40 md:bottom-24" : "bottom-24 md:bottom-8"
          }`}
        >
          <div
            className={`flex items-center gap-1 rounded-full bg-ink pl-4 text-sm font-medium text-white shadow-[0_10px_30px_rgba(0,0,0,.2)] ${
              toast.undo ? "py-1.5 pr-1.5" : "py-2.5 pr-4"
            }`}
          >
            {/* The live region above already reads the message out. */}
            <p aria-hidden>{toast.text}</p>
            {toast.undo && (
              <button
                type="button"
                onClick={toast.undo}
                aria-label={`Anular: ${toast.text}`}
                className="pointer-events-auto ml-2 h-8 rounded-full px-3 font-semibold text-white underline-offset-2 outline-none transition hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/60"
              >
                Anular
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );

  const visible = gone.length ? optimistic.filter((l) => !gone.includes(l.id)) : optimistic;
  return { leads: visible, removeMany, move, assign, moveMany, assignMany, segmentMany, update, updateNext, log, feedback };
}

/** A card or row can remount elsewhere after a change: put keyboard focus back on its menu. */
export function refocus(id: string, attr = "data-lead-trigger") {
  setTimeout(() => document.querySelector<HTMLElement>(`[${attr}="${id}"]`)?.focus(), 60);
}
