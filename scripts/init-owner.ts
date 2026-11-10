/**
 * Bezpečná inicializácia Owner účtu (spúšťa sa iba na serveri / lokálne so service role kľúčom).
 *   OWNER_PASSWORD="silne-heslo-min-12-znakov" npm run init-owner
 * Načíta premenné z .env.local (node --env-file) alebo z prostredia.
 */
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = (process.env.OWNER_EMAIL || "").trim().toLowerCase();
  const password = process.env.OWNER_PASSWORD;
  if (!url || !key || !email) throw new Error("Chýba NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY alebo OWNER_EMAIL.");
  const db = createClient(url, key, { auth: { persistSession: false } });

  const { data: existingOwner } = await db.from("system_roles").select("user_id").eq("role", "owner").maybeSingle();
  if (existingOwner) {
    console.log("Owner už existuje – nič sa nemení.");
    return;
  }
  if (!password || password.length < 12) throw new Error("Nastav OWNER_PASSWORD (min. 12 znakov).");

  const { data: list } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let user = list?.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { first_name: "Owner", last_name: "" } });
    if (error || !data.user) throw new Error(error?.message || "Nepodarilo sa vytvoriť používateľa.");
    user = data.user;
  } else {
    await db.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  }
  await db.from("profiles").upsert({ id: user.id, email, first_name: "Owner", last_name: "" });
  const { error } = await db.from("system_roles").insert({ user_id: user.id, role: "owner" });
  if (error) throw new Error(error.message);
  await db.from("audit_logs").insert({ actor_id: user.id, action: "owner.initialized", entity: "profile", entity_id: user.id });
  console.log(`Owner vytvorený: ${email}`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
