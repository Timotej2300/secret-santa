import { requireUser } from "@/lib/auth";
import { ActionForm, Field } from "@/components/Form";
import { PageTitle, Shell, Badge } from "@/components/ui";
import { changePassword, updateProfile } from "@/app/actions/profile";

export const metadata = { title: "Profil" };

export default async function ProfilePage() {
  const s = await requireUser("/profil");
  return (
    <Shell narrow>
      <PageTitle title="Profil" subtitle={s.user.email} action={<div className="flex gap-1">{s.roles.map((r) => <Badge key={r} tone="green">{r}</Badge>)}</div>} />
      <div className="space-y-6">
        <ActionForm action={updateProfile} className="card space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Meno"><input className="input" name="first_name" defaultValue={s.user.first_name} required /></Field>
            <Field label="Priezvisko"><input className="input" name="last_name" defaultValue={s.user.last_name} required /></Field>
          </div>
          <Field label="Telefón"><input className="input" type="tel" name="phone" defaultValue={s.user.phone ?? ""} /></Field>
          <button className="btn-primary">Uložiť</button>
        </ActionForm>
        <ActionForm action={changePassword} resetOnSuccess className="card space-y-3">
          <h2 className="font-display text-lg font-semibold text-forest-800">Zmena hesla</h2>
          <Field label="Nové heslo (min. 10 znakov)"><input className="input" type="password" name="password" minLength={10} autoComplete="new-password" required /></Field>
          <Field label="Heslo znova"><input className="input" type="password" name="password2" minLength={10} autoComplete="new-password" required /></Field>
          <button className="btn-primary">Zmeniť heslo</button>
        </ActionForm>
      </div>
    </Shell>
  );
}
