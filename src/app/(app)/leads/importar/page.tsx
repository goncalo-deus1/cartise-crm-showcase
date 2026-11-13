import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireMember } from "@/lib/team";
import { Importer } from "./importer";

export const metadata = { title: "Importar folha · Cartise CRM" };

export default function ImportPage() {
  return (
    <section>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={16} /> Leads
      </Link>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Importar contactos</h1>
        <p className="mt-1 text-sm text-ink-2">
          Carrega uma folha Excel ou CSV. Contactos que já estão no CRM são ignorados.
        </p>
      </div>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-3xl bg-surface-2" />}>
        <ImportData />
      </Suspense>
    </section>
  );
}

async function ImportData() {
  const { me, team } = await requireMember();
  return <Importer team={team} me={me.email} />;
}
