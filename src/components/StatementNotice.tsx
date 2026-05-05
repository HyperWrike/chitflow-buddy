import { formatINR, formatMonth, formatINRCompact } from "@/lib/format";

interface StatementRow {
  auction_day: number;
  group_code: string;
  name_on_chit: string;
  prized: boolean;
  chit_value: number;
  amount_due: number;
}

interface Props {
  subscriber: {
    name: string;
    access_code: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string;
    pincode: string | null;
    whatsapp_number: string;
  };
  month: string;
  rows: StatementRow[];
  auctionTime?: string | null;
}

export function StatementNotice({ subscriber, month, rows, auctionTime }: Props) {
  const total = rows.reduce((s, r) => s + r.amount_due, 0);
  return (
    <div
      className="mx-auto overflow-hidden border border-slate-300 bg-white text-slate-900 shadow-xl"
      style={{ width: 640, fontFamily: "var(--font-body)" }}
    >
      <div className="bg-[#0f2744] px-4 py-3 text-center text-white">
        <div className="font-display text-2xl tracking-wide">PANASUNA CHITS (P) LTD.,</div>
        <div className="text-xs tracking-wide">419, Chinna Kadai St, Salem - 636 001.</div>
        <div className="text-[11px] italic opacity-90">(A ROSCA Institution)</div>
      </div>
      <div className="flex items-center justify-between bg-[#f5a623] px-4 py-2 text-[11px] font-semibold text-[#0f2744]">
        <span>Ph: 9842567890</span>
        <span className="text-sm tracking-wide">Good Day Wishes !!!</span>
        <span>Code:{subscriber.access_code}</span>
      </div>
      <div className="grid grid-cols-1 border-b border-slate-300 md:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-1 px-4 py-4 text-sm">
          <div className="font-medium">Dear {subscriber.name},</div>
          {subscriber.address_line1 && <div className="text-xs">{subscriber.address_line1}</div>}
          {subscriber.address_line2 && <div className="text-xs">{subscriber.address_line2}</div>}
          <div className="text-xs">
            {subscriber.city}
            {subscriber.pincode ? ` - ${subscriber.pincode}` : ""}
          </div>
        </div>
        <div className="border-t border-slate-300 px-4 py-4 text-right md:border-l md:border-t-0">
          <div className="font-display text-lg uppercase tracking-wide text-[#0f2744]">
            {formatMonth(month)} Chit Details
          </div>
          {auctionTime && (
            <div className="mt-2 text-xs">Auction Time: {auctionTime} @ 9842360611</div>
          )}
          <div className="mt-3 inline-flex rounded-full bg-[#eff6ff] px-3 py-1 text-[11px] font-semibold text-[#2563eb]">
            Live statement preview
          </div>
        </div>
      </div>
      <div className="border-b border-slate-300 bg-[#ddeeff] px-4 py-2 text-center text-[11px] font-medium text-[#1d4e89]">
        Kindly note the chit amount and pay before Auction Date.
      </div>
      <table className="w-full border-collapse text-xs">
        <thead className="bg-[#f5f8ff] text-[#0f2744]">
          <tr>
            <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">Date</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Group</th>
            <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold">Name</th>
            <th className="border border-slate-300 px-2 py-1.5 text-center font-semibold">
              Prized
            </th>
            <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold">
              ChitVal
            </th>
            <th className="border border-slate-300 px-2 py-1.5 text-right font-semibold text-[#9b3a9b]">
              Due
            </th>
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(even)]:bg-[#f5f8ff]">
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-200">
              <td className="border border-slate-300 px-2 py-1.5 text-center">{r.auction_day}</td>
              <td className="border border-slate-300 px-2 py-1.5 font-mono font-medium">
                {r.group_code}
              </td>
              <td className="border border-slate-300 px-2 py-1.5">{r.name_on_chit}</td>
              <td className="border border-slate-300 px-2 py-1.5 text-center">
                {r.prized ? "Yes" : "No"}
              </td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono">
                {formatINRCompact(r.chit_value)}
              </td>
              <td className="border border-slate-300 px-2 py-1.5 text-right font-mono font-semibold text-[#9b3a9b]">
                {formatINRCompact(r.amount_due)}
              </td>
            </tr>
          ))}
          <tr className="bg-[#fff8ec] font-bold">
            <td colSpan={5} className="border border-slate-300 px-2 py-2 text-right">
              TOTAL:
            </td>
            <td className="border border-slate-300 px-2 py-2 text-right font-mono text-[#9b3a9b]">
              {formatINRCompact(total)}
            </td>
          </tr>
        </tbody>
      </table>
      <div className="bg-[#f7f8fa] px-4 py-2 text-center text-[10px] text-slate-500">
        For queries call: 9842567890 · Panasuna Chits (P) Ltd
      </div>
    </div>
  );
}
