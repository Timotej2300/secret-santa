import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { TICKET_STATUS, TICKET_TYPE } from "@/components/Support";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Podpora" };
export const dynamic = "force-dynamic";

export default async function AdminSupport() {
  await requireRole("owner", "system_admin", "support");
  const { data } = await admin().from("support_tickets").select("id,type,subject,status,created_at,user:profiles!support_tickets_user_id_fkey(first_name,last_name,email)").order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as unknown as { id: string; type: string; subject: string; status: string; created_at: string; user: { first_name: string; last_name: string; email: string } }[];
  return (
    <>
      <PageTitle title="Podpora" />
      {rows.length === 0 ? (
        <Empty title="Žiadne požiadavky" />
      ) : (
        <ul className="space-y-3">
          {rows.map((t) => (
            <li key={t.id}>
              <Link href={`/admin/podpora/${t.id}`} className="card flex items-center justify-between gap-3 !p-4 transition hover:shadow-lift">
                <div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-xs text-forest-900/50">{t.user.first_name} {t.user.last_name} · {TICKET_TYPE[t.type]} · {fmtDateTime(t.created_at)}</p>
                </div>
                <Badge tone={t.status === "resolved" || t.status === "closed" ? "green" : "gold"}>{TICKET_STATUS[t.status]}</Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
