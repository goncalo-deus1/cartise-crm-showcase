"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGrid, Columns3, Users } from "lucide-react";

export const NAV = [
  { href: "/", label: "Visão geral", icon: LayoutGrid },
  { href: "/pipeline", label: "Pipeline", icon: Columns3 },
  { href: "/leads", label: "Leads", icon: Users },
] as const;

function isActive(path: string, href: string) {
  return href === "/" ? path === "/" : path.startsWith(href);
}

/** Pill navigation, top of the page on desktop. The *View variants render without the hook (Suspense fallback). */
export function TopNav() {
  return <TopNavView path={usePathname()} />;
}

export function TopNavView({ path }: { path: string }) {
  return (
    <nav aria-label="Principal" className="flex items-center gap-1 rounded-full bg-surface p-1">
      {NAV.map(({ href, label }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active ? "bg-ink text-white" : "text-ink-2 hover:bg-surface-2 hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** Icon bar fixed to the bottom on phones. */
export function BottomNav() {
  return <BottomNavView path={usePathname()} />;
}

export function BottomNavView({ path }: { path: string }) {
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-30 flex justify-around border-t border-line bg-surface/95 px-2 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 backdrop-blur md:hidden"
    >
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(path, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 rounded-xl px-3 py-1 text-[11px] font-medium ${
              active ? "text-brand" : "text-ink-3"
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
