import { admin } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";
import { ActionForm, Field } from "@/components/Form";
import { Shell, Empty } from "@/components/ui";
import { completeInvite } from "@/app/actions/register";
import { fmtDateTime, fmtEur } from "@/lib/utils";
import { TriangleAlert } from "lucide-react";

export const metadata = { title: "Dokončenie registrácie", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ param: string }> }) {
  const { param } = await params;
  const decoded = decodeURIComponent(param);
  const token = decoded.startsWith("id=") ? decoded.slice(3) : "";
  const invalid = (
    <Shell narrow>
      <Empty title="Pozvánka je neplatná" icon={<TriangleAlert size={26} />}>
        Odkaz je neplatný, už bol použitý alebo expiroval. Požiadaj organizátora o novú pozvánku.
      </Empty>
    </Shell>
  );
  if (token.length < 20) return invalid;

  const db = admin();
  const { data } = await db.from("invitations").select("id,kind,email,participant_id,organizer_user_id,expires_at,used_at,revoked_at").eq("token_hash", hashToken(token)).maybeSingle();
  const inv = data as { id: string; kind: string; email: string; participant_id: string | null; organizer_user_id: string | null; expires_at: string; used_at: string | null; revoked_at: string | null } | null;
  if (!inv || inv.used_at || inv.revoked_at || new Date(inv.expires_at).getTime() < Date.now()) {
    if (inv && !inv.used_at && new Date(inv.expires_at).getTime() < Date.now()) await db.from("invitations").update({ email_status: "expired" }).eq("id", inv.id);
    return invalid;
  }

  let title = "Vitaj v SECRET SANTA";
  let info: { label: string; value: string }[] = [];
  let hasAccount = false;
  if (inv.kind === "participant") {
    const { data: p } = await db.from("participants").select("first_name,last_name,groups(name,min_gift_value,gift_deadline)").eq("id", inv.participant_id!).maybeSingle();
    const pt = p as unknown as { first_name: string; last_name: string; groups: { name: string; min_gift_value: number; gift_deadline: string | null } } | null;
    if (!pt) return invalid;
    title = `Ahoj, ${pt.first_name}!`;
    info = [
      { label: "Skupina", value: pt.groups.name },
      { label: "Minimálna hodnota darčeka", value: fmtEur(pt.groups.min_gift_value) },
      { label: "Termín odovzdania", value: fmtDateTime(pt.groups.gift_deadline) },
    ];
    const { data: ex } = await db.from("profiles").select("id").eq("email", inv.email.toLowerCase()).maybeSingle();
    hasAccount = !!ex;
  } else {
    title = "Aktivácia organizátorského účtu";
  }

  return (
    <Shell narrow>
      <div className="card">
        <h1 className="font-display text-3xl font-semibold text-forest-800">{title}</h1>
        <p className="mt-1 text-sm text-forest-900/60">{inv.email}</p>
        {info.length > 0 && (
          <dl className="mt-5 space-y-2 rounded-2xl bg-cream p-4 text-sm">
            {info.map((i) => (
              <div key={i.label} className="flex justify-between gap-4"><dt className="text-forest-900/60">{i.label}</dt><dd className="text-right font-medium">{i.value}</dd></div>
            ))}
          </dl>
        )}
        <ActionForm action={completeInvite} className="mt-6 space-y-4">
          <input type="hidden" name="token" value={token} />
          {hasAccount ? (
            <>
              <p className="text-sm text-forest-900/70">Tento e-mail už má účet. Zadaj svoje existujúce heslo a pripoj sa do skupiny.</p>
              <Field label="Existujúce heslo"><input className="input" type="password" name="password" autoComplete="current-password" required /></Field>
            </>
          ) : (
            <>
              <Field label="Vytvor si heslo (min. 10 znakov)"><input className="input" type="password" name="password" autoComplete="new-password" minLength={10} required /></Field>
              <Field label="Heslo znova"><input className="input" type="password" name="password2" autoComplete="new-password" minLength={10} required /></Field>
            </>
          )}
          <button className="btn-primary w-full">Dokončiť registráciu</button>
        </ActionForm>
      </div>
    </Shell>
  );
}
