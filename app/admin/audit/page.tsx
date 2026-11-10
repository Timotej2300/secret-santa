import { requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { Empty, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Audit logy" };
export const dynamic = "force-dynamic";

export default async function Audit() {
  await requireRole("owner", "system_admin");
  const { data } = await admin().from("audit_logs").select("id,action,entity,entity_id,meta,created_at,actor:profiles!audit_logs_actor_id_fkey(first_name,last_name,email)").order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as unknown as { id: string; action: string; entity: string | null; entity_id: string | null; meta: Record<string, unknown>; created_at: string; actor: { first_name: string; last_name: string; email: string } | null }[];
  return (
    <>
      <PageTitle title="Audit logy" subtitle="Posledných 300 záznamov" />
      {rows.length === 0 ? (
        <Empty title="Zatiaľ žiadne záznamy" />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[760px]">
            <thead className="border-b border-forest-900/5"><tr><th className="th">Čas</th><th className="th">Používateľ</th><th className="th">Akcia</th><th className="th">Detail</th></tr></thead>
            <tbody className="divide-y divide-forest-900/5">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td text-xs">{fmtDateTime(r.created_at)}</td>
                  <td className="td text-xs">{r.actor ? `${r.actor.first_name} ${r.actor.last_name}` : "systém"}</td>
                  <td className="td font-mono text-xs">{r.action}</td>
                  <td className="td text-xs text-forest-900/60">{r.entity}{r.entity_id ? ` · ${r.entity_id.slice(0, 8)}` : ""} {Object.keys(r.meta ?? {}).length ? JSON.stringify(r.meta) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
