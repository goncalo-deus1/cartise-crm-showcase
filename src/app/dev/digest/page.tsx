import { notFound } from "next/navigation";
import { buildDigest, type DigestChanges } from "@/lib/digest";
import { SAMPLE_LEADS, SAMPLE_TEAM } from "../sample";

const SAMPLE_CHANGES: DigestChanges = {
  replies: [
    { leadId: "sample-5", empresa: "Bem-Estar Spa", contacto: "Inês Costa", snippet: "Olá Gonçalo, obrigada pelo contacto. Podemos falar na quinta às 10h?" },
  ],
  moves: [
    { leadId: "sample-5", empresa: "Bem-Estar Spa", stage: "Respondeu", by: "pelo email" },
    { leadId: "sample-7", empresa: "Clínica Dental Sul", stage: "Proposta", by: "Tomás" },
  ],
  newLeads: [{ leadId: "sample-12", empresa: "Body Lab", contacto: "Rita Cruz" }],
  sent: [
    { empresa: "Clínica Sorriso", count: 2 },
    { empresa: "Fit Porto", count: 1 },
  ],
};

/** Preview of the morning email with made-up data. Only exists under `next dev`. */
export default function DevDigestPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const d = buildDigest(SAMPLE_TEAM[0], SAMPLE_LEADS, "http://localhost:3000", "2026-11-07", SAMPLE_CHANGES);
  return (
    <div className="mx-auto max-w-[720px] px-4 pt-6">
      <p className="mb-2 text-sm text-ink-2">
        Assunto: <strong>{d.subject}</strong>
      </p>
      <iframe title="Email" srcDoc={d.html} className="h-[1100px] w-full rounded-2xl border border-line bg-white" />
    </div>
  );
}
