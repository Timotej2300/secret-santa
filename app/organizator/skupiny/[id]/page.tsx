import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Mail, Printer, RefreshCw, Shuffle, Trash2, UserPlus } from "lucide-react";
import { canManageGroup, requireUser } from "@/lib/auth";
import { admin } from "@/lib/supabase/admin";
import { DRAW_STATUS, GIFT_STATUS, GROUP_STATUS, type GroupRow } from "@/lib/queries";
import { INVITE_LABEL, inviteDisplayStatus, type InviteView } from "@/lib/invites";
import { APP_URL, fmtDateTime, isoToLocalInput } from "@/lib/utils";
import { ActionButton, ActionForm, Field } from "@/components/Form";
import { GroupForm } from "@/components/GroupForm";
import { CopyButton } from "@/components/Misc";
import { Badge, Empty, PageTitle } from "@/components/ui";
import { addParticipant, removeParticipant, resendInvitation, rotateQr, runDraw, setDeliveryLock, setRegistration, toggleOrganizerParticipation, updateGroupSettings, updateRules } from "@/app/actions/groups";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const TABS = [
  ["ucastnici", "Účastníci"],
  ["losovanie", "Losovanie"],
  ["emaily", "E-maily a pozvánky"],
  ["darceky", "Darčeky"],
  ["info", "Informácie a nastavenia"],
  ["zapisnik", "Zápisník a QR"],
] as const;

type P = { id: string; first_name: string; last_name: string; email: string; phone: string | null; status: string; source: string; user_id: string | null; leave_requested_at: string | null; gift_value_confirmed_at: string | null };
const name = (p?: { first_name: string; last_name: string }) => (p ? `${p.first_name} ${p.last_name}` : "—");
const inviteTone: Record<InviteView, "green" | "gold" | "gray" | "red"> = { sent: "gray", delivered: "gold", opened: "gold", registered: "green", expired: "red", failed: "red" };

