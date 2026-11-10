import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { TicketThread, type Msg, type Ticket } from "@/components/Support";

export const metadata = { title: "Požiadavka" };
export const dynamic = "force-dynamic";

export default async function AdminTicket({ params }: { params: Promise<{ id: string }> }) {
  const s = await requireRole("owner", "system_admin", "support");
  const { id } = await params;
  const db = admin();
  const { data } = await db.from("support_tickets").select("id,type,subject,description,status,created_at").eq("id", id).maybeSingle();
  if (!data) notFound();
  const { data: m } = await db.from("support_messages").select("id,body,created_at,author_id,author:profiles!support_messages_author_id_fkey(first_name,last_name)").eq("ticket_id", id).order("created_at");
  return <TicketThread ticket={data as Ticket} messages={(m ?? []) as unknown as Msg[]} userId={s.user.id} staff />;
}
