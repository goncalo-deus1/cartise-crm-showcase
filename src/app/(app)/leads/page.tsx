import { Suspense } from "react";
import Link from "next/link";
import { Plus, Trash2, Upload } from "lucide-react";
import { requireMember } from "@/lib/team";
import { getActiveLeads } from "@/lib/leads";
import { todayISO } from "@/lib/dates";
import { LeadsWorkspace } from "../pipeline/workspace";

export const metadata = { title: "Leads · Cartise CRM" };

export default function LeadsPage() {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-3">Leads</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight">Todas as leads</h1>
        </div>
        <div className="flex gap-2">
        <Link
          href="/leads/apagadas"
          aria-label="Leads apagadas"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-3 text-sm font-semibold text-ink-2 transition hover:bg-surface-2 hover:text-ink sm:px-4"
        >
          <Trash2 size={16} aria-hidden /> <span className="hidden sm:inline">Apagadas</span>
        </Link>
        <Link
          href="/leads/importar"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface px-4 text-sm font-semibold text-ink transition hover:bg-surface-2"
        >
          <Upload size={16} aria-hidden /> Importar
        </Link>
        <Link
          href="/leads/nova"
          className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-black/85"
        >
          <Plus size={16} /> Nova lead
        </Link>
        </div>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-2" />}>
        <LeadsData />
      </Suspense>
    </section>
  );
}

async function LeadsData() {
  const [{ me, team }, leads] = await Promise.all([requireMember(), getActiveLeads()]);
  return <LeadsWorkspace leads={leads} team={team} me={me.email} today={todayISO()} />;
}
