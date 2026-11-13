"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowUp,
  Briefcase,
  Building2,
  CalendarClock,
  ChartNoAxesColumnIncreasing,
  Check,
  ChevronDown,
  CircleDot,
  Globe,
  History,
  Link2,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Tag,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { Lead } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { isOpen, SEGMENTS, STAGES, segmentLabel, stageOf, type StageId } from "@/lib/stages";
import { dueLabel, dueState, relativeDate } from "@/lib/dates";
import { formatPhone, telHref } from "@/lib/phone";
import { dueBucket, hasEmail, hasLinkedin, hasPhone, sortLeads, type Sort, type SortKey } from "@/lib/lead-filters";
import { Avatar } from "@/components/avatar";
import { MenuItem, MenuLabel, Popover } from "@/components/popover";
import { StageBadge } from "@/components/ui";
import { CompanyLogo } from "@/components/company-logo";
import { companyDomain } from "@/lib/domain";
import { hostOf } from "@/lib/domain";
import { checkField, EDITABLE_FIELDS, MAX_LENGTH, normalizeUrl, type EditableField } from "@/lib/fields";
import { SHOW_NEXT_STEP } from "@/lib/features";

type Column = {
  id: string;
  label: string;
  icon: LucideIcon;
  width: number;
  sort?: SortKey;
  cell: (l: Lead) => ReactNode;
  /** Small summary in the footer row. */
  footer?: (rows: Lead[]) => string;
};

const DUE_TEXT = {
  overdue: "text-bad",
  today: "text-warn",
  soon: "text-ink",
  later: "text-ink-2",
  none: "text-ink-3",
} as const;

const Empty = () => <span className="text-ink-3">—</span>;
const LINK = "block min-w-0 truncate underline decoration-line-strong underline-offset-2 hover:decoration-ink";
/** Only ever link to http(s), whatever was typed. */
const safeHref = (url: string) => normalizeUrl(url) || undefined;

