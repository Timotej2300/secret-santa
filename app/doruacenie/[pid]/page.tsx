import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { fmtEur } from "@/lib/utils";
import { Shell } from "@/components/ui";
import { DeliveryForm } from "@/components/DeliveryForm";

export const metadata = { title: "Odovzdanie darčeka" };
export const dynamic = "force-dynamic";

export default async function DeliveryPage({ params }: { params: Promise<{ pid: string }> }) {
  const s = await requireUser();
  const { pid } = await params;
  const db = admin();
  const { data } = await db.from("participants").select("id,groups(name,min_gift_value,delivery_locked)").eq("id", pid).eq("user_id", s.user.id).eq("status", "registered").maybeSingle();
  if (!data) notFound();
  const p = data as unknown as { id: string; groups: { name: string; min_gift_value: number; delivery_locked: boolean } };
  const { data: d } = await db.from("delivery_details").select("*").eq("participant_id", pid).maybeSingle();
  return (
    <Shell narrow>
      <div className="card">
        <h1 className="font-display text-3xl font-semibold text-forest-800">Ako chceš odovzdať darček?</h1>
        <p className="mt-1 text-sm text-forest-900/60">Skupina {p.groups.name}</p>
        {p.groups.delivery_locked && <p className="mt-4 rounded-2xl bg-gold-300/30 p-3 text-sm">Organizátor zamkol úpravu údajov.</p>}
        <DeliveryForm participantId={pid} initial={d as never} minValue={fmtEur(p.groups.min_gift_value)} locked={p.groups.delivery_locked} />
      </div>
    </Shell>
  );
}
