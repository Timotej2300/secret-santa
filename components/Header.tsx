import Link from "next/link";
import { Menu, UserRound } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getSession, hasRole, homeFor } from "@/lib/auth";
import { logout } from "@/app/actions/auth";

export async function Header() {
  const s = await getSession();
  const adminLinks: { href: string; label: string }[] = [];
  if (s) {
    if (hasRole(s, "owner", "system_admin", "support")) adminLinks.push({ href: "/admin", label: hasRole(s, "owner") ? "Owner panel" : "Administrácia" });
    if (hasRole(s, "organizer", "owner")) adminLinks.push({ href: "/organizator", label: "Organizátor" });
  }
  const link = "rounded-xl px-3 py-2 text-sm font-medium text-forest-800 transition hover:bg-forest-50";
  const items = (
    <>
      <Link href="/" className={link}>Domov</Link>
      {!s && <Link href="/prihlasenie" className={link}>Prihlásenie</Link>}
      {s && <Link href="/dashboard" className={link}>Môj panel</Link>}
      {adminLinks.map((l) => (
        <Link key={l.href} href={l.href} className={link}>{l.label}</Link>
      ))}
      {s && (
        <>
          <Link href="/profil" className={`${link} inline-flex items-center gap-1.5`}><UserRound size={16} />{s.user.first_name || "Profil"}</Link>
          <form action={logout}><button className={`${link} text-forest-900/60`}>Odhlásiť</button></form>
        </>
      )}
    </>
  );
  return (
    <header className="sticky top-0 z-40 border-b border-forest-900/5 bg-cream/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">{items}</nav>
        <details className="relative md:hidden">
          <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-xl border border-forest-900/10 bg-white" aria-label="Menu"><Menu size={18} /></summary>
          <nav className="absolute right-0 top-12 flex w-56 flex-col rounded-2xl border border-forest-900/5 bg-paper p-2 shadow-lift">{items}</nav>
        </details>
      </div>
      {s && <span className="sr-only">{homeFor(s)}</span>}
    </header>
  );
}
