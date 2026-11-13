import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireMember } from "@/lib/team";
import { getActiveLeads, type Lead } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { stageOf, type StageId } from "@/lib/stages";
import { todayISO } from "@/lib/dates";
import { Card } from "@/components/ui";
import { Unassigned } from "./unassigned";
import { Companies } from "./companies";
import { groupCompanies, industryStats } from "@/lib/companies";

const IN_CONVERSATION: StageId[] = ["respondeu", "referido", "reuniao", "proposta"];
const CLOSED: StageId[] = ["ganho", "perdido"];

export default function OverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const [{ me, team }, leads] = await Promise.all([requireMember(), getActiveLeads()]);
  return <OverviewView me={me} team={team} leads={leads} today={todayISO()} now={new Date()} />;
}

/** Pure view, also used by the /dev sample preview. */
export function OverviewView({
  me,
  team,
  leads,
  today,
  now,
  demo = false,
}: {
  me: Member;
  team: Member[];
  leads: Lead[];
  today: string;
  now: Date;
  demo?: boolean;
}) {
  const by = (s: StageId[]) => leads.filter((l) => s.includes(stageOf(l.estado))).length;
  const companies = groupCompanies(leads);
  const unassigned = leads.filter((l) => !l.responsavel && !CLOSED.includes(stageOf(l.estado)));
  const dateLabel = new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Lisbon",
  }).format(now);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-ink-3 first-letter:uppercase">{dateLabel}</p>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Olá, {displayName(me)}</h1>
      </div>

      <div className="grid grid-cols-4 gap-2 md:gap-3">
        <Stat label="Ativas" value={leads.length - by(CLOSED)} />
        <Stat label="Por contactar" value={by(["novo"])} href="/pipeline" />
        <Stat label="Em conversa" value={by(IN_CONVERSATION)} />
        <Stat label="Ganhas" value={by(["ganho"])} accent />
      </div>

      {unassigned.length > 0 && (
        <Card className="border-[1.5px] border-dashed border-ink-3/40">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="unassigned-title" tabIndex={-1} className="font-display text-lg font-semibold outline-none">
                Quem fica com estas?
              </h2>
              <p className="text-sm text-ink-2">
                {unassigned.length} {unassigned.length === 1 ? "lead ainda não tem" : "leads ainda não têm"} dono.
              </p>
            </div>
          </div>
          <Unassigned
            leads={unassigned.map((l) => ({ id: l.id, empresa: l.empresa, contacto: l.contacto_nome, segmento: l.segmento }))}
            team={team}
            me={me.email}
            demo={demo}
          />
        </Card>
      )}

      <Companies companies={companies} industries={industryStats(companies)} team={team} today={today} />
    </div>
  );
}

function Stat({ label, value, href, accent }: { label: string; value: number; href?: string; accent?: boolean }) {
  const body = (
    <>
      <p className={`flex items-center gap-1 text-[11px] leading-tight md:text-sm ${accent ? "text-white/75" : "text-ink-2"}`}>
        {label}
        {href && <ArrowRight size={14} className="hidden md:block" aria-hidden />}
      </p>
      <p className="mt-1 font-display text-2xl font-semibold tabular-nums tracking-tight md:text-4xl">{value}</p>
    </>
  );
  const cls = `block rounded-2xl p-3 transition md:rounded-3xl md:p-5 ${accent ? "bg-ink text-white" : "bg-surface"} ${
    href ? "hover:shadow-[0_6px_20px_rgba(0,0,0,.06)]" : ""
  }`;
  return href ? (
    <Link href={href} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-14 w-64 animate-pulse rounded-xl bg-surface-2" />
      <div className="grid grid-cols-4 gap-2 md:gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-2xl bg-surface-2 md:h-28 md:rounded-3xl" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-3xl bg-surface-2" />
    </div>
  );
}
