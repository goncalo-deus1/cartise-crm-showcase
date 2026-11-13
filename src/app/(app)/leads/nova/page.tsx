import { Suspense } from "react";
import { requireMember } from "@/lib/team";
import { LeadForm } from "../lead-form";
import { createLead } from "../actions";

export const metadata = { title: "Nova lead · Cartise CRM" };

export default function NewLeadPage() {
  return (
    <section>
      <div className="mb-5">
        <p className="text-sm text-ink-3">Leads</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Nova lead</h1>
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-2" />}>
        <NewLeadForm />
      </Suspense>
    </section>
  );
}

async function NewLeadForm() {
  const { me, team } = await requireMember();
  return <LeadForm action={createLead} team={team} me={me.email} cancelHref="/leads" />;
}
