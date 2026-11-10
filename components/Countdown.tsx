"use client";
import { useEffect, useState } from "react";

export function Countdown({ deadline }: { deadline: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  if (now === null) return <div className="skeleton h-20" />;
  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) return <p className="rounded-2xl bg-red-50 p-4 text-center font-semibold text-red-800">Termín odovzdania uplynul</p>;
  const s = Math.floor(diff / 1000);
  const cells = [
    ["Dni", Math.floor(s / 86400)],
    ["Hodiny", Math.floor((s % 86400) / 3600)],
    ["Minúty", Math.floor((s % 3600) / 60)],
    ["Sekundy", s % 60],
  ] as const;
  return (
    <div className="grid grid-cols-4 gap-2 text-center" aria-live="off">
      {cells.map(([l, v]) => (
        <div key={l} className="rounded-2xl bg-forest-700 px-1 py-3 text-white">
          <div className="font-display text-2xl font-semibold tabular-nums sm:text-3xl">{String(v).padStart(2, "0")}</div>
          <div className="text-[10px] uppercase tracking-wider text-gold-300">{l}</div>
        </div>
      ))}
    </div>
  );
}
