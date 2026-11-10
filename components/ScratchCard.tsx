"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { revealRecipient } from "@/app/actions/participant";
import { useToast } from "@/components/Toast";

/** Meno sa načíta zo servera až po odstieraní – dovtedy nie je nikde v HTML. */
export function ScratchCard({ participantId }: { participantId: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [name, setName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const drawing = useRef(false);
  const moves = useRef(0);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * dpr;
    c.height = height * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const g = ctx.createLinearGradient(0, 0, width, height);
    g.addColorStop(0, "#d8b865");
    g.addColorStop(0.5, "#efdca0");
    g.addColorStop(1, "#c9a24a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15,42,29,0.55)";
    ctx.font = "600 16px Georgia, serif";
    ctx.textAlign = "center";
    ctx.fillText("Odkry svojho Secret Santa príjemcu", width / 2, height / 2 - 4);
    ctx.font = "13px sans-serif";
    ctx.fillText("stieraj prstom alebo myšou", width / 2, height / 2 + 20);
  }, []);

  const reveal = useCallback(async () => {
    setBusy(true);
    const r = await revealRecipient(participantId);
    setBusy(false);
    if (!r.ok) return toast("err", r.error);
    setName((r.data as { name: string }).name);
    router.refresh();
  }, [participantId, router, toast]);

  const scratch = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || busy || name) return;
    const c = canvas.current!;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    ctx.globalCompositeOperation = "destination-out";
    ctx.beginPath();
    ctx.arc(e.clientX - rect.left, e.clientY - rect.top, 22, 0, Math.PI * 2);
    ctx.fill();
    if (++moves.current % 12 === 0) {
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      let clear = 0;
      let total = 0;
      for (let i = 3; i < d.length; i += 4 * 37) {
        total++;
        if (d[i] === 0) clear++;
      }
      if (clear / total > 0.45) void reveal();
    }
  };

  return (
    <div className="relative mx-auto h-44 w-full max-w-md select-none overflow-hidden rounded-3xl border-2 border-gold-400 bg-paper shadow-lift">
      <div className="absolute inset-0 grid place-items-center px-4 text-center">
        {name ? (
          <div>
            <Gift className="mx-auto mb-2 text-gold-500" />
            <p className="font-display text-3xl font-semibold text-forest-800">{name}</p>
          </div>
        ) : (
          <p className="text-sm text-forest-900/40">{busy ? "Načítavam…" : ""}</p>
        )}
      </div>
      {!name && (
        <canvas
          ref={canvas}
          className="absolute inset-0 h-full w-full cursor-crosshair touch-none"
          onPointerDown={(e) => {
            drawing.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            scratch(e);
          }}
          onPointerMove={scratch}
          onPointerUp={() => (drawing.current = false)}
          onPointerCancel={() => (drawing.current = false)}
        />
      )}
    </div>
  );
}
