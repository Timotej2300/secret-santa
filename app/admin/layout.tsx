import Link from "next/link";
import { Activity, FileClock, LayoutDashboard, LifeBuoy, Mail, Settings, Shuffle, ShieldCheck, UserCog, Users, UsersRound } from "lucide-react";
import { hasRole, requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await requireRole("owner", "system_admin", "support");
  const owner = hasRole(s, "owner");
  const sys = hasRole(s, "owner", "system_admin");
  const links = [
    { href: "/admin", label: "Prehľad platformy", icon: LayoutDashboard, show: true },
    { href: "/admin/skupiny", label: "Všetky skupiny", icon: UsersRound, show: sys },
    { href: "/admin/uzivatelia", label: "Všetci používatelia", icon: Users, show: sys },
    { href: "/admin/organizatori", label: "Organizátori", icon: UserCog, show: owner },
    { href: "/admin/uzivatelia?f=vedenie", label: "Vedenie systému", icon: ShieldCheck, show: sys },
    { href: "/admin/losovania", label: "Losovania a priradenia", icon: Shuffle, show: owner },
    { href: "/admin/emaily", label: "E-mailové logy", icon: Mail, show: sys },
    { href: "/admin/podpora", label: "Podpora", icon: LifeBuoy, show: true },
    { href: "/admin/audit", label: "Audit logy", icon: FileClock, show: sys },
    { href: "/admin/nastavenia", label: "Nastavenia platformy", icon: Settings, show: owner },
  ].filter((l) => l.show);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="lg:w-64 lg:shrink-0">
        <nav className="card !p-2 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-forest-800 transition hover:bg-forest-50">
              <I size={16} className="text-forest-500" /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-3 hidden items-center gap-2 px-2 text-xs text-forest-900/40 lg:flex"><Activity size={12} /> {owner ? "Owner" : sys ? "System admin" : "Support"}</p>
      </aside>
      <div className="min-w-0 flex-1 fade-up">{children}</div>
    </div>
  );
}
