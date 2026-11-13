// Analyse pré-enregistrée du protocole n° 3. Usage : node bench/v4-test-report.js bench/v4-test.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const ci = (d, n = 0) => [mean(d), (1.96 * sd(d)) / Math.sqrt(d.length)];
const fmt = ([m, c], n = 0) => `${m >= 0 ? '+' : ''}${m.toFixed(n)} ± ${c.toFixed(n)}`;
const P = ['oracle', 'habit', 'v3-gele', 'v4', 'v4-myope', 'v4-sansmemoire'];
const LBL = { oracle: 'Oracle (jour par jour, vraie dynamique)', habit: 'Habitude', 'v3-gele': 'CORTEX v3 (gelée)', v4: 'CORTEX v4', 'v4-myope': 'v4 sans planification', 'v4-sansmemoire': 'v4 sans variables construites' };
const bodies = [...new Set(R.map((r) => r.body))];
const get = (p, b) => R.filter((r) => r.policy === p && (!b || r.body === b)).sort((x, y) => (x.body + x.seed).localeCompare(y.body + y.seed));
const TOL = 14;
const found = (r, e) => r.beliefs.some((b) => b.outcome === e.outcome && e.expect.includes(b.key) && (e.anyDate || b.tau == null || (!e.structural && Math.abs(b.tau - e.start) <= TOL)));
const L = [`# Évaluation pré-enregistrée n° 3 — ${R.length} années simulées, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`];
L.push('## Profit (% de l’oracle jour par jour ; > 100 % possible quand l’activité a un état)\n');
L.push(`| Politique | ${bodies.join(' | ')} |\n|---|${bodies.map(() => '---:').join('|')}|`);
for (const p of P) L.push(`| ${LBL[p]} | ${bodies.map((b) => { const x = get(p, b), o = get('oracle', b); return x.length ? (100 * mean(x.map((r, i) => r.reward / o[i].reward))).toFixed(1) : '—'; }).join(' | ')} |`);
L.push('\n## Erreur du modèle du monde (RMS du log, 7 jours à l’avance)\n');
L.push(`| Politique | ${bodies.join(' | ')} |\n|---|${bodies.map(() => '---:').join('|')}|`);
for (const p of P.slice(2)) L.push(`| ${LBL[p]} | ${bodies.map((b) => mean(get(p, b).map((r) => r.rmse)).toFixed(3)).join(' | ')} |`);
L.push('\n## Hypothèses\n');
const pair = (a, b, f) => { const x = get(a), y = get(b); return x.map((r, i) => f(r) - f(y[i])); };
const H = [
  ['H1 profit v4 > v3', pair('v4', 'v3-gele', (r) => r.reward), 0, (c) => c[0] - c[1] > 0],
  ['H2 profit v4 > habitude', pair('v4', 'habit', (r) => r.reward), 0, (c) => c[0] - c[1] > 0],
  ['H3 erreur v4 < v4 sans variables construites', pair('v4', 'v4-sansmemoire', (r) => r.rmse), 3, (c) => c[0] + c[1] < 0],
  ['H4 profit v4 > v4 sans planification', pair('v4', 'v4-myope', (r) => r.reward), 0, (c) => c[0] - c[1] > 0],
];
L.push('| Hypothèse | Différence appariée (IC95) | Verdict |\n|---|---:|---|');
for (const [name, d, n, ok] of H) { const c = ci(d); L.push(`| ${name} | ${fmt(c, n)} | ${ok(c) ? '✅ confirmée' : '❌ non confirmée'} |`); }
for (const b of bodies) for (const [name, d0, n, ok] of H) {
  const sub = (a, bb, f) => { const x = get(a, b), y = get(bb, b); return x.map((r, i) => f(r) - f(y[i])); };
  const d = name.startsWith('H1') ? sub('v4', 'v3-gele', (r) => r.reward) : name.startsWith('H2') ? sub('v4', 'habit', (r) => r.reward) : name.startsWith('H3') ? sub('v4', 'v4-sansmemoire', (r) => r.rmse) : sub('v4', 'v4-myope', (r) => r.reward);
  const c = ci(d); L.push(`| ↳ ${b} : ${name} | ${fmt(c, n)} | ${ok(c) ? '✅' : '❌'} |`);
}
L.push('\n## Découverte des mécanismes cachés, par classe de représentabilité\n');
L.push('| Activité | Mécanisme | Classe | v3 | v4 | v4 sans planif. |\n|---|---|---|---:|---:|---:|');
const byClass = {};
for (const b of bodies) {
  const evs = get('v4', b)[0]?.events ?? [];
  evs.forEach((e, i) => {
    const cnt = (p) => get(p, b).filter((r) => found(r, r.events[i])).length;
    const n = get('v4', b).length;
    L.push(`| ${b} | ${e.label} | ${e.classe} | ${cnt('v3-gele')}/${n} | ${cnt('v4')}/${n} | ${cnt('v4-myope')}/${n} |`);
    (byClass[e.classe] ??= { v3: 0, v4: 0, n: 0 }); byClass[e.classe].v3 += cnt('v3-gele'); byClass[e.classe].v4 += cnt('v4'); byClass[e.classe].n += n;
  });
}
L.push('\n| Classe | v3 | v4 |\n|---|---:|---:|');
for (const [k, v] of Object.entries(byClass)) L.push(`| ${k} | ${v.v3}/${v.n} (${Math.round(100 * v.v3 / v.n)} %) | ${v.v4}/${v.n} (${Math.round(100 * v.v4 / v.n)} %) |`);
const rep = byClass['représentable'];
L.push(`\n**H5** (v4 découvre ≥ 50 % des mécanismes représentables) : ${rep ? `${Math.round(100 * rep.v4 / rep.n)} % → ${rep.v4 / rep.n >= 0.5 ? '✅ confirmée' : '❌ non confirmée'}` : '—'}`);
L.push('\n## Fausses découvertes (croyances ne correspondant à aucun mécanisme caché, ni par famille ni par date)\n');
const falses = (r) => r.beliefs.filter((b) => !r.events.some((e) => e.outcome === b.outcome && (e.expect.includes(b.key) || (b.tau != null && !e.structural && Math.abs(b.tau - e.start) <= TOL)))).length;
L.push(`| Politique | ${bodies.join(' | ')} | dont « mémoire »/« interaction » (v4) |\n|---|${bodies.map(() => '---:').join('|')}|---:|`);
for (const p of ['v3-gele', 'v4', 'v4-myope']) L.push(`| ${LBL[p]} | ${bodies.map((b) => mean(get(p, b).map(falses)).toFixed(2)).join(' | ')} | ${p === 'v4' ? mean(get('v4').map((r) => r.beliefs.filter((b) => /^(memory|interaction):/.test(b.key) && !r.events.some((e) => e.outcome === b.outcome && e.expect.includes(b.key))).length)).toFixed(2) : ''} |`);
const worst = Math.max(...bodies.map((b) => mean(get('v4', b).map(falses))));
L.push(`\n**H6** (≤ 2 fausses découvertes par an et par activité pour v4) : pire activité ${worst.toFixed(2)} → ${worst <= 2 ? '✅ confirmée' : '❌ non confirmée'}`);
L.push('\n## Stratégies adoptées par v4 (jours d’activation des leviers discrets, moyenne par an)\n');
for (const b of bodies) { const x = get('v4', b), h = get('v4-myope', b); const keys = [...new Set(x.flatMap((r) => Object.keys(r.actDays ?? {})))]; L.push(`- ${b} : ${keys.map((k) => `${k} ${mean(x.map((r) => (r.actDays?.[k] ?? []).length)).toFixed(0)} j (myope : ${mean(h.map((r) => (r.actDays?.[k] ?? []).length)).toFixed(0)} j)`).join(' · ')}`); }
L.push(`\n## Temps de calcul (s par année simulée)\n\n${P.slice(2).map((p) => `- ${LBL[p]} : ${mean(get(p).map((r) => r.secs)).toFixed(1)} s`).join('\n')}`);
const out = L.join('\n'); console.log(out);
if (argv.includes('--md')) writeFileSync(argv[argv.indexOf('--md') + 1], out + '\n');
