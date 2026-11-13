// Usage : node research/v6/p2-report.js research/v6/p2-dev.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const wilson = (x, n, z = 1.96) => { const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [c - h, c + h]; };
const by = (c) => R.filter((r) => r.cls === c);
const anyHors = (r) => r.targets.some((t) => t.diag === 'hors de portée');
const touched = (c) => by(c).flatMap((r) => r.targets.filter((t) => t.touched));
const pct = (x) => `${(100 * x).toFixed(0)} %`;
const L = [`# Prototype P2 — ${R.length} mondes, graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`];
L.push('## Diagnostic par classe de monde\n');
L.push('| Classe | Mondes | Mondes avec ≥ 1 « hors de portée » | Mesures touchées déclarées hors de portée | … avec la bonne famille | « mal estimé » (mesures) |');
L.push('|---|---:|---:|---:|---:|---:|');
for (const c of ['compris', 'forme', 'rupture', 'regime', 'flou']) {
  const x = by(c); if (!x.length) continue;
  const tt = touched(c);
  const fam = c === 'forme' ? 'forme' : 'temps';
  L.push(`| ${c} | ${x.length} | ${x.filter(anyHors).length} | ${tt.length ? `${tt.filter((t) => t.diag === 'hors de portée').length}/${tt.length}` : '—'} | ${tt.length ? `${tt.filter((t) => t.diag === 'hors de portée' && t.fam === fam).length}/${tt.length}` : '—'} | ${x.flatMap((r) => r.targets).filter((t) => t.diag === 'mal estimé').length}/${x.length * 3} |`);
}
// AUC : mesures touchées (forme + rupture) contre toutes les mesures des mondes compris
const pos = [...touched('forme'), ...touched('rupture')].map((t) => t.logE), neg = by('compris').flatMap((r) => r.targets.map((t) => t.logE));
let auc = 0; for (const p of pos) for (const n of neg) auc += p > n ? 1 : p === n ? 0.5 : 0; auc /= pos.length * neg.length || 1;
// GALILÉE
const g1 = by('forme').flatMap((r) => r.targets.filter((t) => t.galilee && t.touched).map((t) => ({ ...t.galilee, form: r.truth.form })));
const g2 = by('forme').flatMap((r) => r.targets.filter((t) => t.galileeMelange).map((t) => t.galileeMelange));
const g3 = by('compris').flatMap((r) => r.targets.filter((t) => t.galilee).map((t) => t.galilee));
const dr = g1.filter((g) => g.rmse0 != null).map((g) => g.rmse1 - g.rmse0);
const md = mean(dr), sdd = Math.sqrt(dr.reduce((s, x) => s + (x - md) ** 2, 0) / Math.max(1, dr.length - 1)), cid = 1.96 * sdd / Math.sqrt(dr.length || 1);
const orc = touched('forme').filter((t) => t.oracleLogE != null);
L.push(`\nPlafond oracle (forme) : la vraie formule en colonne libre dépasse le seuil de la sonde pour ${orc.filter((t) => t.oracleLogE >= Math.log(30)).length}/${orc.length} mesures touchées ; la sonde en déclare ${orc.filter((t) => t.diag === 'hors de portée').length}.`);
L.push(`\nAUC de la sonde (C4) : ${auc.toFixed(3)} (${pos.length} mesures touchées, ${neg.length} mesures de mondes compris)\n`);
L.push('## GALILÉE\n');
L.push(`| Essai | Appels | Formules acceptées sur C |\n|---|---:|---:|`);
L.push(`| G1 vraies formes (après sonde) | ${g1.length} | ${g1.filter((g) => g.accepted).length} |`);
L.push(`| G2 écarts mélangés (contamination) | ${g2.length} | ${g2.filter((g) => g.accepted).length} |`);
L.push(`| G3 mondes compris (appel forcé) | ${g3.length} | ${g3.filter((g) => g.accepted).length} |`);
L.push(`\nG1 — variation de l'erreur de prévision sur C avec la formule : ${md >= 0 ? '+' : ''}${md.toFixed(4)} ± ${cid.toFixed(4)}`);
L.push('\nFormules proposées (G1) : ' + g1.slice(0, 12).map((g) => `${g.form} → \`${g.text}\` ${g.accepted ? '✓' : '✗'}`).join(' · '));
// verdicts
const comp = by('compris'), c1 = comp.filter(anyHors).length, w1 = wilson(c1, comp.length);
const tF = touched('forme'), tR = touched('rupture');
const c2f = mean(tF.map((t) => +(t.diag === 'hors de portée'))), c2r = mean(tR.map((t) => +(t.diag === 'hors de portée')));
const fl = by('flou'), c3 = mean(fl.map((r) => +anyHors(r)));
const g1r = mean(g1.map((g) => +g.accepted)), g2r = mean(g2.map((g) => +g.accepted)), g3r = mean(g3.map((g) => +g.accepted));
const v = (ok) => (ok ? '✅' : '❌');
L.push('\n## Verdicts (critères de PROTOCOLE_P2.md)\n');
L.push(`- C1 compris, mondes avec fausse alarme ≤ 10 % (borne ≤ 15 %) : ${pct(c1 / comp.length)} (borne ${pct(w1[1])}) ${v(c1 / comp.length <= 0.1 && w1[1] <= 0.15)}`);
L.push(`- C2 forme ≥ 60 % : ${pct(c2f)} ${v(c2f >= 0.6)} · rupture ≥ 60 % : ${pct(c2r)} ${v(c2r >= 0.6)}`);
L.push(`- C3 flou, mondes avec « hors de portée » ≤ 15 % : ${pct(c3)} ${v(c3 <= 0.15)}`);
L.push(`- C4 AUC ≥ 0,80 : ${auc.toFixed(3)} ${v(auc >= 0.8)}`);
L.push(`- G1 formules acceptées ≥ 50 % et erreur en baisse : ${pct(g1r)}, ${md.toFixed(4)} ± ${cid.toFixed(4)} ${v(g1r >= 0.5 && md + cid < 0)}`);
L.push(`- G2 contamination ≤ 10 % : ${pct(g2r)} ${v(g2r <= 0.1)}`);
L.push(`- G3 compris ≤ 10 % : ${pct(g3r)} ${v(g3r <= 0.1)}`);
L.push(`- Abandon (C1 échoue ou AUC < 0,70) : ${c1 / comp.length <= 0.1 && w1[1] <= 0.15 && auc >= 0.7 ? 'non' : '**OUI**'}`);
L.push(`\nTemps moyen par monde : ${mean(R.map((r) => r.secs)).toFixed(1)} s`);
const txt = L.join('\n'); const mi = argv.indexOf('--md'); if (mi >= 0) writeFileSync(argv[mi + 1], txt + '\n'); console.log(txt);
