import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useMemo, useRef, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { importDemoRows, type ImportRow, type ImportSummary } from "@/lib/demo-data";

export const Route = createFileRoute("/import")({
  component: ImportPage,
  head: () => ({ meta: [{ title: "Import Data — Panasuna Chits" }] }),
});

function ImportPage() {
  return <ProtectedLayout><Importer /></ProtectedLayout>;
}

const FIELD_DEFS: { key: keyof ImportRow; label: string; required?: boolean; aliases: string[] }[] = [
  { key: "subscriberName", label: "Subscriber Name", required: true, aliases: ["subscriber", "subscriber name", "name", "full name", "customer", "customer name", "member", "member name"] },
  { key: "accessCode", label: "Access Code", aliases: ["code", "access code", "subscriber code", "id", "subscriber id", "pcpl"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "whatsapp number", "phone", "mobile", "mobile no", "phone no", "contact"] },
  { key: "altPhone", label: "Alt Phone", aliases: ["alt", "alt phone", "alternate", "alternate phone", "secondary phone"] },
  { key: "addressLine1", label: "Address Line 1", aliases: ["address", "address1", "address line 1", "addr1"] },
  { key: "addressLine2", label: "Address Line 2", aliases: ["address2", "address line 2", "addr2"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "pincode", label: "Pincode", aliases: ["pin", "pincode", "zip", "postal", "postal code"] },
  { key: "groupCode", label: "Group Code", aliases: ["group", "group code", "chit code", "chit group", "scheme"] },
  { key: "chitValue", label: "Chit Value", aliases: ["chit value", "value", "amount", "chit amount"] },
  { key: "durationMonths", label: "Duration (months)", aliases: ["duration", "months", "duration months", "term"] },
  { key: "auctionDay", label: "Auction Day", aliases: ["auction day", "auction date", "day"] },
  { key: "commissionRate", label: "Commission %", aliases: ["commission", "commission rate", "commission %"] },
  { key: "seats", label: "Seats", aliases: ["seats", "seat count", "shares"] },
  { key: "nameOnChit", label: "Name on Chit", aliases: ["name on chit", "chit name"] },
];

const NUMBER_FIELDS: (keyof ImportRow)[] = ["chitValue", "durationMonths", "auctionDay", "commissionRate", "seats"];

const norm = (s: string) => s.toString().trim().toLowerCase().replace(/[._\-]+/g, " ").replace(/\s+/g, " ");

function autoMap(headers: string[]): Record<string, keyof ImportRow | "">  {
  const map: Record<string, keyof ImportRow | ""> = {};
  for (const header of headers) {
    const n = norm(header);
    let best: keyof ImportRow | "" = "";
    for (const def of FIELD_DEFS) {
      if (def.aliases.some((alias) => alias === n)) { best = def.key; break; }
    }
    if (!best) {
      for (const def of FIELD_DEFS) {
        if (def.aliases.some((alias) => n.includes(alias) || alias.includes(n))) { best = def.key; break; }
      }
    }
    map[header] = best;
  }
  return map;
}

type ParsedFile = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
};

