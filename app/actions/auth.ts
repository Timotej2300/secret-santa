"use server";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";
import { emailSchema, firstError } from "@/lib/validation";
import { rateLimit, TOO_MANY } from "@/lib/ratelimit";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/utils";

export async function login(fd: FormData): Promise<ActionResult<{ redirect: string }>> {
  if (!(await rateLimit("login", 10, 600))) return fail(TOO_MANY);
  const email = emailSchema.safeParse(fd.get("email"));
  const password = String(fd.get("password") ?? "");
  if (!email.success) return fail(firstError(email.error));
  if (!password) return fail("Zadaj heslo");
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithPassword({ email: email.data, password });
  if (error || !data.user) return fail("Nesprávny e-mail alebo heslo");
  const { data: p } = await admin().from("profiles").select("is_active").eq("id", data.user.id).maybeSingle();
  if (!p || !(p as { is_active: boolean }).is_active) {
    await sb.auth.signOut();
    return fail("Účet je deaktivovaný");
  }
  await audit(data.user.id, "auth.login");
  const next = String(fd.get("next") ?? "");
  return ok(undefined, { redirect: next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard" });
}

export async function logout() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/");
}
