"use client";

import { useActionState, useEffect, useId, useOptimistic, useRef, useState, useTransition } from "react";
import { displayName, type Member } from "@/lib/names";
import { STAGES, stageOf, type StageId } from "@/lib/stages";
import { isNextRedirect } from "@/lib/errors";
import { Avatar } from "@/components/avatar";
import { PrimaryButton, inputClass } from "@/components/ui";
import { moveLead, setOwner } from "../../actions";
import { addNote, setNextAction, type FormState } from "../actions";
import { addDays, dueLabel, dueState } from "@/lib/dates";
import { CalendarClock } from "lucide-react";

const pill = (active: boolean) =>
  `flex items-center gap-2 rounded-full border py-1.5 text-sm font-medium transition ${
    active ? "border-ink bg-ink text-white" : "border-line-strong text-ink-2 hover:border-ink hover:text-ink"
  }`;

/** Owner + stage pickers that save immediately (buttons, so arrow keys never save by accident). */
export function LeadControls({
  id,
  estado,
  responsavel,
  team,
}: {
  id: string;
  estado: string;
  responsavel: string | null;
  team: Member[];
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useOptimistic({ estado: stageOf(estado), responsavel });
  const [error, setError] = useState<string | null>(null);
  const ownerLabel = useId();
  const stageLabel = useId();
  const owner = team.find((m) => m.email === state.responsavel);

  const save = (patch: Partial<typeof state>, action: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      setState((s) => ({ ...s, ...patch }));
      try {
        const result = await action();
        if (!result.ok) setError(result.error ?? "Algo correu mal.");
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError("Sem ligação ao servidor. Tenta outra vez.");
      }
    });

  return (
    <div className="space-y-5" aria-busy={pending}>
      <div>
        <p id={ownerLabel} className="mb-2 text-sm font-medium text-ink-2">
          Quem contacta
        </p>
        <div role="group" aria-labelledby={ownerLabel} className="flex flex-wrap gap-2">
          {[...team, null].map((m) => {
            const value = m?.email ?? null;
            const active = value === state.responsavel;
            return (
              <button
                key={value ?? "none"}
                type="button"
                aria-pressed={active}
                onClick={() => !active && save({ responsavel: value }, () => setOwner(id, value))}
                className={`${pill(active)} pl-1.5 pr-3.5`}
              >
                <Avatar member={m} team={team} size={24} />
                {displayName(m)}
              </button>
            );
          })}
        </div>
        {!owner && <p className="mt-2 text-xs text-warn">Ninguém ficou com esta lead ainda.</p>}
      </div>
      <div>
        <p id={stageLabel} className="mb-2 text-sm font-medium text-ink-2">
          Estado
        </p>
        <div role="group" aria-labelledby={stageLabel} className="flex flex-wrap gap-1.5">
          {STAGES.map((s) => {
            const active = s.id === state.estado;
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={active}
                onClick={() => !active && save({ estado: s.id as StageId }, () => moveLead(id, s.id))}
                className={`${pill(active)} px-3`}
              >
                <span className={`size-2 rounded-full ${s.dot}`} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-bad-soft px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}
    </div>
  );
}

export function NoteForm({ id }: { id: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState((prev: FormState, fd: FormData) => addNote(id, prev, fd), {});
  const textId = useId();
  const message = state.fieldErrors?.texto ?? state.error;

  useEffect(() => {
    if (message) formRef.current?.querySelector("textarea")?.focus();
  }, [state.attempt, message]);

  return (
    <form ref={formRef} key={state.attempt ?? 0} action={action} className="space-y-3">
      <label className="block">
        <span className="sr-only">Nova nota</span>
        <textarea
          name="texto"
          rows={3}
          defaultValue={state.values?.texto ?? ""}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? textId : undefined}
          placeholder="O que aconteceu? Ex.: liguei, pediu proposta para dezembro…"
          className={`${inputClass} h-auto py-2.5`}
        />
      </label>
      {message && (
        <p id={textId} role="alert" className="text-sm text-bad">
          {message}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink-2">
          <input
            type="checkbox"
            name="contacto"
            defaultChecked={state.values?.contacto === "on"}
            className="size-5 accent-[var(--brand)]"
          />
          Foi um contacto (atualiza “último contacto”)
        </label>
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "A guardar…" : "Adicionar"}
        </PrimaryButton>
      </div>
    </form>
  );
}

/** Next step, editable in place with quick date picks. */
export function NextAction({
  id,
  acao,
  data,
  today,
}: {
  id: string;
  acao: string;
  data: string | null;
  today: string;
}) {
  const [state, action, pending] = useActionState(
    (prev: FormState, fd: FormData) => setNextAction(id, prev, fd),
    {},
  );
  const dateRef = useRef<HTMLInputElement>(null);
  const errId = useId();
  const due = dueState(data, today);
  const message = state.fieldErrors?.proxima_acao ?? state.error;
  const quick = [
    { label: "Hoje", days: 0 },
    { label: "Amanhã", days: 1 },
    { label: "+3 dias", days: 3 },
    { label: "+1 semana", days: 7 },
  ];

  return (
    <div>
      <h2 className="mb-3 font-display text-lg font-semibold">Próxima ação</h2>
      {(acao || data) && (
        <div
          className={`mb-4 flex items-start gap-3 rounded-2xl p-3.5 ${
            due === "overdue" ? "bg-bad-soft" : due === "today" ? "bg-warn-soft" : "bg-surface-2"
          }`}
        >
          <CalendarClock
            size={18}
            aria-hidden
            className={due === "overdue" ? "text-bad" : due === "today" ? "text-warn" : "text-ink-2"}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{acao || "Seguimento"}</p>
            {data && <p className="text-sm text-ink-2">{dueLabel(data, today)}</p>}
          </div>
          <form action={action}>
            <input type="hidden" name="limpar" value="1" />
            <button
              type="submit"
              disabled={pending}
              className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-white"
            >
              Feito
            </button>
          </form>
        </div>
      )}
      <form key={`${acao}|${data}|${state.attempt ?? 0}`} action={action} className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-ink-2">{acao || data ? "Mudar para" : "O que fazer"}</span>
          <input
            name="proxima_acao"
            defaultValue={state.values?.proxima_acao ?? acao}
            placeholder="Ex.: ligar, enviar proposta"
            aria-invalid={message ? true : undefined}
            aria-describedby={message ? errId : undefined}
            className={inputClass}
          />
        </label>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Escolher data rápida">
          {quick.map((q) => (
            <button
              key={q.label}
              type="button"
              onClick={() => {
                if (dateRef.current) dateRef.current.value = addDays(today, q.days);
              }}
              className="rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-ink hover:text-ink"
            >
              {q.label}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="sr-only">Data</span>
          <input
            ref={dateRef}
            name="proxima_data"
            type="date"
            defaultValue={state.values?.proxima_data ?? data ?? ""}
            className={inputClass}
          />
        </label>
        {message && (
          <p id={errId} role="alert" className="text-sm text-bad">
            {message}
          </p>
        )}
        <PrimaryButton type="submit" disabled={pending} className="w-full">
          {pending ? "A guardar…" : "Guardar próximo passo"}
        </PrimaryButton>
      </form>
    </div>
  );
}
