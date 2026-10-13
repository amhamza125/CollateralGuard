import { createClient } from 'genlayer-js';
import { studionet } from 'genlayer-js/chains';
import { readFileSync, writeFileSync } from 'fs';
// Polls every transaction recorded by run.mjs (../results/cg-results.json) to
// GenVM finalization and writes ../results/cg-finalize.json.
const R = JSON.parse(readFileSync('../results/cg-results.json'));
const ro = createClient({ chain: studionet });
const out = [];
const deadline = Date.now() + 25 * 60 * 1000;
let pending = R.txs.filter(t => t.hash).map(t => ({ ...t, status: null }));
while (pending.some(t => t.status !== 7 && t.status !== 'FINALIZED') && Date.now() < deadline) {
  for (const t of pending) {
    if (t.status === 7 || t.status === 'FINALIZED') continue;
    try { const tx = await ro.getTransaction({ hash: t.hash }); t.status = tx.status; } catch {}
  }
  const done = pending.filter(t => t.status === 7 || t.status === 'FINALIZED').length;
  console.log(`finalized ${done}/${pending.length}`);
  if (done < pending.length) await new Promise(r => setTimeout(r, 20000));
}
for (const t of pending) out.push({ fn: t.fn, exec: t.exec, status: t.status, hash: t.hash });
writeFileSync('../results/cg-finalize.json', JSON.stringify(out, null, 2));
const ok = out.filter(t => t.status === 7 || t.status === 'FINALIZED').length;
const succFinal = out.filter(t => t.exec === 'SUCCESS' && (t.status === 7 || t.status === 'FINALIZED')).length;
console.log(`FINALIZE DONE: ${ok}/${out.length} finalized; successful writes finalized: ${succFinal}/${out.filter(t=>t.exec==='SUCCESS').length}`);
