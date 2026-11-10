import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { ActionButton, ActionForm, Field } from "@/components/Form";
import { Empty, PageTitle, Shell } from "@/components/ui";
import { addWish, deleteWish } from "@/app/actions/participant";

export const metadata = { title: "Môj wishlist" };
export const dynamic = "force-dynamic";

export default async function WishlistPage({ params }: { params: Promise<{ pid: string }> }) {
  const s = await requireUser();
  const { pid } = await params;
  const db = admin();
  const { data } = await db.from("participants").select("id").eq("id", pid).eq("user_id", s.user.id).eq("status", "registered").maybeSingle();
  if (!data) notFound();
  const { data: w } = await db.from("wishlist_items").select("*").eq("participant_id", pid).order("created_at");
  const items = (w ?? []) as { id: string; title: string; description: string | null; url: string | null; note: string | null; clothing_size: string | null; favorite_color: string | null }[];
  return (
    <Shell>
      <PageTitle title="Môj wishlist" subtitle="Vidí ho iba osoba, ktorá ťa vyžrebovala." />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-4 font-display text-lg font-semibold text-forest-800">Pridať želanie</h2>
          <ActionForm action={addWish} resetOnSuccess className="space-y-3">
            <input type="hidden" name="participantId" value={pid} />
            <Field label="Názov"><input className="input" name="title" required maxLength={140} /></Field>
            <Field label="Popis"><textarea className="input min-h-16" name="description" maxLength={1000} /></Field>
            <Field label="Odkaz na produkt"><input className="input" type="url" name="url" placeholder="https://" /></Field>
            <Field label="URL obrázka (HTTPS)"><input className="input" type="url" name="image_url" placeholder="https://" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Veľkosť oblečenia"><input className="input" name="clothing_size" maxLength={30} /></Field>
              <Field label="Obľúbená farba"><input className="input" name="favorite_color" maxLength={40} /></Field>
            </div>
            <Field label="Poznámka"><input className="input" name="note" maxLength={500} /></Field>
            <button className="btn-primary">Pridať</button>
          </ActionForm>
        </div>
        <div>
          {items.length === 0 ? (
            <Empty title="Wishlist je prázdny">Pridaj aspoň pár nápadov, nech má tvoj Secret Santa ľahšiu prácu.</Empty>
          ) : (
            <ul className="space-y-3">
              {items.map((i) => (
                <li key={i.id} className="card flex items-start justify-between gap-3 !p-4 text-sm">
                  <div>
                    <p className="font-semibold">{i.title}</p>
                    {i.description && <p className="text-forest-900/70">{i.description}</p>}
                    {i.url && <a href={i.url} target="_blank" rel="noopener noreferrer nofollow" className="text-xs underline">{i.url}</a>}
                    <p className="text-xs text-forest-900/60">{[i.clothing_size && `Veľkosť: ${i.clothing_size}`, i.favorite_color && `Farba: ${i.favorite_color}`, i.note].filter(Boolean).join(" · ")}</p>
                  </div>
                  <ActionButton className="btn-ghost !px-3" run={deleteWish.bind(null, i.id)} confirm="Odstrániť želanie?"><Trash2 size={15} /></ActionButton>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Shell>
  );
}
