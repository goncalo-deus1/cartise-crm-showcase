import { notFound } from "next/navigation";
import { OverviewView } from "@/app/(app)/page";
import { SAMPLE_LEADS, SAMPLE_TEAM } from "../sample";

/** UI preview with made-up data. Only exists under `next dev`. */
export default function DevOverviewPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-8">
      <OverviewView
        me={SAMPLE_TEAM[0]}
        team={SAMPLE_TEAM}
        leads={SAMPLE_LEADS}
        today="2026-11-07"
        now={new Date("2026-11-07T10:00:00Z")}
        demo
      />
    </div>
  );
}
