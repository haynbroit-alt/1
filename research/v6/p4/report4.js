// Analyse pré-enregistrée de P4. Usage : node research/v6/p4/report4.js research/v6/p4/p4-test.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const get = (tau, c, arm) => R.filter((r) => r.tau === tau && r.c === c && r.arm === arm).sort((a, b) => a.seed - b.seed);
const pctOf = (tau, c, arm) => { const o = get(tau, c, 'oracle-patient'); return get(tau, c, arm).map((r, i) => (100 * r.profit) / o[i].profit); };
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const ci = (d) => { const m = mean(d), sd = Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, d.length - 1)); return [m, (1.96 * sd) / Math.sqrt(d.length)]; };
const f = ([m, c]) => `${m >= 0 ? '+' : ''}${m.toFixed(2)} ± ${c.toFixed(2)}`;
const TAUS = [33, 60, 120], CS = [0, 0.25];
const ARMS = ['oracle-patient', 'oracle-patient-j30', 'oracle-myope', 'habitude', 'E0P0', 'E1P0', 'E0P1', 'E1P1'];
const seeds = [...new Set(R.map((r) => r.seed))];
const L = [`# Prototype P4 — ${R.length} années simulées, graines ${Math.min(...seeds)}–${Math.max(...seeds)}\n`];
L.push('## Profit (% de l’oracle patient)\n');
L.push(`| Bras | ${TAUS.flatMap((t) => CS.map((c) => `τ ${t}, c ${c}`)).join(' | ')} |\n|---|${TAUS.flatMap(() => CS.map(() => '---:')).join('|')}|`);
for (const a of ARMS) L.push(`| ${a} | ${TAUS.flatMap((t) => CS.map((c) => mean(pctOf(t, c, a)).toFixed(1))).join(' | ')} |`);
// différences appariées en points de % de l'oracle patient
const diff = (tau, c, a, b) => { const x = pctOf(tau, c, a), y = pctOf(tau, c, b); return x.map((v, i) => v - y[i]); };
const pool = (taus, c, a, b) => taus.flatMap((t) => diff(t, c, a, b));
const H = [
  ['H1 la patience a besoin du savoir : E1P1 − E1P0, c = 0,25, τ ∈ {33, 60}', pool([33, 60], 0.25, 'E1P1', 'E1P0'), (x) => x[0] - x[1] > 0],
  ['H2 le savoir a besoin de l’exploration : E1P1 − E0P1, c = 0,25, τ ∈ {33, 60}', pool([33, 60], 0.25, 'E1P1', 'E0P1'), (x) => x[0] - x[1] > 0],
];
for (const tau of [33, 60]) { const d = diff(tau, 0, 'E1P1', 'E0P1').map((v, i) => (v + diff(tau, 0.25, 'E1P1', 'E0P1')[i]) / 2); H.push([`H3 τ = ${tau} : moyenne sur c de (E1P1 − E0P1)`, d, (x) => x[0] - x[1] > 0]); }
{ const d = diff(120, 0, 'E1P1', 'E0P1').map((v, i) => (v + diff(120, 0.25, 'E1P1', 'E0P1')[i]) / 2); H.push(['H4 (prédiction, rapportée) τ = 120 : moyenne sur c de (E1P1 − E0P1) ≤ 0', d, (x) => x[0] <= 0]); }
L.push('\n## Hypothèses (points de % de l’oracle patient, différences appariées, IC95)\n');
L.push('| Hypothèse | Différence | Verdict |\n|---|---:|---|');
for (const [n, d, ok] of H) { const x = ci(d); L.push(`| ${n} | ${f(x)} | ${ok(x) ? '✅' : '❌'} |`); }
const v1 = ci(H[0][1]), v2 = ci(H[1][1]);
L.push(`\nAbandon (H1 et H2 échouent toutes deux) : ${v1[0] - v1[1] > 0 || v2[0] - v2[1] > 0 ? 'non' : '**OUI**'}`);
L.push('\n## Rapporté (H5, H6)\n');
L.push('| Cellule | coût de l’exploration à c = 0 (E1P1 − E0P1) | E1P1 − habitude | E1P1 − oracle myope | E1P1 − oracle patient après j30 | élasticité LT apprise au j180 (E1P1 / E0P1) | vraie |');
L.push('|---|---:|---:|---:|---:|---:|---:|');
for (const tau of TAUS) for (const c of CS) {
  const el = (a) => mean(get(tau, c, a).map((r) => r.snap[179].elasticity)).toFixed(2);
  L.push(`| τ ${tau}, c ${c} | ${c === 0 ? f(ci(diff(tau, 0, 'E1P1', 'E0P1'))) : '—'} | ${f(ci(diff(tau, c, 'E1P1', 'habitude')))} | ${f(ci(diff(tau, c, 'E1P1', 'oracle-myope')))} | ${f(ci(diff(tau, c, 'E1P1', 'oracle-patient-j30')))} | ${el('E1P1')} / ${el('E0P1')} | ${mean(get(tau, c, 'E1P1').map((r) => r.snap[179].trueElasticity)).toFixed(2)} |`);
}
const txt = L.join('\n'); const mi = argv.indexOf('--md'); if (mi >= 0) writeFileSync(argv[mi + 1], txt + '\n'); console.log(txt);
