import type { ReactNode } from "react";
import { Gift } from "lucide-react";

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-semibold text-forest-800 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-forest-900/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="grid place-items-center rounded-3xl border border-dashed border-forest-900/15 bg-paper/60 px-6 py-14 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-forest-50 text-forest-600">{icon ?? <Gift size={26} />}</div>
      <h3 className="font-display text-lg font-semibold text-forest-800">{title}</h3>
      {children && <div className="mt-2 max-w-md text-sm text-forest-900/60">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="card !p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-forest-700/70">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold text-forest-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-forest-900/50">{hint}</p>}
    </div>
  );
}

const tones: Record<string, string> = {
  green: "bg-forest-100 text-forest-800",
  gold: "bg-gold-300/40 text-gold-600",
  gray: "bg-mist text-forest-900/70",
  red: "bg-red-100 text-red-800",
};
export function Badge({ tone = "gray", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={`badge ${tones[tone]}`}>{children}</span>;
}

export function Shell({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <div className={`fade-up mx-auto w-full px-4 py-10 ${narrow ? "max-w-xl" : "max-w-6xl"}`}>{children}</div>;
}

export function Skeleton({ className = "h-24" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}
