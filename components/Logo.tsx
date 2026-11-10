import Link from "next/link";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-3" aria-label="SECRET SANTA – domov">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest-700 font-display text-sm font-bold tracking-wider text-gold-300 shadow-soft transition group-hover:bg-forest-800">SS</span>
      <span className={`font-display text-[15px] font-semibold tracking-[0.22em] ${light ? "text-white" : "text-forest-800"}`}>SECRET SANTA</span>
    </Link>
  );
}
