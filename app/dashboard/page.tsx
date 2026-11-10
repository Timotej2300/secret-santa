import Link from "next/link";
import { Gift, Heart, LifeBuoy, Mail, Phone, Truck } from "lucide-react";
import { myParticipations, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { GIFT_STATUS } from "@/lib/queries";
import { fmtDateTime, fmtEur } from "@/lib/utils";
import { ActionButton, ActionForm } from "@/components/Form";
import { Countdown } from "@/components/Countdown";
import { ScratchCard } from "@/components/ScratchCard";
import { Badge, Empty, PageTitle, Shell } from "@/components/ui";
import { confirmReceived, markGiven, reportGiftProblem, requestLeave } from "@/app/actions/participant";

export const metadata = { title: "Môj panel" };
export const dynamic = "force-dynamic";

type Recv = { id: string; revealed_at: string | null; receiver: { id: string; first_name: string; last_name: string }; gift_statuses: { status: string; given_at: string | null; received_at: string | null; given_late: boolean } | { status: string; given_at: string | null; received_at: string | null; given_late: boolean }[] | null };

export default async function Dashboard() {
  const s = await requireUser("/dashboard");
  const parts = (await myParticipations(s.user.id)).filter((p) => p.status === "registered");
  const pending = (await myParticipations(s.user.id)).filter((p) => p.status === "invited");
  const db = admin();

  const cards = await Promise.all(
    parts.map(async (p) => {
      const g = p.groups;
      const { data: org } = await db.from("profiles").select("first_name,last_name,email,phone").eq("id", g.organizer_id).single();
      const { data: mine } = await db.from("delivery_details").select("method").eq("participant_id", p.id).maybeSingle();
      let recv: Recv | null = null;
      let wishes: { id: string; title: string; description: string | null; url: string | null; image_url: string | null; note: string | null; clothing_size: string | null; favorite_color: string | null }[] = [];
      let recvDelivery: Record<string, string | null> | null = null;
      let myGift: { status: string } | null = null;
      let incoming: { id: string; status: string } | null = null;
      if (g.draw_status === "drawn") {
        const { data: a } = await db.from("assignments").select("id,revealed_at,receiver:participants!assignments_receiver_id_fkey(id,first_name,last_name),gift_statuses(status,given_at,received_at,given_late)").eq("giver_id", p.id).eq("is_active", true).maybeSingle();
        recv = (a as unknown as Recv) ?? null;
        if (recv?.revealed_at) {
          const { data: w } = await db.from("wishlist_items").select("id,title,description,url,image_url,note,clothing_size,favorite_color").eq("participant_id", recv.receiver.id).order("created_at");
          wishes = (w ?? []) as typeof wishes;
          const { data: d } = await db.from("delivery_details").select("*").eq("participant_id", recv.receiver.id).maybeSingle();
          recvDelivery = (d as Record<string, string | null>) ?? null;
        }
        const { data: inc } = await db.from("assignments").select("id,gift_statuses(status)").eq("receiver_id", p.id).eq("is_active", true).maybeSingle();
        const i = inc as unknown as { id: string; gift_statuses: { status: string } | { status: string }[] | null } | null;
        if (i) incoming = { id: i.id, status: (Array.isArray(i.gift_statuses) ? i.gift_statuses[0] : i.gift_statuses)?.status ?? "pending" };
        const gs = recv && (Array.isArray(recv.gift_statuses) ? recv.gift_statuses[0] : recv.gift_statuses);
        myGift = gs ? { status: gs.status } : null;
      }
      return { p, g, org: org as { first_name: string; last_name: string; email: string; phone: string | null }, mine: mine as { method: string } | null, recv, wishes, recvDelivery, myGift, incoming };
    }),
  );

  return (
    <Shell>
      <PageTitle title={`Ahoj, ${s.user.first_name || "vitaj"}!`} subtitle="Tvoje Secret Santa skupiny" />
      {pending.length > 0 && <p className="mb-4 rounded-2xl bg-gold-300/30 p-3 text-sm">Máš nedokončenú registráciu v {pending.length} skupine – otvor odkaz z pozvánky v e-maile.</p>}
      {cards.length === 0 ? (
        <Empty title="Zatiaľ nie si v žiadnej skupine">Skupina sa objaví po dokončení registrácie z pozvánky alebo cez QR kód.</Empty>
      ) : (
        <div className="space-y-8">
          {cards.map(({ p, g, org, mine, recv, wishes, recvDelivery, myGift, incoming }) => {
            const gs = recv && (Array.isArray(recv.gift_statuses) ? recv.gift_statuses[0] : recv.gift_statuses);
            return (
              <section key={p.id} className="space-y-4">
                <div className="card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-display text-2xl font-semibold text-forest-800">{g.name}</h2>
                      <p className="text-sm text-forest-900/60">Minimálna hodnota darčeka {fmtEur(g.min_gift_value)} · Termín {fmtDateTime(g.gift_deadline)}</p>
                    </div>
                    {myGift && <Badge tone={myGift.status === "confirmed" ? "green" : myGift.status === "problem" ? "red" : "gold"}>{GIFT_STATUS[myGift.status]}</Badge>}
                  </div>
                  {g.gift_deadline && <div className="mt-5"><Countdown deadline={g.gift_deadline} /></div>}
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="card">
                    <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-800"><Gift size={18} /> Môj príjemca</h3>
                    {g.draw_status !== "drawn" || !recv ? (
                      <p className="rounded-2xl bg-cream p-4 text-sm text-forest-900/70">Organizátor zatiaľ nespustil losovanie. Tvoj darčekový príjemca sa zobrazí hneď, ako bude losovanie pripravené.</p>
                    ) : recv.revealed_at ? (
                      <p className="rounded-3xl border-2 border-gold-400 bg-paper p-6 text-center font-display text-3xl font-semibold text-forest-800">{recv.receiver.first_name} {recv.receiver.last_name}</p>
                    ) : (
                      <ScratchCard participantId={p.id} />
                    )}
                    {recv?.revealed_at && recv && (
                      <div className="mt-5 space-y-3 border-t border-forest-900/5 pt-4">
                        {recvDelivery && (
                          <p className="flex items-start gap-2 text-sm"><Truck size={16} className="mt-0.5 shrink-0 text-forest-500" />
                            <span>
                              {recvDelivery.method === "in_person" && <>Osobné odovzdanie{recvDelivery.meeting_place ? `: ${recvDelivery.meeting_place}` : ""}</>}
                              {recvDelivery.method === "address" && <>Doručiť na: {recvDelivery.address_line}, {recvDelivery.postal_code} {recvDelivery.city}, {recvDelivery.country}</>}
                              {recvDelivery.method === "via_person" && <>Odovzdať cez: {recvDelivery.via_person_name}</>}
                              {recvDelivery.note ? ` – ${recvDelivery.note}` : ""}
                            </span>
                          </p>
                        )}
                        {myGift && ["pending", "problem"].includes(myGift.status) && <ActionButton className="btn-primary" run={markGiven.bind(null, recv.id)} confirm="Naozaj si darček odovzdal/a?">Darček som odovzdal</ActionButton>}
                        {myGift?.status === "awaiting_confirmation" && <p className="text-sm text-forest-900/60">Čaká na potvrdenie príjemcu.</p>}
                        {gs?.given_late && <p className="text-xs text-red-700">Odovzdané po termíne.</p>}
                      </div>
                    )}
                  </div>

                  <div className="card">
                    <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-800"><Heart size={18} /> Wishlist príjemcu</h3>
                    {!recv?.revealed_at ? (
                      <p className="text-sm text-forest-900/50">Zobrazí sa po odkrytí príjemcu.</p>
                    ) : wishes.length === 0 ? (
                      <p className="text-sm text-forest-900/50">Príjemca zatiaľ nepridal žiadne želanie.</p>
                    ) : (
                      <ul className="space-y-3">
                        {wishes.map((w) => (
                          <li key={w.id} className="rounded-2xl bg-cream p-3 text-sm">
                            <div className="flex gap-3">
                              {w.image_url && /* eslint-disable-next-line @next/next/no-img-element */ <img src={w.image_url} alt="" referrerPolicy="no-referrer" className="h-14 w-14 rounded-xl object-cover" />}
                              <div className="min-w-0">
                                <p className="font-semibold">{w.url ? <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-gold-500">{w.title}</a> : w.title}</p>
                                {w.description && <p className="text-forest-900/70">{w.description}</p>}
                                <p className="text-xs text-forest-900/60">{[w.clothing_size && `Veľkosť: ${w.clothing_size}`, w.favorite_color && `Farba: ${w.favorite_color}`, w.note].filter(Boolean).join(" · ")}</p>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {incoming?.status === "awaiting_confirmation" && (
                  <div className="card flex flex-wrap items-center justify-between gap-3 !bg-gold-300/20">
                    <p className="text-sm font-medium">Tvoj Secret Santa označil, že ti odovzdal darček.</p>
                    <ActionButton className="btn-gold" run={confirmReceived.bind(null, incoming.id)}>Darček som dostal</ActionButton>
                  </div>
                )}
                {incoming?.status === "confirmed" && <p className="rounded-2xl bg-forest-100 p-3 text-sm font-medium text-forest-800">Prijatie tvojho darčeka je potvrdené.</p>}

                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="card text-sm">
                    <h3 className="mb-2 font-display text-lg font-semibold text-forest-800">Informácie o skupine</h3>
                    {g.description && <p className="mb-2 text-forest-900/70">{g.description}</p>}
                    <p className="whitespace-pre-wrap">{g.rules || "Organizátor zatiaľ nepridal ďalšie informácie."}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/doruacenie/${p.id}`} className="btn-ghost"><Truck size={15} /> {mine ? "Upraviť doručenie" : "Nastaviť doručenie"}</Link>
                      <Link href={`/wishlist/${p.id}`} className="btn-ghost"><Heart size={15} /> Môj wishlist</Link>
                    </div>
                  </div>
                  <div className="card text-sm">
                    <h3 className="mb-2 font-display text-lg font-semibold text-forest-800">Organizátor</h3>
                    <p className="font-medium">{org.first_name} {org.last_name}</p>
                    <p className="mt-1 flex items-center gap-2 text-forest-900/70"><Mail size={14} /> <a href={`mailto:${org.email}`} className="underline">{org.email}</a></p>
                    {org.phone && <p className="mt-1 flex items-center gap-2 text-forest-900/70"><Phone size={14} /> {org.phone}</p>}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href="/podpora" className="btn-ghost"><LifeBuoy size={15} /> Podpora</Link>
                      {recv && gs && gs.status !== "confirmed" && (
                        <details className="w-full">
                          <summary className="cursor-pointer text-xs text-forest-900/60">Nahlásiť problém s darčekom</summary>
                          <ActionForm action={reportGiftProblem.bind(null, recv.id)} className="mt-2 flex gap-2">
                            <input className="input" name="note" placeholder="Čo sa stalo?" required />
                            <button className="btn-ghost">Odoslať</button>
                          </ActionForm>
                        </details>
                      )}
                      <ActionButton className="btn-ghost !text-red-700" run={requestLeave.bind(null, p.id)} confirm="Požiadať organizátora o odchod zo skupiny?">Požiadať o odchod</ActionButton>
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Shell>
  );
}
