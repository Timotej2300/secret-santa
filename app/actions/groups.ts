"use server";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/admin";
import { canManageGroup, getSession, hasRole, isOwner, type Session } from "@/lib/auth";
import { groupSchema, personSchema, firstError, formObject } from "@/lib/validation";
import { rateLimit, TOO_MANY } from "@/lib/ratelimit";
import { issueInvitation, sendMany } from "@/lib/invites";
import { templates } from "@/lib/email";
import { secureShuffle, validateAssignments } from "@/lib/draw";
import { newToken } from "@/lib/tokens";
import { audit } from "@/lib/audit";
import { fail, ok, localToIso, type ActionResult } from "@/lib/utils";

type G = { id: string; organizer_id: string; name: string; status: string; draw_status: string; max_participants: number; phone_required: boolean; rules: string; description: string; gift_deadline: string | null; min_gift_value: number };

async function loadGroup(id: string) {
  const { data } = await admin().from("groups").select("*").eq("id", id).maybeSingle();
  return (data as G | null) ?? null;
}

async function guard(groupId: string): Promise<{ s: Session; g: G } | null> {
  const s = await getSession();
  if (!s) return null;
  if (!(await canManageGroup(s, groupId))) return null;
  const g = await loadGroup(groupId);
  return g ? { s, g } : null;
}
const NO = "Nemáš oprávnenie na túto akciu.";

async function activeCount(groupId: string) {
  const { count } = await admin().from("participants").select("id", { count: "exact", head: true }).eq("group_id", groupId).in("status", ["invited", "registered"]);
  return count ?? 0;
}

export async function createGroup(fd: FormData): Promise<ActionResult<{ redirect: string }>> {
  const s = await getSession();
  if (!s || !hasRole(s, "organizer", "owner")) return fail(NO);
  const p = groupSchema.safeParse({ ...formObject(fd), phone_required: fd.get("phone_required") === "on" });
  if (!p.success) return fail(firstError(p.error));
  const db = admin();
  const { data, error } = await db
    .from("groups")
    .insert({ organizer_id: s.user.id, name: p.data.name, description: p.data.description, max_participants: p.data.max_participants, min_gift_value: p.data.min_gift_value, gift_deadline: localToIso(p.data.gift_deadline), rules: p.data.rules, phone_required: p.data.phone_required })
    .select("id")
    .single();
  if (error || !data) return fail("Skupinu sa nepodarilo vytvoriť");
  const id = (data as { id: string }).id;
  await db.from("group_settings").insert({ group_id: id });
  await db.from("group_qr_tokens").insert({ group_id: id, token: newToken(18) });
  await audit(s.user.id, "group.created", { entity: "group", entityId: id, groupId: id });
  return ok("Skupina vytvorená", { redirect: `/organizator/skupiny/${id}` });
}

