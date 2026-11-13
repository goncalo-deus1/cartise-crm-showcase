import { addDays } from "@/lib/dates";
import type { StageId } from "@/lib/stages";

/** One-tap things you can log on a lead. */
export const TOUCHES = {
  email: { label: "Email", done: "Email enviado" },
  linkedin: { label: "LinkedIn", done: "Mensagem no LinkedIn" },
  chamada: { label: "Chamada", done: "Chamada feita" },
  respondeu: { label: "Respondeu", done: "Respondeu" },
  reuniao: { label: "Reunião", done: "Reunião marcada" },
} as const;

export type TouchKind = keyof typeof TOUCHES;

export function isTouch(v: string): v is TouchKind {
  return Object.hasOwn(TOUCHES, v);
}

/**
 * Outbound cadence: after the Nth outreach touch, what to do next and when.
 * Email → LinkedIn (+3d) → Call (+4d) → last email (+7d) → try again every 2 weeks.
 */
const OUTREACH_STEPS = [
  { days: 3, acao: "Follow-up no LinkedIn" },
  { days: 4, acao: "Ligar" },
  { days: 7, acao: "Último email" },
];
const AFTER_CADENCE = { days: 14, acao: "Voltar a tentar" };

const PROSPECTING: StageId[] = ["novo", "em_sequencia"];
const CONVERSATION: StageId[] = ["respondeu", "referido", "reuniao", "proposta"];

export type TouchDecision = {
  /** New stage, when the lead should move. */
  estado?: StageId;
  /** New next step; undefined = leave the current one alone. */
  next?: { acao: string; data: string };
  /** What happens to the outreach step counter. */
  step: "bump" | "reset" | "keep";
};

/**
 * Decide what a tap does, based on the stage the lead is in now.
 * Stages only move forward, except a lost lead that replies or books a meeting is reopened.
 *
 * @param step  outreach touches since the cadence (re)started (leads.passo_cadencia)
 */
export function decideTouch(kind: TouchKind, step: number, current: StageId, today: string): TouchDecision {
  const followUp = (acao = "Seguimento", days = 3) => ({ acao, data: addDays(today, days) });

  if (kind === "respondeu") {
    if (PROSPECTING.includes(current) || current === "perdido") {
      return { estado: "respondeu", next: followUp("Responder e marcar reunião", 1), step: "reset" };
    }
    if (current === "ganho") return { step: "keep" };
    return { next: followUp(), step: "keep" }; // already in a conversation
  }

  if (kind === "reuniao") {
    if (PROSPECTING.includes(current) || current === "respondeu" || current === "referido" || current === "perdido") {
      return { estado: "reuniao", next: followUp("Enviar proposta", 2), step: "reset" };
    }
    if (current === "proposta") return { next: followUp("Seguimento da proposta"), step: "keep" };
    if (current === "ganho") return { step: "keep" };
    return { next: followUp("Enviar proposta", 2), step: "keep" }; // already "Reunião"
  }

  // Outreach: email / LinkedIn / call
  if (current === "ganho" || current === "perdido") return { step: "keep" }; // just log it
  if (CONVERSATION.includes(current)) return { next: followUp(), step: "keep" };
  const s = OUTREACH_STEPS[step] ?? AFTER_CADENCE;
  return {
    estado: current === "novo" ? "em_sequencia" : undefined,
    next: followUp(s.acao, s.days),
    step: "bump",
  };
}
