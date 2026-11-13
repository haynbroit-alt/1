// Analyse PRÉ-ENREGISTRÉE du protocole n° 4 (écrite avant l'exécution, commit B).
// Usage : node bench/v5-test-report.js bench/v5-test.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const ci = (d) => [mean(d), (1.96 * sd(d)) / Math.sqrt(d.length)];
const fmt = ([m, c], n = 0) => `${m >= 0 ? '+' : ''}${m.toFixed(n)} ± ${c.toFixed(n)}`;
const P = ['oracle', 'habit', 'v3-gele', 'v4-gele', 'v5', 'v5-sansC1', 'v5-sansC2', 'v5-sansC4', 'v5-avecC3'];
const LBL = { oracle: 'Oracle (vraie dynamique ; non myope là où l’activité le permet)', habit: 'Habitude (règle fixe)', 'v3-gele': 'CORTEX v3 (gelée)', 'v4-gele': 'CORTEX v4 (gelée)', v5: '**CORTEX v5**', 'v5-sansC1': 'v5 sans exploration (C1)', 'v5-sansC2': 'v5 sans variables inventées (C2)', 'v5-sansC4': 'v5 sans incompréhension (C4)', 'v5-avecC3': 'v5 avec remise en cause (C3, rejetée en dev)' };
const bodies = [...new Set(R.map((r) => r.body))];
const get = (p, b) => R.filter((r) => r.policy === p && (!b || r.body === b)).sort((x, y) => (x.body + String(x.seed).padStart(4, '0')).localeCompare(y.body + String(y.seed).padStart(4, '0')));
const pols = P.filter((p) => get(p).length);
const TOL = 14;
// découverte : bonne mesure, bonne clé (famille + variable), bonne date ±14 j si le mécanisme est daté
const found = (r, e) => r.beliefs.some((b) => b.outcome === e.outcome && e.expect.includes(b.key) && (e.anyDate || b.tau == null || (!e.structural && Math.abs(b.tau - e.start) <= TOL)));
// fausse découverte : croyance qui ne correspond à aucun mécanisme réel. Une croyance datée de niveau/volatilité à ±14 j
// d'une bascule du régime caché (hors de portée) n'est pas comptée fausse : elle décrit un changement réel.
const isTrue = (b, e) => b.outcome === e.outcome && (e.expect.includes(b.key) || (b.tau != null && !e.structural && Math.abs(b.tau - e.start) <= TOL)
  || (e.switches && ['level', 'variance'].includes(b.key) && b.tau != null && e.switches.some((s) => Math.abs(b.tau - s) <= TOL)));
const falses = (r) => r.beliefs.filter((b) => !r.events.some((e) => isTrue(b, e))).length;
const pair = (a, b, f, body) => { const x = get(a, body), y = get(b, body); return x.map((r, i) => f(r) - f(y[i])); };
const pdays = (r) => mean(Object.values(r.perplexity?.days ?? {}));

const L = [`# Évaluation pré-enregistrée n° 4 (CORTEX v5) — ${R.length} années simulées, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`];
L.push('## Profit (% de l’oracle)\n');
L.push(`| Politique | ${bodies.join(' | ')} | **Tous** |\n|---|${bodies.map(() => '---:').join('|')}|---:|`);
for (const p of pols) {
  const pct = (b) => { const x = get(p, b), o = get('oracle', b); return x.map((r, i) => (100 * r.reward) / o[i].reward); };
  L.push(`| ${LBL[p]} | ${bodies.map((b) => mean(pct(b)).toFixed(1)).join(' | ')} | **${mean(bodies.flatMap(pct)).toFixed(1)}** |`);
}
L.push('\n## Erreur du modèle du monde (RMS du log, 7 jours à l’avance ; plus bas = mieux)\n');
L.push(`| Politique | ${bodies.join(' | ')} | **Tous** |\n|---|${bodies.map(() => '---:').join('|')}|---:|`);
for (const p of pols.filter((p) => !['oracle', 'habit'].includes(p))) L.push(`| ${LBL[p]} | ${bodies.map((b) => mean(get(p, b).map((r) => r.rmse)).toFixed(3)).join(' | ')} | **${mean(get(p).map((r) => r.rmse)).toFixed(3)}** |`);

