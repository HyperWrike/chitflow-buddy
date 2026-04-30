import { createFileRoute, Link } from "@tanstack/react-router";
import { ProtectedLayout } from "@/components/ProtectedLayout";
import { useQuery } from "@tanstack/react-query";
import { db } from "@/lib/db-types";
import { Card } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/subscribers/$id")({
  component: SubscriberDetailPage,
  head: () => ({ meta: [{ title: "Subscriber Details — Panasuna Chits" }] }),
});

function SubscriberDetailPage() {
  return (
    <ProtectedLayout>
      <Detail />
    </ProtectedLayout>
  );
}

function Detail() {
  const { id } = Route.useParams();

  const sub = useQuery({
    queryKey: ["subscriber", id],
    queryFn: async () => {
      const { data, error } = await db.from("subscribers").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const subs = useQuery({
    queryKey: ["subscriptions-for-subscriber", id],
    queryFn: async () => {
      const { data, error } = await db
        .from("subscriptions")
        .select("*, chit_groups!inner(group_code, chit_value, auction_day, duration_months)")
        .eq("subscriber_id", id);
      if (error) throw error;
      return data;
    },
  });

  if (sub.isLoading) return <div>Loading...</div>;
  if (!sub.data) return <div>Not found.</div>;

  return (
    <div className="space-y-6">
      <Link to="/subscribers" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="mr-1 h-4 w-4" /> Back to subscribers
      </Link>

      <div>
        <h1 className="text-3xl font-bold">{sub.data.name}</h1>
        <p className="text-sm font-mono text-muted-foreground">{sub.data.access_code}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Contact</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">WhatsApp</dt><dd className="font-mono">{sub.data.whatsapp_number}</dd></div>
            {sub.data.alt_number && <div className="flex justify-between"><dt className="text-muted-foreground">Alt</dt><dd className="font-mono">{sub.data.alt_number}</dd></div>}
          </dl>
        </Card>
        <Card className="p-5">
          <h2 className="mb-3 text-sm font-semibold uppercase text-muted-foreground">Address</h2>
          <p className="text-sm">
            {sub.data.address_line1}<br />
            {sub.data.address_line2 && <>{sub.data.address_line2}<br /></>}
            {sub.data.city} {sub.data.pincode && `- ${sub.data.pincode}`}
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3">
          <h2 className="text-base font-semibold">Chit Group Memberships</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/60 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Group</th>
              <th className="px-4 py-2 text-left">Name on Chit</th>
              <th className="px-4 py-2 text-right">Seats</th>
              <th className="px-4 py-2 text-right">Chit Value</th>
              <th className="px-4 py-2 text-left">Auction Day</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {(subs.data ?? []).length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">No chit group memberships yet.</td></tr>
            )}
            {(subs.data ?? []).map((s: any) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium">
                  <Link to="/groups/$id" params={{ id: s.group_id }} className="hover:text-primary hover:underline">
                    {s.chit_groups.group_code}
                  </Link>
                </td>
                <td className="px-4 py-3">{s.name_on_chit}</td>
                <td className="px-4 py-3 text-right">{s.seat_count}</td>
                <td className="px-4 py-3 text-right">{formatINR(s.chit_groups.chit_value)}</td>
                <td className="px-4 py-3">Day {s.chit_groups.auction_day}</td>
                <td className="px-4 py-3">
                  {s.prized
                    ? <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-gold-foreground">Prized {s.prized_month ?? ""}</span>
                    : <span className="text-xs text-muted-foreground">Active</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
