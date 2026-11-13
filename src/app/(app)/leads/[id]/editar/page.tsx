import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/team";
import { getLead } from "@/lib/leads";
import { LeadForm } from "../../lead-form";
import { updateLead } from "../../actions";

export const metadata = { title: "Editar lead · Cartise CRM" };

export default function EditLeadPage({ params }: PageProps<"/leads/[id]/editar">) {
  return (
    <section>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-surface-2" />}>
        <EditLead params={params} />
      </Suspense>
    </section>
  );
}

async function EditLead({ params }: { params: PageProps<"/leads/[id]/editar">["params"] }) {
  const { id } = await params;
  const [{ me, team }, lead] = await Promise.all([requireMember(), getLead(id)]);
  if (!lead) notFound();
  return (
    <>
      <div className="mb-5">
        <p className="text-sm text-ink-3">Editar</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">{lead.empresa}</h1>
      </div>
      <LeadForm
        action={updateLead.bind(null, lead.id)}
        lead={lead}
        team={team}
        me={me.email}
        cancelHref={`/leads/${lead.id}`}
      />
    </>
  );
}
