import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";
import { sendMany } from "@/lib/invites";
import { templates } from "@/lib/email";

export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const now = Date.now();

  // expirované pozvánky
  await db.from("invitations").update({ email_status: "expired" }).lt("expires_at", new Date(now).toISOString()).is("used_at", null).not("email_status", "in", "(expired,failed)");

  // pripomienky termínu
  const { data } = await db.from("groups").select("id,name,gift_deadline,group_settings(reminder_days_before,reminder_sent_at)").eq("draw_status", "drawn").not("gift_deadline", "is", null).gt("gift_deadline", new Date(now).toISOString());
  let sent = 0;
  for (const g of (data ?? []) as unknown as { id: string; name: string; gift_deadline: string; group_settings: { reminder_days_before: number; reminder_sent_at: string | null } | { reminder_days_before: number; reminder_sent_at: string | null }[] | null }[]) {
    const st = Array.isArray(g.group_settings) ? g.group_settings[0] : g.group_settings;
    if (!st || st.reminder_sent_at) continue;
    if (new Date(g.gift_deadline).getTime() - now > st.reminder_days_before * 86400000) continue;
    const { data: ps } = await db.from("participants").select("first_name,email").eq("group_id", g.id).eq("status", "registered");
    const mails = ((ps ?? []) as { first_name: string; email: string }[]).map((p) => ({ to: p.email, template: "reminder", groupId: g.id, ...templates.reminder({ first_name: p.first_name, group: g.name, deadline: g.gift_deadline }) }));
    await sendMany(mails);
    await db.from("group_settings").update({ reminder_sent_at: new Date().toISOString() }).eq("group_id", g.id);
    sent += mails.length;
  }
  return NextResponse.json({ ok: true, reminders: sent });
}
