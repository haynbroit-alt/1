// Usage : node research/v6/run.js --seeds 1-40 --out research/v6/dev.json
import { writeFileSync } from 'node:fs';
import { makeWorld } from './worlds.js';
import { discover, score } from './engine.js';
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const [a, b] = arg('--seeds', '1-12').split('-').map(Number);
const methods = arg('--methods', 'p1,grille,bayes,ui').split(',');
const out = [];
for (let s = a; s <= (b ?? a); s++) {
  const w = makeWorld(s);
  for (const method of methods) {
    const t0 = Date.now(); const res = discover(w, { method });
    out.push({ seed: s, kind: w.kind, method, secs: (Date.now() - t0) / 1000, ...score(w, res), accepted: res.accepted.map(({ target, tau, w: ww, acceptedAt }) => ({ target, tau, w: ww, acceptedAt })), truth: w.truth });
  }
  process.stderr.write(`\r${s}`);
}
writeFileSync(arg('--out', 'research/v6/dev.json'), JSON.stringify(out));
console.error('\nok', out.length);
