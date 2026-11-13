export type Member = { email: string; nome: string };

export function displayName(m: Pick<Member, "email" | "nome"> | undefined | null) {
  if (!m) return "Sem dono";
  if (m.nome) return m.nome;
  const local = m.email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}
