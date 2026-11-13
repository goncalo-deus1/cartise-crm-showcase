import { Suspense } from "react";
import { notFound } from "next/navigation";
import { LeadsWorkspace } from "@/app/(app)/pipeline/workspace";
import { SAMPLE_LEADS, SAMPLE_TEAM } from "../sample";

/** UI preview with made-up data. Only exists under `next dev`. */
export default function DevLeadsPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-8">
      <Suspense>
        <LeadsWorkspace leads={SAMPLE_LEADS} team={SAMPLE_TEAM} me="goncalo@example.com" today="2026-11-07" demo />
      </Suspense>
    </div>
  );
}
