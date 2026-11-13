"use client";

import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import { RotateCcw, Search } from "lucide-react";
import type { Lead } from "@/lib/leads";
import { CompanyLogo } from "@/components/company-logo";
import { StageBadge } from "@/components/ui";
import { companyDomain } from "@/lib/domain";
import { daysFrom, shortDate } from "@/lib/dates";
import { stageOf, STAGES } from "@/lib/stages";
import { isNextRedirect } from "@/lib/errors";
import { restoreLeads } from "../../actions";

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();

/** "Apagada hoje" / "Apagada ontem" / "Apagada a 4 nov" (last change, i.e. when it was deleted). */
function deletedWhen(iso: string, today: string) {
  const d = daysFrom(iso, today);
  return d === 0 ? "Apagada hoje" : d === -1 ? "Apagada ontem" : `Apagada a ${shortDate(iso)}`;
}

/** Deleted leads, newest first, each with a button to put it back in the pipeline. */
export function DeletedList({ leads, today, demo = false }: { leads: Lead[]; today: string; demo?: boolean }) {
  const [local, setLocal] = useState(leads);
  const [restoring, hide] = useOptimistic<string[], string>([], (s, id) => [...s, id]);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const all = (demo ? local : leads).filter((l) => !restoring.includes(l.id));
  const q = norm(query.trim());
  const shown = q
    ? all.filter((l) => norm(`${l.empresa} ${l.contacto_nome} ${l.email}`).includes(q))
    : all;

  const restore = (lead: Lead) =>
    startTransition(async () => {
      setError(null);
      const done = `${lead.empresa} recuperada. Já está no pipeline.`;
      if (demo) {
        setLocal((s) => s.filter((l) => l.id !== lead.id));
        return setMessage(done);
      }
      hide(lead.id);
      try {
        const r = await restoreLeads([lead.id]);
        if (!r.ok) return setError(r.error);
        setMessage(done);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  return (
    <div>
      <p aria-live="polite" className={message ? "mb-4 rounded-xl bg-ok-soft px-4 py-2.5 text-sm text-ok" : "sr-only"}>
        {message}
      </p>
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
          {error}
        </p>
      )}

      {all.length > 0 && (
        <label className="mb-4 flex h-10 max-w-sm items-center gap-2 rounded-full bg-surface px-4 text-sm focus-within:ring-2 focus-within:ring-brand/40">
          <Search size={16} aria-hidden className="text-ink-3" />
          <span className="sr-only">Procurar nas apagadas</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar empresa, contacto ou email"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-ink-3"
          />
        </label>
      )}

      {shown.length === 0 ? (
        <p className="rounded-3xl bg-surface px-6 py-12 text-center text-sm text-ink-2">
          {all.length === 0 ? "Não há leads apagadas." : "Nenhuma lead apagada corresponde à pesquisa."}
        </p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {shown.map((l) => {
            const stage = STAGES.find((s) => s.id === stageOf(l.estado))!;
            return (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 md:px-5">
                <CompanyLogo name={l.empresa} domain={companyDomain(l)} size={32} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link href={`/leads/${l.id}`} className="truncate font-semibold hover:underline">
                      {l.empresa}
                    </Link>
                    <StageBadge label={stage.label} dot={stage.dot} />
                  </div>
                  <p className="truncate text-sm text-ink-2">
                    {[l.contacto_nome, l.email].filter(Boolean).join(" · ") || "Sem contacto"}
                  </p>
                </div>
                <span className="hidden shrink-0 text-sm text-ink-3 sm:block">
                  {deletedWhen(l.atualizado_em, today)}
                </span>
                <button
                  type="button"
                  onClick={() => restore(l)}
                  aria-label={`Recuperar ${l.empresa}${l.contacto_nome ? ` · ${l.contacto_nome}` : ""}`}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-sm font-semibold text-ink outline-none transition hover:bg-line focus-visible:ring-2 focus-visible:ring-brand/40"
                >
                  <RotateCcw size={15} aria-hidden /> Recuperar
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {all.length > 0 && (
        <p className="mt-3 text-sm text-ink-3">
          {shown.length === all.length ? `${all.length} apagadas` : `${shown.length} de ${all.length} apagadas`}
        </p>
      )}
    </div>
  );
}
