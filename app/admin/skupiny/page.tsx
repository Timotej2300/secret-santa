import Link from "next/link";
import { Trash2 } from "lucide-react";
import { isOwner, requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { DRAW_STATUS, GROUP_STATUS, participantCounts } from "@/lib/queries";
import { ActionButton } from "@/components/Form";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { deleteGroup } from "@/app/actions/admin";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Všetky skupiny" };
export const dynamic = "force-dynamic";

export default async function AllGroups() {
  const s = await requireRole("owner", "system_admin");
  const owner = isOwner(s);
  const { data } = await admin().from("groups").select("id,name,status,draw_status,max_participants,gift_deadline,organizer:profiles!groups_organizer_id_fkey(first_name,last_name,email)").order("created_at", { ascending: false });
  const groups = (data ?? []) as unknown as { id: string; name: string; status: string; draw_status: string; max_participants: number; gift_deadline: string | null; organizer: { first_name: string; last_name: string; email: string } }[];
  const counts = await participantCounts(groups.map((g) => g.id));
  return (
    <>
      <PageTitle title="Všetky skupiny" />
      {groups.length === 0 ? (
        <Empty title="Zatiaľ žiadne skupiny" />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-forest-900/5"><tr><th className="th">Skupina</th><th className="th">Organizátor</th><th className="th">Účastníci</th><th className="th">Stav</th><th className="th">Termín</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-forest-900/5">
              {groups.map((g) => (
                <tr key={g.id}>
                  <td className="td font-medium">{owner ? <Link href={`/organizator/skupiny/${g.id}`} className="underline decoration-gold-500">{g.name}</Link> : g.name}</td>
                  <td className="td text-forest-900/70">{g.organizer.first_name} {g.organizer.last_name}<br /><span className="text-xs">{g.organizer.email}</span></td>
                  <td className="td">{counts[g.id].registered} / {g.max_participants}</td>
                  <td className="td"><Badge tone={g.draw_status === "drawn" ? "green" : "gray"}>{GROUP_STATUS[g.status]} · {DRAW_STATUS[g.draw_status]}</Badge></td>
                  <td className="td text-xs">{fmtDateTime(g.gift_deadline)}</td>
                  <td className="td text-right">{owner && <ActionButton className="btn-ghost !px-3 !text-red-700" run={deleteGroup.bind(null, g.id)} confirm={`Natrvalo zmazať skupinu „${g.name}“ vrátane účastníkov a priradení?`}><Trash2 size={15} /></ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
