"use server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { deliverySchema, firstError, formObject, wishSchema } from "@/lib/validation";
import { sendMany } from "@/lib/invites";
import { templates } from "@/lib/email";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/utils";

type Own = { id: string; group_id: string; groups: { name: string; gift_deadline: string | null; delivery_locked: boolean; draw_status: string } };

async function own(participantId: string) {
  const s = await getSession();
  if (!s) return null;
  const { data } = await admin().from("participants").select("id,group_id,groups(name,gift_deadline,delivery_locked,draw_status)").eq("id", participantId).eq("user_id", s.user.id).eq("status", "registered").maybeSingle();
  return data ? { s, p: data as unknown as Own } : null;
}
const NO = "Nemáš oprávnenie na túto akciu.";

export async function saveDelivery(fd: FormData): Promise<ActionResult<{ redirect: string }>> {
  const pid = String(fd.get("participantId"));
  const c = await own(pid);
  if (!c) return fail(NO);
  if (c.p.groups.delivery_locked) return fail("Organizátor zamkol úpravu údajov o doručení.");
  if (fd.get("confirm_value") !== "on") return fail("Potvrď minimálnu hodnotu darčeka.");
  const parsed = deliverySchema.safeParse(formObject(fd));
  if (!parsed.success) return fail(firstError(parsed.error));
  const d = parsed.data;
  const row = {
    participant_id: pid,
    method: d.method,
    note: d.note || null,
    meeting_place: d.method === "in_person" ? d.meeting_place || null : null,
    address_line: d.method === "address" ? d.address_line : null,
    city: d.method === "address" ? d.city : null,
    postal_code: d.method === "address" ? d.postal_code : null,
    country: d.method === "address" ? d.country : null,
    via_person_name: d.method === "via_person" ? d.via_person_name : null,
  };
  const { error } = await admin().from("delivery_details").upsert(row);
  if (error) return fail("Údaje sa nepodarilo uložiť");
  await admin().from("participants").update({ gift_value_confirmed_at: new Date().toISOString() }).eq("id", pid).is("gift_value_confirmed_at", null);
  await audit(c.s.user.id, "delivery.saved", { entity: "participant", entityId: pid, groupId: c.p.group_id });
  revalidatePath("/dashboard");
  return ok("Údaje uložené", { redirect: `/odkrytie/${pid}` });
}

/** Meno príjemcu sa vráti až tu – nikdy nie v HTML pred odkrytím. */
export async function revealRecipient(pid: string): Promise<ActionResult<{ name: string }>> {
  const c = await own(pid);
  if (!c) return fail(NO);
  const { data } = await admin().from("assignments").select("id,revealed_at,receiver:participants!assignments_receiver_id_fkey(first_name,last_name)").eq("giver_id", pid).eq("is_active", true).maybeSingle();
  if (!data) return fail("Losovanie ešte neprebehlo.");
  const a = data as unknown as { id: string; revealed_at: string | null; receiver: { first_name: string; last_name: string } };
  if (!a.revealed_at) await admin().from("assignments").update({ revealed_at: new Date().toISOString() }).eq("id", a.id);
  revalidatePath("/dashboard");
  return ok(undefined, { name: `${a.receiver.first_name} ${a.receiver.last_name}` });
}

export async function addWish(fd: FormData): Promise<ActionResult> {
  const pid = String(fd.get("participantId"));
  const c = await own(pid);
  if (!c) return fail(NO);
  const p = wishSchema.safeParse(formObject(fd));
  if (!p.success) return fail(firstError(p.error));
  const { count } = await admin().from("wishlist_items").select("id", { count: "exact", head: true }).eq("participant_id", pid);
  if ((count ?? 0) >= 30) return fail("Wishlist môže mať maximálne 30 položiek.");
  const v = p.data;
  await admin().from("wishlists").upsert({ participant_id: pid });
  const { error } = await admin().from("wishlist_items").insert({ participant_id: pid, title: v.title, description: v.description || null, url: v.url || null, image_url: v.image_url || null, note: v.note || null, clothing_size: v.clothing_size || null, favorite_color: v.favorite_color || null });
  if (error) return fail("Položku sa nepodarilo pridať");
  revalidatePath(`/wishlist/${pid}`);
  return ok("Pridané do wishlistu");
}

export async function deleteWish(itemId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail(NO);
  const { data } = await admin().from("wishlist_items").select("id,participant_id,participants(user_id)").eq("id", itemId).maybeSingle();
  const w = data as unknown as { participant_id: string; participants: { user_id: string } } | null;
  if (!w || w.participants.user_id !== s.user.id) return fail(NO);
  await admin().from("wishlist_items").delete().eq("id", itemId);
  revalidatePath(`/wishlist/${w.participant_id}`);
  return ok("Položka odstránená");
}

