// Usage : node research/v6/report.js research/v6/dev.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const methods = [...new Set(R.map((r) => r.method))];
const LBL = { p1: 'P1 (τ continu + pari invariant)', grille: 'Grille v5 (τ ∈ {3,3 ; 10 ; 33} + même pari)', bayes: 'Facteur de Bayes naïf (meilleur τ, log BF > 3)', ui: 'Variante ui (candidat figé + inférence universelle)' };
const wilson = (x, n, z = 1.96) => { const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [c - h, c + h]; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const L = [`# Prototype P1 — ${new Set(R.map((r) => r.seed)).size} mondes, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`];
L.push('| Méthode | B1 placebo : mondes avec ≥ 1 acceptation | B3 mal spécifié | B2 fausses / monde à modes | A1 modes forts retrouvés | A2 forts lents (τ ≥ 30) | modes faibles retrouvés | A3 médiane |log τ̂/τ| | imprécises / monde | s / monde |');
L.push('|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|');
const out = {};
for (const m of methods) {
  const x = R.filter((r) => r.method === m);
  const pl = x.filter((r) => r.kind === 'placebo'), mi = x.filter((r) => r.kind === 'mal-specifie'), mo = x.filter((r) => r.kind === 'modes');
  const b1 = pl.filter((r) => r.nAccepted > 0).length, w1 = wilson(b1, pl.length);
  const b3 = mi.filter((r) => r.nAccepted > 0).length;
  const strong = mo.flatMap((r) => r.modes).filter((q) => q.realized >= 0.1), weak = mo.flatMap((r) => r.modes).filter((q) => q.realized < 0.1);
  const slow = strong.filter((q) => q.tau >= 30);
  const err = strong.filter((q) => q.found).map((q) => Math.abs(Math.log(q.tauHat / q.tau))).sort((a, b) => a - b);
  out[m] = { b1: b1 / pl.length, b1hi: w1[1], a1: mean(strong.map((q) => +q.found)), a2: mean(slow.map((q) => +q.found)) };
  L.push(`| ${LBL[m] ?? m} | ${b1}/${pl.length} (IC haut ${(100 * w1[1]).toFixed(0)} %) | ${b3}/${mi.length} | ${mean(mo.map((r) => r.falseOnEmpty)).toFixed(2)} | ${(100 * out[m].a1).toFixed(0)} % (${strong.length}) | ${(100 * out[m].a2).toFixed(0)} % (${slow.length}) | ${(100 * mean(weak.map((q) => +q.found))).toFixed(0)} % (${weak.length}) | ${err.length ? err[Math.floor(err.length / 2)].toFixed(2) : '—'} | ${mean(mo.map((r) => r.imprecise)).toFixed(2)} | ${mean(x.map((r) => r.secs)).toFixed(2)} |`);
}
// A2 : P1 contre grille, appariés sur les mêmes modes forts lents
if (out.p1 && out.grille) {
  const key = (r, i) => `${r.seed}:${i}`;
  const g = new Map(R.filter((r) => r.method === 'grille' && r.kind === 'modes').flatMap((r) => r.modes.map((q, i) => [key(r, i), q])));
  const d = R.filter((r) => r.method === 'p1' && r.kind === 'modes').flatMap((r) => r.modes.map((q, i) => [q, g.get(key(r, i))])).filter(([q]) => q.realized >= 0.1 && q.tau >= 30).map(([q, h]) => +q.found - +h.found);
  const m = mean(d), sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1)), ci = 1.96 * sd / Math.sqrt(d.length);
  L.push(`\nA2 apparié (P1 − grille v5, modes forts lents) : ${(100 * m).toFixed(0)} ± ${(100 * ci).toFixed(0)} points (${d.length} modes).`);
  out.a2diff = [m, ci];
}
L.push('\n## Verdicts (critères de PROTOCOLE_P1.md)\n');
if (out.p1) {
  const v = (ok) => (ok ? '✅' : '❌');
  const B2 = mean(R.filter((r) => r.method === 'p1' && r.kind === 'modes').map((r) => r.falseOnEmpty));
  L.push(`- B1 (≤ 10 %, borne haute ≤ 15 %) : ${(100 * out.p1.b1).toFixed(1)} %, borne ${(100 * out.p1.b1hi).toFixed(1)} % ${v(out.p1.b1 <= 0.1 && out.p1.b1hi <= 0.15)}`);
  L.push(`- B2 (≤ 0,10 / monde) : ${B2.toFixed(3)} ${v(B2 <= 0.1)}`);
  L.push(`- A1 (≥ 60 %) : ${(100 * out.p1.a1).toFixed(0)} % ${v(out.p1.a1 >= 0.6)}`);
  L.push(`- A2 (≥ 50 % et > grille) : ${(100 * out.p1.a2).toFixed(0)} %, différence ${out.a2diff ? (100 * out.a2diff[0]).toFixed(0) + ' ± ' + (100 * out.a2diff[1]).toFixed(0) : '—'} ${v(out.p1.a2 >= 0.5 && out.a2diff && out.a2diff[0] - out.a2diff[1] > 0)}`);
  L.push(`- Abandon (B1 échoue ou A1 < 40 %) : ${out.p1.b1 <= 0.1 && out.p1.b1hi <= 0.15 && out.p1.a1 >= 0.4 ? 'non' : '**OUI**'}`);
}
const txt = L.join('\n'); const mi = argv.indexOf('--md'); if (mi >= 0) writeFileSync(argv[mi + 1], txt + '\n'); console.log(txt);
