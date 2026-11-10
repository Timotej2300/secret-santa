import { redirect } from "next/navigation";
import { getSession, homeFor } from "@/lib/auth";
import { ActionForm, Field } from "@/components/Form";
import { Shell } from "@/components/ui";
import { login } from "@/app/actions/auth";

export const metadata = { title: "Prihlásenie" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const s = await getSession();
  if (s) redirect(homeFor(s));
  const { next } = await searchParams;
  return (
    <Shell narrow>
      <div className="card">
        <h1 className="font-display text-3xl font-semibold text-forest-800">Prihlásenie</h1>
        <p className="mt-1 text-sm text-forest-900/60">Vitaj späť v SECRET SANTA.</p>
        <ActionForm action={login} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next ?? ""} />
          <Field label="E-mail"><input className="input" type="email" name="email" autoComplete="email" required /></Field>
          <Field label="Heslo"><input className="input" type="password" name="password" autoComplete="current-password" required /></Field>
          <button className="btn-primary w-full">Prihlásiť sa</button>
        </ActionForm>
        <p className="mt-5 text-xs text-forest-900/50">Účet vznikne po dokončení registrácie cez pozvánku alebo QR kód skupiny.</p>
      </div>
    </Shell>
  );
}
