import { displayName, type Member } from "@/lib/names";

/** One tone per team member (by position in the team list): avatar + card colour. */
export const OWNER_TONES = [
  { avatar: "bg-brand text-brand-ink", card: "bg-brand-soft", chip: "bg-brand text-brand-ink" },
  { avatar: "bg-lime text-ink", card: "bg-[#f3f6c6]", chip: "bg-lime text-ink" },
  { avatar: "bg-ink text-white", card: "bg-surface-2", chip: "bg-ink text-white" },
];

export function ownerTone(email: string | null | undefined, team: Member[]) {
  if (!email) return null;
  const index = team.findIndex((m) => m.email === email);
  return index < 0 ? null : OWNER_TONES[index % OWNER_TONES.length];
}

export function Avatar({
  member,
  team,
  size = 28,
}: {
  member: Pick<Member, "email" | "nome"> | null | undefined;
  team: Member[];
  size?: number;
}) {
  const style = { width: size, height: size, fontSize: Math.round(size * 0.42) };
  const tone = ownerTone(member?.email, team);
  if (!member || !tone) {
    return (
      <span
        title="Sem dono"
        style={style}
        className="inline-grid shrink-0 place-items-center rounded-full border-[1.5px] border-dashed border-ink-3 bg-surface text-ink-3"
      >
        ?
      </span>
    );
  }
  const name = displayName(member);
  return (
    <span
      title={name}
      style={style}
      className={`inline-grid shrink-0 place-items-center rounded-full font-semibold ${tone.avatar}`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
