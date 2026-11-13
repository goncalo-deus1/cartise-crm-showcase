"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import type { Lead } from "@/lib/leads";
import { displayName, type Member } from "@/lib/names";
import { isSegment, SEGMENTS, STAGES } from "@/lib/stages";
import { EMAIL_PATTERN } from "@/lib/validation";
import { Card, Field, PrimaryButton, inputClass } from "@/components/ui";
import type { FormState } from "./actions";

export function LeadForm({
  action,
  lead,
  team,
  me,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lead?: Lead;
  team: Member[];
  me: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const formRef = useRef<HTMLFormElement>(null);
  const err = state.fieldErrors ?? {};
  // After a failed submit, show what was typed (React resets forms on submit), else the saved lead.
  const v = (name: keyof Lead) => state.values?.[name] ?? (lead?.[name] as string | null | undefined) ?? "";

  useEffect(() => {
    formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state.attempt]);

  const segment = v("segmento") || "outro";

  return (
    <form
      ref={formRef}
      key={state.attempt ?? 0}
      action={formAction}
      className="grid gap-5 lg:grid-cols-[1fr_340px]"
    >
      <Card className="grid gap-4 md:grid-cols-2">
        <h2 className="font-display text-lg font-semibold md:col-span-2">Empresa e contacto</h2>
        <Field label="Empresa *" error={err.empresa} className="md:col-span-2">
          <input name="empresa" required defaultValue={v("empresa")} className={inputClass} autoFocus={!lead} />
        </Field>
        <Field label="Nome do contacto">
          <input name="contacto_nome" defaultValue={v("contacto_nome")} className={inputClass} />
        </Field>
        <Field label="Cargo">
          <input name="cargo" defaultValue={v("cargo")} className={inputClass} />
        </Field>
        <Field label="Email" error={err.email}>
          <input
            name="email"
            type="email"
            pattern={EMAIL_PATTERN}
            title="nome@empresa.pt"
            defaultValue={v("email")}
            className={inputClass}
          />
        </Field>
        <Field label="Telefone" error={err.telefone} hint="Portugueses: 9 dígitos. Estrangeiros: com o indicativo (+44 …).">
          <input
            name="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={v("telefone")}
            placeholder="912 345 678"
            className={inputClass}
          />
        </Field>
        <Field label="Cidade">
          <input name="cidade" defaultValue={v("cidade")} className={inputClass} />
        </Field>
        <Field label="Website">
          <input name="website" defaultValue={v("website")} placeholder="empresa.pt" className={inputClass} />
        </Field>
        <Field label="LinkedIn">
          <input
            name="linkedin_url"
            defaultValue={v("linkedin_url")}
            placeholder="linkedin.com/in/…"
            className={inputClass}
          />
        </Field>
        <Field label="Segmento" className="md:col-span-2">
          <select name="segmento" defaultValue={segment} className={inputClass}>
            {!isSegment(segment) && <option value={segment}>{segment}</option>}
            {Object.entries(SEGMENTS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notas" className="md:col-span-2">
          <textarea name="notas" rows={4} defaultValue={v("notas")} className={`${inputClass} h-auto py-2.5`} />
        </Field>
      </Card>

      <div className="space-y-5">
        <Card className="space-y-4">
          <h2 className="font-display text-lg font-semibold">Seguimento</h2>
          {!lead && (
            <>
              <Field label="Quem contacta">
                <select name="responsavel" defaultValue={state.values?.responsavel ?? me} className={inputClass}>
                  {team.map((m) => (
                    <option key={m.email} value={m.email}>
                      {displayName(m)}
                    </option>
                  ))}
                  <option value="">Sem dono</option>
                </select>
              </Field>
              <Field label="Estado">
                <select name="estado" defaultValue={state.values?.estado ?? "novo"} className={inputClass}>
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          )}
          <Field label="Próxima ação">
            <input
              name="proxima_acao"
              defaultValue={v("proxima_acao")}
              placeholder="Ex.: ligar, enviar proposta"
              className={inputClass}
            />
          </Field>
          <Field label="Data da próxima ação">
            <input name="proxima_data" type="date" defaultValue={v("proxima_data")} className={inputClass} />
          </Field>
          {lead && (
            <p className="text-xs text-ink-3">Quem contacta e o estado mudam-se na página da lead.</p>
          )}
        </Card>

        {state.error && (
          <p role="alert" className="rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
            {state.error}
          </p>
        )}
        <div className="flex gap-2">
          <PrimaryButton type="submit" disabled={pending} className="flex-1">
            {pending ? "A guardar…" : lead ? "Guardar" : "Criar lead"}
          </PrimaryButton>
          <Link
            href={cancelHref}
            className="inline-flex h-10 items-center rounded-full bg-surface px-5 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            Cancelar
          </Link>
        </div>
      </div>
    </form>
  );
}
