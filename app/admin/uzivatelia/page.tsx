import Link from "next/link";
import { hasRole, isOwner, requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionButton, ActionForm } from "@/components/Form";
import { Badge, PageTitle } from "@/components/ui";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import { setSystemRole, setUserActive, updateUserBasic } from "@/app/actions/admin";

export const metadata = { title: "Používatelia" };
export const dynamic = "force-dynamic";

const FILTERS = [["all", "Všetci používatelia"], ["ucastnici", "Účastníci"], ["organizatori", "Organizátori"], ["vedenie", "Vedenie systému"]] as const;
const ROLE_LABEL: Record<string, string> = { owner: "Owner", system_admin: "System admin", support: "Support", organizer: "Organizátor" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const s = await requireRole("owner", "system_admin");
  const owner = isOwner(s);
  const { f } = await searchParams;
  const filter = FILTERS.some(([k]) => k === f) ? f! : "all";
  const db = admin();
  const { data: pd } = await db.from("profiles").select("id,email,first_name,last_name,phone,is_active,created_at,last_seen_at").order("created_at", { ascending: false }).limit(500);
  const { data: rd } = await db.from("system_roles").select("user_id,role");
  const { data: gd } = await db.from("participants").select("user_id").in("status", ["invited", "registered"]).not("user_id", "is", null);
  const roles = new Map<string, string[]>();
  ((rd ?? []) as { user_id: string; role: string }[]).forEach((r) => roles.set(r.user_id, [...(roles.get(r.user_id) ?? []), r.role]));
  const groupCount = new Map<string, number>();
  ((gd ?? []) as { user_id: string }[]).forEach((g) => groupCount.set(g.user_id, (groupCount.get(g.user_id) ?? 0) + 1));
  const users = ((pd ?? []) as { id: string; email: string; first_name: string; last_name: string; phone: string | null; is_active: boolean; created_at: string; last_seen_at: string | null }[]).filter((u) => {
    const r = roles.get(u.id) ?? [];
    if (filter === "ucastnici") return r.length === 0;
    if (filter === "organizatori") return r.includes("organizer");
    if (filter === "vedenie") return r.some((x) => ["owner", "system_admin", "support"].includes(x));
    return true;
  });
  return (
    <>
      <PageTitle title="Používatelia" />
      <nav className="mb-5 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-soft">
        {FILTERS.map(([k, l]) => (
          <Link key={k} href={`/admin/uzivatelia?f=${k}`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${filter === k ? "bg-forest-700 text-white" : "text-forest-800 hover:bg-forest-50"}`}>{l}</Link>
        ))}
      </nav>
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[860px]">
          <thead className="border-b border-forest-900/5"><tr><th className="th">Meno</th><th className="th">E-mail</th><th className="th">Rola</th><th className="th">Registrácia</th><th className="th">Stav</th><th className="th">Skupiny</th><th className="th">Aktivita</th></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {users.map((u) => {
              const r = roles.get(u.id) ?? [];
              return (
                <tr key={u.id} className="align-top">
                  <td className="td font-medium">
                    {u.first_name} {u.last_name}
                    {owner && (
                      <details className="mt-1 text-xs font-normal">
                        <summary className="cursor-pointer text-forest-600">Upraviť</summary>
                        <ActionForm action={updateUserBasic} className="mt-2 space-y-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <input className="input" name="first_name" defaultValue={u.first_name} required />
                          <input className="input" name="last_name" defaultValue={u.last_name} required />
                          <input className="input" name="phone" defaultValue={u.phone ?? ""} />
                          <button className="btn-primary !py-1.5">Uložiť</button>
                        </ActionForm>
                        {!r.includes("owner") && (
                          <div className="mt-3 flex flex-wrap gap-1">
                            {(["system_admin", "support", "organizer"] as const).map((role) => (
                              <ActionButton key={role} className="btn-ghost !px-2 !py-1 !text-xs" run={setSystemRole.bind(null, u.id, role, !r.includes(role))}>{r.includes(role) ? "− " : "+ "}{ROLE_LABEL[role]}</ActionButton>
                            ))}
                          </div>
                        )}
                      </details>
                    )}
                  </td>
                  <td className="td text-forest-900/70">{u.email}</td>
                  <td className="td">{r.length ? r.map((x) => <Badge key={x} tone="green">{ROLE_LABEL[x]}</Badge>) : <Badge>Účastník</Badge>}</td>
                  <td className="td text-xs">{fmtDate(u.created_at)}</td>
                  <td className="td">
                    <Badge tone={u.is_active ? "green" : "red"}>{u.is_active ? "Aktívny" : "Deaktivovaný"}</Badge>
                    {hasRole(s, "owner", "system_admin") && !r.includes("owner") && (!r.length || owner) && u.id !== s.user.id && (
                      <div className="mt-1"><ActionButton className="btn-ghost !px-2 !py-1 !text-xs" run={setUserActive.bind(null, u.id, !u.is_active)} confirm={u.is_active ? "Deaktivovať účet?" : "Aktivovať účet?"}>{u.is_active ? "Deaktivovať" : "Aktivovať"}</ActionButton></div>
                    )}
                  </td>
                  <td className="td">{groupCount.get(u.id) ?? 0}</td>
                  <td className="td text-xs">{fmtDateTime(u.last_seen_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