export async function updateGroupSettings(fd: FormData): Promise<ActionResult> {
  const groupId = String(fd.get("groupId"));
  const c = await guard(groupId);
  if (!c) return fail(NO);
  if (["registration_closed", "drawn", "archived"].includes(c.g.status) && !isOwner(c.s)) return fail("Nastavenia sa dajú upraviť iba do uzatvorenia registrácie.");
  const p = groupSchema.safeParse({ ...formObject(fd), rules: c.g.rules, description: String(fd.get("description") ?? ""), phone_required: fd.get("phone_required") === "on" });
  if (!p.success) return fail(firstError(p.error));
  if (p.data.max_participants < (await activeCount(groupId))) return fail("Kapacita nemôže byť nižšia ako súčasný počet účastníkov.");
  await admin().from("groups").update({ name: p.data.name, description: p.data.description, max_participants: p.data.max_participants, min_gift_value: p.data.min_gift_value, gift_deadline: localToIso(p.data.gift_deadline), phone_required: p.data.phone_required }).eq("id", groupId);
  await audit(c.s.user.id, "group.settings_updated", { entity: "group", entityId: groupId, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok("Nastavenia uložené");
}

export async function updateRules(fd: FormData): Promise<ActionResult> {
  const groupId = String(fd.get("groupId"));
  const c = await guard(groupId);
  if (!c) return fail(NO);
  const rules = String(fd.get("rules") ?? "").trim().slice(0, 8000);
  const changed = rules !== c.g.rules;
  await admin().from("groups").update({ rules }).eq("id", groupId);
  await audit(c.s.user.id, "group.rules_updated", { entity: "group", entityId: groupId, groupId });
  if (changed) {
    const { data: st } = await admin().from("group_settings").select("notify_on_rules_change").eq("group_id", groupId).maybeSingle();
    if ((st as { notify_on_rules_change: boolean } | null)?.notify_on_rules_change !== false) {
      const { data: ps } = await admin().from("participants").select("first_name,email").eq("group_id", groupId).eq("status", "registered");
      const mails = ((ps ?? []) as { first_name: string; email: string }[]).map((x) => ({ to: x.email, template: "info_changed", groupId, ...templates.infoChanged({ first_name: x.first_name, group: c.g.name }) }));
      await sendMany(mails);
    }
  }
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok(changed ? "Informácie uložené, účastníci boli upozornení" : "Uložené");
}

export async function setRegistration(groupId: string, open: boolean): Promise<ActionResult> {
  const c = await guard(groupId);
  if (!c) return fail(NO);
  if (["drawn", "archived"].includes(c.g.status)) return fail("Po losovaní už registráciu nemožno meniť.");
  await admin().from("groups").update({ status: open ? "registration_open" : "registration_closed" }).eq("id", groupId);
  await admin().from("group_settings").update({ registration_enabled: open }).eq("group_id", groupId);
  await audit(c.s.user.id, open ? "group.registration_opened" : "group.registration_closed", { entity: "group", entityId: groupId, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok(open ? "Registrácia otvorená" : "Registrácia uzatvorená");
}

export async function rotateQr(groupId: string): Promise<ActionResult> {
  const c = await guard(groupId);
  if (!c) return fail(NO);
  const db = admin();
  await db.from("group_qr_tokens").update({ is_active: false }).eq("group_id", groupId);
  await db.from("group_qr_tokens").insert({ group_id: groupId, token: newToken(18) });
  await audit(c.s.user.id, "group.qr_rotated", { entity: "group", entityId: groupId, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok("Vygenerovaný nový QR kód, starý prestal platiť");
}

export async function addParticipant(fd: FormData): Promise<ActionResult> {
  const groupId = String(fd.get("groupId"));
  const c = await guard(groupId);
  if (!c) return fail(NO);
  if (!(await rateLimit("add-participant", 60, 600, c.s.user.id))) return fail(TOO_MANY);
  if (c.g.draw_status === "drawn") return fail("Losovanie už prebehlo. Najprv odstráň účastníka, ktorý odchádza.");
  const p = personSchema.safeParse({ first_name: fd.get("first_name"), last_name: fd.get("last_name"), email: fd.get("email"), phone: fd.get("phone") ?? "" });
  if (!p.success) return fail(firstError(p.error));
  if (c.g.phone_required && !p.data.phone) return fail("V tejto skupine je telefón povinný.");
  if ((await activeCount(groupId)) >= c.g.max_participants) return fail("Skupina dosiahla maximálnu kapacitu.");
  const { data, error } = await admin()
    .from("participants")
    .insert({ group_id: groupId, first_name: p.data.first_name, last_name: p.data.last_name, email: p.data.email, phone: p.data.phone || null, source: "manual", status: "invited" })
    .select("id")
    .single();
  if (error?.code === "23505") return fail("Tento e-mail už v skupine je.");
  if (error || !data) return fail("Účastníka sa nepodarilo pridať");
  const r = await issueInvitation((data as { id: string }).id);
  await audit(c.s.user.id, "participant.added", { entity: "participant", entityId: (data as { id: string }).id, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok(r.ok ? "Účastník pridaný, pozvánka odoslaná" : `Účastník pridaný, ale e-mail zlyhal: ${r.error}. Skús pozvánku odoslať znova.`);
}

async function participantGuard(participantId: string) {
  const { data } = await admin().from("participants").select("id,group_id,status,user_id,first_name,email").eq("id", participantId).maybeSingle();
  if (!data) return null;
  const pt = data as { id: string; group_id: string; status: string; user_id: string | null; first_name: string; email: string };
  const c = await guard(pt.group_id);
  return c ? { ...c, pt } : null;
}

export async function resendInvitation(participantId: string): Promise<ActionResult> {
  const c = await participantGuard(participantId);
  if (!c) return fail(NO);
  if (c.pt.status !== "invited") return fail("Účastník je už zaregistrovaný.");
  if (!(await rateLimit("resend", 3, 600, participantId))) return fail(TOO_MANY);
  const r = await issueInvitation(participantId);
  await audit(c.s.user.id, "invitation.resent", { entity: "participant", entityId: participantId, groupId: c.g.id });
  revalidatePath(`/organizator/skupiny/${c.g.id}`);
  return r.ok ? ok("Pozvánka znova odoslaná, predchádzajúci odkaz prestal platiť") : fail(`Odoslanie zlyhalo: ${r.error}`);
}

export async function removeParticipant(participantId: string): Promise<ActionResult> {
  const c = await participantGuard(participantId);
  if (!c) return fail(NO);
  if (!["invited", "registered"].includes(c.pt.status)) return fail("Účastník už nie je aktívny.");
  const db = admin();
  let notify: { to: string; first_name: string } | null = null;

  if (c.g.draw_status === "drawn") {
    const { data: asg } = await db.from("assignments").select("giver_id").eq("group_id", c.g.id).eq("receiver_id", participantId).eq("is_active", true).maybeSingle();
    if (asg) {
      const { data: giver } = await db.from("participants").select("first_name,email").eq("id", (asg as { giver_id: string }).giver_id).maybeSingle();
      if (giver) notify = { to: (giver as { email: string }).email, first_name: (giver as { first_name: string }).first_name };
    }
    await db.from("assignments").update({ is_active: false }).eq("group_id", c.g.id).eq("is_active", true);
    await db.from("groups").update({ draw_status: "needs_redraw", status: "registration_closed" }).eq("id", c.g.id);
  }
  await db.from("participants").update({ status: "removed" }).eq("id", participantId);
  await db.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("participant_id", participantId).is("used_at", null).is("revoked_at", null);
  await audit(c.s.user.id, "participant.removed", { entity: "participant", entityId: participantId, groupId: c.g.id });
  if (notify) await sendMany([{ to: notify.to, template: "receiver_changed", groupId: c.g.id, ...templates.receiverChanged({ first_name: notify.first_name, group: c.g.name }) }]);
  revalidatePath(`/organizator/skupiny/${c.g.id}`);
  return ok(c.g.draw_status === "drawn" ? "Účastník odstránený. Pôvodné losovanie bolo zrušené – pridaj náhradníka (ak treba párny počet) a spusti nové losovanie." : "Účastník odstránený");
}

export async function toggleOrganizerParticipation(groupId: string): Promise<ActionResult> {
  const c = await guard(groupId);
  if (!c) return fail(NO);
  const db = admin();
  const { data: mine } = await db.from("participants").select("id").eq("group_id", groupId).eq("user_id", c.g.organizer_id).in("status", ["invited", "registered"]).maybeSingle();
  if (mine) {
    const r = await removeParticipant((mine as { id: string }).id);
    return r.ok ? ok("Organizátor už nie je účastníkom") : r;
  }
  if (c.g.draw_status === "drawn") return fail("Po losovaní už nemožno pridať účastníka.");
  if ((await activeCount(groupId)) >= c.g.max_participants) return fail("Skupina dosiahla maximálnu kapacitu.");
  const { data: org } = await db.from("profiles").select("first_name,last_name,email,phone").eq("id", c.g.organizer_id).single();
  const o = org as { first_name: string; last_name: string; email: string; phone: string | null };
  const { error } = await db.from("participants").insert({ group_id: groupId, user_id: c.g.organizer_id, first_name: o.first_name || "Organizátor", last_name: o.last_name || "-", email: o.email, phone: o.phone, source: "organizer_self", status: "registered", registered_at: new Date().toISOString() });
  if (error) return fail("Nepodarilo sa pridať organizátora medzi účastníkov");
  await db.from("groups").update({ organizer_participates: true }).eq("id", groupId);
  await audit(c.s.user.id, "group.organizer_joined", { entity: "group", entityId: groupId, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok("Organizátor je teraz účastníkom");
}

export async function setDeliveryLock(groupId: string, locked: boolean): Promise<ActionResult> {
  const c = await guard(groupId);
  if (!c) return fail(NO);
  await admin().from("groups").update({ delivery_locked: locked }).eq("id", groupId);
  await audit(c.s.user.id, locked ? "group.delivery_locked" : "group.delivery_unlocked", { entity: "group", entityId: groupId, groupId });
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok(locked ? "Údaje o doručení sú uzamknuté" : "Údaje o doručení sa dajú upravovať");
}

export async function runDraw(groupId: string): Promise<ActionResult> {
  const c = await guard(groupId);
  if (!c) return fail(NO);
  if (!(await rateLimit("draw", 5, 600, groupId))) return fail(TOO_MANY);
  if (c.g.draw_status === "drawn") return fail("Losovanie už prebehlo a je uzamknuté.");
  const db = admin();
  const { data: ps } = await db.from("participants").select("id,first_name,email,status").eq("group_id", groupId).in("status", ["invited", "registered"]);
  const list = (ps ?? []) as { id: string; first_name: string; email: string; status: string }[];
  const pending = list.filter((x) => x.status === "invited").length;
  const reg = list.filter((x) => x.status === "registered");
  if (pending > 0) return fail(`${pending} pozvánok ešte nie je dokončených. Počkaj na registráciu alebo ich odstráň.`);
  if (reg.length < 4) return fail("Na losovanie treba aspoň 4 registrovaných účastníkov.");
  if (reg.length % 2 !== 0) return fail("Počet účastníkov musí byť párny. Pridaj alebo odstráň účastníka.");
  if (reg.length > c.g.max_participants) return fail("Počet účastníkov prekračuje kapacitu skupiny.");
  if (new Set(reg.map((x) => x.email.toLowerCase())).size !== reg.length) return fail("V skupine sú duplicitné e-maily.");

  const ids = reg.map((x) => x.id);
  const order = secureShuffle(ids);
  const pairs = order.map((giver, i) => ({ giver, receiver: order[(i + 1) % order.length] }));
  const bad = validateAssignments(ids, pairs);
  if (bad) return fail(`Interná kontrola losovania zlyhala (${bad}).`);

  const { data: round, error } = await db.rpc("apply_draw", { p_group: groupId, p_order: order, p_actor: c.s.user.id });
  if (error) return fail(`Losovanie zlyhalo: ${error.message}`);

  const redraw = Number(round) > 1;
  const mails = reg.map((x) => ({ to: x.email, template: redraw ? "receiver_changed" : "draw_done", groupId, ...(redraw ? templates.receiverChanged({ first_name: x.first_name, group: c.g.name }) : templates.drawDone({ first_name: x.first_name, group: c.g.name })) }));
  const failed = await sendMany(mails);
  revalidatePath(`/organizator/skupiny/${groupId}`);
  return ok(failed ? `Losovanie hotové, ${failed} e-mailov sa nepodarilo odoslať.` : "Losovanie hotové, účastníci boli upozornení");
}
