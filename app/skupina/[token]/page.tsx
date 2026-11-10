import { admin } from "@/lib/supabase/admin";
import { ActionForm, Field } from "@/components/Form";
import { Shell, Empty } from "@/components/ui";
import { qrRegister } from "@/app/actions/register";
import { fmtDateTime, fmtEur } from "@/lib/utils";
import { LockKeyhole } from "lucide-react";

export const metadata = { title: "Registrácia do skupiny", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function QrPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { data: qr } = await admin().from("group_qr_tokens").select("group_id,is_active").eq("token", token).maybeSingle();
  const q = qr as { group_id: string; is_active: boolean } | null;
  if (!q || !q.is_active) return <Shell narrow><Empty title="Odkaz nie je platný">Požiadaj organizátora o aktuálny QR kód.</Empty></Shell>;
  const { data } = await admin().from("groups").select("name,description,min_gift_value,gift_deadline,status,phone_required,group_settings(registration_enabled)").eq("id", q.group_id).single();
  const g = data as unknown as { name: string; description: string; min_gift_value: number; gift_deadline: string | null; status: string; phone_required: boolean; group_settings: { registration_enabled: boolean } | { registration_enabled: boolean }[] | null };
  const enabled = Array.isArray(g.group_settings) ? g.group_settings[0]?.registration_enabled : g.group_settings?.registration_enabled;
  if (g.status !== "registration_open" || enabled === false) return <Shell narrow><Empty title="Registrácia je uzavretá" icon={<LockKeyhole size={26} />}>Do skupiny {g.name} sa už nedá registrovať.</Empty></Shell>;
  return (
    <Shell narrow>
      <div className="card">
        <span className="badge bg-gold-300/40 text-gold-600">Secret Santa</span>
        <h1 className="mt-3 font-display text-3xl font-semibold text-forest-800">{g.name}</h1>
        {g.description && <p className="mt-1 text-sm text-forest-900/60">{g.description}</p>}
        <p className="mt-3 text-sm text-forest-900/70">Minimálna hodnota darčeka: <b>{fmtEur(g.min_gift_value)}</b> · Termín: <b>{fmtDateTime(g.gift_deadline)}</b></p>
        <ActionForm action={qrRegister} resetOnSuccess className="mt-6 space-y-4">
          <input type="hidden" name="qr" value={token} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meno"><input className="input" name="first_name" autoComplete="given-name" required maxLength={60} /></Field>
            <Field label="Priezvisko"><input className="input" name="last_name" autoComplete="family-name" required maxLength={60} /></Field>
          </div>
          <Field label="E-mail"><input className="input" type="email" name="email" autoComplete="email" required /></Field>
          <Field label={g.phone_required ? "Telefón" : "Telefón (nepovinný)"}><input className="input" type="tel" name="phone" autoComplete="tel" required={g.phone_required} /></Field>
          <button className="btn-primary w-full">Registrovať sa</button>
          <p className="text-xs text-forest-900/50">Po odoslaní ti príde e-mail s odkazom na vytvorenie hesla a dokončenie registrácie.</p>
        </ActionForm>
      </div>
    </Shell>
  );
}
