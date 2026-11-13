import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LeadsWorkspace } from "@/app/(app)/pipeline/workspace";
import { SAMPLE_LEADS, SAMPLE_TEAM } from "./sample";

export const metadata = { title: "Preview · Cartise CRM" };

/** UI preview with made-up data. Only exists under `next dev`. */
export default function DevPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-8">
      <p className="mb-4 inline-block rounded-full bg-warn-soft px-3 py-1 text-xs font-semibold text-warn">
        Pré-visualização com dados fictícios
      </p>
      <Suspense>
        <LeadsWorkspace leads={SAMPLE_LEADS} team={SAMPLE_TEAM} me="goncalo@example.com" today="2026-11-07" withBoard demo />
      </Suspense>
    </div>
  );
}
