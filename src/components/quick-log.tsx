"use client";

import { useState, useTransition } from "react";
import { AtSign, CalendarCheck, Mail, MessageCircleReply, Phone } from "lucide-react";
import { TOUCHES, type TouchKind } from "@/lib/cadence";
import { relativeDate, todayISO } from "@/lib/dates";
import { isNextRedirect } from "@/lib/errors";
import { logTouch } from "@/app/(app)/actions";

export const TOUCH_ICONS = {
  email: Mail,
  linkedin: AtSign,
  chamada: Phone,
  respondeu: MessageCircleReply,
  reuniao: CalendarCheck,
} satisfies Record<TouchKind, unknown>;

/** "Registar contacto": one tap logs it and schedules the next follow-up. */
export function QuickLog({ leadId }: { leadId: string }) {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  const log = (kind: TouchKind) =>
    start(async () => {
      setStatus(null);
      try {
        const r = await logTouch(leadId, kind);
        setStatus(
          r.ok
            ? {
                ok: true,
                text:
                  r.acao && r.data
                    ? `${TOUCHES[kind].done}. Próximo: ${r.acao} · ${relativeDate(r.data, todayISO())}`
                    : `${TOUCHES[kind].done}. Registado.`,
              }
            : { ok: false, text: r.error },
        );
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setStatus({ ok: false, text: "Sem ligação ao servidor. Tenta outra vez." });
      }
    });

  return (
    <div aria-busy={pending}>
      <h2 className="font-display text-lg font-semibold">Registar contacto</h2>
      <p className="mb-3 text-sm text-ink-2">Um toque regista e marca o próximo seguimento.</p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3">
        {(Object.keys(TOUCHES) as TouchKind[]).map((kind) => {
          const Icon = TOUCH_ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              disabled={pending}
              onClick={() => log(kind)}
              className="flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl bg-surface-2 px-2 py-2.5 text-xs font-semibold text-ink transition hover:bg-ink hover:text-white disabled:opacity-60"
            >
              <Icon size={18} aria-hidden />
              {TOUCHES[kind].label}
            </button>
          );
        })}
      </div>
      <p
        aria-live="polite"
        className={`mt-3 min-h-5 text-sm ${status?.ok === false ? "text-bad" : "text-ok"}`}
      >
        {pending ? "A registar…" : status?.text}
      </p>
    </div>
  );
}
