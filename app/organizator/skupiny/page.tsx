import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { GROUP_STATUS, organizerGroups, participantCounts } from "@/lib/queries";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Moje skupiny" };

export default async function GroupsPage({ searchParams }: { searchParams: Promise<{ sekcia?: string }> }) {
  const s = await requireUser();
  const { sekcia } = await searchParams;
  const groups = await organizerGroups(s.user.id);
  const counts = await participantCounts(groups.map((g) => g.id));
  const tab = ["ucastnici", "losovanie", "emaily", "darceky", "info", "zapisnik"].includes(sekcia ?? "") ? sekcia : undefined;
  return (
    <>
      <PageTitle title="Moje skupiny" subtitle={tab ? "Vyber skupinu, ktorú chceš spravovať" : undefined} action={<Link href="/organizator/skupiny/nova" className="btn-primary"><Plus size={16} /> Nová skupina</Link>} />
      {groups.length === 0 ? (
        <Empty title="Zatiaľ nemáš žiadnu skupinu" icon={<Users size={26} />} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map((g) => (
            <Link key={g.id} href={`/organizator/skupiny/${g.id}${tab ? `?tab=${tab}` : ""}`} className="card block transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-display text-xl font-semibold text-forest-800">{g.name}</h3>
                <Badge tone={g.status === "drawn" ? "green" : g.status === "registration_open" ? "gold" : "gray"}>{GROUP_STATUS[g.status]}</Badge>
              </div>
              <p className="mt-3 text-sm text-forest-900/60">{counts[g.id].registered} / {g.max_participants} zaregistrovaných · {counts[g.id].pending} čaká</p>
              <p className="mt-1 text-sm text-forest-900/60">Termín: {fmtDateTime(g.gift_deadline)}</p>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
