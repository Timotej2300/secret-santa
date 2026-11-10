import { requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { DRAW_STATUS } from "@/lib/queries";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Losovania a priradenia" };
export const dynamic = "force-dynamic";

export default async function Draws() {
  await requireRole("owner");
  const db = admin();
  const { data: gd } = await db.from("groups").select("id,name,draw_status,draw_round,drawn_at").neq("draw_status", "not_drawn").order("drawn_at", { ascending: false });
  const groups = (gd ?? []) as { id: string; name: string; draw_status: string; draw_round: number; drawn_at: string | null }[];
  const { data: ad } = groups.length
    ? await db.from("assignments").select("group_id,giver:participants!assignments_giver_id_fkey(first_name,last_name),receiver:participants!assignments_receiver_id_fkey(first_name,last_name)").in("group_id", groups.map((g) => g.id)).eq("is_active", true)
    : { data: [] };
  const rows = (ad ?? []) as unknown as { group_id: string; giver: { first_name: string; last_name: string }; receiver: { first_name: string; last_name: string } }[];
  return (
    <>
      <PageTitle title="Losovania a priradenia" subtitle="Globálny prístup Ownera" />
      {groups.length === 0 ? (
        <Empty title="Zatiaľ neprebehlo žiadne losovanie" />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <details key={g.id} className="card" open={groups.length === 1}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 font-display text-lg font-semibold text-forest-800">
                {g.name}
                <span className="flex items-center gap-2 text-sm font-normal text-forest-900/60"><Badge tone={g.draw_status === "drawn" ? "green" : "red"}>{DRAW_STATUS[g.draw_status]}</Badge> kolo {g.draw_round} · {fmtDateTime(g.drawn_at)}</span>
              </summary>
              <ul className="mt-4 divide-y divide-forest-900/5 text-sm">
                {rows.filter((r) => r.group_id === g.id).map((r, i) => (
                  <li key={i} className="flex justify-between py-2"><span>{r.giver.first_name} {r.giver.last_name}</span><span>→ {r.receiver.first_name} {r.receiver.last_name}</span></li>
                ))}
                {rows.every((r) => r.group_id !== g.id) && <li className="py-2 text-forest-900/50">Priradenia sú neaktívne (čaká sa na nové losovanie).</li>}
              </ul>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
