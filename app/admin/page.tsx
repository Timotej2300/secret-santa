import { hasRole, requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { PageTitle, Stat } from "@/components/ui";

export const metadata = { title: "Administrácia" };
export const dynamic = "force-dynamic";

async function count(table: string) {
  const { count: c } = await admin().from(table).select("*", { count: "exact", head: true });
  return c ?? 0;
}

export default async function AdminHome() {
  const s = await requireRole("owner", "system_admin", "support");
  const sys = hasRole(s, "owner", "system_admin");
  const db = admin();
  const since = new Date(Date.now() - 86400000).toISOString();
  const [{ count: openTickets }, { count: failed }, { count: drawn }] = await Promise.all([
    db.from("support_tickets").select("*", { count: "exact", head: true }).in("status", ["open", "in_progress"]),
    db.from("email_logs").select("*", { count: "exact", head: true }).eq("status", "failed").gte("created_at", since),
    db.from("groups").select("*", { count: "exact", head: true }).eq("draw_status", "drawn"),
  ]);
  return (
    <>
      <PageTitle title="Prehľad platformy" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Otvorené požiadavky" value={openTickets ?? 0} />
        {sys && (
          <>
            <Stat label="Používatelia" value={await count("profiles")} />
            <Stat label="Skupiny" value={await count("groups")} hint={`${drawn ?? 0} vylosovaných`} />
            <Stat label="Účastníci" value={await count("participants")} />
            <Stat label="Chybné e-maily (24 h)" value={failed ?? 0} />
            <Stat label="Záznamy v audite" value={await count("audit_logs")} />
          </>
        )}
      </div>
    </>
  );
}
