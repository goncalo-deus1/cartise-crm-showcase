import { notFound } from "next/navigation";
import { DeletedList } from "@/app/(app)/leads/apagadas/deleted-list";
import { SAMPLE_LEADS } from "../sample";

/** UI preview with made-up data. Only exists under `next dev`. */
export default function DevDeletedPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 pt-6 md:px-8">
      <DeletedList leads={SAMPLE_LEADS.slice(0, 6)} today="2026-11-07" demo />
    </div>
  );
}
