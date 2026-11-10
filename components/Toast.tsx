"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";

type T = { id: number; kind: "ok" | "err"; text: string };
const Ctx = createContext<(kind: "ok" | "err", text: string) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: "ok" | "err", text: string) => {
    const id = Date.now() + Math.random();
    setItems((x) => [...x, { id, kind, text }]);
    setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 4500);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="fade-up flex items-start gap-3 rounded-2xl border border-forest-900/5 bg-paper p-4 text-sm shadow-lift">
            {t.kind === "ok" ? <CheckCircle2 className="mt-0.5 shrink-0 text-forest-500" size={18} /> : <XCircle className="mt-0.5 shrink-0 text-red-600" size={18} />}
            <span>{t.text}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
