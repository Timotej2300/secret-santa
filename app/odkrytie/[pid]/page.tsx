import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { Shell } from "@/components/ui";
import { ScratchCard } from "@/components/ScratchCard";

export const metadata = { title: "Stierací lístok" };
export const dynamic = "force-dynamic";

export default async function ScratchPage({ params }: { params: Promise<{ pid: string }> }) {
  const s = await requireUser();
  const { pid } = await params;
  const db = admin();
  const { data } = await db.from("participants").select("id,groups(draw_status)").eq("id", pid).eq("user_id", s.user.id).eq("status", "registered").maybeSingle();
  if (!data) notFound();
  const drawn = (data as unknown as { groups: { draw_status: string } }).groups.draw_status === "drawn";
  const { data: a } = drawn ? await db.from("assignments").select("revealed_at,receiver:participants!assignments_receiver_id_fkey(first_name,last_name)").eq("giver_id", pid).eq("is_active", true).maybeSingle() : { data: null };
  const asg = a as unknown as { revealed_at: string | null; receiver: { first_name: string; last_name: string } } | null;
  return (
    <Shell narrow>
      <div className="card text-center">
        <h1 className="font-display text-3xl font-semibold text-forest-800">Tvoj Secret Santa príjemca</h1>
        <div className="mt-6">
          {!drawn || !asg ? (
            <p className="rounded-2xl bg-cream p-5 text-sm text-forest-900/70">Organizátor zatiaľ nespustil losovanie. Tvoj darčekový príjemca sa zobrazí hneď, ako bude losovanie pripravené.</p>
          ) : asg.revealed_at ? (
            <p className="rounded-3xl border-2 border-gold-400 bg-paper p-8 font-display text-3xl font-semibold text-forest-800">{asg.receiver.first_name} {asg.receiver.last_name}</p>
          ) : (
            <ScratchCard participantId={pid} />
          )}
        </div>
        <Link href="/dashboard" className="btn-primary mt-6">Prejsť na môj panel</Link>
      </div>
    </Shell>
  );
}
