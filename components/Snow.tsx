"use client";
import { useEffect, useState } from "react";

export function Snow() {
  const [flakes, setFlakes] = useState<{ left: number; size: number; dur: number; delay: number; drift: number; o: number }[]>([]);
  useEffect(() => {
    const count = window.innerWidth < 640 ? 18 : 36;
    setFlakes(
      Array.from({ length: count }, () => ({
        left: Math.random() * 100,
        size: 2 + Math.random() * 4,
        dur: 12 + Math.random() * 14,
        delay: -Math.random() * 20,
        drift: (Math.random() - 0.5) * 120,
        o: 0.35 + Math.random() * 0.5,
      })),
    );
  }, []);
  return (
    <div className="snow-layer pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      {flakes.map((f, i) => (
        <span key={i} className="snowflake" style={{ left: `${f.left}%`, width: f.size, height: f.size, opacity: f.o, animationDuration: `${f.dur}s`, animationDelay: `${f.delay}s`, ["--drift" as string]: `${f.drift}px` }} />
      ))}
    </div>
  );
}
