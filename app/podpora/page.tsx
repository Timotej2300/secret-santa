import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { myParticipations, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionForm, Field } from "@/components/Form";
import { Badge, Empty, PageTitle, Shell } from "@/components/ui";
import { TICKET_STATUS, TICKET_TYPE, type Ticket } from "@/components/Support";
import { createTicket } from "@/app/actions/support";
import { fmtDateTime } from "@/lib/utils";

export const metadata = { title: "Podpora" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const s = await requireUser("/podpora");
  const { data } = await admin().from("support_tickets").select("id,type,subject,description,status,created_at").eq("user_id", s.user.id).order("created_at", { ascending: false });
  const tickets = (data ?? []) as Ticket[];
  const groups = await myParticipations(s.user.id);
  return (
    <Shell>
      <PageTitle title="Podpora" subtitle="Problémy so skupinou rieši organizátor, technické problémy podpora." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-display text-lg font-semibold text-forest-800">Nová požiadavka</h2>
          <ActionForm action={createTicket} className="space-y-3">
            <Field label="Typ problému">
              <select className="input" name="type" required>
                {Object.entries(TICKET_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            {groups.length > 0 && (
              <Field label="Skupina (nepovinné)">
                <select className="input" name="groupId" defaultValue="">
                  <option value="">—</option>
                  {groups.map((g) => <option key={g.group_id} value={g.group_id}>{g.groups.name}</option>)}
                </select>
              </Field>
            )}
            <Field label="Predmet"><input className="input" name="subject" required minLength={3} maxLength={140} /></Field>
            <Field label="Popis"><textarea className="input min-h-28" name="description" required maxLength={4000} /></Field>
            <button className="btn-primary">Odoslať</button>
          </ActionForm>
        </div>
        <div>
          {tickets.length === 0 ? (
            <Empty title="Zatiaľ žiadne požiadavky" icon={<LifeBuoy size={26} />} />
          ) : (
            <ul className="space-y-3">
              {tickets.map((t) => (
                <li key={t.id}>
                  <Link href={`/podpora/${t.id}`} className="card flex items-center justify-between gap-3 !p-4 transition hover:shadow-lift">
                    <div><p className="font-semibold">{t.subject}</p><p className="text-xs text-forest-900/50">{TICKET_TYPE[t.type]} · {fmtDateTime(t.created_at)}</p></div>
                    <Badge tone={t.status === "resolved" || t.status === "closed" ? "green" : "gold"}>{TICKET_STATUS[t.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
