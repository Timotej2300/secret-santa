import Link from "next/link";
import { Gift, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import { getSession, homeFor } from "@/lib/auth";

export default async function Home() {
  const s = await getSession();
  const steps = [
    { icon: QrCode, t: "Pridaj ľudí", d: "Pozvánkou alebo QR kódom." },
    { icon: Sparkles, t: "Losovanie", d: "Jeden uzavretý cyklus, nikto nevytiahne seba." },
    { icon: Gift, t: "Odkry a obdaruj", d: "Stierací lístok a wishlist príjemcu." },
    { icon: ShieldCheck, t: "Súkromie", d: "Priradenia vidí iba darca." },
  ];
  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="fade-up py-16 text-center sm:py-24">
        <span className="badge bg-gold-300/40 text-gold-600">Clean Christmas</span>
        <h1 className="mx-auto mt-6 max-w-3xl font-display text-5xl font-semibold leading-tight text-forest-800 sm:text-6xl">Vianočné losovanie bez starostí.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-forest-900/60">Zorganizuj Secret Santa pre rodinu, kolegov či priateľov – bezpečne, prehľadne a s kúskom kúzla.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {s ? (
            <Link href={homeFor(s)} className="btn-primary">Otvoriť môj panel</Link>
          ) : (
            <Link href="/prihlasenie" className="btn-primary">Prihlásiť sa</Link>
          )}
        </div>
      </section>
      <section className="grid gap-4 pb-8 sm:grid-cols-2 lg:grid-cols-4">
        {steps.map(({ icon: I, t, d }, i) => (
          <div key={t} className="card fade-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="mb-4 grid h-11 w-11 place-items-center rounded-2xl bg-forest-50 text-forest-600"><I size={20} /></div>
            <h3 className="font-display text-lg font-semibold text-forest-800">{t}</h3>
            <p className="mt-1 text-sm text-forest-900/60">{d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