export default async function GroupDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const s = await requireUser();
  const { id } = await params;
  const { tab: t } = await searchParams;
  if (!(await canManageGroup(s, id))) notFound();
  const tab = TABS.some(([k]) => k === t) ? (t as string) : "ucastnici";
  const db = admin();

  const { data: gd } = await db.from("groups").select("*").eq("id", id).single();
  const g = gd as GroupRow & { organizer_participates: boolean };
  const { data: pd } = await db.from("participants").select("id,first_name,last_name,email,phone,status,source,user_id,leave_requested_at,gift_value_confirmed_at").eq("group_id", id).in("status", ["invited", "registered"]).order("created_at");
  const parts = (pd ?? []) as P[];
  const registered = parts.filter((p) => p.status === "registered");
  const byId = new Map(parts.map((p) => [p.id, p]));
  const orgIsParticipant = parts.some((p) => p.user_id === g.organizer_id);

  const { data: qr } = await db.from("group_qr_tokens").select("token").eq("group_id", id).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const qrUrl = qr ? `${APP_URL}/skupina/${(qr as { token: string }).token}` : "";

  const header = (
    <PageTitle
      title={g.name}
      subtitle={`${GROUP_STATUS[g.status]} · ${DRAW_STATUS[g.draw_status]} · ${registered.length} / ${g.max_participants} zaregistrovaných`}
      action={
        g.status === "registration_open" ? (
          <ActionButton run={setRegistration.bind(null, id, false)} confirm="Uzatvoriť registráciu? Nastavenia skupiny sa potom nebudú dať upravovať.">Uzatvoriť registráciu</ActionButton>
        ) : g.status === "registration_closed" ? (
          <ActionButton run={setRegistration.bind(null, id, true)}>Znova otvoriť registráciu</ActionButton>
        ) : undefined
      }
    />
  );

  const tabs = (
    <nav className="mb-6 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-soft">
      {TABS.map(([k, label]) => (
        <Link key={k} href={`/organizator/skupiny/${id}?tab=${k}`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${tab === k ? "bg-forest-700 text-white" : "text-forest-800 hover:bg-forest-50"}`}>{label}</Link>
      ))}
    </nav>
  );

  let body: React.ReactNode = null;

  if (tab === "ucastnici") {
    const { data: dd } = await db.from("delivery_details").select("*").in("participant_id", parts.map((p) => p.id));
    const del = new Map(((dd ?? []) as { participant_id: string; method: string; address_line: string | null; city: string | null; postal_code: string | null; country: string | null; via_person_name: string | null; meeting_place: string | null }[]).map((d) => [d.participant_id, d]));
    const methodLabel = (pid: string) => {
      const d = del.get(pid);
      if (!d) return "—";
      if (d.method === "in_person") return `Osobne${d.meeting_place ? ` (${d.meeting_place})` : ""}`;
      if (d.method === "address") return `Adresa: ${d.address_line}, ${d.postal_code} ${d.city}, ${d.country}`;
      return `Cez osobu: ${d.via_person_name}`;
    };
    body = (
      <div className="space-y-6">
        <div className="card">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-forest-800"><UserPlus size={18} /> Pridať účastníka</h2>
          <ActionForm action={addParticipant} resetOnSuccess className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="groupId" value={id} />
            <input className="input" name="first_name" placeholder="Meno" required />
            <input className="input" name="last_name" placeholder="Priezvisko" required />
            <input className="input" type="email" name="email" placeholder="E-mail" required />
            <input className="input" type="tel" name="phone" placeholder={g.phone_required ? "Telefón" : "Telefón (nepovinný)"} required={g.phone_required} />
            <button className="btn-primary">Pridať a pozvať</button>
          </ActionForm>
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-forest-900/5 pt-4 text-sm">
            <span className="text-forest-900/60">Organizátor ako účastník: <b>{orgIsParticipant ? "áno" : "nie"}</b></span>
            <ActionButton run={toggleOrganizerParticipation.bind(null, id)}>{orgIsParticipant ? "Odhlásiť sa z účasti" : "Zúčastním sa aj ja"}</ActionButton>
          </div>
        </div>
        {parts.length === 0 ? (
          <Empty title="Zatiaľ žiadni účastníci">Pridaj prvého účastníka alebo zdieľaj QR kód.</Empty>
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[720px]">
              <thead className="border-b border-forest-900/5"><tr><th className="th">Meno</th><th className="th">E-mail / telefón</th><th className="th">Stav</th><th className="th">Doručenie</th><th className="th" /></tr></thead>
              <tbody className="divide-y divide-forest-900/5">
                {parts.map((p) => (
                  <tr key={p.id}>
                    <td className="td font-medium">{name(p)}{p.leave_requested_at && <div className="mt-1"><Badge tone="red">Žiada o odchod</Badge></div>}</td>
                    <td className="td text-forest-900/70">{p.email}<br />{p.phone ?? ""}</td>
                    <td className="td"><Badge tone={p.status === "registered" ? "green" : "gold"}>{p.status === "registered" ? "Registrovaný" : "Pozvaný"}</Badge></td>
                    <td className="td max-w-56 text-xs text-forest-900/70">{methodLabel(p.id)}</td>
                    <td className="td text-right"><ActionButton className="btn-ghost !px-3" run={removeParticipant.bind(null, p.id)} confirm={`Odstrániť účastníka ${name(p)}?${g.draw_status === "drawn" ? " Pôvodné losovanie sa zruší!" : ""}`}><Trash2 size={15} /></ActionButton></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "losovanie") {
    const { data: ad } = await db.from("assignments").select("giver_id,receiver_id").eq("group_id", id).eq("is_active", true);
    const asg = (ad ?? []) as { giver_id: string; receiver_id: string }[];
    const pending = parts.length - registered.length;
    const checks = [
      { ok: registered.length >= 4, text: `Aspoň 4 registrovaní účastníci (${registered.length})` },
      { ok: registered.length % 2 === 0 && registered.length > 0, text: `Párny počet účastníkov (${registered.length})` },
      { ok: pending === 0, text: `Všetky pozvánky dokončené (čaká ${pending})` },
      { ok: registered.length <= g.max_participants, text: `V rámci kapacity (${g.max_participants})` },
    ];
    const ready = checks.every((c) => c.ok) && g.draw_status !== "drawn";
    body = (
      <div className="space-y-6">
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-forest-800">Podmienky losovania</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checks.map((c) => (
              <li key={c.text} className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${c.ok ? "bg-forest-500" : "bg-red-500"}`} />{c.text}</li>
            ))}
          </ul>
          <div className="mt-5">
            {g.draw_status === "drawn" ? (
              <Badge tone="green">Losovanie je uzamknuté (kolo {g.draw_round})</Badge>
            ) : (
              <ActionButton className="btn-gold" run={runDraw.bind(null, id)} confirm={g.draw_status === "needs_redraw" ? "Spustiť nové losovanie? Všetci účastníci dostanú e-mail o zmene." : "Spustiť losovanie? Po vylosovaní už nepôjde zmeniť."}>
                <Shuffle size={16} /> {g.draw_status === "needs_redraw" ? "Spustiť nové losovanie" : "Spustiť losovanie"}
              </ActionButton>
            )}
            {!ready && g.draw_status !== "drawn" && <p className="mt-2 text-xs text-forest-900/50">Losovanie sa spustí až po splnení všetkých podmienok.</p>}
          </div>
        </div>
        {asg.length > 0 && (
          <div className="card overflow-x-auto !p-0">
            <div className="border-b border-forest-900/5 px-4 py-3 text-xs text-forest-900/60">Výsledky vidíš ako organizátor. Ak sám hráš, nepozeraj na svoj riadok, aby si si nepokazil prekvapenie.</div>
            <table className="w-full min-w-[420px]">
              <thead><tr><th className="th">Darca</th><th className="th">Príjemca</th></tr></thead>
              <tbody className="divide-y divide-forest-900/5">
                {asg.map((a) => (
                  <tr key={a.giver_id}><td className="td">{name(byId.get(a.giver_id))}</td><td className="td">→ {name(byId.get(a.receiver_id))}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "emaily") {
    const { data: invd } = await db.from("invitations").select("id,participant_id,email_status,used_at,expires_at,revoked_at,sent_at").in("participant_id", parts.map((p) => p.id)).order("sent_at", { ascending: false });
    const latest = new Map<string, { email_status: string; used_at: string | null; expires_at: string; revoked_at: string | null; sent_at: string }>();
    ((invd ?? []) as { participant_id: string; email_status: string; used_at: string | null; expires_at: string; revoked_at: string | null; sent_at: string }[]).forEach((i) => {
      if (!latest.has(i.participant_id)) latest.set(i.participant_id, i);
    });
    body = parts.length === 0 ? (
      <Empty title="Žiadne pozvánky" icon={<Mail size={26} />} />
    ) : (
      <div className="card overflow-x-auto !p-0">
        <table className="w-full min-w-[640px]">
          <thead className="border-b border-forest-900/5"><tr><th className="th">Účastník</th><th className="th">Stav e-mailu</th><th className="th">Odoslané</th><th className="th">Platí do</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-forest-900/5">
            {parts.map((p) => {
              const inv = latest.get(p.id);
              const st: InviteView | null = p.status === "registered" ? "registered" : inv ? inviteDisplayStatus(inv) : null;
              return (
                <tr key={p.id}>
                  <td className="td font-medium">{name(p)}<div className="text-xs font-normal text-forest-900/60">{p.email}</div></td>
                  <td className="td">{st ? <Badge tone={inviteTone[st]}>{INVITE_LABEL[st]}</Badge> : "—"}</td>
                  <td className="td text-xs">{fmtDateTime(inv?.sent_at)}</td>
                  <td className="td text-xs">{p.status === "registered" ? "—" : fmtDateTime(inv?.expires_at)}</td>
                  <td className="td text-right">{p.status === "invited" && <ActionButton run={resendInvitation.bind(null, p.id)}><RefreshCw size={15} /> Odoslať znova</ActionButton>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  if (tab === "darceky") {
    const { data: ad } = await db.from("assignments").select("id,giver_id,receiver_id,gift_statuses(status,given_at,given_late,received_at)").eq("group_id", id).eq("is_active", true);
    const rows = (ad ?? []) as unknown as { id: string; giver_id: string; receiver_id: string; gift_statuses: { status: string; given_at: string | null; given_late: boolean; received_at: string | null } | { status: string; given_at: string | null; given_late: boolean; received_at: string | null }[] | null }[];
    body = (
      <div className="space-y-4">
        <div className="card flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">Termín odovzdania: <b>{fmtDateTime(g.gift_deadline)}</b></p>
          <ActionButton run={setDeliveryLock.bind(null, id, !g.delivery_locked)}>{g.delivery_locked ? "Odomknúť úpravu doručenia" : "Zamknúť údaje o doručení"}</ActionButton>
        </div>
        {rows.length === 0 ? (
          <Empty title="Darčeky sa zobrazia po losovaní" />
        ) : (
          <div className="card overflow-x-auto !p-0">
            <table className="w-full min-w-[640px]">
              <thead className="border-b border-forest-900/5"><tr><th className="th">Darca</th><th className="th">Stav</th><th className="th">Odovzdané</th><th className="th">Prijaté</th></tr></thead>
              <tbody className="divide-y divide-forest-900/5">
                {rows.map((r) => {
                  const gs = Array.isArray(r.gift_statuses) ? r.gift_statuses[0] : r.gift_statuses;
                  return (
                    <tr key={r.id}>
                      <td className="td font-medium">{name(byId.get(r.giver_id))}</td>
                      <td className="td"><Badge tone={gs?.status === "confirmed" ? "green" : gs?.status === "problem" ? "red" : "gold"}>{GIFT_STATUS[gs?.status ?? "pending"]}</Badge>{gs?.given_late && <span className="ml-2 text-xs text-red-700">po termíne</span>}</td>
                      <td className="td text-xs">{fmtDateTime(gs?.given_at)}</td>
                      <td className="td text-xs">{fmtDateTime(gs?.received_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (tab === "info") {
    const locked = ["registration_closed", "drawn", "archived"].includes(g.status);
    body = (
      <div className="space-y-6">
        <div className="card">
          <h2 className="mb-4 font-display text-lg font-semibold text-forest-800">Podrobné informácie a pravidlá</h2>
          <ActionForm action={updateRules} className="space-y-4">
            <input type="hidden" name="groupId" value={id} />
            <textarea className="input min-h-44" name="rules" defaultValue={g.rules} maxLength={8000} placeholder="Kde a kedy sa odovzdávajú darčeky, či musia byť zabalené, špeciálne pravidlá…" />
            <button className="btn-primary">Uložiť a upozorniť účastníkov</button>
          </ActionForm>
        </div>
        <div className="card">
          <h2 className="mb-1 font-display text-lg font-semibold text-forest-800">Nastavenia skupiny</h2>
          {locked && <p className="mb-4 text-sm text-forest-900/60">Registrácia je uzavretá, nastavenia už nemožno upraviť.</p>}
          <GroupForm action={updateGroupSettings} locked={locked} submitLabel="Uložiť nastavenia" initial={{ id, name: g.name, description: g.description, max_participants: g.max_participants, min_gift_value: Number(g.min_gift_value), gift_deadline: isoToLocalInput(g.gift_deadline), phone_required: g.phone_required }} />
        </div>
      </div>
    );
  }

  if (tab === "zapisnik") {
    const svg = qrUrl ? await QRCode.toString(qrUrl, { type: "svg", margin: 1, color: { dark: "#173d2a", light: "#0000" } }) : "";
    body = (
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card text-center">
          <h2 className="font-display text-lg font-semibold text-forest-800">Registračný QR kód</h2>
          {svg && <div className="mx-auto my-4 w-56" dangerouslySetInnerHTML={{ __html: svg }} />}
          <p className="break-all text-xs text-forest-900/50">{qrUrl}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {qrUrl && <CopyButton text={qrUrl} label="Kopírovať odkaz" />}
            <ActionButton run={rotateQr.bind(null, id)} confirm="Vygenerovať nový QR kód? Starý prestane fungovať.">Nový QR kód</ActionButton>
          </div>
        </div>
        <div className="card">
          <h2 className="font-display text-lg font-semibold text-forest-800">Účastnícky zápisník</h2>
          <p className="mt-2 text-sm text-forest-900/60">Tlačiteľný formát A4 s {g.max_participants} riadkami a QR kódom na registráciu.</p>
          <Link href={`/organizator/skupiny/${id}/zapisnik`} target="_blank" className="btn-primary mt-5"><Printer size={16} /> Vytlačiť účastnícky zápisník</Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {header}
      {tabs}
      {body}
    </>
  );
}
