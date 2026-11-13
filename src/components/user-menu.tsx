import { requireMember } from "@/lib/team";
import { UserMenuButton } from "@/components/user-menu-button";

export async function UserMenu() {
  const { me, team } = await requireMember();
  return <UserMenuButton me={me} team={team} />;
}

export function UserMenuSkeleton() {
  return <div className="size-9 animate-pulse rounded-full bg-surface-2" />;
}
