// Banc d'essai : N graines × politiques. Mesure profit, % de l'oracle, détection des ruptures.
// Usage : node bench/bench.js [N=20] [--json chemin]
import { runEpisode } from '../src/runner.js';
import { writeFileSync } from 'node:fs';

const N = +(process.argv[2] || 20);
const jsonPath = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
const variants = [
  ['oracle', 'Oracle (voit la vérité cachée)', { policy: 'oracle' }],
  ['cortex', 'CORTEX complet', {}],
  ['no-hyp', 'CORTEX sans hypothèses ni rêve', { agentOpts: { hypotheses: false, dreaming: false } }],
  ['window', 'Fenêtre glissante 60 j (oubli)', { agentOpts: { hypotheses: false, dreaming: false, window: 60 } }],
  ['no-vigil', 'CORTEX sans vigilance (pas de variation de prix)', { agentOpts: { vigilance: false } }],
  ['no-learn', 'CORTEX sans apprentissage (règles/compétences/calibration)', { agentOpts: { learning: false } }],
  ['habit', 'Habitude (prix fixe 4 €, stock moyen)', { policy: 'habit' }],
];

const res = Object.fromEntries(variants.map(([k]) => [k, []]));
const detect = { level: [], elasticity: [], viral: [], viralEnd: [], falsePos: 0, missed: { level: 0, elasticity: 0, viral: 0 }, reviews: 0 };
const t0 = Date.now();
for (let seed = 1; seed <= N; seed++) {
  for (const [k, , cfg] of variants) {
    const r = runEpisode({ seed, ...cfg });
    res[k].push(r.profit);
    if (k === 'cortex') {
      detect.reviews += r.reviews;
      const ev = r.world.scenario.events;
      const all = [...r.agent.beliefs, ...r.agent.retracted];
      const used = new Set();
      const match = (e, pred) => all.find((b) => !used.has(b) && pred(b) && Math.abs(b.tau - e.start) <= 10);
      const comp = ev[0], elas = ev[2], vir = ev[3];
      const mc = match(comp, (b) => b.type === 'level' && b.coef < 0);
      if (mc) { used.add(mc); detect.level.push({ dateErr: mc.tau - comp.start, delay: mc.acceptedAt - comp.start }); } else detect.missed.level++;
      const me = match(elas, (b) => b.type === 'elasticity' && b.coef < 0);
      if (me) { used.add(me); detect.elasticity.push({ dateErr: me.tau - elas.start, delay: me.acceptedAt - elas.start }); } else detect.missed.elasticity++;
      const mv = all.find((b) => !used.has(b) && b.coef > 0 && Math.abs(b.tau - vir.start) <= 10) || all.find((b) => !used.has(b) && b.type === 'level' && b.end != null && Math.abs(b.end - vir.start) <= 10);
      if (mv) { used.add(mv); detect.viral.push({ dateErr: (mv.coef > 0 ? mv.tau : mv.end) - vir.start, delay: mv.acceptedAt - vir.start }); } else detect.missed.viral++;
      detect.falsePos += all.filter((b) => !used.has(b) && b.tau < comp.start - 10).length;
    }
  }
  process.stderr.write(`\rgraine ${seed}/${N}`);
}
process.stderr.write(`\n${((Date.now() - t0) / 1000).toFixed(0)} s\n`);

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1)); };
const lines = [];
lines.push(`| Politique | Profit annuel moyen | Écart-type | % de l'oracle | Gagne contre « Habitude » |`);
lines.push(`|---|---:|---:|---:|---:|`);
for (const [k, label] of variants) {
  const pctOracle = mean(res[k].map((p, i) => p / res.oracle[i])) * 100;
  const wins = res[k].filter((p, i) => p > res.habit[i]).length;
  lines.push(`| ${label} | ${mean(res[k]).toFixed(0)} € | ${sd(res[k]).toFixed(0)} € | ${pctOracle.toFixed(1)} % | ${k === 'habit' ? '—' : `${wins}/${N}`} |`);
}
// différence appariée CORTEX vs ablation (mêmes mondes, mêmes aléas)
const paired = (a, b) => { const d = res[a].map((x, i) => x - res[b][i]); const m = mean(d), s = sd(d) / Math.sqrt(d.length); return `${m >= 0 ? '+' : ''}${m.toFixed(0)} € ± ${(1.96 * s).toFixed(0)} € (IC95), positif sur ${d.filter((x) => x > 0).length}/${N}`; };
lines.push('');
lines.push(`Différences appariées (mêmes mondes, mêmes nombres aléatoires) :`);
lines.push(`- CORTEX − sans hypothèses : ${paired('cortex', 'no-hyp')}`);
lines.push(`- CORTEX − fenêtre glissante : ${paired('cortex', 'window')}`);
lines.push(`- CORTEX − sans apprentissage : ${paired('cortex', 'no-learn')}`);
lines.push(`- CORTEX − sans vigilance : ${paired('cortex', 'no-vigil')}`);
lines.push(`- CORTEX − habitude : ${paired('cortex', 'habit')}`);
lines.push('');
const dstat = (arr, miss) => arr.length ? `détectée ${arr.length}/${N} — erreur de date médiane ${median(arr.map((x) => Math.abs(x.dateErr)))} j, délai médian d'admission ${median(arr.map((x) => x.delay))} j` : `détectée 0/${N}`;
function median(a) { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : '—'; }
lines.push(`Découverte des ruptures cachées par CORTEX (croyance de la bonne nature à ±10 j de la vraie date) :`);
lines.push(`- Concurrent (baisse de niveau) : ${dstat(detect.level)}`);
lines.push(`- Clients plus sensibles au prix (élasticité) : ${dstat(detect.elasticity)}`);
lines.push(`- Effet viral (hausse temporaire) : ${dstat(detect.viral)}`);
lines.push(`- Fausses ruptures avant tout événement réel : ${detect.falsePos} sur ${N} années`);
lines.push(`- Revues humaines (relecteur simulé) : ${(detect.reviews / N).toFixed(1)} par an en moyenne`);
const out = lines.join('\n');
console.log(out);
if (jsonPath) writeFileSync(jsonPath, JSON.stringify({ N, res, detect }, null, 1));
