"use client";
import { ActionForm, Field } from "@/components/Form";
import type { ActionResult } from "@/lib/utils";

type Initial = { id?: string; name?: string; description?: string; max_participants?: number; min_gift_value?: number; gift_deadline?: string; rules?: string; phone_required?: boolean };

export function GroupForm({ action, initial = {}, withRules, submitLabel, locked }: { action: (fd: FormData) => Promise<ActionResult<unknown>>; initial?: Initial; withRules?: boolean; submitLabel: string; locked?: boolean }) {
  return (
    <ActionForm action={action} className="space-y-4">
      {initial.id && <input type="hidden" name="groupId" value={initial.id} />}
      <Field label="Názov skupiny"><input className="input" name="name" defaultValue={initial.name} required minLength={2} maxLength={120} /></Field>
      <Field label="Popis"><textarea className="input min-h-20" name="description" defaultValue={initial.description} maxLength={1000} /></Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Max. účastníkov (4–30)"><input className="input" type="number" name="max_participants" min={4} max={30} defaultValue={initial.max_participants ?? 20} required /></Field>
        <Field label="Min. hodnota darčeka (€)"><input className="input" type="number" name="min_gift_value" min={0} step="0.5" defaultValue={initial.min_gift_value ?? 15} required /></Field>
        <Field label="Termín odovzdania"><input className="input" type="datetime-local" name="gift_deadline" defaultValue={initial.gift_deadline} /></Field>
      </div>
      {withRules && <Field label="Podrobné informácie a pravidlá"><textarea className="input min-h-36" name="rules" defaultValue={initial.rules} maxLength={8000} placeholder="Kde a kedy sa odovzdávajú darčeky, či musia byť zabalené, špeciálne pravidlá…" /></Field>}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="phone_required" defaultChecked={initial.phone_required} className="h-4 w-4 accent-forest-700" /> Telefón je pri registrácii povinný</label>
      <button className="btn-primary" disabled={locked}>{submitLabel}</button>
    </ActionForm>
  );
}
