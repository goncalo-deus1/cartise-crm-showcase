import { notFound } from "next/navigation";
import { LeadForm } from "@/app/(app)/leads/lead-form";
import { SAMPLE_LEADS, SAMPLE_TEAM } from "../sample";

async function noop() {
  "use server";
  return { error: "Pré-visualização: nada foi guardado." };
}

/** UI preview with made-up data. Only exists under `next dev`. */
export default function DevFormPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-6 md:px-8">
      <LeadForm action={noop} lead={SAMPLE_LEADS[3]} team={SAMPLE_TEAM} me="goncalo@example.com" cancelHref="/dev" />
    </div>
  );
}
