export const STAGES = [
  { id: "novo", label: "Por contactar", dot: "bg-ink-3" },
  { id: "em_sequencia", label: "Em contacto", dot: "bg-blue-600" },
  { id: "respondeu", label: "Respondeu", dot: "bg-cyan-500" },
  { id: "referido", label: "Referido", dot: "bg-yellow-500" },
  { id: "reuniao", label: "Reunião", dot: "bg-fuchsia-500" },
  { id: "proposta", label: "Proposta", dot: "bg-orange-500" },
  { id: "ganho", label: "Ganho", dot: "bg-ok" },
  { id: "perdido", label: "Perdido", dot: "bg-bad" },
] as const;

export type StageId = (typeof STAGES)[number]["id"];

/** Finished deals: hidden from the board by default and not counted as open work. */
export const CLOSED_STAGES: StageId[] = ["ganho", "perdido"];

export function isOpen(estado: string) {
  return !CLOSED_STAGES.includes(stageOf(estado));
}

/** Old CRM states that are shown in another column. */
const ALIASES: Record<string, StageId> = { rascunho: "novo" };

export function stageOf(estado: string): StageId {
  if (STAGES.some((s) => s.id === estado)) return estado as StageId;
  return ALIASES[estado] ?? "novo";
}

export function stageLabel(estado: string) {
  return STAGES.find((s) => s.id === stageOf(estado))!.label;
}

export function isStage(value: string): value is StageId {
  return STAGES.some((s) => s.id === value);
}

export const SEGMENTS: Record<string, string> = {
  clinica: "Clínica",
  clinica_dentaria: "Clínica dentária",
  ginasio: "Ginásio",
  imobiliaria: "Imobiliário",
  educacao: "Educação",
  oficina: "Oficina",
  bem_estar: "Bem-estar",
  marca_nacional: "Marca nacional",
  agencia: "Agência",
  frota: "Frota",
  outro: "Outro",
};

export const ORIGINS: Record<string, string> = {
  outbound: "Prospeção",
  inbound: "Veio até nós",
  manual: "Adicionada à mão",
};

export function isSegment(id: string) {
  return Object.hasOwn(SEGMENTS, id);
}

export function segmentLabel(id: string) {
  return isSegment(id) ? SEGMENTS[id] : id || "—";
}
