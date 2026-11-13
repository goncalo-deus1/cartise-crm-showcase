import type { Lead } from "@/lib/leads";
import type { Member } from "@/lib/names";

/** Made-up data for the /dev preview only. */
export const SAMPLE_TEAM: Member[] = [
  { email: "goncalo@example.com", nome: "Gonçalo" },
  { email: "tomas@example.com", nome: "Tomás" },
];

const base = {
  cidade: "Lisboa",
  website: "",
  email: "",
  telefone: "",
  linkedin_url: "",
  notas: "",
  origem: "manual",
  ultimo_contacto: null,
  criado_em: "2026-10-20T10:00:00Z",
  atualizado_em: "2026-11-05T10:00:00Z",
};

export const SAMPLE_LEADS: Lead[] = [
  ["Clínica Sorriso", "Ana Lopes", "Diretora", "clinica", "novo", "goncalo@example.com", "2026-11-07", "Ligar"],
  ["Ginásio Forte", "Rui Matos", "Sócio-gerente", "ginasio", "novo", null, null, ""],
  ["Escola de Línguas Norte", "Marta Reis", "Marketing", "educacao", "novo", "tomas@example.com", "2026-11-10", "Enviar email"],
  ["Imobiliária Rio", "Pedro Sá", "CEO", "imobiliaria", "em_sequencia", "goncalo@example.com", "2026-11-04", "Follow-up"],
  ["Oficina Central", "João Dias", "Dono", "oficina", "em_sequencia", "tomas@example.com", "2026-11-08", "Follow-up"],
  ["Bem-Estar Spa", "Inês Costa", "Gerente", "bem_estar", "respondeu", "tomas@example.com", "2026-11-07", "Marcar reunião"],
  ["Marca Exemplo", "Carla Nunes", "Brand manager", "marca_nacional", "reuniao", "goncalo@example.com", "2026-11-12", "Reunião"],
  ["Clínica Dental Sul", "Luís Pinto", "Diretor clínico", "clinica_dentaria", "proposta", "goncalo@example.com", "2026-11-14", "Enviar proposta"],
  ["Café da Praça", "Sofia Alves", "Dona", "outro", "ganho", "tomas@example.com", null, ""],
  ["Hotel Avenida", "Nuno Ramos", "Diretor", "outro", "perdido", null, null, ""],
  ["Clínica Sorriso", "Pedro Gomes", "Gestor", "clinica", "em_sequencia", "goncalo@example.com", "2026-11-09", "Follow-up"],
  ["Escola de Línguas Norte", "Sara Lima", "Diretora", "educacao", "novo", null, null, ""],
  ["Body Lab", "Rita Cruz", "Fundadora", "bem_estar", "novo", "goncalo@example.com", null, ""],
  ["Auto Rápido", "Tiago Melo", "Gerente", "oficina", "respondeu", "goncalo@example.com", null, ""],
  ["Fit Porto", "Bruno Faria", "Diretor", "ginasio", "novo", "goncalo@example.com", null, ""],
  // Real brands (public websites only, made-up contacts) so the preview shows fetched logos.
  ["SPORT TV", "Rui Almeida", "Marketing Manager", "marca_nacional", "em_sequencia", "goncalo@example.com", null, "", "sporttv.pt"],
  ["Fidelidade", "Sara Nunes", "Marketing Director", "marca_nacional", "reuniao", "goncalo@example.com", "2026-11-13", "Reunião", "fidelidade.pt"],
  ["MEO", "Catarina Lopes", "Advertising Manager", "marca_nacional", "proposta", "tomas@example.com", "2026-11-11", "Enviar proposta", "meo.pt"],
  ["Idealista", "Miguel Ferraz", "Advertising Manager", "marca_nacional", "novo", null, null, "", "idealista.com"],
].map(([empresa, contacto_nome, cargo, segmento, estado, responsavel, proxima_data, proxima_acao, website], i) => ({
  ...base,
  website: website ?? "",
  id: `sample-${i}`,
  empresa: empresa!,
  contacto_nome: contacto_nome!,
  cargo: cargo!,
  segmento: segmento!,
  estado: estado!,
  responsavel,
  proxima_data,
  proxima_acao: proxima_acao ?? "",
  // A few made-up contact details so the call / WhatsApp / email buttons show in previews.
  ...(i % 3 === 0 ? { telefone: "+351912345678", email: "contacto@example.com" } : {}),
  ...(i % 4 === 1 ? { linkedin_url: "https://www.linkedin.com/in/example" } : {}),
}));
