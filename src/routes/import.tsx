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
  { key: "subscriberName", label: "Subscriber Name", required: true, aliases: ["subscriber", "subscriber name", "name", "full name", "customer", "customer name", "member", "member name", "subscriber name "] },
  { key: "accessCode", label: "Access Code", aliases: ["code", "access code", "subscriber code", "id", "subscriber id", "pcpl", "member code", "member id"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "whatsapp number", "phone", "mobile", "mobile no", "phone no", "contact", "phone number", "mob", "mob no"] },
  { key: "altPhone", label: "Alt Phone", aliases: ["alt", "alt phone", "alternate", "alternate phone", "secondary phone"] },
  { key: "addressLine1", label: "Address Line 1", aliases: ["address", "address1", "address line 1", "addr1"] },
  { key: "addressLine2", label: "Address Line 2", aliases: ["address2", "address line 2", "addr2"] },
  { key: "city", label: "City", aliases: ["city", "town"] },
  { key: "pincode", label: "Pincode", aliases: ["pin", "pincode", "zip", "postal", "postal code"] },
  { key: "groupCode", label: "Group Code", aliases: ["group", "group code", "chit code", "chit group", "scheme", "ps", "chit"] },
  { key: "agreeNo", label: "Agree#", aliases: ["agree#", "agree no", "agreement no", "agreement"] },
  { key: "auctionDate", label: "Auction Date", aliases: ["auction date"] },
  { key: "auctionTime", label: "Auction Time", aliases: ["time", "auction time"] },
  { key: "chitValue", label: "Chit Value", aliases: ["chit value", "value", "amount", "chit amount", "chit amount (after incentive)"] },
  { key: "durationMonths", label: "Duration (months)", aliases: ["duration", "months", "duration months", "term", "period"] },
  { key: "auctionDay", label: "Auction Day", aliases: ["auction day", "auction date", "day"] },
  { key: "commissionRate", label: "Commission %", aliases: ["commission", "commission rate", "commission %"] },
  { key: "seats", label: "Seats", aliases: ["seats", "seat count", "shares"] },
  { key: "nameOnChit", label: "Name on Chit", aliases: ["name on chit", "chit name"] },
  { key: "prized", label: "Prized (Yes/No)", aliases: ["prized", "prized (yes/no)", "prized yes/no", "is prized"] },
  { key: "previousBidAmount", label: "Previous Bid Amount", aliases: ["previous bid amount", "previous bid", "prev bid", "winning bid"] },
  { key: "cc", label: "CC", aliases: ["cc"] },
  { key: "shareOfDiscount", label: "Share of Discount", aliases: ["share of discount", "discount share", "share discount"] },
  { key: "chitAmountAfterIncentive", label: "Chit Amount (After Incentive)", aliases: ["chit amount (after incentive)", "chit amount"] },
];

const NUMBER_FIELDS: (keyof ImportRow)[] = ["chitValue", "durationMonths", "auctionDay", "commissionRate", "seats", "previousBidAmount", "shareOfDiscount"];
const BOOLEAN_FIELDS: (keyof ImportRow)[] = ["prized"];

const parseBool = (v: string): boolean => /^(y|yes|true|1|prized)$/i.test(v.trim());

// Period column like "19/30" — second number is duration in months.
const tryParsePeriod = (v: string): number | null => {
  const m = String(v).match(/(\d+)\s*\/\s*(\d+)/);
  return m ? Number(m[2]) : null;
};

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
  templateRows?: ImportRow[];
  templateMode?: boolean;
  templateMonth?: string | null;
};

const PANASUNA_HEADERS = ["auction date", "subscriber name", "chit value"];

const PANASUNA_MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

