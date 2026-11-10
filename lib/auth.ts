import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { admin } from "@/lib/supabase/admin";

export type SystemRole = "owner" | "system_admin" | "support" | "organizer";
export type Profile = { id: string; email: string; first_name: string; last_name: string; phone: string | null; is_active: boolean };
export type Session = { user: Profile; roles: SystemRole[] };

export const getSession = cache(async (): Promise<Session | null> => {
  const sb = await supabaseServer();
  const { data } = await sb.auth.getUser();
  if (!data.user) return null;
  const db = admin();
  const { data: profile } = await db.from("profiles").select("id,email,first_name,last_name,phone,is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !(profile as Profile).is_active) return null;
  const { data: roles } = await db.from("system_roles").select("role").eq("user_id", data.user.id);
  void db.from("profiles").update({ last_seen_at: new Date().toISOString() } as never).eq("id", data.user.id);
  return { user: profile as Profile, roles: ((roles ?? []) as { role: SystemRole }[]).map((r) => r.role) };
});

export async function requireUser(next?: string) {
  const s = await getSession();
  if (!s) redirect(`/prihlasenie${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return s;
}

export const hasRole = (s: Session | null, ...r: SystemRole[]) => !!s && s.roles.some((x) => r.includes(x));
export const isOwner = (s: Session | null) => hasRole(s, "owner");
export const isStaff = (s: Session | null) => hasRole(s, "owner", "system_admin", "support");

export async function requireRole(...r: SystemRole[]) {
  const s = await requireUser();
  if (!hasRole(s, ...r)) redirect("/dashboard");
  return s;
}

/** Organizátor skupiny alebo Owner. System admin môže skupinu spravovať, ale nie vidieť priradenia. */
export async function canManageGroup(s: Session, groupId: string, level: "organizer" | "admin" = "organizer") {
  if (isOwner(s)) return true;
  if (level === "admin" && hasRole(s, "system_admin")) return true;
  const { data } = await admin().from("groups").select("organizer_id").eq("id", groupId).maybeSingle();
  if (!data) return false;
  if ((data as { organizer_id: string }).organizer_id === s.user.id) return true;
  const { data: m } = await admin().from("group_members").select("user_id").eq("group_id", groupId).eq("user_id", s.user.id).maybeSingle();
  return !!m;
}

/** Skupiny, kde je používateľ účastníkom. */
export async function myParticipations(userId: string) {
  const { data } = await admin()
    .from("participants")
    .select("id,group_id,status,gift_value_confirmed_at,groups(id,name,description,min_gift_value,gift_deadline,rules,draw_status,delivery_locked,organizer_id)")
    .eq("user_id", userId)
    .in("status", ["invited", "registered"]);
  return (data ?? []) as unknown as {
    id: string;
    group_id: string;
    status: string;
    gift_value_confirmed_at: string | null;
    groups: { id: string; name: string; description: string; min_gift_value: number; gift_deadline: string | null; rules: string; draw_status: string; delivery_locked: boolean; organizer_id: string };
  }[];
}

export function homeFor(s: Session) {
  if (hasRole(s, "owner", "system_admin", "support")) return "/admin";
  if (hasRole(s, "organizer")) return "/organizator";
  return "/dashboard";
}
