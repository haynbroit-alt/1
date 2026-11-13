// Usage : node research/v6/p3-report.js research/v6/p3-dev.json [--md out.md]
import { readFileSync, writeFileSync } from 'node:fs';
const argv = process.argv.slice(2);
const R = JSON.parse(readFileSync(argv[0], 'utf8'));
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN);
const wilson = (x, n, z = 1.96) => { if (!n) return [NaN, NaN]; const p = x / n, d = 1 + z * z / n, c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d; return [c - h, c + h]; };
const pct = (x) => (Number.isFinite(x) ? `${(100 * x).toFixed(0)} %` : '—');
const forme = R.filter((r) => r.cls === 'forme'), comp = R.filter((r) => r.cls === 'compris');
// D1 : formes signalées par la sonde avec formule non constante
const d1 = forme.flatMap((r) => { const k = r.truth.target, key = `galilee:${k}`; const p = r.plans.passif?.[key]; if (!p || p.constant || !p.text) return []; const a = r.plans['actif-reel']?.[key], h = r.plans.habitude?.[key]; return [{ seed: r.seed, form: r.truth.form, text: p.text, passif: +p.accepted, actif: a ? +a.accepted : 0, habitude: h ? +h.accepted : 0 }]; });
const diff = d1.map((x) => x.actif - x.passif), md = mean(diff), sd = Math.sqrt(diff.reduce((s, x) => s + (x - md) ** 2, 0) / Math.max(1, diff.length - 1)), ci = 1.96 * sd / Math.sqrt(diff.length || 1);
// D2 : fausses confirmations sous plan actif
const fM = forme.flatMap((r) => Object.entries(r.plans['actif-melange'] ?? {}).filter(([, v]) => v && !v.constant).map(([, v]) => +v.accepted));
const fC = comp.flatMap((r) => Object.entries(r.plans['actif-reel'] ?? {}).filter(([k, v]) => k.startsWith('galilee:') && v && !v.constant).map(([, v]) => +v.accepted));
const fAll = [...fM, ...fC], w2 = wilson(fAll.reduce((s, x) => s + x, 0), fAll.length);
const fMp = forme.flatMap((r) => Object.entries(r.plans.passif ?? {}).filter(([k, v]) => k.startsWith('galileeMelange') && v && !v.constant).map(([, v]) => +v.accepted));
// D3 : budget
const B = R.flatMap((r) => Object.values(r.budget ?? {}));
// D4 : plafond oracle (vraie forme) par plan
const orc = (plan) => forme.map((r) => r.plans[plan]?.[`oracleC:${r.truth.target}`]).filter(Boolean).map((v) => +v.accepted);
const L = [`# Prototype P3 — ${R.length} mondes (${forme.length} forme, ${comp.length} compris), graines ${Math.min(...R.map((r) => r.seed))}–${Math.max(...R.map((r) => r.seed))}\n`];
L.push('## Confirmation des formes sur C selon le plan d’expériences\n');
L.push('| | Passif (blocs aléatoires) | Habitude (leviers fixes) | **Actif (D-optimal, budget égal)** |\n|---|---:|---:|---:|');
L.push(`| Formules de GALILÉE confirmées (D1, ${d1.length} formules) | ${pct(mean(d1.map((x) => x.passif)))} | ${pct(mean(d1.map((x) => x.habitude)))} | **${pct(mean(d1.map((x) => x.actif)))}** |`);
L.push(`| Plafond : la vraie forme jugée sur C (D4) | ${pct(mean(orc('passif')))} (${orc('passif').length}) | ${pct(mean(orc('habitude')))} | plan pour la formule de GALILÉE : ${pct(mean(orc('actif-reel')))} · plan pour la vraie forme : ${pct(mean(orc('actif-oracle')))} (${orc('actif-oracle').length}) |`);
L.push(`\nD1 apparié (actif − passif) : ${(100 * md).toFixed(0)} ± ${(100 * ci).toFixed(0)} points.`);
L.push(`\n## Fausses confirmations (D2)\n`);
L.push(`| | Passif | Actif |\n|---|---:|---:|\n| Formules apprises sur écarts mélangés | ${fMp.reduce((s, x) => s + x, 0)}/${fMp.length} | ${fM.reduce((s, x) => s + x, 0)}/${fM.length} |\n| Formules forcées, mondes compris | — | ${fC.reduce((s, x) => s + x, 0)}/${fC.length} |`);
const nConstM = forme.flatMap((r) => Object.entries(r.plans.passif ?? {}).filter(([k, v]) => k.startsWith('galileeMelange') && v && v.constant)).length;
const nConstC = comp.flatMap((r) => Object.entries(r.plans.passif ?? {}).filter(([k, v]) => k.startsWith('galilee:') && v && v.constant)).length;
L.push(`\nFormules constantes (non testables, donc jamais confirmées) : ${nConstM} sur écarts mélangés, ${nConstC} dans les mondes compris.`);
L.push(`\nBudget du plan actif (D3) : |u₀| moyen max ${Math.max(...B.map((b) => b.u0)).toFixed(2)} (≤ 0,5) · part u₁ max ${Math.max(...B.map((b) => b.u1)).toFixed(2)} (≤ 0,3)`);
L.push('\nFormules jugées (D1) : ' + d1.slice(0, 14).map((x) => `${x.form} → \`${x.text}\` P${x.passif ? '✓' : '✗'} A${x.actif ? '✓' : '✗'}`).join(' · '));
const v = (ok) => (ok ? '✅' : '❌');
const d1a = mean(d1.map((x) => x.actif)), d2 = fAll.reduce((s, x) => s + x, 0) / (fAll.length || 1);
L.push('\n## Verdicts (critères de PROTOCOLE_P3.md)\n');
L.push(`- D1 actif ≥ 50 % et > passif : ${pct(d1a)}, différence ${(100 * md).toFixed(0)} ± ${(100 * ci).toFixed(0)} ${v(d1a >= 0.5 && md - ci > 0)}`);
L.push(`- D2 fausses confirmations ≤ 10 % (borne ≤ 15 %) : ${pct(d2)} (borne ${pct(w2[1])}, ${fAll.length} formules) ${v(d2 <= 0.1 && w2[1] <= 0.15)}`);
L.push(`- D3 budget : ${v(B.every((b) => b.u0 <= 0.5 + 1e-9 && b.u1 <= 0.3 + 1e-9))}`);
L.push(`- Abandon (D2 échoue) : ${d2 <= 0.1 && w2[1] <= 0.15 ? 'non' : '**OUI**'}`);
L.push(`\nTemps moyen par monde : ${mean(R.map((r) => r.secs)).toFixed(1)} s`);
const txt = L.join('\n'); const mi = argv.indexOf('--md'); if (mi >= 0) writeFileSync(argv[mi + 1], txt + '\n'); console.log(txt);
