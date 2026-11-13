"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { RotateCcw, Trash2 } from "lucide-react";
import { isNextRedirect } from "@/lib/errors";
import { restoreLeads } from "../../actions";

/** Shown on a deleted lead's page: it isn't in the pipeline until it's brought back. */
export function DeletedBanner({ leadId }: { leadId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const restore = () =>
    startTransition(async () => {
      setError(null);
      try {
        // The server refresh then renders the page without this banner.
        const r = await restoreLeads([leadId]);
        if (!r.ok) setError(r.error);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  return (
    <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl bg-warn-soft px-4 py-3 text-sm text-ink">
      <Trash2 size={16} aria-hidden className="shrink-0 text-warn" />
      <p className="min-w-0 flex-1">
        <span className="font-semibold">Esta lead está apagada.</span> Não aparece no pipeline nem nas listas.{" "}
        <Link href="/leads/apagadas" className="font-medium underline underline-offset-2">
          Ver apagadas
        </Link>
        {error && <span className="mt-1 block text-bad">{error}</span>}
      </p>
      <button
        type="button"
        onClick={restore}
        disabled={pending}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 font-semibold text-white outline-none transition hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-brand/40 disabled:opacity-60"
      >
        <RotateCcw size={15} aria-hidden /> {pending ? "A recuperar…" : "Recuperar"}
      </button>
    </div>
  );
}
