import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { BottomNav, BottomNavView, TopNav, TopNavView } from "@/components/nav";
import { UserMenu, UserMenuSkeleton } from "@/components/user-menu";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto min-h-dvh max-w-[1440px] px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
      <header className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center" aria-label="Cartise CRM, início">
          <Image src="/brand/cartise-logo.svg" alt="Cartise" width={112} height={31} priority />
        </Link>
        <div className="hidden md:block">
          <Suspense fallback={<TopNavView path="" />}>
            <TopNav />
          </Suspense>
        </div>
        <Suspense fallback={<UserMenuSkeleton />}>
          <UserMenu />
        </Suspense>
      </header>
      {children}
      <Suspense fallback={<BottomNavView path="" />}>
        <BottomNav />
      </Suspense>
    </div>
  );
}
