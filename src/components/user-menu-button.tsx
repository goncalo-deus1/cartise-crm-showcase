"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import type { Member } from "@/lib/names";
import { displayName } from "@/lib/names";
import { signOut } from "@/app/login/actions";
import { Avatar } from "@/components/avatar";
import { MenuItem, Popover } from "@/components/popover";

/** Avatar that opens a small menu with the account and "Sair" (no one-tap logout). */
export function UserMenuButton({ me, team }: { me: Member; team: Member[] }) {
  const [pending, start] = useTransition();
  return (
    <Popover
      label="Conta"
      title={`${displayName(me)} · ${me.email}`}
      trigger={<Avatar member={me} team={team} size={36} />}
      className="rounded-full"
    >
      {() => (
        <MenuItem kind="action" onSelect={() => start(() => signOut())}>
          <LogOut size={16} />
          <span className="flex-1">{pending ? "A sair…" : "Sair"}</span>
        </MenuItem>
      )}
    </Popover>
  );
}
