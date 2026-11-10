import Link from "next/link";
import { BookUser, CalendarClock, Gift, LayoutDashboard, LifeBuoy, Mail, Printer, Settings, Shuffle, Users, FileText } from "lucide-react";
import { requireRole } from "@/lib/auth";

const links = [
  { href: "/organizator", label: "Dashboard", icon: LayoutDashboard },
  { href: "/organizator/skupiny", label: "Moje skupiny", icon: Users },
  { href: "/organizator/skupiny?sekcia=ucastnici", label: "Účastníci", icon: BookUser },
  { href: "/organizator/skupiny?sekcia=losovanie", label: "Losovanie", icon: Shuffle },
  { href: "/organizator/skupiny?sekcia=emaily", label: "E-maily a pozvánky", icon: Mail },
  { href: "/organizator/skupiny?sekcia=darceky", label: "Odovzdávanie darčekov", icon: Gift },
  { href: "/organizator/skupiny?sekcia=info", label: "Podrobné informácie", icon: FileText },
  { href: "/organizator/skupiny?sekcia=zapisnik", label: "Účastnícky zápisník", icon: Printer },
  { href: "/podpora", label: "Podpora", icon: LifeBuoy },
  { href: "/profil", label: "Nastavenia účtu", icon: Settings },
];

export default async function OrganizerLayout({ children }: { children: React.ReactNode }) {
  await requireRole("organizer", "owner");
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 lg:flex-row">
      <aside className="lg:w-60 lg:shrink-0">
        <nav className="card !p-2 flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
          {links.map(({ href, label, icon: I }) => (
            <Link key={href} href={href} className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium text-forest-800 transition hover:bg-forest-50">
              <I size={16} className="text-forest-500" /> {label}
            </Link>
          ))}
        </nav>
        <p className="mt-3 hidden items-center gap-2 px-2 text-xs text-forest-900/40 lg:flex"><CalendarClock size={12} /> Organizátorský panel</p>
      </aside>
      <div className="min-w-0 flex-1 fade-up">{children}</div>
    </div>
  );
}
