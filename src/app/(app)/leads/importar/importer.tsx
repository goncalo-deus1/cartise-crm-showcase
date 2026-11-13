"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import {
  cellText,
  checkRecord,
  dedupeKeys,
  guessMapping,
  IMPORT_FIELDS,
  MAX_IMPORT_ROWS,
  toRawRecords,
  type ImportField,
  type Mapping,
  type RawRecord,
} from "@/lib/import";
import { displayName, type Member } from "@/lib/names";
import { segmentLabel, stageLabel } from "@/lib/stages";
import { isNextRedirect } from "@/lib/errors";
import { Card, PrimaryButton, inputClass } from "@/components/ui";
import { findExisting, importLeads, type Existing, type ImportResult } from "./actions";

type Sheet = { fileName: string; headers: string[]; rows: unknown[][]; firstLine: number };

const PREVIEW_ROWS = 50;
const CHUNK = 100;

/**
 * Decode a CSV the way Excel saved it: UTF-8 (with or without BOM), UTF-16 (BOM), or
 * Windows-1252, which Portuguese Excel on Windows uses for "CSV (separado por vírgulas)".
 */
async function decodeCsv(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
  } catch {
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

async function parseFile(file: File): Promise<Sheet> {
  let data: unknown[][];
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    const Papa = (await import("papaparse")).default;
    const text = await decodeCsv(file);
    data = Papa.parse<unknown[]>(text, { skipEmptyLines: "greedy" }).data;
  } else {
    const { readSheet } = await import("read-excel-file/browser");
    data = (await readSheet(file)) as unknown[][];
  }
  const nonEmpty = (r: unknown[]) => r.some((c) => cellText(c) !== "");
  const headerIndex = data.findIndex(nonEmpty);
  if (headerIndex < 0) throw new Error("A folha está vazia.");
  const headers = data[headerIndex].map((h, i) => cellText(h) || `Coluna ${i + 1}`);
  const rows = data.slice(headerIndex + 1).filter(nonEmpty);
  // +2: spreadsheet rows are 1-based and the header row comes first.
  return { fileName: file.name, headers, rows, firstLine: headerIndex + 2 };
}