async function giftCtx(assignmentId: string) {
  const s = await getSession();
  if (!s) return null;
  const { data } = await admin()
    .from("assignments")
    .select("id,group_id,giver:participants!assignments_giver_id_fkey(id,user_id,first_name,email),receiver:participants!assignments_receiver_id_fkey(id,user_id,first_name,email),groups(name,gift_deadline),gift_statuses(status)")
    .eq("id", assignmentId)
    .eq("is_active", true)
    .maybeSingle();
  if (!data) return null;
  const a = data as unknown as { id: string; group_id: string; giver: { id: string; user_id: string; first_name: string; email: string }; receiver: { id: string; user_id: string; first_name: string; email: string }; groups: { name: string; gift_deadline: string | null }; gift_statuses: { status: string } | { status: string }[] | null };
  const gs = Array.isArray(a.gift_statuses) ? a.gift_statuses[0] : a.gift_statuses;
  return { s, a, status: gs?.status ?? "pending" };
}

export async function markGiven(assignmentId: string): Promise<ActionResult> {
  const c = await giftCtx(assignmentId);
  if (!c || c.a.giver.user_id !== c.s.user.id) return fail(NO);
  if (!["pending", "problem"].includes(c.status)) return fail("Darček už má iný stav.");
  const late = !!c.a.groups.gift_deadline && new Date(c.a.groups.gift_deadline).getTime() < Date.now();
  const db = admin();
  await db.from("gift_statuses").update({ status: "awaiting_confirmation", given_at: new Date().toISOString(), given_late: late, problem_note: null }).eq("assignment_id", assignmentId);
  await db.from("gift_confirmations").upsert({ assignment_id: assignmentId, kind: "given", confirmed_by: c.s.user.id, confirmed_at: new Date().toISOString() }, { onConflict: "assignment_id,kind" });
  await audit(c.s.user.id, "gift.given", { entity: "assignment", entityId: assignmentId, groupId: c.a.group_id, meta: { late } });
  const t = templates.giftGiven({ first_name: c.a.receiver.first_name, group: c.a.groups.name });
  await sendMany([{ to: c.a.receiver.email, template: "gift_given", groupId: c.a.group_id, ...t }]);
  revalidatePath("/dashboard");
  return ok(late ? "Označené ako odovzdané (po termíne)" : "Označené ako odovzdané, čaká na potvrdenie príjemcu");
}

export async function confirmReceived(assignmentId: string): Promise<ActionResult> {
  const c = await giftCtx(assignmentId);
  if (!c || c.a.receiver.user_id !== c.s.user.id) return fail(NO);
  if (c.status !== "awaiting_confirmation") return fail("Darca ešte neoznačil darček ako odovzdaný.");
  const db = admin();
  await db.from("gift_statuses").update({ status: "confirmed", received_at: new Date().toISOString() }).eq("assignment_id", assignmentId);
  await db.from("gift_confirmations").upsert({ assignment_id: assignmentId, kind: "received", confirmed_by: c.s.user.id, confirmed_at: new Date().toISOString() }, { onConflict: "assignment_id,kind" });
  await audit(c.s.user.id, "gift.received", { entity: "assignment", entityId: assignmentId, groupId: c.a.group_id });
  const t = templates.giftReceived({ first_name: c.a.giver.first_name, group: c.a.groups.name });
  await sendMany([{ to: c.a.giver.email, template: "gift_received", groupId: c.a.group_id, ...t }]);
  revalidatePath("/dashboard");
  return ok("Prijatie darčeka potvrdené. Ďakujeme!");
}

export async function reportGiftProblem(assignmentId: string, fd: FormData): Promise<ActionResult> {
  const c = await giftCtx(assignmentId);
  if (!c || (c.a.giver.user_id !== c.s.user.id && c.a.receiver.user_id !== c.s.user.id)) return fail(NO);
  const note = String(fd.get("note") ?? "").trim().slice(0, 500);
  if (note.length < 3) return fail("Popíš problém.");
  await admin().from("gift_statuses").update({ status: "problem", problem_note: note }).eq("assignment_id", assignmentId);
  await audit(c.s.user.id, "gift.problem", { entity: "assignment", entityId: assignmentId, groupId: c.a.group_id });
  revalidatePath("/dashboard");
  return ok("Problém nahlásený organizátorovi");
}

export async function requestLeave(pid: string): Promise<ActionResult> {
  const c = await own(pid);
  if (!c) return fail(NO);
  await admin().from("participants").update({ leave_requested_at: new Date().toISOString() }).eq("id", pid);
  await audit(c.s.user.id, "participant.leave_requested", { entity: "participant", entityId: pid, groupId: c.p.group_id });
  revalidatePath("/dashboard");
  return ok("Žiadosť o odchod bola odoslaná organizátorovi");
}
