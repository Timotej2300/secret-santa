import { buildCycle, validateAssignments } from "../lib/draw";

let failed = 0;
for (const n of [4, 6, 8, 10, 20, 30]) {
  const ids = Array.from({ length: n }, (_, i) => `p${i}`);
  for (let run = 0; run < 2000; run++) {
    const pairs = buildCycle(ids);
    const err = validateAssignments(ids, pairs);
    if (err) {
      console.error(`FAIL n=${n}: ${err}`);
      failed++;
      break;
    }
    const seen = new Set<string>();
    let cur = ids[0];
    const next = new Map(pairs.map((p) => [p.giver, p.receiver]));
    while (!seen.has(cur)) { seen.add(cur); cur = next.get(cur)!; }
    if (seen.size !== n) { console.error(`FAIL n=${n}: nie je jeden cyklus`); failed++; break; }
  }
  console.log(`OK n=${n} (2000 losovaní)`);
}
process.exit(failed ? 1 : 0);
