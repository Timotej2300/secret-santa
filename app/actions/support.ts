"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getSession, hasRole } from "@/lib/auth";
import { rateLimit, TOO_MANY } from "@/lib/ratelimit";
import { sendMany } from "@/lib/invites";
import { templates } from "@/lib/email";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/utils";

const ticketSchema = z.object({
  type: z.enum(["gift", "organizer", "registration", "login", "technical", "other"]),
  subject: z.string().trim().min(3, "Predmet je príliš krátky").max(140),
  description: z.string().trim().min(3, "Popis je príliš krátky").max(4000),
  groupId: z.string().uuid().optional().or(z.literal("")),
});

export async function createTicket(fd: FormData): Promise<ActionResult<{ redirect: string }>> {
  const s = await getSession();
  if (!s) return fail("Prihlás sa.");
  if (!(await rateLimit("ticket", 5, 3600, s.user.id))) return fail(TOO_MANY);
  const p = ticketSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Neplatné údaje");
  if (p.data.groupId) {
    const { data } = await admin().from("participants").select("id").eq("group_id", p.data.groupId).eq("user_id", s.user.id).maybeSingle();
    if (!data) return fail("Nemáš prístup k tejto skupine.");
  }
  const { data, error } = await admin().from("support_tickets").insert({ user_id: s.user.id, group_id: p.data.groupId || null, type: p.data.type, subject: p.data.subject, description: p.data.description }).select("id").single();
  if (error || !data) return fail("Požiadavku sa nepodarilo vytvoriť");
  await audit(s.user.id, "ticket.created", { entity: "ticket", entityId: (data as { id: string }).id });
  return ok("Požiadavka odoslaná", { redirect: `/podpora/${(data as { id: string }).id}` });
}

export async function replyTicket(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail("Prihlás sa.");
  const id = String(fd.get("ticketId"));
  const body = String(fd.get("body") ?? "").trim();
  if (body.length < 1 || body.length > 4000) return fail("Správa musí mať 1–4000 znakov.");
  const { data } = await admin().from("support_tickets").select("id,user_id,subject,status").eq("id", id).maybeSingle();
  const t = data as { id: string; user_id: string; subject: string; status: string } | null;
  const staff = hasRole(s, "owner", "system_admin", "support");
  if (!t || (!staff && t.user_id !== s.user.id)) return fail("Nemáš oprávnenie na túto akciu.");
  await admin().from("support_messages").insert({ ticket_id: id, author_id: s.user.id, body });
  if (staff && t.user_id !== s.user.id) {
    await admin().from("support_tickets").update({ status: t.status === "open" ? "in_progress" : t.status }).eq("id", id);
    const { data: u } = await admin().from("profiles").select("first_name,email").eq("id", t.user_id).single();
    const up = u as { first_name: string; email: string };
    await sendMany([{ to: up.email, template: "support_reply", ...templates.supportReply({ first_name: up.first_name, subject: t.subject, body }) }]);
  } else if (t.status === "resolved") {
    await admin().from("support_tickets").update({ status: "open" }).eq("id", id);
  }
  revalidatePath(`/podpora/${id}`);
  revalidatePath(`/admin/podpora/${id}`);
  return ok("Odpoveď odoslaná");
}

export async function setTicketStatus(id: string, status: "open" | "in_progress" | "resolved" | "closed"): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !hasRole(s, "owner", "system_admin", "support")) return fail("Nemáš oprávnenie na túto akciu.");
  await admin().from("support_tickets").update({ status }).eq("id", id);
  await audit(s.user.id, "ticket.status", { entity: "ticket", entityId: id, meta: { status } });
  revalidatePath(`/admin/podpora`);
  return ok("Stav zmenený");
}