L.push('\n## Hypothèses pré-enregistrées (différences appariées, IC95, trois activités)\n');
const inventables = (r) => r.events.filter((e) => /^inventable/.test(e.classe) && found(r, e)).length;
const H = [
  ['G1 profit v5 > v4', (b) => pair('v5', 'v4-gele', (r) => r.reward, b), 0, (c) => c[0] - c[1] > 0],
  ['G2 profit v5 > habitude', (b) => pair('v5', 'habit', (r) => r.reward, b), 0, (c) => c[0] - c[1] > 0],
  ['E1 profit v5 > v5 sans C1', (b) => pair('v5', 'v5-sansC1', (r) => r.reward, b), 0, (c) => c[0] - c[1] > 0],
  ['E2a erreur v5 < v5 sans C2', (b) => pair('v5', 'v5-sansC2', (r) => r.rmse, b), 3, (c) => c[0] + c[1] < 0],
  ['E2b mécanismes inventables : v5 > v4', (b) => pair('v5', 'v4-gele', inventables, b), 2, (c) => c[0] - c[1] > 0],
  ['E4 fausses découvertes v5 < v5 sans C4', (b) => pair('v5', 'v5-sansC4', falses, b), 2, (c) => c[0] + c[1] < 0],
  ['(C3, sans hypothèse) profit v5 avec C3 − v5', (b) => pair('v5-avecC3', 'v5', (r) => r.reward, b), 0, () => null],
];
L.push('| Hypothèse | Différence appariée (IC95) | Verdict |\n|---|---:|---|');
for (const [name, f, n, ok] of H) {
  const c = ci(f()); const v = ok(c);
  L.push(`| ${name} | ${fmt(c, n)} | ${v === null ? 'rapporté' : v ? '✅ confirmée' : '❌ non confirmée'} |`);
  for (const b of bodies) { const cb = ci(f(b)); const vb = ok(cb); L.push(`| ↳ ${b} | ${fmt(cb, n)} | ${vb === null ? '' : vb ? '✅' : '❌'} |`); }
}
// S : garde-fou
const sRows = bodies.map((b) => [b, mean(get('v5', b).map(falses))]);
L.push(`| S fausses découvertes v5 ≤ 2 par an et par activité | ${sRows.map(([b, m]) => `${b} ${m.toFixed(2)}`).join(' · ')} | ${sRows.every(([, m]) => m <= 2) ? '✅ respecté' : '❌ dépassé'} |`);
// E4b : incompréhension plus fréquente là où existe un mécanisme hors de portée
const withOOR = (r) => r.events.some((e) => e.outOfReach);
const v5r = get('v5'), A1 = v5r.filter(withOOR).map(pdays), A0 = v5r.filter((r) => !withOOR(r)).map(pdays);
const dE = mean(A1) - mean(A0), cE = 1.96 * Math.sqrt(sd(A1) ** 2 / A1.length + sd(A0) ** 2 / A0.length);
L.push(`| E4b jours d’incompréhension par mesure : activités avec mécanisme hors de portée (${mean(A1).toFixed(1)}) − sans (${mean(A0).toFixed(1)}) | ${fmt([dE, cE], 1)} | ${dE - cE > 0 ? '✅ confirmée' : '❌ non confirmée'} |`);

L.push('\n## Découverte des mécanismes cachés (part des années où le mécanisme est trouvé)\n');
const dp = pols.filter((p) => !['oracle', 'habit'].includes(p));
L.push(`| Activité | Mécanisme | Classe | ${dp.map((p) => LBL[p]).join(' | ')} |\n|---|---|---|${dp.map(() => '---:').join('|')}|`);
for (const b of bodies) {
  const evs = get('v5', b)[0].events;
  evs.forEach((e, k) => {
    if (e.outOfReach) { L.push(`| ${b} | ${e.label} | ${e.classe} | ${dp.map(() => '—').join(' | ')} |`); return; }
    L.push(`| ${b} | ${e.label} | ${e.classe} | ${dp.map((p) => { const x = get(p, b); return `${Math.round((100 * x.filter((r) => found(r, r.events[k])).length) / x.length)} %`; }).join(' | ')} |`);
  });
}
L.push('\n## Fausses découvertes par an et jours d’incompréhension\n');
L.push(`| Politique | ${bodies.map((b) => `${b} (fausses)`).join(' | ')} | ${bodies.map((b) => `${b} (incompr. j/mesure)`).join(' | ')} |\n|---|${bodies.map(() => '---:').join('|')}|${bodies.map(() => '---:').join('|')}|`);
for (const p of dp) L.push(`| ${LBL[p]} | ${bodies.map((b) => mean(get(p, b).map(falses)).toFixed(2)).join(' | ')} | ${bodies.map((b) => { const x = get(p, b).filter((r) => r.perplexity); return x.length ? mean(x.map(pdays)).toFixed(1) : '—'; }).join(' | ')} |`);
L.push('\nJours d’incompréhension de v5, par mesure :\n');
for (const b of bodies) { const x = get('v5', b); const keys = Object.keys(x[0]?.perplexity?.days ?? {}); L.push(`- ${b} : ${keys.map((k) => `${k} ${mean(x.map((r) => r.perplexity.days[k])).toFixed(1)} j`).join(' · ')}`); }
L.push('\n## Temps de calcul (s par année simulée)\n');
L.push(dp.map((p) => `${LBL[p]} ${mean(get(p).map((r) => r.secs)).toFixed(1)}`).join(' · '));
const out = L.join('\n');
const mi = argv.indexOf('--md');
if (mi >= 0) writeFileSync(argv[mi + 1], out + '\n');
console.log(out);
