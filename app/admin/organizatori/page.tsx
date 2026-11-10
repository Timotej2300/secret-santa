import { isOwner, requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionButton, ActionForm, Field } from "@/components/Form";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { createOrganizer, resendOrganizerInvite } from "@/app/actions/admin";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Organizátori" };
export const dynamic = "force-dynamic";

export default async function OrganizersPage() {
  const s = await requireRole("owner");
  void isOwner(s);
  const db = admin();
  const { data: rd } = await db.from("system_roles").select("user_id").eq("role", "organizer");
  const ids = ((rd ?? []) as { user_id: string }[]).map((r) => r.user_id);
  const { data: pd } = ids.length ? await db.from("profiles").select("id,first_name,last_name,email,phone,last_seen_at").in("id", ids) : { data: [] };
  const orgs = (pd ?? []) as { id: string; first_name: string; last_name: string; email: string; phone: string | null; last_seen_at: string | null }[];
  return (
    <>
      <PageTitle title="Organizátori" />
      <div className="card mb-6">
        <h2 className="mb-4 font-display text-lg font-semibold text-forest-800">Nový organizátor</h2>
        <ActionForm action={createOrganizer} resetOnSuccess className="grid gap-3 sm:grid-cols-2">
          <Field label="Meno"><input className="input" name="first_name" required /></Field>
          <Field label="Priezvisko"><input className="input" name="last_name" required /></Field>
          <Field label="E-mail"><input className="input" type="email" name="email" required /></Field>
          <Field label="Telefónne číslo"><input className="input" type="tel" name="phone" required /></Field>
          <div className="sm:col-span-2"><button className="btn-primary">Vytvoriť a poslať pozvánku</button></div>
        </ActionForm>
      </div>
      {orgs.length === 0 ? (
        <Empty title="Zatiaľ žiadni organizátori" />
      ) : (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full min-w-[640px]">
            <thead className="border-b border-forest-900/5"><tr><th className="th">Meno</th><th className="th">Kontakt</th><th className="th">Stav</th><th className="th" /></tr></thead>
            <tbody className="divide-y divide-forest-900/5">
              {orgs.map((o) => (
                <tr key={o.id}>
                  <td className="td font-medium">{o.first_name} {o.last_name}</td>
                  <td className="td text-forest-900/70">{o.email}<br />{o.phone}</td>
                  <td className="td">{o.last_seen_at ? <Badge tone="green">Aktívny · {fmtDateTime(o.last_seen_at)}</Badge> : <Badge tone="gold">Čaká na aktiváciu</Badge>}</td>
                  <td className="td text-right">{!o.last_seen_at && <ActionButton run={resendOrganizerInvite.bind(null, o.id)}>Poslať pozvánku znova</ActionButton>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
