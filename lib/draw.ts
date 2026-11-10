import { randomInt } from "node:crypto";

export function secureShuffle<T>(input: readonly T[]): T[] {
  const a = [...input];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Jeden uzavretý cyklus: order[i] -> order[i+1], posledný -> prvý. */
export function buildCycle(ids: readonly string[]): { giver: string; receiver: string }[] {
  const order = secureShuffle(ids);
  return order.map((giver, i) => ({ giver, receiver: order[(i + 1) % order.length] }));
}

export function validateAssignments(ids: readonly string[], pairs: { giver: string; receiver: string }[]): string | null {
  if (pairs.length !== ids.length) return "zlý počet priradení";
  const givers = new Set<string>();
  const receivers = new Set<string>();
  const map = new Map<string, string>();
  for (const p of pairs) {
    if (p.giver === p.receiver) return "samopridelenie";
    givers.add(p.giver);
    receivers.add(p.receiver);
    map.set(p.giver, p.receiver);
  }
  if (givers.size !== ids.length || receivers.size !== ids.length) return "duplicitný darca alebo príjemca";
  for (const [g, r] of map) if (map.get(r) === g) return "vzájomná dvojica";
  return null;
}
