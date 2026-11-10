"use client";
import { useState } from "react";
import { ActionForm, Field } from "@/components/Form";
import { saveDelivery } from "@/app/actions/participant";

type D = { method: "in_person" | "address" | "via_person"; note?: string | null; meeting_place?: string | null; address_line?: string | null; city?: string | null; postal_code?: string | null; country?: string | null; via_person_name?: string | null };

export function DeliveryForm({ participantId, initial, minValue, locked }: { participantId: string; initial?: D | null; minValue: string; locked: boolean }) {
  const [method, setMethod] = useState<D["method"]>(initial?.method ?? "in_person");
  const opts: [D["method"], string][] = [["in_person", "Osobné odovzdanie"], ["address", "Doručenie na adresu"], ["via_person", "Cez inú osobu"]];
  return (
    <ActionForm action={saveDelivery} className="mt-6 space-y-5">
      <input type="hidden" name="participantId" value={participantId} />
      <div className="grid gap-2">
        {opts.map(([v, l]) => (
          <label key={v} className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3.5 text-sm font-medium transition ${method === v ? "border-forest-600 bg-forest-50" : "border-forest-900/10 bg-white"}`}>
            <input type="radio" name="method" value={v} checked={method === v} onChange={() => setMethod(v)} className="accent-forest-700" /> {l}
          </label>
        ))}
      </div>
      {method === "in_person" && <Field label="Dohodnuté miesto (nepovinné)"><input className="input" name="meeting_place" defaultValue={initial?.meeting_place ?? ""} maxLength={200} /></Field>}
      {method === "address" && (
        <div className="space-y-3">
          <p className="text-xs text-forest-900/60">Adresu uvidí iba tvoj darca, organizátor a Owner.</p>
          <Field label="Ulica a číslo"><input className="input" name="address_line" defaultValue={initial?.address_line ?? ""} required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mesto"><input className="input" name="city" defaultValue={initial?.city ?? ""} required /></Field>
            <Field label="PSČ"><input className="input" name="postal_code" defaultValue={initial?.postal_code ?? ""} required /></Field>
          </div>
          <Field label="Krajina"><input className="input" name="country" defaultValue={initial?.country ?? "Slovensko"} required /></Field>
        </div>
      )}
      {method === "via_person" && <Field label="Meno osoby"><input className="input" name="via_person_name" defaultValue={initial?.via_person_name ?? ""} required /></Field>}
      <Field label="Poznámka (nepovinné)"><textarea className="input min-h-20" name="note" defaultValue={initial?.note ?? ""} maxLength={500} /></Field>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="confirm_value" required className="mt-0.5 h-4 w-4 accent-forest-700" />
        <span>Potvrdzujem, že môj darček bude mať minimálne hodnotu stanovenú organizátorom ({minValue}).</span>
      </label>
      <button className="btn-primary w-full" disabled={locked}>Uložiť a pokračovať</button>
    </ActionForm>
  );
}
