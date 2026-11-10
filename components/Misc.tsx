"use client";
import { useState } from "react";
import { Check, Copy, Printer } from "lucide-react";

export function PrintButton({ label = "Vytlačiť" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className="btn-primary no-print">
      <Printer size={16} /> {label}
    </button>
  );
}

export function CopyButton({ text, label = "Kopírovať" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn-ghost"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt("Skopíruj odkaz:", text);
        }
      }}
    >
      {done ? <Check size={16} /> : <Copy size={16} />} {done ? "Skopírované" : label}
    </button>
  );
}
