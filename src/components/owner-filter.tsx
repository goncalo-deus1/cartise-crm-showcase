"use client";

import { useMemo } from "react";
import { displayName, type Member } from "@/lib/names";
import { Avatar } from "@/components/avatar";
import type { OwnerFilterValue } from "@/lib/lead-filters";

export { matchesOwner, matchesQuery, type OwnerFilterValue } from "@/lib/lead-filters";

/** Segmented control: Todos / Meus / <teammate> / Sem dono, with counts. */
export function OwnerFilter({
  value,
  onChange,
  team,
  me,
  owners,
}: {
  value: OwnerFilterValue;
  onChange: (v: OwnerFilterValue) => void;
  team: Member[];
  me: string;
  owners: (string | null)[];
}) {
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: owners.length, none: 0 };
    for (const o of owners) {
      if (o) c[o] = (c[o] ?? 0) + 1;
      else c.none += 1;
    }
    return c;
  }, [owners]);

  const options: { id: OwnerFilterValue; label: string; avatar?: Member | null }[] = [
    { id: "all", label: "Todos" },
    ...team.map((m) => ({ id: m.email, label: m.email === me ? "Meus" : displayName(m), avatar: m })),
    { id: "none", label: "Sem dono", avatar: null },
  ];

  return (
    <div
      role="group"
      aria-label="Filtrar por quem contacta"
      className="flex flex-wrap gap-1 rounded-3xl bg-surface p-1 sm:flex-nowrap sm:rounded-full"
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.id)}
            className={`flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-2 pr-3 text-sm font-medium transition ${
              active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2"
            }`}
          >
            {o.avatar !== undefined ? <Avatar member={o.avatar} team={team} size={22} /> : <span className="w-1" />}
            {o.label}
            <span
              className={`rounded-full px-1.5 text-xs tabular-nums ${
                active ? "bg-white/20 text-white" : "bg-surface-2 text-ink-2"
              }`}
            >
              {counts[o.id] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = "Procurar lead",
  onCard = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Inside a white card: use the grey fill so the field stays visible. */
  onCard?: boolean;
}) {
  return (
    <label className="relative block md:w-72">
      <span className="sr-only">Procurar</span>
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 fill-none stroke-ink-3 stroke-2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`h-10 w-full rounded-full border border-transparent ${onCard ? "bg-surface-2" : "bg-surface"} pl-10 pr-4 text-base outline-none transition placeholder:text-ink-3 focus:border-brand focus:ring-4 focus:ring-brand/30 md:text-sm`}
      />
    </label>
  );
}
