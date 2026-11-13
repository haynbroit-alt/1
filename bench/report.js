// Analyse d'un fichier de résultats : profit (% oracle), fidélité du modèle, compréhension, fausses découvertes.
// Usage : node bench/report.js bench/dev.json [--md fichier.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { POLICIES } from './policies-def.js';
// plusieurs fichiers : les suivants remplacent les mêmes (politique, environnement, graine)
const files = process.argv.slice(2).filter((a) => a.endsWith('.json') && !process.argv[process.argv.indexOf(a) - 1]?.startsWith('--'));
const file = files.join(' + ');
const merged = new Map();
for (const f of files) for (const r of JSON.parse(readFileSync(f, 'utf8'))) merged.set(`${r.policy}|${r.env}|${r.seed}`, r);
const R = [...merged.values()];
// tolérance de date : 14 jours ; pour un pic périodique, une période (son début n'est datable qu'à une période près)
const TOL = 14;
const tolFor = (e) => (e.type === 'pulse' ? Math.max(TOL, e.period ?? 14) : TOL);
// déclin logistique : daté à son point milieu ; une croyance est à la bonne date si τ ∈ [milieu − 3·largeur − 14, milieu + 14]
const dateOk = (e, tau) => (e.type === 'logistic' ? tau >= e.mid - 3 * e.width - TOL && tau <= e.mid + TOL : Math.abs(tau - e.start) <= tolFor(e));
const evStart = (e) => (e.type === 'logistic' ? e.mid : e.start);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const key = (r) => `${r.env}|${r.seed}`;
const by = {}; for (const r of R) (by[r.policy] ??= {})[key(r)] = r;
const envs = [...new Set(R.map((r) => r.env))];
const pols = Object.keys(POLICIES).filter((p) => by[p]);
const agents = pols.filter((p) => !['oracle', 'habit'].includes(p));

