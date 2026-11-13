import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/lib/team";
import { getArchivedLeads } from "@/lib/leads";
import { todayISO } from "@/lib/dates";
import { DeletedList } from "./deleted-list";

export const metadata = { title: "Apagadas · Cartise CRM" };

export default function DeletedLeadsPage() {
  return (
    <section className="max-w-4xl">
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={16} aria-hidden /> Leads
      </Link>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Leads apagadas</h1>
        <p className="mt-1 text-sm text-ink-2">
          Não aparecem no pipeline nem nas listas. Recupera uma para a pôr de volta, com o histórico todo.
        </p>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-2" />}>
        <DeletedData />
      </Suspense>
    </section>
  );
}

async function DeletedData() {
  const [, leads] = await Promise.all([requireMember(), getArchivedLeads()]);
  return <DeletedList leads={leads} today={todayISO()} />;
}
