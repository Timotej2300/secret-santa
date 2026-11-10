import "server-only";
import { admin } from "@/lib/supabase/admin";
import { hashToken, newToken, INVITE_TTL_MS } from "@/lib/tokens";
import { sendEmail, templates } from "@/lib/email";
import { APP_URL } from "@/lib/utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const inviteUrl = (token: string) => `${APP_URL}/pozvanka/id=${token}`;

/** Vytvorí nový token (starý zneplatní), uloží hash a odošle pozvánku. */
export async function issueInvitation(participantId: string) {
  const db = admin();
  const { data: p } = await db.from("participants").select("id,group_id,first_name,last_name,email,groups(name,min_gift_value,gift_deadline)").eq("id", participantId).maybeSingle();
  if (!p) return { ok: false as const, error: "Účastník neexistuje" };
  const part = p as unknown as { id: string; group_id: string; first_name: string; last_name: string; email: string; groups: { name: string; min_gift_value: number; gift_deadline: string | null } };

  await db.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("participant_id", participantId).is("used_at", null).is("revoked_at", null);

  const token = newToken();
  const { data: inv, error } = await db
    .from("invitations")
    .insert({ participant_id: participantId, email: part.email, kind: "participant", token_hash: hashToken(token), expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString() })
    .select("id")
    .single();
  if (error || !inv) return { ok: false as const, error: "Pozvánku sa nepodarilo vytvoriť" };

  const t = templates.invitation({ first_name: part.first_name, last_name: part.last_name, group: part.groups, url: inviteUrl(token), infoUrl: inviteUrl(token) });
  const r = await sendEmail({ to: part.email, template: "invitation", subject: t.subject, html: t.html, groupId: part.group_id });
  const invId = (inv as { id: string }).id;
  if (r.ok) await db.from("invitations").update({ resend_message_id: r.id, email_status: "sent" }).eq("id", invId);
  else await db.from("invitations").update({ email_status: "failed" }).eq("id", invId);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

/** Pozvánka pre nového organizátora (vytvorí účet bez použiteľného hesla; heslo si nastaví cez token). */
export async function issueOrganizerInvite(userId: string, email: string, firstName: string) {
  const db = admin();
  await db.from("invitations").update({ revoked_at: new Date().toISOString() }).eq("organizer_user_id", userId).is("used_at", null).is("revoked_at", null);
  const token = newToken();
  const { data: inv, error } = await db
    .from("invitations")
    .insert({ organizer_user_id: userId, email, kind: "organizer", token_hash: hashToken(token), expires_at: new Date(Date.now() + INVITE_TTL_MS).toISOString() })
    .select("id")
    .single();
  if (error || !inv) return { ok: false as const, error: "Pozvánku sa nepodarilo vytvoriť" };
  const t = templates.organizerInvite({ first_name: firstName, url: inviteUrl(token) });
  const r = await sendEmail({ to: email, template: "organizer_invite", subject: t.subject, html: t.html });
  const invId = (inv as { id: string }).id;
  if (r.ok) await db.from("invitations").update({ resend_message_id: r.id }).eq("id", invId);
  else await db.from("invitations").update({ email_status: "failed" }).eq("id", invId);
  return r.ok ? { ok: true as const } : { ok: false as const, error: r.error };
}

/** Hromadné odosielanie s ohľadom na limit Resend (2 req/s). */
export async function sendMany(items: { to: string; template: string; subject: string; html: string; groupId?: string | null }[]) {
  let failed = 0;
  for (const it of items) {
    const r = await sendEmail(it);
    if (!r.ok) failed++;
    await sleep(600);
  }
  return failed;
}

export type InviteView = "sent" | "delivered" | "opened" | "registered" | "expired" | "failed";
export function inviteDisplayStatus(inv: { email_status: string; used_at: string | null; expires_at: string; revoked_at: string | null }): InviteView {
  if (inv.used_at) return "registered";
  if (inv.email_status === "failed") return "failed";
  if (new Date(inv.expires_at).getTime() < Date.now() || inv.revoked_at) return "expired";
  return inv.email_status as InviteView;
}

export const INVITE_LABEL: Record<InviteView, string> = {
  sent: "Odoslaný",
  delivered: "Doručený",
  opened: "Otvorený",
  registered: "Registrovaný",
  expired: "Expirovaný",
  failed: "Chyba odoslania",
};
