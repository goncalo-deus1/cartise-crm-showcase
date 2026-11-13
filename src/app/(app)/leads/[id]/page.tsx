import { Suspense, type ReactNode } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { companyDomain } from "@/lib/domain";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, Link2, Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { e164, formatPhone, telHref, whatsappHref } from "@/lib/phone";
import { requireMember } from "@/lib/team";
import { getLead, getTimeline, type TimelineItem } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { ORIGINS, segmentLabel, stageOf, STAGES } from "@/lib/stages";
import { relativeDate, shortDate, todayISO } from "@/lib/dates";
import { Card, StageBadge } from "@/components/ui";
import { LeadControls, NextAction, NoteForm } from "./controls";
import { QuickLog } from "@/components/quick-log";
import { DeletedBanner } from "./deleted-banner";

export const metadata = { title: "Lead · Cartise CRM" };

export default function LeadPage({ params }: PageProps<"/leads/[id]">) {
  return (
    <section>
      <Link href="/leads" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-2 hover:text-ink">
        <ArrowLeft size={16} /> Leads
      </Link>
      <Suspense fallback={<div className="h-[480px] animate-pulse rounded-3xl bg-surface-2" />}>
        <LeadDetail params={params} />
      </Suspense>
    </section>
  );
}

function externalUrl(v: string) {
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

async function LeadDetail({ params }: { params: PageProps<"/leads/[id]">["params"] }) {
  const { id } = await params;
  const [{ team }, lead, timeline] = await Promise.all([requireMember(), getLead(id), getTimeline(id)]);
  if (!lead) notFound();

  const stage = STAGES.find((s) => s.id === stageOf(lead.estado))!;
  const today = todayISO();
  const phone = e164(lead.telefone); // "" when missing or not a usable number

  return (
    <div className="space-y-5">
      {lead.arquivado && <DeletedBanner leadId={lead.id} />}
      <Card className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 gap-4">
          <CompanyLogo name={lead.empresa} domain={companyDomain(lead)} size={56} />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">{lead.empresa}</h1>
              <StageBadge label={stage.label} dot={stage.dot} />
            </div>
            <p className="mt-1 text-ink-2">
              {lead.contacto_nome || "Sem contacto"}
              {lead.cargo && <span className="text-ink-3"> · {lead.cargo}</span>}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {phone && (
                <InfoLink href={telHref(phone)} icon={<Phone size={15} />}>
                  {formatPhone(lead.telefone)}
                </InfoLink>
              )}
              {lead.email && (
                <InfoLink href={`mailto:${lead.email}`} icon={<Mail size={15} />}>
                  {lead.email}
                </InfoLink>
              )}
              {lead.website && (
                <InfoLink href={externalUrl(lead.website)} icon={<Globe size={15} />} external>
                  {lead.website.replace(/^https?:\/\//, "")}
                </InfoLink>
              )}
              {lead.linkedin_url && (
                <InfoLink href={externalUrl(lead.linkedin_url)} icon={<Link2 size={15} />} external>
                  LinkedIn
                </InfoLink>
              )}
              {lead.cidade && (
                <span className="flex items-center gap-1.5 text-ink-2">
                  <MapPin size={15} /> {lead.cidade}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 self-start">
          {phone ? (
            <>
              <a
                href={telHref(phone)}
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                <Phone size={15} aria-hidden /> Ligar
              </a>
              <a
                href={whatsappHref(phone)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#25D366] px-4 text-sm font-semibold text-ink transition hover:brightness-95"
              >
                <MessageCircle size={15} aria-hidden /> WhatsApp
              </a>
            </>
          ) : (
            <Link
              href={`/leads/${lead.id}/editar`}
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-dashed border-line-strong px-4 text-sm font-medium text-ink-2 transition hover:border-ink hover:text-ink"
            >
              <Phone size={15} aria-hidden /> Adicionar telefone
            </Link>
          )}
          <Link
            href={`/leads/${lead.id}/editar`}
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-surface-2 px-4 text-sm font-semibold text-ink transition hover:bg-line"
          >
            <Pencil size={15} aria-hidden /> Editar
          </Link>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold">Histórico</h2>
          <NoteForm id={lead.id} />
          <Timeline items={timeline} team={team} />
        </Card>

        {/* On phones, who/what/next comes before the long history. */}
        <div className="order-first space-y-5 lg:order-none">
          <Card>
            <QuickLog leadId={lead.id} />
          </Card>
          <Card>
            <LeadControls id={lead.id} estado={lead.estado} responsavel={lead.responsavel} team={team} />
          </Card>
          <Card>
            <NextAction
              id={lead.id}
              acao={lead.proxima_acao}
              data={lead.proxima_data}
              today={today}
            />
          </Card>
          <Card>
            <h2 className="mb-3 font-display text-lg font-semibold">Detalhes</h2>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 text-sm">
              <Detail label="Segmento">{segmentLabel(lead.segmento)}</Detail>
              <Detail label="Origem">{ORIGINS[lead.origem] ?? (lead.origem || "—")}</Detail>
              <Detail label="Último contacto">{lead.ultimo_contacto ? relativeDate(lead.ultimo_contacto, today) : "—"}</Detail>
              <Detail label="Criada">{shortDate(lead.criado_em)}</Detail>
            </dl>
            {lead.notas && (
              <p className="mt-4 whitespace-pre-line rounded-2xl bg-surface-2 p-3.5 text-sm text-ink-2">{lead.notas}</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function InfoLink({
  href,
  icon,
  external,
  children,
}: {
  href: string;
  icon: ReactNode;
  external?: boolean;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="flex min-w-0 items-center gap-1.5 font-medium text-ink hover:text-brand"
    >
      <span className="text-ink-3">{icon}</span>
      <span className="truncate">{children}</span>
    </a>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </>
  );
}

const TAG_LABEL: Record<string, string> = {
  nota: "Nota",
  contacto: "Contacto",
  estado: "Estado",
  responsavel: "Responsável",
  criado: "Criada",
  editado: "Editada",
  importacao: "Importação",
  seguimento: "Próximo passo",
  arquivado: "Arquivo",
  email: "Email",
  linkedin: "LinkedIn",
};

function authorName(author: string, team: Member[]) {
  const m = team.find((t) => t.email.toLowerCase() === author.toLowerCase());
  if (m) return displayName(m);
  if (author === "motor") return "Automático";
  if (author === "importacao") return "Importação";
  return author;
}

function Timeline({ items, team }: { items: TimelineItem[]; team: Member[] }) {
  if (items.length === 0) return <p className="mt-6 text-sm text-ink-3">Ainda sem histórico.</p>;
  return (
    <ol className="mt-6 space-y-4 border-l-2 border-line pl-5">
      {items.map((it) => (
        <li key={it.id} className="relative">
          <span
            className={`absolute -left-[27px] top-1.5 size-3 rounded-full border-2 border-surface ${
              it.kind === "message" ? "bg-brand" : it.tag === "contacto" ? "bg-ok" : "bg-ink-3"
            }`}
          />
          <div className="flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            <span className="font-semibold text-ink-2">{TAG_LABEL[it.tag] ?? it.tag}</span>
            <span>·</span>
            <span>{it.kind === "message" ? it.author : authorName(it.author, team)}</span>
            <span>·</span>
            <time dateTime={it.date}>{shortDate(it.date)}</time>
          </div>
          <p className="mt-0.5 text-sm font-medium text-ink">{it.title}</p>
          {it.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-2">{it.body}</p>}
        </li>
      ))}
    </ol>
  );
}
