// Analyse du banc de transfert. Usage : node bench/transfer-report.js f.json [g.json…] [--body x,y] [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
import { LABELS } from './transfer.js';
const argv = process.argv.slice(2);
const files = argv.filter((a, i) => a.endsWith('.json') && argv[i - 1] !== '--md');
const bodyFilter = argv.includes('--body') ? argv[argv.indexOf('--body') + 1].split(',') : null;
const merged = new Map();
for (const f of files) for (const r of JSON.parse(readFileSync(f, 'utf8'))) merged.set(`${r.policy}|${r.body}|${r.seed}`, r);
const R = [...merged.values()].filter((r) => !bodyFilter || bodyFilter.includes(r.body));
const TOL = 14;
const tolFor = (e) => (e.type === 'pulse' ? Math.max(TOL, e.period ?? 14) : TOL);
const dateOk = (e, tau) => (e.type === 'logistic' ? tau >= e.mid - 3 * e.width - TOL && tau <= e.mid + TOL : Math.abs(tau - e.start) <= tolFor(e));
const evStart = (e) => (e.type === 'logistic' ? e.mid : e.start);
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / Math.max(1, a.length - 1)); };
const ci = (d) => [mean(d), (1.96 * sd(d)) / Math.sqrt(d.length)];
const by = {}; for (const r of R) (by[r.policy] ??= {})[`${r.body}|${r.seed}`] = r;
const bodies = [...new Set(R.map((r) => r.body))];
const pols = Object.keys(LABELS).filter((p) => by[p]);
const agents = pols.filter((p) => !['oracle', 'habit'].includes(p));
const famOf = (e) => e.expect[0].split(':')[0] === 'slope' ? `${e.expect[0]}` : e.type === 'logistic' ? 'logistic' : e.expect[0].split(':')[0];
function score(r) {
  const used = new Set(), ev = [];
  for (const e of r.events) {
    // anyDate (pré-enregistré, protocole n° 3) : un mécanisme permanent compte comme découvert quelle que soit la forme datée ou non de la croyance
    const ok = r.beliefs.filter((b) => b.outcome === e.outcome && e.expect.includes(b.key) && (e.anyDate || b.tau == null || (!e.structural && dateOk(e, b.tau))));
    const any = r.beliefs.filter((b) => b.outcome === e.outcome && b.tau != null && !e.structural && dateOk(e, b.tau));
    ok.forEach((b) => used.add(b)); any.forEach((b) => used.add(b));
    const first = ok.sort((x, y) => x.acceptedAt - y.acceptedAt)[0];
    ev.push({ fam: famOf(e), understood: !!first, delay: first ? first.acceptedAt - evStart(e) : null });
  }
  const famsHere = new Set(r.events.flatMap((e) => e.expect));
  return { ev, falses: r.beliefs.filter((b) => !used.has(b) && !(b.tau == null && famsHere.has(b.key))).length };
}
const L = [];
const ks = (p, body) => Object.keys(by[p] ?? {}).filter((k) => !body || k.startsWith(body + '|'));
L.push(`# Transfert — ${R.length} épisodes, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`);
L.push(`## Profit (% de l'oracle)\n\n| Politique | ${bodies.join(' | ')} | **Tous** |\n|---|${bodies.map(() => '---:').join('|')}|---:|`);
for (const p of pols) {
  const cell = (body) => { const k = ks(p, body).filter((k) => by.oracle[k]); return k.length ? (100 * mean(k.map((k) => by[p][k].reward / by.oracle[k].reward))).toFixed(1) : '—'; };
  L.push(`| ${LABELS[p]} | ${bodies.map(cell).join(' | ')} | **${cell(null)}** |`);
}
L.push(`\n## Erreur du modèle du monde (RMS du log, 7 j à l'avance ; plus bas = mieux)\n\n| Politique | ${bodies.join(' | ')} | **Tous** |\n|---|${bodies.map(() => '---:').join('|')}|---:|`);
for (const p of agents) { const cell = (body) => { const k = ks(p, body); return k.length ? mean(k.map((k) => by[p][k].rmse)).toFixed(3) : '—'; }; L.push(`| ${LABELS[p]} | ${bodies.map(cell).join(' | ')} | **${cell(null)}** |`); }
const fams = [...new Set(R.flatMap((r) => r.events.map(famOf)))];
L.push(`\n## Compréhension (bonne famille, bonne variable, bonne date ±${TOL} j) et fausses découvertes\n\n| Politique | ${fams.join(' | ')} | **Compris** | Délai médian | Fausses / an |\n|---|${fams.map(() => '---:').join('|')}|---:|---:|---:|`);
for (const p of agents) {
  const S = Object.values(by[p]).map(score), ev = S.flatMap((s) => s.ev);
  const d = ev.filter((e) => e.delay != null).map((e) => e.delay).sort((a, b) => a - b);
  L.push(`| ${LABELS[p]} | ${fams.map((f) => { const x = ev.filter((e) => e.fam === f); return x.length ? `${x.filter((e) => e.understood).length}/${x.length}` : '—'; }).join(' | ')} | **${(100 * ev.filter((e) => e.understood).length / ev.length).toFixed(0)} %** | ${d.length ? d[Math.floor(d.length / 2)] + ' j' : '—'} | ${mean(S.map((s) => s.falses)).toFixed(2)} |`);
}
L.push(`\n## Différences appariées (IC95)\n\n| Comparaison | Profit (€/an) | Gagne | Erreur du modèle | Compréhension (pts) |\n|---|---:|---:|---:|---:|`);
const MAIN = by.v5 ? 'v5' : by.v4 ? 'v4' : 'v3';
for (const ref of agents.filter((p) => p !== MAIN)) {
  const k = ks(MAIN).filter((k) => by[ref][k]); if (!k.length) continue;
  const u = (p, kk) => { const s = score(by[p][kk]).ev; return s.length ? s.filter((e) => e.understood).length / s.length : null; };
  const dp = k.map((kk) => by[MAIN][kk].reward - by[ref][kk].reward), de = k.map((kk) => by[MAIN][kk].rmse - by[ref][kk].rmse);
  const du = k.map((kk) => [u(MAIN, kk), u(ref, kk)]).filter(([x]) => x != null).map(([x, y]) => 100 * (x - y));
  const f = (x, n = 0) => (x >= 0 ? '+' : '') + x.toFixed(n);
  const [a1, b1] = ci(dp), [a2, b2] = ci(de), [a3, b3] = ci(du);
  L.push(`| ${MAIN} − ${LABELS[ref]} | ${f(a1)} ± ${b1.toFixed(0)} | ${dp.filter((x) => x > 0).length}/${dp.length} | ${f(a2, 3)} ± ${b2.toFixed(3)} | ${f(a3, 1)} ± ${b3.toFixed(1)} |`);
}
L.push(`\nTemps moyen par année (${MAIN}) : ${by[MAIN] ? mean(Object.values(by[MAIN]).map((r) => r.secs)).toFixed(1) : '—'} s.`);
const out = L.join('\n'); console.log(out);
if (argv.includes('--md')) writeFileSync(argv[argv.indexOf('--md') + 1], out + '\n');
