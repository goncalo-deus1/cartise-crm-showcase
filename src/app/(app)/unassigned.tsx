"use client";

import Link from "next/link";
import { useOptimistic, useRef, useState, useTransition } from "react";
import { displayName, type Member } from "@/lib/names";
import { segmentLabel } from "@/lib/stages";
import { isNextRedirect } from "@/lib/errors";
import { Avatar } from "@/components/avatar";
import { claimLead } from "./actions";

type Row = { id: string; empresa: string; contacto: string; segmento: string };

const PAGE = 8;

/** Leads with no owner, with one-tap "Eu" / "Tomás" buttons. */
export function Unassigned({
  leads,
  team,
  me,
  demo = false,
}: {
  leads: Row[];
  team: Member[];
  me: string;
  demo?: boolean;
}) {
  const [local, setLocal] = useState(leads);
  const [rows, remove] = useOptimistic(demo ? local : leads, (state: Row[], id: string) =>
    state.filter((r) => r.id !== id),
  );
  const [, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [showAll, setShowAll] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);
  // Put "me" first so the first button is always "Eu".
  const people = [...team].sort((a, b) => (a.email === me ? -1 : b.email === me ? 1 : 0));

  /** The row disappears: keep keyboard focus in the list instead of dropping to the page top. */
  const keepFocus = (index: number) =>
    setTimeout(() => {
      const buttons = listRef.current?.querySelectorAll<HTMLElement>("li button");
      const next = buttons?.[Math.min(index, (buttons?.length ?? 1) - 1) * people.length];
      (next ?? document.getElementById("unassigned-title"))?.focus();
    }, 60);

  const assign = (row: Row, index: number, m: Member) =>
    start(async () => {
      setError(null);
      setAnnouncement(`${row.empresa}: ${m.email === me ? "ficaste tu" : `fica ${displayName(m)}`}`);
      keepFocus(index);
      if (demo) return setLocal((s) => s.filter((r) => r.id !== row.id));
      remove(row.id);
      try {
        const r = await claimLead(row.id, m.email);
        if (!r.ok) setError(r.error);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  const visible = showAll ? rows : rows.slice(0, PAGE);

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {error && (
        <p role="alert" className="mb-3 rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
      <ul ref={listRef} className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visible.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 py-2 pl-3.5 pr-2">
            <Link href={`/leads/${r.id}`} className="min-w-0 hover:text-brand">
              <span className="block truncate text-sm font-semibold">{r.empresa}</span>
              <span className="block truncate text-xs text-ink-2">
                {r.contacto || "Sem contacto"} · {segmentLabel(r.segmento)}
              </span>
            </Link>
            <div className="flex shrink-0 gap-1.5">
              {people.map((m) => (
                <button
                  key={m.email}
                  type="button"
                  onClick={() => assign(r, i, m)}
                  aria-label={`${r.empresa}: ${m.email === me ? "fico eu" : `fica ${displayName(m)}`}`}
                  className="flex h-10 items-center gap-1.5 rounded-full bg-surface pl-1 pr-3 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white"
                >
                  <Avatar member={m} team={team} size={28} />
                  {m.email === me ? "Eu" : displayName(m)}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      {rows.length > PAGE && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 text-sm font-medium text-ink-2 hover:text-ink"
        >
          {showAll ? "Mostrar menos" : `Mostrar todas (${rows.length})`}
        </button>
      )}
      {rows.length === 0 && <p className="text-sm text-ink-2">Tudo distribuído.</p>}
    </div>
  );
}