const PANASUNA_ADDRESS_SKIP = /^(intimation|screenshot after payment is|member code|phone no|panasuna chits|rosci institution|good day wishes|kindly note|auction time|auction date|time|agree#|group|subscriber name|prized|chit value|previous bid amount|cc|share of discount|period|chit amount|total|grand total|previous pending|balance|pending|outstanding)$/i;

function looksLikePanasunaTemplate(grid: string[][]): boolean {
  const flat = grid
    .slice(0, 30)
    .map((row) => row.map((c) => String(c).toLowerCase()).join(" | "))
    .join("\n");
  if (flat.includes("panasuna") && flat.includes("member code")) return true;
  if (flat.includes("auction date") && flat.includes("prized") && flat.includes("chit value") && flat.includes("period")) return true;
  return false;
}

function detectPanasunaMonth(grid: string[][]): string | null {
  const text = grid.slice(0, 30).map((row) => row.map((c) => String(c).trim()).filter(Boolean).join(" ")).join("\n");
  const match = text.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s*[-–]\s*(\d{4})\s+chit details\b/i);
  if (!match) return null;
  const month = PANASUNA_MONTHS[match[1].toLowerCase()];
  return month ? `${match[2]}-${month}` : null;
}

function parsePanasunaGrid(grid: string[][]): ImportRow[] {
  const out: ImportRow[] = [];

  type Block = {
    name: string;
    accessCode: string;
    phone: string;
    addressLines: string[];
    month: string | null;
    headerRow?: number;
    columnMap?: Record<string, number>;
  };

  let block: Block | null = null;

  const stripHonorifics = (s: string) => s.replace(/^(mr\.?|mrs\.?|dr\.?|ms\.?|sri|smt|miss|shri)\s*/i, "").trim();

  const extractMemberCode = (text: string): string | null => {
    const m = text.match(/PCPL\s*0*(\d{1,5})/i);
    return m ? `PCPL${String(m[1]).padStart(4, "0")}` : null;
  };

  const extractPhone = (text: string): string | null => {
    const m = text.match(/(\d{10,12})/);
    if (!m) return null;
    const digits = m[1].replace(/\D/g, "");
    return digits.slice(-10);
  };

  const isHeaderRow = (row: string[]): boolean => {
    const lower = row.map((c) => String(c).toLowerCase().trim());
    return PANASUNA_HEADERS.every((needle) => lower.some((cell) => cell.includes(needle)));
  };

  const buildColumnMap = (row: string[]): Record<string, number> => {
    const map: Record<string, number> = {};
    row.forEach((cell, idx) => {
      const k = String(cell).toLowerCase().trim().replace(/\s+/g, " ");
      if (!k) return;
      map[k] = idx;
    });
    return map;
  };

  const get = (row: string[], cm: Record<string, number>, ...keys: string[]) => {
    const normKey = (v: string) => String(v).toLowerCase().trim().replace(/\s+/g, " ");

    // Exact key match first.
    for (const k of keys) {
      const idx = cm[normKey(k)];
      if (idx != null && row[idx] != null) {
        const v = String(row[idx]).trim();
        if (v) return v;
      }
    }

    // Fallback to fuzzy/contains match for template header variations.
    const entries = Object.entries(cm);
    for (const rawKey of keys) {
      const nk = normKey(rawKey);
      const matched = entries.find(([header]) => header.includes(nk) || nk.includes(header));
      if (!matched) continue;
      const idx = matched[1];
      if (idx != null && row[idx] != null) {
        const v = String(row[idx]).trim();
        if (v) return v;
      }
    }

    return "";
  };

  const parseNum = (v: string): number | null => {
    if (!v) return null;
    const cleaned = v.replace(/[,\s]/g, "").replace(/[^\d.\-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  };

  const SUMMARY_LABELS = ["total", "grand total", "previous pending", "sub total", "sub-total", "subtotal", "balance", "previous balance", "pending", "carried forward", "carry forward", "outstanding"];

  const isTotalRow = (row: string[]): boolean => {
    const cells = row.map((c) => String(c).toLowerCase().trim()).filter(Boolean);
    if (cells.some((c) => SUMMARY_LABELS.includes(c))) return true;
    const joined = cells.join(" | ");
    return /\b(grand\s*total|previous\s*pending|sub[\s-]?total|previous\s*balance|carried\s*forward|carry\s*forward|outstanding)\b/.test(joined)
      || /(^|\|\s*)total(\s*|\s*\|)/.test(joined);
  };

  const startNewBlock = () => {
    block = { name: "", accessCode: "", phone: "", addressLines: [], month: detectPanasunaMonth(grid) };
  };

  for (let i = 0; i < grid.length; i++) {
    const row = grid[i].map((c) => String(c ?? "").trim());

    if (row.every((c) => !c)) continue;

    const rowJoined = row.join(" | ");

    if (rowJoined.toLowerCase().includes("panasuna chits")) {
      if (block && (block.name || block.accessCode || block.phone) && !block.headerRow) {
        // Header repeated — start a new block
        block = null;
      }
      if (!block) startNewBlock();
      continue;
    }

    if (rowJoined.toLowerCase().includes("member code")) {
      const code = extractMemberCode(rowJoined);
      if (code) {
        if (!block) startNewBlock();
        block!.accessCode = code;
      }
    }
    if (rowJoined.toLowerCase().includes("phone no")) {
      const ph = extractPhone(rowJoined);
      if (ph && ph.length === 10) {
        if (!block) startNewBlock();
        block!.phone = ph;
      }
    }

    for (const cell of row) {
      const m = cell.match(/^Dear\s+(.+?)[,.]?$/i);
      if (m) {
        if (!block) startNewBlock();
        block!.name = stripHonorifics(m[1].trim().replace(/\.$/, "")).trim();
      }
    }

    if (isHeaderRow(row)) {
      if (!block) startNewBlock();
      block!.headerRow = i;
      block!.columnMap = buildColumnMap(row);
      continue;
    }

    if (block?.headerRow != null) {
      if (isTotalRow(row)) {
        // End of this block's data section. Reset block.
        block = null;
        continue;
      }
      const cm = block.columnMap!;
      const groupCode = get(row, cm, "group", "group code", "chit group", "scheme", "chit code");
      const subscriberOnRow = get(row, cm, "subscriber name");
      if (!groupCode && !subscriberOnRow) continue;

      const summaryCheck = `${groupCode} ${subscriberOnRow}`.toLowerCase().trim();
      if (SUMMARY_LABELS.some((label) => summaryCheck === label || summaryCheck.startsWith(label + " ") || summaryCheck.endsWith(" " + label))) continue;

      const auctionStr = get(row, cm, "auction date", "auction day");
      const timeStr = get(row, cm, "time", "auction time");
      const agreeStr = get(row, cm, "agree#", "agree no", "agreement no", "agreement");
      const prizedStr = get(row, cm, "prized (yes/no)", "prized yes/no", "prized");
      const chitVal = get(row, cm, "chit value");
      const prevBid = get(row, cm, "previous bid amount");
      const ccStr = get(row, cm, "cc");
      const shareDisc = get(row, cm, "share of discount");
      const period = get(row, cm, "period");
      const chitAmtAfter = get(row, cm, "chit amount (after incentive)", "chit amount");

      const periodMatch = period.match(/(\d+)\s*\/\s*(\d+)/);
      const durationMonths = periodMatch ? Number(periodMatch[2]) : null;

      out.push({
        subscriberName: block.name || subscriberOnRow,
        accessCode: block.accessCode || null,
        whatsapp: block.phone || null,
        addressLine1: block.addressLines.slice(0, 2).join(", ") || null,
        addressLine2: block.addressLines.slice(2).join(", ") || null,
        city: "Salem",
        pincode: (block.addressLines.join(" ").match(/(\d{6})/) || [null, null])[1],
        groupCode: groupCode || null,
        agreeNo: agreeStr || null,
        auctionDate: auctionStr || null,
        auctionTime: timeStr || null,
        chitValue: parseNum(chitVal),
        durationMonths,
        auctionDay: parseNum(auctionStr),
        seats: 1,
        nameOnChit: subscriberOnRow || block.name,
        prized: /^y/i.test(prizedStr),
        previousBidAmount: parseNum(prevBid),
        cc: parseNum(ccStr),
        shareOfDiscount: parseNum(shareDisc),
        chitAmountAfterIncentive: parseNum(chitAmtAfter),
        month: block.month,
      });
      continue;
    }

    // Address capture: any non-marker text inside an open block before header
    if (block && !block.headerRow) {
      for (const cell of row) {
        if (!cell) continue;
        const normalized = cell.trim();
        if (!normalized || normalized.length < 3) continue;
        if (PANASUNA_ADDRESS_SKIP.test(normalized.toLowerCase())) continue;
        if (/^dear\s+/i.test(normalized)) continue;
        if (/\b(intimation|member code|phone no|chit details|kindly note|auction time|auction date|period|chit value|previous bid amount|share of discount)\b/i.test(normalized)) continue;
        block.addressLines.push(normalized);
      }
    }
  }

  // De-dupe identical rows (same person + same group)
  const seen = new Set<string>();
  return out.filter((r) => {
    const key = `${(r.accessCode || r.subscriberName || "").toLowerCase()}::${(r.groupCode || "").toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

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
        const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" }) as string[][];

        if (looksLikePanasunaTemplate(grid)) {
          const templateRows = parsePanasunaGrid(grid);
          if (!templateRows.length) {
            toast.error("Template detected but no subscriber rows could be extracted.");
            return;
          }
          if (!templateRows.some((r) => (r.groupCode || "").trim())) {
            toast.warning("Template parsed, but no group codes were found. Check header names in the source file.");
          }
          setParsed({
            fileName: file.name,
            headers: ["Subscriber Name", "Access Code", "WhatsApp", "Group Code", "Chit Value", "Prized", "Auction Day", "Duration", "Previous Bid Amount", "Share of Discount"],
            rows: [],
            templateRows,
            templateMode: true,
            templateMonth: templateRows.find((r) => r.month)?.month ?? detectPanasunaMonth(grid),
          });
          setMapping({});
          toast.success(`Detected Panasuna template — extracted ${templateRows.length} subscription rows from ${file.name}`);
          return;
        }

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
    if (parsed.templateMode && parsed.templateRows) return parsed.templateRows;
    return parsed.rows
      .filter((row) => {
        // Skip "Total" summary rows that have no subscriber name in any name-mapped column
        const firstVal = Object.values(row)[0]?.toString().trim().toLowerCase();
        return firstVal !== "total";
      })
      .map((row) => {
        const out: any = {};
        for (const [header, target] of Object.entries(mapping)) {
          if (!target) continue;
          const raw = (row[header] ?? "").toString().trim();
          if (!raw) continue;
          if (BOOLEAN_FIELDS.includes(target)) {
            out[target] = parseBool(raw);
          } else if (target === "durationMonths") {
            // Period like "19/30" → 30, otherwise normal number parse
            const period = tryParsePeriod(raw);
            if (period != null) {
              out[target] = period;
            } else {
              const num = Number(raw.replace(/[,\s]/g, ""));
              out[target] = Number.isFinite(num) ? num : null;
            }
          } else if (NUMBER_FIELDS.includes(target)) {
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
    const templateMode = parsed?.templateMode === true;
    const hasNameMapping = templateMode ? true : Object.values(mapping).includes(required.key);
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
                <div className="text-xs text-muted-foreground">
                  {parsed.templateMode
                    ? `Panasuna receipt template · ${parsed.templateRows?.length ?? 0} subscription rows extracted`
                    : `${parsed.rows.length} data rows · ${parsed.headers.length} columns`}
                </div>
              </div>
              <Button variant="outline" onClick={reset}>Choose different file</Button>
            </div>
            {parsed.templateMode && (
              <div className="mt-3 rounded-md border border-emerald-300/60 bg-emerald-50/60 p-3 text-xs text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/10 dark:text-emerald-200">
                <div className="font-semibold">Detected: Panasuna multi-block receipt template</div>
                <p className="mt-0.5">
                  Member Code, phone, name, address and the chit table are pulled from each block. Column mapping is skipped — preview the rows below and import.
                </p>
              </div>
            )}
          </Card>

          {!parsed.templateMode && (
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
          )}

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
                    {(parsed.templateMode
                      ? FIELD_DEFS.filter((d) => mappedRows.some((r) => r[d.key] != null && r[d.key] !== ""))
                      : FIELD_DEFS.filter((d) => Object.values(mapping).includes(d.key))
                    ).map((d) => (
                      <th key={d.key} className="px-2 py-2 text-left">{d.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {mappedRows.slice(0, 25).map((row, i) => (
                    <tr key={i} className={!row.subscriberName?.trim() ? "bg-destructive/5" : ""}>
                      <td className="px-2 py-1.5 text-muted-foreground">{i + 1}</td>
                      {(parsed.templateMode
                        ? FIELD_DEFS.filter((d) => mappedRows.some((r) => r[d.key] != null && r[d.key] !== ""))
                        : FIELD_DEFS.filter((d) => Object.values(mapping).includes(d.key))
                      ).map((d) => (
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
