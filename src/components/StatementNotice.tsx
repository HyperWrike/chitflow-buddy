import { formatINR, formatMonth } from "@/lib/format";

interface StatementRow {
  auction_day: number;
  group_code: string;
  name_on_chit: string;
  prized: boolean;
  chit_value: number;
  amount_due: number;
}

interface Props {
  subscriber: { name: string; access_code: string; address_line1: string | null; address_line2: string | null; city: string; pincode: string | null; whatsapp_number: string };
  month: string;
  rows: StatementRow[];
  auctionTime?: string | null;
}

export function StatementNotice({ subscriber, month, rows, auctionTime }: Props) {
  const total = rows.reduce((s, r) => s + r.amount_due, 0);
  return (
    <div className="bg-white text-black border-2 border-primary mx-auto" style={{ width: 640, fontFamily: "Georgia, serif" }}>
      <div className="bg-primary text-primary-foreground text-center py-3 px-4">
        <div className="text-xl font-bold tracking-wide">PANASUNA CHITS (P) LTD</div>
        <div className="text-xs">419/151-A, Chinnakadai St, I Agraharam, Salem 636001</div>
        <div className="text-xs italic">(A ROSCA Institution)</div>
      </div>
      <div className="bg-gold text-gold-foreground flex justify-between items-center px-4 py-1.5 text-xs font-semibold">
        <span>Phone: 9842567890</span>
        <span className="text-sm">Good Day Wishes !!!</span>
        <span>Code: {subscriber.access_code}</span>
      </div>
      <div className="grid grid-cols-2 gap-4 px-4 py-3 text-sm border-b">
        <div>
          <div>Dear {subscriber.name}</div>
          {subscriber.address_line1 && <div className="text-xs">{subscriber.address_line1}</div>}
          {subscriber.address_line2 && <div className="text-xs">{subscriber.address_line2}</div>}
          <div className="text-xs">{subscriber.city}{subscriber.pincode ? ` - ${subscriber.pincode}` : ""}</div>
        </div>
        <div className="text-right">
          <div className="font-bold">{formatMonth(month).toUpperCase()} Chit Details</div>
          {auctionTime && <div className="text-xs mt-1">Auction Time: {auctionTime} @ 9842360611</div>}
        </div>
      </div>
      <div className="bg-blue-100 text-blue-900 text-center py-1.5 text-xs font-medium border-b">
        Kindly note the chit amount and pay before Auction Date
      </div>
      <table className="w-full text-xs">
        <thead className="bg-muted">
          <tr>
            <th className="px-2 py-1.5 border">Auction Date</th>
            <th className="px-2 py-1.5 border">Group</th>
            <th className="px-2 py-1.5 border">Subscriber Name</th>
            <th className="px-2 py-1.5 border">Prized</th>
            <th className="px-2 py-1.5 border text-right">Chit Value</th>
            <th className="px-2 py-1.5 border text-right">Amount Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="px-2 py-1.5 border text-center">{r.auction_day}</td>
              <td className="px-2 py-1.5 border font-mono">{r.group_code}</td>
              <td className="px-2 py-1.5 border">{r.name_on_chit}</td>
              <td className="px-2 py-1.5 border text-center">{r.prized ? "Yes" : "No"}</td>
              <td className="px-2 py-1.5 border text-right">{formatINR(r.chit_value, false)}</td>
              <td className="px-2 py-1.5 border text-right font-semibold">{formatINR(r.amount_due, false)}</td>
            </tr>
          ))}
          <tr className="bg-gold/30 font-bold">
            <td colSpan={5} className="px-2 py-2 border text-right">TOTAL:</td>
            <td className="px-2 py-2 border text-right">{formatINR(total, false)}</td>
          </tr>
        </tbody>
      </table>
      <div className="px-4 py-2 text-[10px] text-center text-muted-foreground bg-muted/40">
        For queries call: 9842567890 — Panasuna Chits (P) Ltd
      </div>
    </div>
  );
}
