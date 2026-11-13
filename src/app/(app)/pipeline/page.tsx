import { Suspense } from "react";
import { requireMember } from "@/lib/team";
import { getActiveLeads } from "@/lib/leads";
import { todayISO } from "@/lib/dates";
import { LeadsWorkspace } from "./workspace";

export const metadata = { title: "Pipeline · Cartise CRM" };

export default function PipelinePage() {
  return (
    <section>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Pipeline</h1>
      </div>
      <Suspense fallback={<BoardSkeleton />}>
        <PipelineData />
      </Suspense>
    </section>
  );
}

async function PipelineData() {
  const [{ me, team }, leads] = await Promise.all([requireMember(), getActiveLeads()]);
  return <LeadsWorkspace leads={leads} team={team} me={me.email} today={todayISO()} withBoard />;
}

function BoardSkeleton() {
  return (
    <div className="space-y-3">
      <div className="h-10 w-full max-w-xl animate-pulse rounded-full bg-surface-2" />
      <div className="h-9 w-80 animate-pulse rounded-full bg-surface-2" />
      <div className="h-96 animate-pulse rounded-3xl bg-surface-2" />
    </div>
  );
}
