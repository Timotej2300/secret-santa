import { requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "E-mailové logy" };
export const dynamic = "force-dynamic";

export default async function EmailLogs() {
  await requireRole("owner", "system_admin");
  const { data } = await admin().from("email_logs").select("id,to_email,template,status,error,created_at,groups(name)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { id: string; to_email: string; template: string; status: string; error: string | null; created_at: string; groups: { name: string } | null }[];
  return (
    <>
      <PageTitle title="E-mailové logy" subtitle="Posledných 200 e-mailov" />
      {rows.length === 0 ? (
        <Empty title="Zatiaľ žiadne e-maily" />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[720px]">
            <thead className="border-b border-forest-900/5"><tr><th className="th">Čas</th><th className="th">Komu</th><th className="th">Šablóna</th><th className="th">Skupina</th><th className="th">Stav</th></tr></thead>
            <tbody className="divide-y divide-forest-900/5">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td text-xs">{fmtDateTime(r.created_at)}</td>
                  <td className="td">{r.to_email}</td>
                  <td className="td text-xs">{r.template}</td>
                  <td className="td text-xs">{r.groups?.name ?? "—"}</td>
                  <td className="td"><Badge tone={r.status === "failed" ? "red" : r.status === "sent" ? "gray" : "green"}>{r.status}</Badge>{r.error && <div className="mt-1 max-w-xs text-xs text-red-700">{r.error}</div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
