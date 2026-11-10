import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { admin } from "@/lib/supabase/admin";

function verify(body: string, headers: Headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = headers.get("svix-id");
  const ts = headers.get("svix-timestamp");
  const sigHeader = headers.get("svix-signature");
  if (!secret || !id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigHeader.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

export async function POST(req: Request) {
  const body = await req.text();
  if (!verify(body, req.headers)) return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  const evt = JSON.parse(body) as { type: string; created_at?: string; data?: { email_id?: string } };
  const emailId = evt.data?.email_id;
  if (!emailId) return NextResponse.json({ ok: true });
  const db = admin();
  const now = new Date().toISOString();

  if (evt.type === "email.delivered") {
    await db.from("invitations").update({ email_status: "delivered", delivered_at: now }).eq("resend_message_id", emailId).in("email_status", ["sent"]);
    await db.from("email_logs").update({ status: "delivered" }).eq("resend_message_id", emailId);
  } else if (evt.type === "email.opened") {
    await db.from("invitations").update({ email_status: "opened", opened_at: now }).eq("resend_message_id", emailId).in("email_status", ["sent", "delivered"]);
    await db.from("email_logs").update({ status: "opened" }).eq("resend_message_id", emailId);
  } else if (evt.type === "email.bounced" || evt.type === "email.failed") {
    await db.from("invitations").update({ email_status: "failed" }).eq("resend_message_id", emailId).is("used_at", null);
    await db.from("email_logs").update({ status: "failed", error: evt.type }).eq("resend_message_id", emailId);
  }
  return NextResponse.json({ ok: true });
}
