"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { admin } from "@/lib/supabase/admin";
import { getSession } from "@/lib/auth";
import { passwordSchema, firstError } from "@/lib/validation";
import { supabaseServer } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { fail, ok, type ActionResult } from "@/lib/utils";

const schema = z.object({
  first_name: z.string().trim().min(1, "Zadaj meno").max(60),
  last_name: z.string().trim().min(1, "Zadaj priezvisko").max(60),
  phone: z.string().trim().max(30).regex(/^[+0-9 ()\-]*$/, "Neplatný telefón").optional().or(z.literal("")),
});

export async function updateProfile(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail("Prihlás sa.");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return fail(firstError(p.error));
  await admin().from("profiles").update({ first_name: p.data.first_name, last_name: p.data.last_name, phone: p.data.phone || null }).eq("id", s.user.id);
  revalidatePath("/profil");
  return ok("Profil uložený");
}

export async function changePassword(fd: FormData): Promise<ActionResult> {
  const s = await getSession();
  if (!s) return fail("Prihlás sa.");
  const pw = passwordSchema.safeParse(fd.get("password"));
  if (!pw.success) return fail(firstError(pw.error));
  if (fd.get("password") !== fd.get("password2")) return fail("Heslá sa nezhodujú");
  const sb = await supabaseServer();
  const { error } = await sb.auth.updateUser({ password: pw.data });
  if (error) return fail("Heslo sa nepodarilo zmeniť");
  await audit(s.user.id, "auth.password_changed");
  return ok("Heslo zmenené");
}
