"use server";
import { supabaseServer } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import { passwordSchema, personSchema, firstError } from "@/lib/validation";
import { rateLimit, TOO_MANY } from "@/lib/ratelimit";
import { issueInvitation } from "@/lib/invites";
import { sendEmail, templates } from "@/lib/email";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/utils";

const INVALID = "Pozvánka je neplatná, už bola použitá alebo expirovala. Požiadaj organizátora o novú.";

/** Dokončenie registrácie cez jednorazový token z e-mailu. */
export async function completeInvite(fd: FormData): Promise<ActionResult<{ redirect: string }>> {
  if (!(await rateLimit("invite", 10, 600))) return fail(TOO_MANY);
  const token = String(fd.get("token") ?? "");
  if (token.length < 20) return fail(INVALID);
  const db = admin();

  const { data: inv } = await db.from("invitations").select("id,kind,email,participant_id,organizer_user_id,expires_at,used_at,revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  const i = inv as { id: string; kind: string; email: string; participant_id: string | null; organizer_user_id: string | null; expires_at: string; used_at: string | null; revoked_at: string | null } | null;
  if (!i || i.used_at || i.revoked_at || new Date(i.expires_at).getTime() < Date.now()) return fail(INVALID);

  const password = String(fd.get("password") ?? "");
  const pw = passwordSchema.safeParse(password);
  if (!pw.success) return fail(firstError(pw.error));

  const sb = await supabaseServer();
  let userId: string;
  let redirectTo = "/dashboard";
  let groupName = "";
  let firstName = "";

  if (i.kind === "organizer") {
    if (password !== String(fd.get("password2") ?? "")) return fail("Heslá sa nezhodujú");
    if (!i.organizer_user_id) return fail(INVALID);
    const { error } = await db.auth.admin.updateUserById(i.organizer_user_id, { password, email_confirm: true });
    if (error) return fail("Heslo sa nepodarilo nastaviť");
    userId = i.organizer_user_id;
    redirectTo = "/organizator";
  } else {
    const { data: part } = await db.from("participants").select("id,group_id,first_name,last_name,phone,status,groups(name)").eq("id", i.participant_id!).maybeSingle();
    const pt = part as unknown as { id: string; group_id: string; first_name: string; last_name: string; phone: string | null; status: string; groups: { name: string } } | null;
    if (!pt || !["invited", "registered"].includes(pt.status)) return fail(INVALID);
    groupName = pt.groups.name;
    firstName = pt.first_name;

    const { data: existing } = await db.from("profiles").select("id").eq("email", i.email.toLowerCase()).maybeSingle();
    if (existing) {
      userId = (existing as { id: string }).id;
    } else {
      if (password !== String(fd.get("password2") ?? "")) return fail("Heslá sa nezhodujú");
      const { data: created, error } = await db.auth.admin.createUser({
        email: i.email.toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: { first_name: pt.first_name, last_name: pt.last_name, phone: pt.phone },
      });
      if (error || !created.user) return fail("Účet sa nepodarilo vytvoriť");
      userId = created.user.id;
    }
    redirectTo = `/doruacenie/${pt.id}`;
  }

  const { data: prof } = await db.from("profiles").select("email,is_active").eq("id", userId).maybeSingle();
  if (!prof || !(prof as { is_active: boolean }).is_active) return fail("Účet je deaktivovaný");
  const { error: signErr } = await sb.auth.signInWithPassword({ email: (prof as { email: string }).email, password });
  if (signErr) return fail(i.kind === "participant" ? "Tento e-mail už má účet – zadaj jeho existujúce heslo." : "Prihlásenie zlyhalo");

  const { data: claimed } = await db.from("invitations").update({ used_at: new Date().toISOString(), email_status: "registered" }).eq("id", i.id).is("used_at", null).is("revoked_at", null).select("id");
  if (!claimed || claimed.length === 0) {
    await sb.auth.signOut();
    return fail(INVALID);
  }

  if (i.kind === "participant") {
    await db.from("participants").update({ user_id: userId, status: "registered", registered_at: new Date().toISOString() }).eq("id", i.participant_id!);
    const t = templates.registrationConfirmed({ first_name: firstName, group: groupName });
    await sendEmail({ to: i.email, template: "registration_confirmed", subject: t.subject, html: t.html });
    await audit(userId, "participant.registered", { entity: "participant", entityId: i.participant_id! });
  } else {
    await audit(userId, "organizer.activated", { entity: "profile", entityId: userId });
  }
  return ok(undefined, { redirect: redirectTo });
}

/** Registrácia cez QR kód skupiny. Vždy odpovedá rovnako, aby sa nedali zisťovať e-maily. */
export async function qrRegister(fd: FormData): Promise<ActionResult> {
  if (fd.get("website")) return ok("Skontroluj si e-mail – poslali sme ti pozvánku na dokončenie registrácie.");
  if (!(await rateLimit("qr", 5, 600))) return fail(TOO_MANY);
  const parsed = personSchema.safeParse({ first_name: fd.get("first_name"), last_name: fd.get("last_name"), email: fd.get("email"), phone: fd.get("phone") ?? "" });
  if (!parsed.success) return fail(firstError(parsed.error));
  const db = admin();

  const { data: qr } = await db.from("group_qr_tokens").select("group_id,is_active").eq("token", String(fd.get("qr") ?? "")).maybeSingle();
  if (!qr || !(qr as { is_active: boolean }).is_active) return fail("Registračný odkaz je neplatný.");
  const groupId = (qr as { group_id: string }).group_id;

  const { data: g } = await db.from("groups").select("id,status,max_participants,phone_required,draw_status,group_settings(registration_enabled)").eq("id", groupId).maybeSingle();
  const grp = g as unknown as { id: string; status: string; max_participants: number; phone_required: boolean; draw_status: string; group_settings: { registration_enabled: boolean } | { registration_enabled: boolean }[] | null } | null;
  const enabled = Array.isArray(grp?.group_settings) ? grp?.group_settings[0]?.registration_enabled : grp?.group_settings?.registration_enabled;
  if (!grp || grp.status !== "registration_open" || enabled === false) return fail("Registrácia do tejto skupiny je uzavretá.");
  if (grp.phone_required && !parsed.data.phone) return fail("Telefónne číslo je povinné.");

  const email = parsed.data.email;
  const { data: dup } = await db.from("participants").select("id,status").eq("group_id", groupId).ilike("email", email).in("status", ["invited", "registered"]).maybeSingle();
  const generic = ok("Skontroluj si e-mail – poslali sme ti pozvánku na dokončenie registrácie.");
  if (dup) {
    if ((dup as { status: string }).status === "invited") await issueInvitation((dup as { id: string }).id);
    return generic;
  }

  const { count } = await db.from("participants").select("id", { count: "exact", head: true }).eq("group_id", groupId).in("status", ["invited", "registered"]);
  if ((count ?? 0) >= grp.max_participants) return fail("Skupina je už plná.");

  const { data: created, error } = await db
    .from("participants")
    .insert({ group_id: groupId, first_name: parsed.data.first_name, last_name: parsed.data.last_name, email, phone: parsed.data.phone || null, source: "qr", status: "invited" })
    .select("id")
    .single();
  if (error || !created) return error?.code === "23505" ? generic : fail("Registrácia zlyhala, skús to znova.");
  await issueInvitation((created as { id: string }).id);
  return generic;
}
