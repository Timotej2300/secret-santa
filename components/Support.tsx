import { ActionButton, ActionForm, Field } from "@/components/Form";
import { Badge } from "@/components/ui";
import { fmtDateTime } from "@/lib/utils";
import { replyTicket, setTicketStatus } from "@/app/actions/support";

export const TICKET_TYPE: Record<string, string> = { gift: "Problém s darčekom", organizer: "Problém s organizátorom", registration: "Problém s registráciou", login: "Problém s prihlásením", technical: "Technický problém", other: "Iné" };
export const TICKET_STATUS: Record<string, string> = { open: "Otvorená", in_progress: "Rieši sa", resolved: "Vyriešená", closed: "Uzavretá" };

export type Ticket = { id: string; type: string; subject: string; description: string; status: string; created_at: string };
export type Msg = { id: string; body: string; created_at: string; author_id: string; author: { first_name: string; last_name: string } | null };

export function TicketThread({ ticket, messages, userId, staff }: { ticket: Ticket; messages: Msg[]; userId: string; staff?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-forest-800">{ticket.subject}</h2>
          <Badge tone={ticket.status === "resolved" || ticket.status === "closed" ? "green" : "gold"}>{TICKET_STATUS[ticket.status]}</Badge>
        </div>
        <p className="mt-1 text-xs text-forest-900/50">{TICKET_TYPE[ticket.type]} · {fmtDateTime(ticket.created_at)}</p>
        <p className="mt-3 whitespace-pre-wrap text-sm">{ticket.description}</p>
        {staff && (
          <div className="mt-4 flex flex-wrap gap-2">
            {(["in_progress", "resolved", "closed"] as const).map((st) => (
              <ActionButton key={st} run={setTicketStatus.bind(null, ticket.id, st)}>{TICKET_STATUS[st]}</ActionButton>
            ))}
          </div>
        )}
      </div>
      {messages.map((m) => (
        <div key={m.id} className={`card !p-4 text-sm ${m.author_id === userId ? "ml-6 !bg-forest-50" : "mr-6"}`}>
          <p className="text-xs text-forest-900/50">{m.author ? `${m.author.first_name} ${m.author.last_name}` : "—"} · {fmtDateTime(m.created_at)}</p>
          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
        </div>
      ))}
      <ActionForm action={replyTicket} resetOnSuccess className="card space-y-3">
        <input type="hidden" name="ticketId" value={ticket.id} />
        <Field label="Odpoveď"><textarea className="input min-h-24" name="body" required maxLength={4000} /></Field>
        <button className="btn-primary">Odoslať</button>
      </ActionForm>
    </div>
  );
}