export function Importer({ team, me, demo = false }: { team: Member[]; me: string; demo?: boolean }) {
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [mapping, setMapping] = useState<Mapping>({});
  const [existing, setExisting] = useState<Existing>({});
  const [owner, setOwner] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<ImportResult, { ok: true }> | null>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultRef = useRef<HTMLHeadingElement>(null);

  const load = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!/\.(xlsx|csv)$/i.test(file.name)) {
      setError("Usa um ficheiro .xlsx (Excel) ou .csv.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("O ficheiro tem mais de 5 MB.");
      return;
    }
    setLoading(true);
    try {
      const parsed = await parseFile(file);
      if (parsed.rows.length === 0) throw new Error("A folha só tem cabeçalhos, sem contactos.");
      setExisting({});
      setSheet(parsed);
      setMapping(guessMapping(parsed.headers, parsed.rows.slice(0, 30)));
    } catch (e) {
      if (isNextRedirect(e)) throw e;
      setSheet(null);
      setError(e instanceof Error && e.message ? e.message : "Não foi possível ler o ficheiro.");
    } finally {
      setLoading(false);
    }
  };

  const checked = useMemo(() => {
    if (!sheet) return [];
    const seen = new Set<string>();
    return toRawRecords(sheet.rows, mapping).map((raw, i) => {
      const c = checkRecord(raw);
      const keys = dedupeKeys(c.row);
      const status = c.errors.length
        ? ("erro" as const)
        : keys.some((k) => existing[k])
          ? ("existe" as const)
          : keys.some((k) => seen.has(k))
            ? ("repetida" as const)
            : ("nova" as const);
      if (status === "nova") keys.forEach((k) => seen.add(k));
      return { ...c, raw, line: sheet.firstLine + i, status };
    });
  }, [sheet, mapping, existing]);

  // Ask the server which of these contacts already exist (again whenever the mapping changes).
  const probeKey = useMemo(
    () => JSON.stringify(checked.filter((c) => !c.errors.length).map((c) => [c.row.email, c.row.empresa, c.row.contacto_nome])),
    [checked],
  );
  useEffect(() => {
    if (demo || !sheet) return;
    let cancelled = false;
    const probes = (JSON.parse(probeKey) as string[][]).map(([email, empresa, contacto_nome]) => ({ email, empresa, contacto_nome }));
    const timer = setTimeout(() => {
      findExisting(probes)
        .then((e) => !cancelled && setExisting(e))
        // Not fatal: the server checks duplicates again when importing.
        .catch(() => !cancelled && setError("Não foi possível verificar duplicados agora. Ao importar volta a ser verificado."));
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [probeKey, demo, sheet]);

  /** Each distinct status in the sheet and the stage it becomes, so wrong guesses are visible. */
  const statusMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of checked) {
      const src = (c.raw.estado ?? "").trim();
      if (src && !m.has(src)) m.set(src, stageLabel(c.row.estado));
    }
    return [...m.entries()].slice(0, 12);
  }, [checked]);

  useEffect(() => {
    if (result) resultRef.current?.focus();
  }, [result]);

  const counts = useMemo(() => {
    const c = { nova: 0, existe: 0, repetida: 0, erro: 0 };
    for (const r of checked) c[r.status] += 1;
    return c;
  }, [checked]);

  const tooMany = (sheet?.rows.length ?? 0) > MAX_IMPORT_ROWS;

  const runImport = () =>
    start(async () => {
      if (!sheet) return;
      setError(null);
      const toSend = checked.filter((r) => r.status === "nova");
      const skippedHere = checked
        .filter((c) => c.status !== "nova")
        .map((c) => ({
          line: c.line,
          reason: c.status === "erro" ? c.errors.join(", ") : c.status === "existe" ? "Já existe no CRM" : "Repetida na folha",
        }));
      if (demo) {
        setResult({ ok: true, imported: toSend.length, skipped: skippedHere });
        return;
      }
      let imported = 0;
      const skippedServer: { line: number; reason: string }[] = [];
      try {
        for (let i = 0; i < toSend.length; i += CHUNK) {
          const part = toSend.slice(i, i + CHUNK);
          setProgress(`A importar ${Math.min(i + CHUNK, toSend.length)} de ${toSend.length}…`);
          // Send the cleaned row (short, safe text); the server validates it again.
          const r = await importLeads(
            part.map((c) => c.row as RawRecord),
            part.map((c) => c.line),
            owner || null,
            sheet.fileName,
          );
          if (!r.ok) {
            setError(
              imported
                ? `${r.error} ${imported} contactos já tinham sido importados; volta a carregar a folha para importar o resto (os já importados são ignorados).`
                : r.error,
            );
            return;
          }
          imported += r.imported;
          skippedServer.push(...r.skipped);
        }
        setResult({ ok: true, imported, skipped: [...skippedHere, ...skippedServer].sort((a, b) => a.line - b.line) });
        setSheet(null);
      } catch (e) {
        if (isNextRedirect(e)) throw e;
        setError(
          imported
            ? `Ligação perdida. ${imported} contactos foram importados; volta a carregar a folha para importar o resto.`
            : "Sem ligação ao servidor. Nada foi importado; tenta outra vez.",
        );
      } finally {
        setProgress(null);
      }
    });

  if (result) {
    return (
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-ok" size={28} aria-hidden />
          <div>
            <h2 ref={resultRef} tabIndex={-1} className="font-display text-xl font-semibold outline-none">
              {result.imported} {result.imported === 1 ? "contacto importado" : "contactos importados"}
            </h2>
            {result.skipped.length > 0 && (
              <p className="text-sm text-ink-2">
                {result.skipped.length} {result.skipped.length === 1 ? "linha ficou" : "linhas ficaram"} de fora.
              </p>
            )}
          </div>
        </div>
        {result.skipped.length > 0 && (
          <details className="rounded-2xl bg-surface-2 p-4 text-sm">
            <summary className="cursor-pointer font-medium">Ver linhas que ficaram de fora</summary>
            <ul className="mt-3 space-y-1 text-ink-2">
              {result.skipped.map((s) => (
                <li key={`${s.line}-${s.reason}`}>
                  Linha {s.line}: {s.reason}
                </li>
              ))}
            </ul>
          </details>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex h-10 items-center rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-black/85"
          >
            {owner ? "Ver na visão geral" : "Dividir na visão geral"}
          </Link>
          <button
            type="button"
            onClick={() => setResult(null)}
            className="inline-flex h-10 items-center rounded-full bg-surface-2 px-5 text-sm font-semibold text-ink hover:bg-line"
          >
            Importar outra folha
          </button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            load(e.dataTransfer.files?.[0]);
          }}
          className={`flex flex-col items-center gap-3 rounded-3xl border-[1.5px] border-dashed px-6 py-10 text-center transition ${
            dragging ? "border-brand bg-brand-softer" : "border-line-strong"
          }`}
        >
          <FileSpreadsheet size={32} className="text-ink-3" aria-hidden />
          <div>
            <p className="font-semibold">{sheet ? sheet.fileName : "Arrasta a folha para aqui"}</p>
            <p className="text-sm text-ink-2">
              {sheet
                ? `${sheet.rows.length} linhas encontradas`
                : "Excel (.xlsx) ou CSV. A primeira linha deve ter os nomes das colunas."}
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="peer sr-only"
            id="import-file"
            onChange={(e) => {
              load(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <label
            htmlFor="import-file"
            className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-semibold text-white hover:bg-black/85 peer-focus-visible:ring-4 peer-focus-visible:ring-brand/40"
          >
            <Upload size={16} aria-hidden /> {loading ? "A ler…" : sheet ? "Escolher outro ficheiro" : "Escolher ficheiro"}
          </label>
        </div>
        <p aria-live="polite" className="sr-only">
          {loading ? "A ler o ficheiro…" : progress ?? ""}
        </p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
            {error}
          </p>
        )}
      </Card>

      {sheet && (
        <>
          <Card>
            <h2 className="font-display text-lg font-semibold">Colunas</h2>
            <p className="mb-4 text-sm text-ink-2">Confirma de que coluna vem cada informação.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1.5 block text-sm font-medium text-ink-2">
                    {f.label}
                    {"required" in f && f.required && " *"}
                  </span>
                  <select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => {
                        const next = { ...m };
                        if (e.target.value === "") delete next[f.key as ImportField];
                        else next[f.key as ImportField] = Number(e.target.value);
                        return next;
                      })
                    }
                    className={inputClass}
                  >
                    <option value="">— não importar</option>
                    {sheet.headers.map((h, i) => (
                      <option key={i} value={i}>
                        {h}
                      </option>
                    ))}
                  </select>
                  <span className="mt-1 block truncate text-xs text-ink-3">
                    {mapping[f.key] !== undefined
                      ? `Ex.: ${sheet.rows.map((r) => cellText(r[mapping[f.key]!])).find(Boolean) ?? "(vazio)"}`
                      : " "}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <Card>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold">Pré-visualização</h2>
                <ul className="mt-1 flex flex-wrap gap-2 text-xs font-semibold">
                  <li className="rounded-full bg-ok-soft px-2.5 py-1 text-ok">{counts.nova} {counts.nova === 1 ? "novo" : "novos"}</li>
                  {counts.existe > 0 && (
                    <li className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">{counts.existe} já no CRM</li>
                  )}
                  {counts.repetida > 0 && (
                    <li className="rounded-full bg-surface-2 px-2.5 py-1 text-ink-2">{counts.repetida} {counts.repetida === 1 ? "repetido" : "repetidos"}</li>
                  )}
                  {counts.erro > 0 && (
                    <li className="rounded-full bg-bad-soft px-2.5 py-1 text-bad">{counts.erro} com {counts.erro === 1 ? "erro" : "erros"}</li>
                  )}
                </ul>
              </div>
              {statusMap.length > 0 && (
                <div className="w-full text-xs text-ink-2 sm:order-last">
                  <span className="font-semibold">Estados da folha:</span>{" "}
                  {statusMap.map(([src, label], i) => (
                    <span key={src}>
                      {i > 0 && " · "}“{src}” → <strong className="text-ink">{label}</strong>
                    </span>
                  ))}
                </div>
              )}
              <label className="block sm:w-56">
                <span className="mb-1.5 block text-sm font-medium text-ink-2">Quem contacta</span>
                <select value={owner} onChange={(e) => setOwner(e.target.value)} className={inputClass}>
                  <option value="">Sem dono (dividir depois)</option>
                  {team.map((m) => (
                    <option key={m.email} value={m.email}>
                      {m.email === me ? `Eu (${displayName(m)})` : displayName(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-surface-2 text-xs font-semibold uppercase tracking-wide text-ink-2">
                  <tr>
                    <th className="px-3 py-2.5">Linha</th>
                    <th className="px-3 py-2.5">Empresa</th>
                    <th className="px-3 py-2.5">Contacto</th>
                    <th className="px-3 py-2.5">Segmento</th>
                    <th className="px-3 py-2.5">Estado</th>
                    <th className="px-3 py-2.5">Resultado</th>
                  </tr>
                </thead>
                <tbody>
                  {checked.slice(0, PREVIEW_ROWS).map((r) => (
                    <tr key={r.line} className="border-t border-line align-top">
                      <td className="px-3 py-2.5 tabular-nums text-ink-3">{r.line}</td>
                      <td className="px-3 py-2.5 font-medium">{r.row.empresa || "—"}</td>
                      <td className="px-3 py-2.5 text-ink-2">
                        {r.row.contacto_nome || "—"}
                        {r.row.email && <div className="text-xs text-ink-3">{r.row.email}</div>}
                      </td>
                      <td className="px-3 py-2.5 text-ink-2">{segmentLabel(r.row.segmento)}</td>
                      <td className="px-3 py-2.5 text-ink-2">{stageLabel(r.row.estado)}</td>
                      <td className="px-3 py-2.5">
                        {r.status === "nova" && <span className="font-semibold text-ok">Nova</span>}
                        {r.status === "existe" && <span className="text-ink-2">Já no CRM</span>}
                        {r.status === "repetida" && <span className="text-ink-2">Repetida</span>}
                        {r.status === "erro" && <span className="font-semibold text-bad">{r.errors.join(", ")}</span>}
                        {r.warnings.map((w) => (
                          <div key={w} className="mt-0.5 flex items-center gap-1 text-xs text-warn">
                            <AlertTriangle size={12} aria-hidden /> {w}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {checked.length > PREVIEW_ROWS && (
              <p className="mt-2 text-xs text-ink-3">
                A mostrar {PREVIEW_ROWS} de {checked.length} linhas. Todas são verificadas.
              </p>
            )}

            {tooMany && (
              <p role="alert" className="mt-4 rounded-xl bg-bad-soft px-4 py-2.5 text-sm text-bad">
                Esta folha tem mais de {MAX_IMPORT_ROWS} linhas. Divide-a em partes mais pequenas.
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PrimaryButton
                type="button"
                onClick={runImport}
                disabled={pending || counts.nova === 0 || tooMany || (mapping.empresa === undefined && mapping.email === undefined)}
              >
                {pending
                  ? (progress ?? "A importar…")
                  : `Importar ${counts.nova} ${counts.nova === 1 ? "contacto" : "contactos"}`}
              </PrimaryButton>
              {mapping.empresa === undefined && mapping.email === undefined && (
                <p className="text-sm text-bad">Escolhe a coluna da empresa (ou do email).</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
