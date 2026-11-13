import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/lib/names";

/** Who is signed in, plus the whole team (team_members table). Deduped per request. */
export const getCurrentMember = cache(async () => {
  await connection(); // always request-time: reads auth cookies and the clock
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = (data?.claims?.email as string | undefined)?.toLowerCase();
  if (!email) return null;

  const { data: members } = await supabase
    .from("team_members")
    .select("email, nome")
    .order("created_at");
  // Keep emails exactly as stored: leads.responsavel is a case-sensitive FK to them.
  const team = ((members ?? []) as Member[]).map((m) => ({
    email: m.email,
    nome: m.nome || "",
  }));
  const me = team.find((m) => m.email.toLowerCase() === email);
  return { email, me, team };
});

/** Use at the top of every data loader: signed-in team members only. */
export async function requireMember() {
  const current = await getCurrentMember();
  if (!current) redirect("/login");
  if (!current.me) redirect("/sem-acesso");
  return { ...current, me: current.me };
}
