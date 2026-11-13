import { notFound } from "next/navigation";
import { Importer } from "@/app/(app)/leads/importar/importer";
import { SAMPLE_TEAM } from "../sample";

/** Import flow with made-up team; nothing is saved. Only exists under `next dev`. */
export default function DevImportPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  return (
    <div className="mx-auto max-w-[1100px] px-4 pt-6 md:px-8">
      <Importer team={SAMPLE_TEAM} me="goncalo@example.com" demo />
    </div>
  );
}