function Importer() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, keyof ImportRow | "">>({});
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  const onFile = async (file: File) => {
    setSummary(null);
    const ext = file.name.split(".").pop()?.toLowerCase();
    try {
      let headers: string[] = [];
      let rows: Record<string, string>[] = [];

      if (ext === "csv" || file.type === "text/csv") {
        const text = await file.text();
        const result = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
        if (result.errors?.length) {
          toast.warning(`CSV parser reported ${result.errors.length} issue${result.errors.length === 1 ? "" : "s"} — review preview carefully.`);
        }
        rows = (result.data ?? []).map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, (v ?? "").toString()])));
        headers = result.meta?.fields ?? Object.keys(rows[0] ?? {});
      } else if (ext === "xlsx" || ext === "xls") {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
        rows = json.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? "" : String(v)])));
        headers = rows.length ? Object.keys(rows[0]) : [];
      } else {
        toast.error("Unsupported file type. Please upload .csv, .xlsx, or .xls");
        return;
      }

      if (!headers.length || !rows.length) {
        toast.error("File appears empty.");
        return;
      }

      setParsed({ fileName: file.name, headers, rows });
      setMapping(autoMap(headers));
      toast.success(`Loaded ${rows.length} rows from ${file.name}`);
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const mappedRows: ImportRow[] = useMemo(() => {
    if (!parsed) return [];
    return parsed.rows.map((row) => {
      const out: any = {};
      for (const [header, target] of Object.entries(mapping)) {
        if (!target) continue;
        const raw = (row[header] ?? "").toString().trim();
        if (!raw) continue;
        if (NUMBER_FIELDS.includes(target)) {
          const num = Number(raw.replace(/[,\s]/g, ""));
          out[target] = Number.isFinite(num) ? num : null;
        } else {
          out[target] = raw;
        }
      }
      return out as ImportRow;
    });
  }, [parsed, mapping]);

  const validation = useMemo(() => {
    const errors: { row: number; message: string }[] = [];
    const seen = new Set<string>();
    let dupes = 0;
    let missingName = 0;
    const required = FIELD_DEFS.find((f) => f.key === "subscriberName")!;
    const hasNameMapping = Object.values(mapping).includes(required.key);
    if (!hasNameMapping && parsed) {
      errors.push({ row: 0, message: `Required column "${required.label}" is not mapped.` });
    }

    mappedRows.forEach((row, i) => {
      if (!row.subscriberName?.trim()) {
        missingName++;
        errors.push({ row: i + 2, message: "Missing subscriber name" });
      }
      if (row.whatsapp) {
        const digits = row.whatsapp.replace(/\D/g, "");
        if (digits.length < 10) errors.push({ row: i + 2, message: `Invalid phone "${row.whatsapp}"` });
      }
      if (row.chitValue != null && row.chitValue <= 0) {
        errors.push({ row: i + 2, message: `Chit value should be positive (got ${row.chitValue})` });
      }
      const dedupKey = `${(row.accessCode || "").toLowerCase()}|${(row.whatsapp || "").replace(/\D/g, "")}|${(row.subscriberName || "").toLowerCase().trim()}|${(row.groupCode || "").toLowerCase()}`;
      if (seen.has(dedupKey)) dupes++;
      else seen.add(dedupKey);
    });

    return { errors, dupes, missingName, hasNameMapping };
  }, [mappedRows, mapping, parsed]);

  const onImport = async () => {
    if (!mappedRows.length) return;
    if (!validation.hasNameMapping) {
      toast.error("Map a column to Subscriber Name before importing.");
      return;
    }
    setBusy(true);
    try {
      const valid = mappedRows.filter((r) => r.subscriberName?.trim());
      const result = importDemoRows(valid);
      setSummary(result);
      qc.invalidateQueries();
      toast.success(`Import complete: ${result.subscribersCreated} new subscribers, ${result.groupsCreated} new groups, ${result.enrollmentsCreated} enrollments`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setParsed(null);
    setMapping({});
    setSummary(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <Link to="/subscribers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to subscribers
      </Link>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-sm text-muted-foreground">
          Upload an Excel (.xlsx, .xls) or CSV file. Columns are auto-mapped, you can review and correct, then preview before importing.
          Subscribers, groups, and enrollments are created or merged automatically.
        </p>
      </div>

      {!parsed && (
        <Card className="p-8 text-center border-dashed">
          <FileSpreadsheet className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Drop a file or pick one to get started.</p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <div className="mt-4">
            <Button onClick={() => fileRef.current?.click()}>
              <Upload className="mr-2 h-4 w-4" /> Choose file
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Expected columns include: Subscriber Name, Access Code, WhatsApp, Group Code, Chit Value, Duration, Auction Day, Seats…
          </p>
        </Card>
      )}

      {parsed && (
        <>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{parsed.fileName}</div>
                <div className="text-xs text-muted-foreground">{parsed.rows.length} data rows · {parsed.headers.length} columns</div>
              </div>
              <Button variant="outline" onClick={reset}>Choose different file</Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-3 text-base font-semibold">Column mapping</h2>
            <p className="mb-4 text-xs text-muted-foreground">We auto-detected matches based on column names. Adjust as needed.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {parsed.headers.map((header) => (
                <div key={header} className="flex items-center gap-2">
                  <Label className="w-1/2 truncate text-xs font-mono">{header}</Label>
                  <select
                    className="w-1/2 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    value={mapping[header] ?? ""}
                    onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value as keyof ImportRow | "" }))}
                  >
                    <option value="">— Skip —</option>
                    {FIELD_DEFS.map((def) => (
                      <option key={def.key} value={def.key}>
                        {def.label}{def.required ? " *" : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="mb-2 text-base font-semibold">Preview & validation</h2>
            <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
              <Stat label="Total rows" value={mappedRows.length} />
              <Stat label="Will import" value={mappedRows.filter((r) => r.subscriberName?.trim()).length - validation.dupes} />
              <Stat label="Duplicates" value={validation.dupes} tone={validation.dupes ? "warn" : "muted"} />
              <Stat label="Errors" value={validation.errors.length} tone={validation.errors.length ? "warn" : "muted"} />
            </div>

            {validation.errors.length > 0 && (
              <div className="mb-3 rounded-md border border-amber-300/60 bg-amber-50/60 p-3 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-1 font-semibold">
                  <AlertTriangle className="h-4 w-4" /> {validation.errors.length} issue{validation.errors.length === 1 ? "" : "s"} found
                </div>
                <ul className="max-h-32 space-y-0.5 overflow-y-auto text-xs">
                  {validation.errors.slice(0, 50).map((e, i) => (
                    <li key={i}>Row {e.row}: {e.message}</li>
                  ))}
                  {validation.errors.length > 50 && <li>...and {validation.errors.length - 50} more</li>}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 uppercase">
                  <tr>
                    <th className="px-2 py-2 text-left">#</th>
                    {FIELD_DEFS.filter((d) => Object.values(mapping).includes(d.key)).map((d) => (
                      <th key={d.key} className="px-2 py-2 text-left">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mappedRows.slice(0, 25).map((row, i) => (
                    <tr key={i} className={!row.subscriberName?.trim() ? "bg-destructive/5" : ""}>
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                      {FIELD_DEFS.filter((d) => Object.values(mapping).includes(d.key)).map((d) => (
                        <td key={d.key} className="px-2 py-1.5">{row[d.key] != null ? String(row[d.key]) : <span className="text-muted-foreground">—</span>}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {mappedRows.length > 25 && (
                <div className="bg-muted/30 px-3 py-2 text-center text-xs text-muted-foreground">
                  Showing first 25 of {mappedRows.length} rows
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <Input
                placeholder="Filename to remember (optional)"
                value={parsed.fileName}
                disabled
                className="max-w-xs"
              />
              <Button onClick={onImport} disabled={busy || !validation.hasNameMapping}>
                {busy ? "Importing..." : "Import data"}
              </Button>
            </div>
          </Card>
        </>
      )}

      {summary && (
        <Card className="border-emerald-300/60 bg-emerald-50/60 p-5 dark:border-emerald-500/40 dark:bg-emerald-500/10">
          <div className="mb-2 flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
            <CheckCircle2 className="h-5 w-5" /> Import complete
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <li><strong>{summary.subscribersCreated}</strong> new subscribers</li>
            <li><strong>{summary.subscribersUpdated}</strong> subscribers updated</li>
            <li><strong>{summary.groupsCreated}</strong> new groups</li>
            <li><strong>{summary.enrollmentsCreated}</strong> enrollments added</li>
            <li><strong>{summary.enrollmentsSkipped}</strong> already enrolled (skipped)</li>
          </ul>
          <div className="mt-3 flex gap-2">
            <Button asChild size="sm"><Link to="/subscribers">View subscribers</Link></Button>
            <Button asChild size="sm" variant="outline"><Link to="/groups">View groups</Link></Button>
            <Button size="sm" variant="ghost" onClick={reset}>Import another file</Button>
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone = "muted" }: { label: string; value: number | string; tone?: "muted" | "warn" }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${tone === "warn" ? "border-amber-300/60 bg-amber-50/40 dark:border-amber-500/40 dark:bg-amber-500/10" : "bg-muted/30"}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}
