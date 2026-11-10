import "server-only";
import { admin } from "@/lib/supabase/admin";

export type GroupRow = {
  id: string;
  organizer_id: string;
  name: string;
  description: string;
  max_participants: number;
  min_gift_value: number;
  gift_deadline: string | null;
  rules: string;
  status: string;
  draw_status: string;
  draw_round: number;
  phone_required: boolean;
  delivery_locked: boolean;
  created_at: string;
};

export const GROUP_STATUS: Record<string, string> = {
  draft: "Koncept",
  registration_open: "Registrácia otvorená",
  registration_closed: "Registrácia uzavretá",
  drawn: "Vylosované",
  archived: "Archív",
};
export const DRAW_STATUS: Record<string, string> = { not_drawn: "Nevylosované", drawn: "Vylosované", needs_redraw: "Treba nové losovanie" };
export const GIFT_STATUS: Record<string, string> = { pending: "Čaká na odovzdanie", awaiting_confirmation: "Čaká na potvrdenie príjemcu", confirmed: "Potvrdené", problem: "Problém" };

export async function organizerGroups(userId: string) {
  const db = admin();
  const { data: own } = await db.from("groups").select("*").eq("organizer_id", userId).order("created_at", { ascending: false });
  const { data: mem } = await db.from("group_members").select("group_id").eq("user_id", userId);
  const extra = ((mem ?? []) as { group_id: string }[]).map((m) => m.group_id);
  let more: GroupRow[] = [];
  if (extra.length) {
    const { data } = await db.from("groups").select("*").in("id", extra);
    more = (data ?? []) as GroupRow[];
  }
  const all = [...((own ?? []) as GroupRow[]), ...more];
  return all.filter((g, i) => all.findIndex((x) => x.id === g.id) === i);
}

export async function participantCounts(groupIds: string[]) {
  const out: Record<string, { total: number; registered: number; pending: number }> = {};
  groupIds.forEach((id) => (out[id] = { total: 0, registered: 0, pending: 0 }));
  if (!groupIds.length) return out;
  const { data } = await admin().from("participants").select("group_id,status").in("group_id", groupIds).in("status", ["invited", "registered"]);
  ((data ?? []) as { group_id: string; status: string }[]).forEach((p) => {
    out[p.group_id].total++;
    if (p.status === "registered") out[p.group_id].registered++;
    else out[p.group_id].pending++;
  });
  return out;
}
