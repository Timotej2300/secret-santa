"use server";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { admin } from "@/lib/supabase/admin";
import { getSession, hasRole, isOwner } from "@/lib/auth";
import { personSchema, firstError } from "@/lib/validation";
import { issueOrganizerInvite } from "@/lib/invites";
import { sendEmail, templates } from "@/lib/email";
import { audit } from "@/lib/audit";
import { APP_URL, fail, ok, type ActionResult } from "@/lib/utils";

const NO = "Nemáš oprávnenie na túto akciu.";
const ROLES = ["system_admin", "support", "organizer"] as const;

export async function createOrganizer(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!isOwner(s)) return fail(NO);
  const p = personSchema.safeParse({ first_name: fd.get("first_name"), last_name: fd.get("last_name"), email: fd.get("email"), phone: fd.get("phone") ?? "" });
  if (!p.success) return fail(firstError(p.error));
  const db = admin();
  const { data: existing } = await db.from("profiles").select("id").eq("email", p.data.email).maybeSingle();
  let userId: string;
  let isNew = false;
  if (existing) {
    userId = (existing as { id: string }).id;
  } else {
    const { data, error } = await db.auth.admin.createUser({ email: p.data.email, password: randomBytes(32).toString("base64url"), email_confirm: true, user_metadata: { first_name: p.data.first_name, last_name: p.data.last_name, phone: p.data.phone } });
    if (error || !data.user) return fail("Účet sa nepodarilo vytvoriť");
    userId = data.user.id;
    isNew = true;
  }
  await db.from("profiles").update({ first_name: p.data.first_name, last_name: p.data.last_name, phone: p.data.phone || null }).eq("id", userId);
  const { error: rErr } = await db.from("system_roles").upsert({ user_id: userId, role: "organizer", granted_by: s!.user.id }, { onConflict: "user_id,role" });
  if (rErr) return fail("Rolu sa nepodarilo pridať");
  await audit(s!.user.id, "role.granted", { entity: "profile", entityId: userId, meta: { role: "organizer" } });
  if (isNew) {
    const r = await issueOrganizerInvite(userId, p.data.email, p.data.first_name);
    revalidatePath("/admin/organizatori");
    return r.ok ? ok("Organizátor vytvorený, pozvánka odoslaná") : ok(`Organizátor vytvorený, ale e-mail zlyhal: ${r.error}`);
  }
  const t = templates.organizerInvite({ first_name: p.data.first_name, url: `${APP_URL}/prihlasenie`, existing: true });
  await sendEmail({ to: p.data.email, template: "organizer_role", subject: t.subject, html: t.html });
  revalidatePath("/admin/organizatori");
  return ok("Existujúci účet dostal rolu organizátora");
}

export async function resendOrganizerInvite(userId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!isOwner(s)) return fail(NO);
  const { data } = await admin().from("profiles").select("email,first_name,last_seen_at").eq("id", userId).maybeSingle();
  const u = data as { email: string; first_name: string; last_seen_at: string | null } | null;
  if (!u) return fail("Používateľ neexistuje");
  if (u.last_seen_at) return fail("Organizátor sa už prihlásil.");
  const r = await issueOrganizerInvite(userId, u.email, u.first_name);
  await audit(s!.user.id, "organizer.invite_resent", { entity: "profile", entityId: userId });
  return r.ok ? ok("Pozvánka odoslaná znova") : fail(`Odoslanie zlyhalo: ${r.error}`);
}

export async function setSystemRole(userId: string, role: string, grant: boolean): Promise<ActionResult> {
  const s = await getSession();
  if (!isOwner(s)) return fail(NO);
  if (!(ROLES as readonly string[]).includes(role)) return fail("Túto rolu nemožno meniť.");
  if (userId === s!.user.id) return fail("Vlastné roly nemožno meniť.");
  const db = admin();
  if (grant) await db.from("system_roles").upsert({ user_id: userId, role, granted_by: s!.user.id }, { onConflict: "user_id,role" });
  else await db.from("system_roles").delete().eq("user_id", userId).eq("role", role);
  await audit(s!.user.id, grant ? "role.granted" : "role.revoked", { entity: "profile", entityId: userId, meta: { role } });
  revalidatePath("/admin/uzivatelia");
  return ok(grant ? "Rola pridaná" : "Rola odobratá");
}

export async function setUserActive(userId: string, active: boolean): Promise<ActionResult> {
  const s = await getSession();
  if (!s || !hasRole(s, "owner", "system_admin")) return fail(NO);
  if (userId === s.user.id) return fail("Vlastný účet nemožno deaktivovať.");
  const db = admin();
  const { data: roles } = await db.from("system_roles").select("role").eq("user_id", userId);
  const target = ((roles ?? []) as { role: string }[]).map((r) => r.role);
  if (target.includes("owner")) return fail("Owner účet nemožno deaktivovať.");
  if (!isOwner(s) && target.length > 0) return fail("Zamestnanecké účty môže spravovať iba Owner.");
  await db.from("profiles").update({ is_active: active }).eq("id", userId);
  await db.auth.admin.updateUserById(userId, { ban_duration: active ? "none" : "876000h" });
  await audit(s.user.id, active ? "user.activated" : "user.deactivated", { entity: "profile", entityId: userId });
  revalidatePath("/admin/uzivatelia");
  return ok(active ? "Účet aktivovaný" : "Účet deaktivovaný");
}

export async function updateUserBasic(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!isOwner(s)) return fail(NO);
  const id = String(fd.get("userId"));
  const first = String(fd.get("first_name") ?? "").trim().slice(0, 60);
  const last = String(fd.get("last_name") ?? "").trim().slice(0, 60);
  const phone = String(fd.get("phone") ?? "").trim().slice(0, 30);
  if (!first || !last) return fail("Meno a priezvisko sú povinné.");
  if (!/^[+0-9 ()\-]*$/.test(phone)) return fail("Neplatný telefón");
  await admin().from("profiles").update({ first_name: first, last_name: last, phone: phone || null }).eq("id", id);
  await audit(s!.user.id, "user.updated", { entity: "profile", entityId: id });
  revalidatePath("/admin/uzivatelia");
  return ok("Používateľ upravený");
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  const s = await getSession();
  if (!isOwner(s)) return fail(NO);
  const { data } = await admin().from("groups").select("name").eq("id", groupId).maybeSingle();
  if (!data) return fail("Skupina neexistuje");
  await admin().from("groups").delete().eq("id", groupId);
  await audit(s!.user.id, "group.deleted", { entity: "group", entityId: groupId, meta: { name: (data as { name: string }).name } });
  revalidatePath("/admin/skupiny");
  return ok("Skupina zmazaná");
}
