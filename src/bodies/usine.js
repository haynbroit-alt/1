// CORPS « usine » — écrit APRÈS le gel du cerveau (protocole n° 2). Aucune notion de prix ni de demande :
// une ligne de production, ses pièces conformes et ses rebuts. Déclaration + monde caché uniquement.
import { makeRng, poissonInv } from '../rng.js';

const DOW = [0.02, 0, 0, 0, -0.03, -0.1, -0.15];
export function usineScenario(seed) {
  const r = makeRng(seed * 211 + 9);
  const brk = Math.round(r.uniform(140, 170));
  return {
    events: [
      { outcome: 'rebuts', type: 'level', start: Math.round(r.uniform(90, 130)), mag: Math.log(r.uniform(1.35, 1.55)), label: 'Nouveau fournisseur de matière : plus de rebuts', expect: ['level'] },
      { outcome: 'pieces', type: 'level', start: brk, end: brk + 10, mag: Math.log(r.uniform(0.6, 0.7)), label: 'Panne d’une presse (10 jours)', expect: ['level'] },
      { outcome: 'rebuts', type: 'slope', start: Math.round(r.uniform(190, 230)), mag: -r.uniform(0.9, 1.3), label: 'Formation des opérateurs : la cadence abîme moins', expect: ['slope:cadence'] },
      { outcome: 'pieces', type: 'dow', start: Math.round(r.uniform(240, 280)), shift: [0, 0, 0, 0, -0.25, 0, 0], label: 'Nouvelle équipe de nuit le vendredi', expect: ['dow'] },
      { outcome: 'pieces', type: 'wear', start: 0, label: 'Usure : sans maintenance, la disponibilité baisse jour après jour', expect: ['adstock:maintenance', 'trend', 'slope:maintenance'], structural: true },
    ],
  };
}

export function usineBody(seed, sc = usineScenario(seed)) {
  const nr = makeRng(seed * 4241 + 3);
  const N = { p: [], d: [], u1: [], u2: [], e: [] };
  for (let t = 0; t < 400; t++) { N.p.push(nr.normal()); N.d.push(nr.normal()); N.u1.push(nr.next()); N.u2.push(nr.next()); N.e.push(nr.normal()); }
  let e = 0.15; const energy = [];
  for (let t = 0; t < 400; t++) { e = Math.max(0.06, e + 0.006 * N.e[t] + 0.02 * (0.15 - e)); energy.push(Math.round(e * 1000) / 1000); }
  const on = (ev, t) => t >= ev.start && (ev.end == null || t < ev.end);
  let T = 0, sinceMaint = 0;
  const mu = (k, t, a, wearDays) => {
    const lc = Math.log(a.cadence / 100);
    if (k === 'pieces') {
      let v = Math.log(780) + 0.95 * lc + Math.log(1 + a.heuresSup / 8) - 0.15 * a.maintenance - 0.004 * wearDays + DOW[t % 7];
      for (const ev of sc.events) if (ev.outcome === 'pieces' && on(ev, t)) { if (ev.type === 'level') v += ev.mag; if (ev.type === 'dow') v += ev.shift[t % 7]; }
      return v;
    }
    let v = Math.log(22) + 2.2 * lc + 0.08 * Math.log(1 + a.heuresSup / 8) + 0.002 * wearDays;
    for (const ev of sc.events) if (ev.outcome === 'rebuts' && on(ev, t)) { if (ev.type === 'level') v += ev.mag; if (ev.type === 'slope') v += ev.mag * lc; }
    return v;
  };
  const reward = (a, o, ctx) => 9 * o.pieces - 3 * o.rebuts - ctx.energie * 0.8 * a.cadence * (8 + a.heuresSup) - 6 * 38 * a.heuresSup - 900 * a.maintenance - 4000;
  return {
    id: 'usine', label: 'Usine (écrite après le gel)',
    levers: [
      { key: 'cadence', label: 'cadence', unit: 'pièces/h', kind: 'continuous', min: 60, max: 140, step: 5, init: 100, transform: 'log', ref: 100, sign: 1 },
      { key: 'heuresSup', label: 'heures supplémentaires', unit: 'h', kind: 'discrete', values: [0, 2, 4], init: 0, transform: 'lin', ref: 0, scale: 2 },
      { key: 'maintenance', label: 'maintenance préventive', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin' },
    ],
    context: [{ key: 'energie', label: 'prix de l’énergie', unit: '€/kWh', transform: 'lin', ref: 0.15, scale: 0.05 }],
    outcomes: [
      { key: 'pieces', label: 'les pièces conformes', plural: true, of: 'des pièces conformes', inputs: ['cadence', 'heuresSup', 'maintenance'], prior: { mean: Math.log(500), sd: 3 }, priors: { cadence: { mean: 1, sd: 1 } } },
      { key: 'rebuts', label: 'les rebuts', plural: true, of: 'des rebuts', inputs: ['cadence', 'heuresSup', 'maintenance'], prior: { mean: Math.log(20), sd: 3 } },
    ],
    reward,
    contextAt: (t) => ({ energie: energy[t] }),
    step(a) {
      const t = T++;
      const pieces = poissonInv(Math.exp(mu('pieces', t, a, sinceMaint) + 0.06 * N.p[t]), N.u1[t]);
      const rebuts = poissonInv(Math.exp(mu('rebuts', t, a, sinceMaint) + 0.12 * N.d[t]), N.u2[t]);
      sinceMaint = a.maintenance ? 0 : sinceMaint + 1;
      const o = { pieces, rebuts };
      return { outcomes: o, censored: { pieces: false, rebuts: false }, reward: reward(a, o, { energie: energy[t] }) };
    },
    habit: (t) => ({ cadence: 100, heuresSup: 0, maintenance: t % 14 === 0 ? 1 : 0 }),
    truth: {
      mu: (k, t, a) => mu(k, t, a, sinceMaint), sd: (k) => (k === 'pieces' ? 0.06 : 0.12), events: () => sc.events.map((x) => ({ ...x })),
      // l'oracle « jour par jour » ne voit pas l'usure future : il suit en plus le calendrier de maintenance
      // optimal déduit de la vraie usure (coût d'arrêt ≈ 1 950 €, usure ≈ 28 €/jour² → tous les ~12 jours)
      oracleAdjust: (t, a) => ({ ...a, maintenance: t % 12 === 11 ? 1 : 0 }),
    },
    probes: [70, 90, 110, 130].flatMap((cadence) => [0, 2].map((heuresSup) => ({ cadence, heuresSup, maintenance: 0 }))),
  };
}
