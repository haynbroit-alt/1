// Expériences de contrôle de la v4 (règles 4 à 6) : les découvertes sont-elles réelles, et utiles hors échantillon ?
// Usage : node bench/v4-controls.js bench/v4-dev2.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const ci = (d) => `${mean(d) >= 0 ? '+' : ''}${mean(d).toFixed(3)} ± ${((1.96 * sd(d)) / Math.sqrt(d.length)).toFixed(3)}`;
const get = (p, b) => R.filter((r) => r.policy === p && r.body === b).sort((x, y) => x.seed - y.seed);
const has = (r, re) => r.beliefs.some((b) => re.test(b.key));
const L = ['# Expériences de contrôle v4 (développement)\n'];

L.push('## 1. Placebo : la maintenance ne sert à rien (aucune usure)\n');
L.push('| Politique | Croit à une usure « jours depuis maintenance » | Maintenances / an | % de l’oracle |\n|---|---:|---:|---:|');
for (const p of ['v3-gele', 'v4', 'v4-myope', 'v4-sansmemoire']) { const x = get(p, 'usine-placebo'), o = get('oracle', 'usine-placebo'); if (!x.length) continue;
  L.push(`| ${p} | ${x.filter((r) => has(r, /^memory:since:maintenance/)).length}/${x.length} | ${mean(x.map((r) => (r.actDays?.maintenance ?? []).length)).toFixed(1)} | ${(100 * mean(x.map((r, i) => r.reward / o[i].reward))).toFixed(1)} |`); }

L.push('\n## 2. Usure liée à la cadence récente (et non au temps depuis la maintenance)\n');
L.push('| Politique | Trouve la mémoire de la cadence | Croit (à tort) à « jours depuis maintenance » | Maintenances / an | % de l’oracle |\n|---|---:|---:|---:|---:|');
for (const p of ['v3-gele', 'v4', 'v4-myope', 'v4-sansmemoire']) { const x = get(p, 'usine-cadence'), o = get('oracle', 'usine-cadence'); if (!x.length) continue;
  L.push(`| ${p} | ${x.filter((r) => has(r, /^memory:ema\d:cadence/)).length}/${x.length} | ${x.filter((r) => has(r, /^memory:since:maintenance/)).length}/${x.length} | ${mean(x.map((r) => (r.actDays?.maintenance ?? []).length)).toFixed(1)} | ${(100 * mean(x.map((r, i) => r.reward / o[i].reward))).toFixed(1)} |`); }

L.push('\n## 3. Usure réelle, et robustesse : l’usure double au jour 200\n');
const gaps = (days, a, b) => { const d = (days ?? []).filter((x) => x >= a && x < b); const g = []; for (let i = 1; i < d.length; i++) g.push(d[i] - d[i - 1]); return g.length ? mean(g) : NaN; };
L.push('| Corps | Politique | Trouve l’usure | Intervalle moyen entre maintenances, j 60–200 | j 230–365 | % de l’oracle |\n|---|---|---:|---:|---:|---:|');
for (const body of ['usine', 'usine-rupture']) for (const p of ['v3-gele', 'v4', 'v4-myope']) { const x = get(p, body), o = get('oracle', body); if (!x.length) continue;
  L.push(`| ${body} | ${p} | ${x.filter((r) => has(r, /^memory:since:maintenance/)).length}/${x.length} | ${mean(x.map((r) => gaps(r.actDays?.maintenance, 60, 200)).filter(Number.isFinite)).toFixed(1)} | ${mean(x.map((r) => gaps(r.actDays?.maintenance, 230, 365)).filter(Number.isFinite)).toFixed(1)} | ${(100 * mean(x.map((r, i) => r.reward / o[i].reward))).toFixed(1)} |`); }
L.push('\nCalendrier optimal (oracle) : environ 12 jours avant la rupture, 8 jours après.');

L.push('\n## 4. Fausses mémoires et interactions là où il n’y en a aucune\n');
const noMem = ['calme', 'boulangerie', 'marche', 'glacier', 'restaurant', 'abonnement', 'usine-placebo'];
L.push('| Corps (sans mécanisme à mémoire ni interaction) | v4 : années avec ≥ 1 « mémoire » | avec ≥ 1 « interaction » | Mémoires / an |\n|---|---:|---:|---:|');
for (const b of noMem) { const x = get('v4', b); if (!x.length) continue;
  L.push(`| ${b} | ${x.filter((r) => has(r, /^memory:/)).length}/${x.length} | ${x.filter((r) => has(r, /^interaction:/)).length}/${x.length} | ${mean(x.map((r) => r.beliefs.filter((b2) => /^memory:/.test(b2.key)).length)).toFixed(2)} |`); }
L.push('\nLe fleuriste a un vrai effet retard du marketing : une mémoire du marketing y est correcte.');

L.push('\n## 5. Les variables construites améliorent-elles les prévisions hors échantillon ?\n');
L.push('Erreur RMS du log de chaque mesure, prédite **7 jours à l’avance** (jours futurs jamais vus par le modèle). Différence appariée v4 − v4 sans variables construites (négatif = mieux).\n');
L.push('| Corps | v4 | v4 sans variables construites | Différence (IC95) |\n|---|---:|---:|---:|');
const bodies = [...new Set(R.map((r) => r.body))];
const all = [];
for (const b of bodies) { const x = get('v4', b), y = get('v4-sansmemoire', b); if (!x.length || !y.length) continue; const d = x.map((r, i) => r.rmse - y[i].rmse); all.push(...d);
  L.push(`| ${b} | ${mean(x.map((r) => r.rmse)).toFixed(3)} | ${mean(y.map((r) => r.rmse)).toFixed(3)} | ${ci(d)} |`); }
L.push(`| **Tous** | | | **${ci(all)}** |`);

L.push('\n## 6. Temps de calcul (s par année simulée)\n');
L.push('| Politique | Moyenne | Max |\n|---|---:|---:|');
for (const p of ['v3-gele', 'v4', 'v4-myope', 'v4-sansmemoire']) { const x = R.filter((r) => r.policy === p); if (x.length) L.push(`| ${p} | ${mean(x.map((r) => r.secs)).toFixed(1)} | ${Math.max(...x.map((r) => r.secs)).toFixed(1)} |`); }
const out = L.join('\n'); console.log(out);
if (argv.includes('--md')) writeFileSync(argv[argv.indexOf('--md') + 1], out + '\n');
