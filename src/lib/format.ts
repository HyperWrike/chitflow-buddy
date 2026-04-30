// Indian number formatting + chit-fund helpers

export function formatINR(value: number | string | null | undefined, withSymbol = true): string {
  if (value === null || value === undefined || value === "") return withSymbol ? "₹0" : "0";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return withSymbol ? "₹0" : "0";
  const formatted = new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(Math.round(n));
  return withSymbol ? `₹${formatted}` : formatted;
}

export function formatINRCompact(value: number): string {
  // 30,00,000 style without symbol
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(value));
}

export function formatDateDMY(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function formatMonth(yyyymm: string): string {
  // "2023-06" → "June 2023"
  const [y, m] = yyyymm.split("-");
  const idx = Number(m) - 1;
  if (idx < 0 || idx > 11) return yyyymm;
  return `${MONTH_NAMES[idx]} ${y}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-").map(Number);
  const prev = new Date(y, m - 2, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function monthOptions(count = 24): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    out.push({ value: v, label: formatMonth(v) });
  }
  return out;
}

export function formatPhoneE164(num: string): string {
  const digits = num.replace(/\D/g, "").slice(-10);
  return `+91${digits}`;
}