/** Spreadsheet-style list of leads (Attio-like): sortable columns, stage and owner editable in place. */
export function LeadGrid({
  leads,
  team,
  today,
  sort,
  onSort,
  onMove,
  onAssign,
  onUpdate,
  onUpdateNext,
  selected,
  onSelect,
}: {
  leads: Lead[];
  team: Member[];
  today: string;
  sort: Sort;
  onSort: (s: Sort) => void;
  onMove: (id: string, stage: StageId) => void;
  onAssign: (id: string, email: string | null) => void;
  onUpdate: (id: string, field: EditableField, value: string) => void;
  onUpdateNext: (id: string, acao: string, data: string) => void;
  /** Ids of the ticked rows. */
  selected: string[];
  onSelect: (ids: string[]) => void;
}) {
  const rows = useMemo(
    () => sortLeads(leads, sort, (email) => displayName(team.find((m) => m.email === email))),
    [leads, sort, team],
  );

  const allColumns: Column[] = [
    {
      id: "contacto",
      label: "Contacto",
      icon: User,
      width: 170,
      sort: "contacto",
      cell: (l) => (
        <EditableCell field="contacto_nome" lead={l} onSave={onUpdate} placeholder="Nome do contacto">
          <span className="min-w-0 truncate font-medium text-ink">{l.contacto_nome}</span>
        </EditableCell>
      ),
    },
    {
      id: "cargo",
      label: "Cargo",
      icon: Briefcase,
      width: 160,
      cell: (l) => (
        <EditableCell field="cargo" lead={l} onSave={onUpdate} placeholder="Ex.: Diretora de marketing">
          <span className="min-w-0 truncate text-ink-2">{l.cargo}</span>
        </EditableCell>
      ),
    },
    {
      id: "estado",
      label: "Estado",
      icon: CircleDot,
      width: 140,
      sort: "estado",
      cell: (l) => <StageCell lead={l} onMove={onMove} />,
    },
    {
      id: "progresso",
      label: "Progresso",
      icon: ChartNoAxesColumnIncreasing,
      width: 150,
      sort: "estado",
      cell: (l) => <StageProgress estado={l.estado} />,
      footer: (r) => {
        const n = r.filter((l) => stageOf(l.estado) === "ganho").length;
        return n ? `${n} ganha${n === 1 ? "" : "s"}` : "";
      },
    },
    {
      id: "owner",
      label: "Quem contacta",
      icon: UserRound,
      width: 150,
      sort: "owner",
      cell: (l) => <OwnerCell lead={l} team={team} onAssign={onAssign} />,
      footer: (r) => {
        const n = r.filter((l) => !l.responsavel).length;
        return n ? `${n} sem dono` : "";
      },
    },
    {
      id: "proximo",
      label: "Próximo passo",
      icon: CalendarClock,
      width: 230,
      sort: "proximo",
      cell: (l) => <NextStepCell lead={l} today={today} onSave={onUpdateNext} />,
      footer: (r) => {
        const n = r.filter((l) => dueBucket(l, today) === "overdue").length;
        return n ? `${n} atrasada${n === 1 ? "" : "s"}` : "";
      },
    },
    {
      id: "ultimo",
      label: "Último contacto",
      icon: History,
      width: 140,
      sort: "ultimo",
      cell: (l) => (l.ultimo_contacto ? <span className="text-ink-2">{relativeDate(l.ultimo_contacto, today)}</span> : <Empty />),
    },
    {
      id: "email",
      label: "Email",
      icon: Mail,
      width: 210,
      cell: (l) => (
        <EditableCell field="email" lead={l} onSave={onUpdate} placeholder="nome@empresa.pt" inputMode="email">
          <a href={`mailto:${l.email}`} className={LINK}>
            {l.email}
          </a>
        </EditableCell>
      ),
      footer: (r) => `${r.filter(hasEmail).length} com email`,
    },
    {
      id: "telefone",
      label: "Telefone",
      icon: Phone,
      width: 150,
      cell: (l) => (
        <EditableCell field="telefone" lead={l} onSave={onUpdate} placeholder="912 345 678" inputMode="tel">
          {hasPhone(l) ? (
            <a href={telHref(l.telefone)} className={`${LINK} whitespace-nowrap tabular-nums`}>
              {formatPhone(l.telefone)}
            </a>
          ) : (
            <span className="truncate text-ink-2">{l.telefone}</span>
          )}
        </EditableCell>
      ),
      footer: (r) => `${r.filter(hasPhone).length} com telefone`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      icon: Link2,
      width: 120,
      cell: (l) => (
        <EditableCell field="linkedin_url" lead={l} onSave={onUpdate} placeholder="linkedin.com/in/…" inputMode="url">
          <a href={safeHref(l.linkedin_url)} target="_blank" rel="noopener noreferrer" className={LINK}>
            Ver perfil
          </a>
        </EditableCell>
      ),
      footer: (r) => `${r.filter(hasLinkedin).length} com LinkedIn`,
    },
    {
      id: "website",
      label: "Website",
      icon: Globe,
      width: 160,
      cell: (l) => (
        <EditableCell field="website" lead={l} onSave={onUpdate} placeholder="empresa.pt" inputMode="url">
          <a href={safeHref(l.website)} target="_blank" rel="noopener noreferrer" className={LINK}>
            {hostOf(l.website) ?? l.website}
          </a>
        </EditableCell>
      ),
    },
    {
      id: "segmento",
      label: "Indústria",
      icon: Tag,
      width: 150,
      sort: "segmento",
      cell: (l) => <SegmentCell lead={l} onSave={onUpdate} />,
    },
    {
      id: "cidade",
      label: "Cidade",
      icon: MapPin,
      width: 120,
      sort: "cidade",
      cell: (l) => (
        <EditableCell field="cidade" lead={l} onSave={onUpdate} placeholder="Lisboa">
          <span className="min-w-0 truncate text-ink-2">{l.cidade}</span>
        </EditableCell>
      ),
    },
  ];

  const columns = SHOW_NEXT_STEP ? allColumns : allColumns.filter((c) => c.id !== "proximo");

  const header = (label: string, Icon: LucideIcon, key?: SortKey) => {
    const on = key && sort.key === key;
    const content = (
      <>
        <Icon size={13} aria-hidden className="shrink-0 text-ink-3" />
        <span className="truncate">{label}</span>
        {on && (sort.dir === "asc" ? <ArrowUp size={13} aria-hidden /> : <ArrowDown size={13} aria-hidden />)}
      </>
    );
    if (!key) return <span className="flex items-center gap-1.5">{content}</span>;
    return (
      <button
        type="button"
        onClick={() => onSort(sort.key === key ? { key, dir: sort.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })}
        className={`flex w-full items-center gap-1.5 text-left hover:text-ink ${on ? "text-ink" : ""}`}
      >
        {content}
      </button>
    );
  };
  const ariaSort = (key?: SortKey) =>
    key && sort.key === key ? (sort.dir === "asc" ? "ascending" : "descending") : undefined;

  // An inset shadow, not a border: collapsed table borders don't move with a sticky cell.
  const CHECK = 40;
  const FIRST = 220;
  const stickyCheck = "sticky left-0 z-[2]";
  const sticky = "sticky left-[40px] z-[2] shadow-[inset_-1px_0_0_var(--color-line)]";
  const totalWidth = CHECK + FIRST + columns.reduce((n, c) => n + c.width, 0);
  const picked = new Set(selected);
  const allPicked = rows.length > 0 && rows.every((l) => picked.has(l.id));
  const somePicked = !allPicked && rows.some((l) => picked.has(l.id));
  const toggle = (id: string) => onSelect(picked.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <>
      {/* Tablet and desktop: the table */}
      <div className="hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <div className="overflow-x-auto">
          <table className="table-fixed border-collapse text-left text-[13px]" style={{ width: totalWidth, minWidth: "100%" }}>
            <colgroup>
              <col style={{ width: CHECK }} />
              <col style={{ width: FIRST }} />
              {columns.map((c) => (
                <col key={c.id} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr className="h-9 border-b border-line text-xs font-medium text-ink-2">
                <td className={`${stickyCheck} bg-surface pl-3.5`}>
                  <Checkbox
                    checked={allPicked}
                    indeterminate={somePicked}
                    label={allPicked ? "Desmarcar todas as leads" : "Selecionar todas as leads"}
                    onChange={() => onSelect(allPicked ? [] : rows.map((l) => l.id))}
                  />
                </td>
                <th scope="col" aria-sort={ariaSort("empresa")} className={`${sticky} bg-surface px-3 font-medium`}>
                  {header("Empresa", Building2, "empresa")}
                </th>
                {columns.map((c) => (
                  <th key={c.id} scope="col" aria-sort={ariaSort(c.sort)} className="border-r border-line px-3 font-medium last:border-r-0">
                    {header(c.label, c.icon, c.sort)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => {
                const on = picked.has(l.id);
                const bg = on ? "bg-brand-softer" : "bg-surface group-hover:bg-surface-2";
                return (
                <tr
                  key={l.id}
                  className={`group h-9 border-b border-line ${on ? "bg-brand-softer" : "hover:bg-surface-2"}`}
                >
                  <td className={`${stickyCheck} ${bg} pl-3.5`}>
                    <Checkbox
                      checked={on}
                      label={`Selecionar ${l.empresa} · ${l.contacto_nome || "sem contacto"}`}
                      onChange={() => toggle(l.id)}
                    />
                  </td>
                  <th scope="row" aria-label={l.empresa} className={`${sticky} ${bg} pl-3 pr-2 font-normal`}>
                    <EditableCell field="empresa" lead={l} onSave={onUpdate} placeholder="Nome da empresa">
                      <Link
                        href={`/leads/${l.id}`}
                        className="flex min-w-0 items-center gap-1.5 rounded-md border border-line bg-surface py-0.5 pl-1 pr-2 hover:border-line-strong"
                      >
                        <CompanyLogo name={l.empresa} domain={companyDomain(l)} size={18} />
                        <span className="truncate font-medium text-ink">{l.empresa}</span>
                      </Link>
                    </EditableCell>
                  </th>
                  {columns.map((c) => (
                    <td key={c.id} className="overflow-hidden border-r border-line px-2.5 last:border-r-0">
                      {c.cell(l)}
                    </td>
                  ))}
                </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 2} className="px-4 py-12 text-ink-2">
                    Nenhuma lead com estes filtros.
                  </td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr className="h-9 text-xs text-ink-2">
                  <td className={`${stickyCheck} bg-surface`} />
                  <td className={`${sticky} bg-surface px-3`}>
                    <span className="font-semibold tabular-nums text-ink">{rows.length}</span>{" "}
                    {rows.length === 1 ? "lead" : "leads"}
                  </td>
                  {columns.map((c) => (
                    <td key={c.id} className="truncate border-r border-line px-3 tabular-nums last:border-r-0">
                      {c.footer?.(rows)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Phones: a compact list */}
      <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface md:hidden">
        {rows.map((l) => {
          const s = STAGES.find((x) => x.id === stageOf(l.estado))!;
          const owner = team.find((m) => m.email === l.responsavel);
          return (
            <li key={l.id}>
              <Link href={`/leads/${l.id}`} className="flex items-center gap-3 px-4 py-3.5">
                <CompanyLogo name={l.empresa} domain={companyDomain(l)} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{l.empresa}</p>
                  <p className="flex items-center gap-1.5 truncate text-[13px] text-ink-3">
                    <Avatar member={owner} team={team} size={16} />
                    {l.contacto_nome || "Sem contacto"}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StageBadge label={s.label} dot={s.dot} />
                  {SHOW_NEXT_STEP && l.proxima_data && isOpen(l.estado) && (
                    <span className={`text-xs font-medium ${DUE_TEXT[dueState(l.proxima_data, today)]}`}>
                      {dueLabel(l.proxima_data, today)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
        {rows.length === 0 && <li className="px-4 py-10 text-center text-sm text-ink-2">Nenhuma lead com estes filtros.</li>}
      </ul>
    </>
  );
}

function StageCell({ lead, onMove }: { lead: Lead; onMove: (id: string, stage: StageId) => void }) {
  const current = stageOf(lead.estado);
  const s = STAGES.find((x) => x.id === current)!;
  return (
    <Popover
      align="left"
      label={`Estado de ${lead.empresa}: ${s.label}. Mudar`}
      title={lead.empresa}
      trigger={
        <>
          <StageBadge label={s.label} dot={s.dot} compact />
          <ChevronDown size={13} aria-hidden className="text-ink-3 opacity-0 transition group-hover:opacity-100" />
        </>
      }
      className="flex items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {(close) => (
        <>
          <MenuLabel>Mover para</MenuLabel>
          {STAGES.map((x) => (
            <MenuItem
              key={x.id}
              active={x.id === current}
              onSelect={() => {
                onMove(lead.id, x.id);
                close();
              }}
            >
              <span className={`size-2 rounded-full ${x.dot}`} />
              <span className="flex-1">{x.label}</span>
              {x.id === current && <Check size={14} />}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function OwnerCell({
  lead,
  team,
  onAssign,
}: {
  lead: Lead;
  team: Member[];
  onAssign: (id: string, email: string | null) => void;
}) {
  const owner = team.find((m) => m.email === lead.responsavel) ?? null;
  return (
    <Popover
      align="left"
      label={`Quem contacta ${lead.empresa}: ${owner ? displayName(owner) : "sem dono"}. Mudar`}
      title={lead.empresa}
      trigger={
        <>
          <Avatar member={owner} team={team} size={18} />
          <span className={`truncate ${owner ? "text-ink" : "text-ink-3"}`}>{owner ? displayName(owner) : "Sem dono"}</span>
          <ChevronDown size={13} aria-hidden className="shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100" />
        </>
      }
      className="flex max-w-full items-center gap-1.5 rounded-full py-0.5 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {(close) => (
        <>
          <MenuLabel>Quem contacta</MenuLabel>
          {[...team, null].map((m) => (
            <MenuItem
              key={m?.email ?? "none"}
              active={(m?.email ?? null) === lead.responsavel}
              onSelect={() => {
                onAssign(lead.id, m?.email ?? null);
                close();
              }}
            >
              <Avatar member={m} team={team} size={20} />
              <span className="flex-1">{m ? displayName(m) : "Sem dono"}</span>
              {(m?.email ?? null) === lead.responsavel && <Check size={14} />}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

function Checkbox({
  checked,
  indeterminate = false,
  label,
  onChange,
}: {
  checked: boolean;
  indeterminate?: boolean;
  label: string;
  onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={label}
      className="size-3.5 shrink-0 cursor-pointer rounded accent-ink"
    />
  );
}

/**
 * A value that can be edited in place: the pencil (on hover, keyboard focus, or always on
 * touch screens) turns it into a text field; empty cells offer "Adicionar". Enter saves
 * (invalid values stay open with the reason), Escape cancels, clicking away saves.
 */
function EditableCell({
  field,
  lead,
  onSave,
  placeholder,
  inputMode,
  children,
}: {
  field: EditableField;
  lead: Lead;
  onSave: (id: string, field: EditableField, value: string) => void;
  placeholder: string;
  inputMode?: "email" | "tel" | "url";
  /** How the value looks when it's set. */
  children: ReactNode;
}) {
  const value = String(lead[field] ?? "");
  const label = `${EDITABLE_FIELDS[field].toLowerCase()} de ${lead.empresa}`;
  const [editing, setEditing] = useState(false);
  // The message is drawn in a portal next to the field: the cell itself clips overflow.
  const [error, setError] = useState<{ text: string; top: number; left: number; input: HTMLInputElement } | null>(
    null,
  );
  // Keep the message under the field while the page or table scrolls.
  useEffect(() => {
    if (!error) return;
    const follow = () =>
      setError((e) => {
        if (!e) return e;
        const r = e.input.getBoundingClientRect();
        return { ...e, top: r.bottom + 6, left: r.left };
      });
    window.addEventListener("scroll", follow, true);
    return () => window.removeEventListener("scroll", follow, true);
  }, [error]);
  const done = useRef(false);
  const opener = useRef<HTMLButtonElement>(null);
  const errorId = useId();

  const open = () => {
    done.current = false;
    setError(null);
    setEditing(true);
  };
  const finish = (next: string | null, refocus: boolean, input?: HTMLInputElement) => {
    if (done.current) return;
    if (next !== null && next.trim() !== value && input) {
      // Check first, and keep the field open with the reason if it's wrong (only Escape discards).
      const check = checkField(field, next);
      if (!check.ok) {
        const r = input.getBoundingClientRect();
        return setError({ text: check.error, top: r.bottom + 6, left: r.left, input });
      }
    }
    done.current = true;
    setEditing(false);
    setError(null);
    if (next !== null && next.trim() !== value) onSave(lead.id, field, next);
    // Back to the button after Enter / Escape; after a click elsewhere, leave focus there.
    if (refocus) setTimeout(() => opener.current?.focus({ preventScroll: true }), 60);
  };

  if (editing) {
    return (
      <span className="relative block w-full">
        <input
          ref={(el) => {
            if (el && !done.current && document.activeElement !== el) {
              el.focus();
              el.select();
            }
          }}
          defaultValue={value}
          maxLength={MAX_LENGTH[field]}
          inputMode={inputMode}
          autoComplete="off"
          spellCheck={false}
          aria-label={`Editar ${label}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          placeholder={placeholder}
          onChange={() => {
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              finish(e.currentTarget.value, true, e.currentTarget);
            } else if (e.key === "Escape") {
              e.preventDefault();
              finish(null, true);
            }
          }}
          onBlur={(e) => {
            // Switching window or tab (e.g. to copy a link) keeps the field open.
            if (!document.hasFocus()) return;
            finish(e.currentTarget.value, false, e.currentTarget);
          }}
          className={`h-7 w-full min-w-0 rounded-md border bg-surface px-2 text-[13px] text-ink outline-none ring-4 ${
            error ? "border-bad ring-bad/15" : "border-brand ring-brand/20"
          }`}
        />
        {error &&
          createPortal(
            <span
              id={errorId}
              role="alert"
              style={{ top: error.top, left: error.left }}
              className="fixed z-50 w-max max-w-[280px] rounded-lg bg-bad px-2.5 py-1.5 text-xs font-medium text-white shadow-lg"
            >
              {error.text}
            </span>,
            document.body,
          )}
      </span>
    );
  }

  if (!value) {
    return (
      <button
        ref={opener}
        type="button"
        onClick={open}
        aria-label={`Adicionar ${label}`}
        className="group/add flex h-7 w-full items-center gap-1 rounded-md text-left text-ink-3 outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="group-hover/add:hidden group-focus-visible/add:hidden [@media(hover:none)]:hidden">—</span>
        <span className="hidden items-center gap-1 text-xs font-medium group-hover/add:flex group-focus-visible/add:flex [@media(hover:none)]:flex">
          <Plus size={13} aria-hidden /> Adicionar
        </span>
      </button>
    );
  }

  return (
    <span className="group/edit flex min-w-0 flex-1 items-center justify-between gap-1">
      {children}
      <button
        ref={opener}
        type="button"
        aria-label={`Editar ${label}`}
        title="Editar"
        onClick={open}
        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover/edit:opacity-100 group-focus-within/edit:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Pencil size={12} aria-hidden />
      </button>
    </span>
  );
}

/** Next step: date + what to do, edited together. Both empty removes it. */
function NextStepCell({
  lead,
  today,
  onSave,
}: {
  lead: Lead;
  today: string;
  onSave: (id: string, acao: string, data: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const form = useRef<HTMLSpanElement>(null);
  const done = useRef(false);
  const active = Boolean(lead.proxima_data || lead.proxima_acao) && isOpen(lead.estado);

  const [dateError, setDateError] = useState(false);
  const finish = (save: boolean, refocus: boolean) => {
    if (done.current || !form.current) return;
    const [dateInput, textInput] = [...form.current.querySelectorAll("input")];
    // A half-typed date reads as "": don't let it silently wipe the date.
    if (save && dateInput.validity.badInput) {
      setDateError(true);
      if (refocus) dateInput.focus();
      return;
    }
    done.current = true;
    setEditing(false);
    setDateError(false);
    if (save) onSave(lead.id, textInput.value, dateInput.value);
    if (refocus) setTimeout(() => opener.current?.focus({ preventScroll: true }), 60);
  };
  const keys = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish(true, true);
    } else if (e.key === "Escape") {
      e.preventDefault();
      finish(false, true);
    }
  };

  if (editing) {
    return (
      <span
        ref={form}
        role="group"
        aria-label={`Próximo passo de ${lead.empresa}`}
        className="flex items-center gap-1"
        onBlur={() => {
          // Save when focus leaves both fields (checked after the move settles, so the date
          // picker or switching window doesn't count).
          requestAnimationFrame(() => {
            if (!document.hasFocus()) return;
            if (!form.current?.contains(document.activeElement)) finish(true, false);
          });
        }}
      >
        <input
          type="date"
          defaultValue={lead.proxima_data ?? ""}
          aria-label={`Data do próximo passo de ${lead.empresa}`}
          aria-invalid={dateError || undefined}
          title={dateError ? "Data incompleta" : undefined}
          onChange={() => setDateError(false)}
          onKeyDown={keys}
          ref={(el) => {
            if (el && !done.current && !form.current?.contains(document.activeElement)) el.focus();
          }}
          className={`h-7 w-[118px] shrink-0 rounded-md border bg-surface px-1.5 text-xs text-ink outline-none ring-4 ${
            dateError ? "border-bad ring-bad/15" : "border-brand ring-brand/20"
          }`}
        />
        <input
          defaultValue={lead.proxima_acao}
          maxLength={300}
          placeholder="O que fazer"
          aria-label={`Próximo passo de ${lead.empresa}`}
          onKeyDown={keys}
          className="h-7 w-full min-w-0 rounded-md border border-brand bg-surface px-2 text-[13px] text-ink outline-none ring-4 ring-brand/20"
        />
      </span>
    );
  }

  const start = () => {
    done.current = false;
    setDateError(false);
    setEditing(true);
  };

  if (!active) {
    return (
      <button
        ref={opener}
        type="button"
        onClick={start}
        aria-label={`Marcar próximo passo de ${lead.empresa}`}
        className="group/add flex h-7 w-full items-center gap-1 rounded-md text-left text-ink-3 outline-none hover:bg-surface focus-visible:ring-2 focus-visible:ring-brand/40"
      >
        <span className="group-hover/add:hidden group-focus-visible/add:hidden [@media(hover:none)]:hidden">—</span>
        <span className="hidden items-center gap-1 text-xs font-medium group-hover/add:flex group-focus-visible/add:flex [@media(hover:none)]:flex">
          <Plus size={13} aria-hidden /> Marcar
        </span>
      </button>
    );
  }

  return (
    <span className="group/edit flex min-w-0 flex-1 items-center justify-between gap-1">
      <span className={`flex min-w-0 items-center gap-1.5 ${DUE_TEXT[dueState(lead.proxima_data, today)]}`}>
        {lead.proxima_data && <span className="shrink-0 font-medium">{dueLabel(lead.proxima_data, today)}</span>}
        {lead.proxima_acao && (
          <span className="truncate text-ink-2">
            {lead.proxima_data && "· "}
            {lead.proxima_acao}
          </span>
        )}
      </span>
      <button
        ref={opener}
        type="button"
        aria-label={`Editar próximo passo de ${lead.empresa}`}
        title="Editar"
        onClick={start}
        className="grid size-6 shrink-0 place-items-center rounded-md text-ink-3 opacity-0 transition hover:bg-surface hover:text-ink focus-visible:opacity-100 group-hover/edit:opacity-100 group-focus-within/edit:opacity-100 [@media(hover:none)]:opacity-100"
      >
        <Pencil size={12} aria-hidden />
      </button>
    </span>
  );
}

function SegmentCell({
  lead,
  onSave,
}: {
  lead: Lead;
  onSave: (id: string, field: EditableField, value: string) => void;
}) {
  return (
    <Popover
      align="left"
      label={`Indústria de ${lead.empresa}: ${segmentLabel(lead.segmento)}. Mudar`}
      title={lead.empresa}
      trigger={
        <>
          <span className="truncate text-ink-2">{segmentLabel(lead.segmento)}</span>
          <ChevronDown size={13} aria-hidden className="shrink-0 text-ink-3 opacity-0 transition group-hover:opacity-100" />
        </>
      }
      className="flex max-w-full items-center gap-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-brand/40"
    >
      {(close) => (
        <>
          <MenuLabel>Indústria</MenuLabel>
          {Object.entries(SEGMENTS).map(([id, label]) => (
            <MenuItem
              key={id}
              active={id === lead.segmento}
              onSelect={() => {
                onSave(lead.id, "segmento", id);
                close();
              }}
            >
              <span className="flex-1">{label}</span>
              {id === lead.segmento && <Check size={14} />}
            </MenuItem>
          ))}
        </>
      )}
    </Popover>
  );
}

/** The open path a deal walks, in order (Referido sits level with Respondeu). */
const PATH: StageId[] = ["novo", "em_sequencia", "respondeu", "reuniao", "proposta", "ganho"];
const STEP: Partial<Record<StageId, number>> = { referido: 3 };

/** How far along the pipeline a lead is: a thin bar plus "3/6". Lost deals show an empty bar. */
export function StageProgress({ estado }: { estado: string }) {
  const stage = stageOf(estado);
  const label = STAGES.find((x) => x.id === stage)!.label;
  if (stage === "perdido") {
    return (
      <span role="img" aria-label="Progresso: perdido" className="flex items-center gap-2">
        <span className="h-1.5 flex-1 rounded-full bg-bad-soft" />
        <span className="w-7 text-right text-xs font-medium text-bad">—</span>
      </span>
    );
  }
  const step = STEP[stage] ?? PATH.indexOf(stage) + 1;
  const total = PATH.length;
  const fill = stage === "ganho" ? "bg-ok" : "bg-brand";
  return (
    <span role="img" aria-label={`Progresso: ${label}, passo ${step} de ${total}`} className="flex items-center gap-2">
      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
        <span className={`block h-full rounded-full ${fill}`} style={{ width: `${(step / total) * 100}%` }} />
      </span>
      <span className="w-7 text-right text-xs tabular-nums text-ink-2">
        {step}/{total}
      </span>
    </span>
  );
}