// compréhension : une croyance de la bonne famille, à ±TOL jours (ou structurelle), pour chaque vrai changement
function score(r) {
  const used = new Set(), out = [];
  for (const e of r.events) {
    const ok = r.beliefs.filter((b) => e.expect.includes(b.family) && (b.tau == null || (!e.structural && dateOk(e, b.tau))));
    const any = r.beliefs.filter((b) => b.tau != null && !e.structural && dateOk(e, b.tau));
    ok.forEach((b) => used.add(b)); any.forEach((b) => used.add(b));
    const first = ok.sort((x, y) => x.acceptedAt - y.acceptedAt)[0];
    out.push({ fam: e.expect[0], type: e.type, understood: !!first, detected: !!first || any.length > 0, delay: first ? first.acceptedAt - evStart(e) : null });
  }
  const famsInEnv = new Set(r.events.flatMap((e) => e.expect));
  const falses = r.beliefs.filter((b) => !used.has(b) && !(b.tau == null && famsInEnv.has(b.family))).length;
  return { events: out, falses };
}
const ci = (d) => { const m = mean(d), s = sd(d) / Math.sqrt(d.length); return [m, 1.96 * s]; };
const fmt = (x, d = 0) => (x >= 0 ? '+' : '') + x.toFixed(d);
const L = [];
L.push(`# Résultats — ${file} — ${R.length} épisodes, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`);
L.push(`## 1. Profit (% de l'oracle, moyenne par environnement)\n`);
L.push(`| Politique | ${envs.join(' | ')} | **Tous** |`); L.push(`|---|${envs.map(() => '---:').join('|')}|---:|`);
for (const p of pols) {
  const cells = envs.map((e) => { const ks = Object.keys(by[p]).filter((k) => k.startsWith(e + '|')); return mean(ks.map((k) => by[p][k].profit / by.oracle[k].profit)) * 100; });
  const all = mean(Object.keys(by[p]).map((k) => by[p][k].profit / by.oracle[k].profit)) * 100;
  L.push(`| ${POLICIES[p].label} | ${cells.map((c) => c.toFixed(1)).join(' | ')} | **${all.toFixed(1)}** |`);
}
L.push(`\n## 2. Fidélité du modèle du monde (erreur RMS du log-taux de demande, 7 j à l'avance ; plus bas = mieux)\n`);
L.push(`| Politique | ${envs.join(' | ')} | **Tous** |`); L.push(`|---|${envs.map(() => '---:').join('|')}|---:|`);
for (const p of agents) {
  const cells = envs.map((e) => mean(Object.keys(by[p]).filter((k) => k.startsWith(e + '|')).map((k) => by[p][k].rmse)));
  L.push(`| ${POLICIES[p].label} | ${cells.map((c) => c.toFixed(3)).join(' | ')} | **${mean(Object.values(by[p]).map((r) => r.rmse)).toFixed(3)}** |`);
}
L.push(`\n## 3. Compréhension des changements cachés (bonne famille à ±${TOL} j) et fausses découvertes\n`);
const fams = [...new Set(R.flatMap((r) => r.events.map((e) => e.type + ':' + e.expect[0])))];
L.push(`| Politique | ${fams.map((f) => f.split(':')[0]).join(' | ')} | **Compris (tous)** | Délai médian | Fausses découvertes / an (dont monde calme) |`);
L.push(`|---|${fams.map(() => '---:').join('|')}|---:|---:|---:|`);
for (const p of agents) {
  const S = Object.values(by[p]).map((r) => ({ r, s: score(r) }));
  const cells = fams.map((f) => { const ev = S.flatMap(({ s }) => s.events.filter((e) => e.type + ':' + e.fam === f)); return `${ev.filter((e) => e.understood).length}/${ev.length}`; });
  const ev = S.flatMap(({ s }) => s.events);
  const delays = ev.filter((e) => e.delay != null).map((e) => e.delay).sort((a, b) => a - b);
  const fp = mean(S.map(({ s }) => s.falses)), fpCalm = S.filter(({ r }) => r.env === 'calme');
  L.push(`| ${POLICIES[p].label} | ${cells.join(' | ')} | **${(100 * ev.filter((e) => e.understood).length / ev.length).toFixed(0)} %** | ${delays.length ? delays[Math.floor(delays.length / 2)] + ' j' : '—'} | ${fp.toFixed(2)} (${fpCalm.length ? mean(fpCalm.map(({ s }) => s.falses)).toFixed(2) : '—'}) |`);
}
L.push(`\n## 4. Différences appariées v2 − références (mêmes mondes, mêmes aléas ; IC95)\n`);
L.push(`| Comparaison | Profit (€/an) | Gagne | Erreur du modèle (RMS) | Compréhension (pts) |`); L.push(`|---|---:|---:|---:|---:|`);
for (const ref of agents.filter((p) => p !== 'v2')) {
  if (!by.v2) break;
  const ks = Object.keys(by.v2).filter((k) => by[ref][k]);
  const dp = ks.map((k) => by.v2[k].profit - by[ref][k].profit), de = ks.map((k) => by.v2[k].rmse - by[ref][k].rmse);
  const u = (p, k) => { const s = score(by[p][k]).events; return s.length ? s.filter((e) => e.understood).length / s.length : null; };
  const du = ks.map((k) => [u('v2', k), u(ref, k)]).filter(([x]) => x != null).map(([x, y]) => 100 * (x - y));
  const [mp, cp] = ci(dp), [me, ce] = ci(de), [mu, cu] = ci(du);
  L.push(`| v2 − ${POLICIES[ref].label} | ${fmt(mp)} ± ${cp.toFixed(0)} | ${dp.filter((x) => x > 0).length}/${dp.length} | ${fmt(me, 3)} ± ${ce.toFixed(3)} | ${fmt(mu, 1)} ± ${cu.toFixed(1)} |`);
}
L.push(`\nTemps de calcul moyen par année simulée (v2) : ${by.v2 ? mean(Object.values(by.v2).map((r) => r.secs)).toFixed(1) : '—'} s.`);
const out = L.join('\n');
console.log(out);
const mdi = process.argv.indexOf('--md'); if (mdi > 0) writeFileSync(process.argv[mdi + 1], out + '\n');
