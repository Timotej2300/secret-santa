import Link from "next/link";
import { CalendarClock, Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { DRAW_STATUS, GIFT_STATUS, organizerGroups, participantCounts } from "@/lib/queries";
import { Badge, Empty, PageTitle, Stat } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Organizátor" };

export default async function OrganizerDashboard() {
  const s = await requireUser();
  const groups = await organizerGroups(s.user.id);
  const ids = groups.map((g) => g.id);
  const counts = await participantCounts(ids);
  const totals = Object.values(counts).reduce((a, c) => ({ total: a.total + c.total, registered: a.registered + c.registered, pending: a.pending + c.pending }), { total: 0, registered: 0, pending: 0 });

  const giftCounts: Record<string, number> = {};
  if (ids.length) {
    const { data } = await admin().from("assignments").select("id,gift_statuses(status)").in("group_id", ids).eq("is_active", true);
    ((data ?? []) as unknown as { gift_statuses: { status: string } | { status: string }[] | null }[]).forEach((a) => {
      const gs = Array.isArray(a.gift_statuses) ? a.gift_statuses[0] : a.gift_statuses;
      if (gs) giftCounts[gs.status] = (giftCounts[gs.status] ?? 0) + 1;
    });
  }
  const upcoming = groups.filter((g) => g.gift_deadline && new Date(g.gift_deadline) > new Date()).sort((a, b) => +new Date(a.gift_deadline!) - +new Date(b.gift_deadline!))[0];

  return (
    <>
      <PageTitle title={`Ahoj, ${s.user.first_name || "organizátor"}`} subtitle="Prehľad tvojich skupín" action={<Link href="/organizator/skupiny/nova" className="btn-primary"><Plus size={16} /> Nová skupina</Link>} />
      {groups.length === 0 ? (
        <Empty title="Zatiaľ nemáš žiadnu skupinu" icon={<Users size={26} />}>
          Vytvor prvú skupinu a pozvi účastníkov.
          <div className="mt-4"><Link href="/organizator/skupiny/nova" className="btn-primary">Vytvoriť skupinu</Link></div>
        </Empty>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Skupiny" value={groups.length} />
            <Stat label="Účastníci" value={totals.total} />
            <Stat label="Zaregistrovaní" value={totals.registered} />
            <Stat label="Čakajúce pozvánky" value={totals.pending} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-forest-800">Stav losovania</h2>
              <ul className="mt-3 divide-y divide-forest-900/5">
                {groups.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                    <Link href={`/organizator/skupiny/${g.id}`} className="font-medium hover:underline">{g.name}</Link>
                    <Badge tone={g.draw_status === "drawn" ? "green" : g.draw_status === "needs_redraw" ? "red" : "gray"}>{DRAW_STATUS[g.draw_status]}</Badge>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card">
              <h2 className="font-display text-lg font-semibold text-forest-800">Stav darčekov</h2>
              {Object.keys(giftCounts).length === 0 ? (
                <p className="mt-3 text-sm text-forest-900/50">Po losovaní sa tu zobrazia stavy darčekov.</p>
              ) : (
                <ul className="mt-3 divide-y divide-forest-900/5">
                  {Object.entries(GIFT_STATUS).map(([k, label]) => (
                    <li key={k} className="flex justify-between py-2.5 text-sm"><span>{label}</span><b>{giftCounts[k] ?? 0}</b></li>
                  ))}
                </ul>
              )}
              {upcoming && (
                <p className="mt-4 flex items-center gap-2 rounded-2xl bg-cream p-3 text-sm"><CalendarClock size={16} className="text-gold-600" /> Najbližší termín: <b>{fmtDateTime(upcoming.gift_deadline)}</b> ({upcoming.name})</p>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
