// Banc C2 (PROTOCOLE_C2.md) : E1 identité avec runWorld, E2 placebo extérieurs, E3 recevabilité.
// Usage : node research/v6/c2-bench.js --e1 1-60 --e2 9001-9200 [--out fichier.json]
import { writeFileSync } from 'node:fs';
import { makeRng } from '../../src/rng.js';
import { runWorld, makeWorld2 } from './p2.js';
import { recevable, analyser, jugerFormule } from './juge.js';

const FORMS = { carre: (u) => 0.3 * u[0] * u[0], saturation: (u) => (0.4 * u[0]) / (1 + 2 * Math.abs(u[0])), interaction: (u) => 0.3 * u[0] * u[1] };
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const out = { e1: [], e2: null, e3: [] };

// ---------- E1 : identité ----------
const [a1, b1] = arg('--e1', '1-10').split('-').map(Number);
for (let seed = a1; seed <= b1; seed++) {
  const ref = runWorld(seed, { oracleC: true });
  const w = makeWorld2(seed);
  const an = analyser({ Y: w.Y, U: w.U });
  let ok = true; const ecarts = [];
  for (const t of ref.targets) {
    const m = an.mesures[t.target];
    if (m.diag !== t.diag || m.fam !== t.fam || Math.abs(m.logE - t.logE) > 1e-6) { ok = false; ecarts.push({ k: t.target, ref: [t.diag, t.fam, t.logE], mod: [m.diag, m.fam, m.logE] }); }
    if (t.oracleC) {
      const j = jugerFormule(an, t.target, { f: FORMS[ref.truth.form], text: 'oracle' });
      if (j.accepted !== t.oracleC.accepted || (t.oracleC.logE != null && Math.abs(j.logE - t.oracleC.logE) > 1e-6)) { ok = false; ecarts.push({ k: t.target, oracle: [t.oracleC.accepted, t.oracleC.logE, j.accepted, j.logE] }); }
    }
  }
  out.e1.push({ seed, ok, ecarts });
  process.stderr.write(`\rE1 ${seed}`);
}

// ---------- E2 : mondes placebo extérieurs (comptages, aucune structure cachée) ----------
function mondePlacebo(seed) {
  const r = makeRng(seed * 7817 + 5), T = 365, K = 1 + (seed % 3), L = 1 + (seed % 3);
  const poisson = (lam) => { if (lam > 40) return Math.max(0, Math.round(lam + Math.sqrt(lam) * r.normal())); const e = Math.exp(-lam); let k = 0, p = 1; do { k++; p *= r.next(); } while (p > e); return k - 1; };
  const lam = Array.from({ length: K }, () => Math.exp(r.uniform(Math.log(3), Math.log(60))));
  const dow = Array.from({ length: K }, () => Array.from({ length: 7 }, () => Math.exp(r.normal() * 0.2)));
  const U = []; let left = 0, cur = [];
  for (let t = 0; t < T; t++) { if (left <= 0) { cur = Array.from({ length: L }, () => r.uniform(-1, 1)); left = r.int(5, 40); } U.push([...cur]); left--; }
  const Y = Array.from({ length: T }, (_, t) => Array.from({ length: K }, (_, k) => Math.log(1 + poisson(lam[k] * dow[k][t % 7]))));
  return { Y, U };
}
const [a2, b2] = arg('--e2', '9001-9020').split('-').map(Number);
let mesures = 0, fausses = 0, mondesTouches = 0, n2 = 0;
for (let seed = a2; seed <= b2; seed++) {
  const w = mondePlacebo(seed);
  if (!recevable(w).ok) continue;
  n2++;
  const an = analyser(w, { standardiserLeviers: true });
  const f = an.mesures.filter((m) => m.missing).length;
  mesures += an.mesures.length; fausses += f; if (f) mondesTouches++;
  process.stderr.write(`\rE2 ${seed}`);
}
const p = fausses / mesures, z = 1.96, nM = mesures;
const wilson = (p + (z * z) / (2 * nM) + z * Math.sqrt((p * (1 - p)) / nM + (z * z) / (4 * nM * nM))) / (1 + (z * z) / nM);
out.e2 = { mondes: n2, mesures, fausses_alarmes: fausses, part: +(100 * p).toFixed(1), borne_wilson: +(100 * wilson).toFixed(1), mondes_touches: mondesTouches };

// ---------- E3 : recevabilité ----------
const base = mondePlacebo(9001);
const rare = { Y: base.Y.map((y, t) => y.map((v, k) => (k === 0 ? (t % 30 === 0 ? v + 3 : 0) : v))), U: base.U };
const cas = [
  ['trop courte', { Y: base.Y.slice(0, 60), U: base.U.slice(0, 60) }],
  ['mesure constante', { Y: base.Y.map((y) => [0, ...y.slice(1)]), U: base.U }],
  ['série rare (12 jours actifs)', rare],
  ['sans levier', { Y: base.Y, U: base.Y.map(() => []) }],
];
for (const [nom, w] of cas) { const r = recevable(w); out.e3.push({ cas: nom, refusee: !r.ok, motif: r.raisons[0] ?? null }); }
out.e3.push({ cas: 'série saine (témoin)', refusee: !recevable(base).ok, motif: null });

const e1ok = out.e1.filter((x) => x.ok).length;
console.log(`\nE1 identité : ${e1ok}/${out.e1.length}`);
console.log(`E2 placebo : ${out.e2.fausses_alarmes}/${out.e2.mesures} mesures (${out.e2.part} %, borne ${out.e2.borne_wilson} %), ${out.e2.mondes_touches}/${out.e2.mondes} mondes touchés`);
for (const x of out.e3) console.log(`E3 ${x.refusee ? 'refusée ' : 'ACCEPTÉE'} ${x.cas}${x.motif ? ' — ' + x.motif : ''}`);
if (arg('--out')) writeFileSync(arg('--out'), JSON.stringify(out));
