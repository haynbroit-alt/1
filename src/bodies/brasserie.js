// ACTIVITÉ INCONNUE (protocole n° 4) — brasserie artisanale avec salle de dégustation. Écrite APRÈS le gel de la v5 (commit A).
import { makeRng, poissonInv } from '../rng.js';
import { invKeys } from './_invkeys.js';

export function brasserieScenario(seed) {
  const r = makeRng(seed * 2711 + 5);
  const t1 = Math.round(r.uniform(160, 210));
  const reg = [], switches = []; let s = r.next() < 0.5 ? 1 : -1;
  for (let t = 0; t < 400; t++) { if (t > 0 && r.next() < 1 / 45) { s = -s; switches.push(t); } reg.push(s); }
  return {
    reg, t1,
    events: [
      { outcome: 'pintes', type: 'slope', start: t1, label: 'Les clients deviennent plus sensibles au prix (élasticité −1,4 → −2,2)', classe: 'représentable', expect: ['slope:prix'] },
      { outcome: 'pintes', type: 'carry', start: 0, label: 'Une dégustation attire encore du monde les jours suivants (mémoire λ = 0,7)', classe: 'représentable', expect: ['adstock:degustation', 'memory:ema7:degustation', 'memory:ema9:degustation'], structural: true, anyDate: true },
      { outcome: 'pintes', type: 'reputation', start: 0, label: 'Réputation cachée : mémoire lente (λ = 0,9) des plaintes, qui fait fuir les clients', classe: 'inventable', invTerms: ['plaintes'], expect: [], structural: true, anyDate: true },
      { outcome: 'pintes', type: 'regime', start: 0, label: 'Régime caché à deux états (±22 %), bascules aléatoires (≈ 1 tous les 45 j)', classe: 'hors de portée', expect: [], structural: true, outOfReach: true, switches },
    ],
  };
}

export function brasserieBody(seed, sc = brasserieScenario(seed)) {
  const nr = makeRng(seed * 6007 + 29);
  const N = { p: [], u: [] };
  for (let t = 0; t < 400; t++) { N.p.push(nr.normal()); N.u.push(nr.next()); }
  let T = 0, rep = 3, carry = 0;
  const DOW = [-0.35, -0.3, -0.1, 0.05, 0.4, 0.55, 0.1];
  const pintesMu = (t, a, R = rep, C = carry) => Math.log(170) + DOW[t % 7] + (t >= sc.t1 ? -2.2 : -1.4) * Math.log(a.prix / 6) + 0.5 * (0.3 * a.degustation + 0.7 * C) - 0.12 * (R - 3) + 0.22 * sc.reg[t];
  const plaintesMu = (a, pintes) => Math.log(Math.max(0.3, 0.02 * pintes)) + 1.2 * Math.log(Math.max(1, pintes) / (55 * a.serveurs));
  const reward = (a, o) => (a.prix - 1.6) * o.pintes - 120 * a.serveurs - 250 * a.degustation - 15 * o.plaintes - 200;
  const body = {
    id: 'brasserie', label: 'Brasserie artisanale (inconnue)',
    levers: [
      { key: 'prix', label: 'prix de la pinte', unit: '€', kind: 'continuous', min: 4, max: 9, step: 0.5, init: 6, transform: 'log', ref: 6, sign: -1 },
      { key: 'serveurs', label: 'serveurs', unit: '', kind: 'discrete', values: [2, 3, 4, 5], init: 3, transform: 'log', ref: 3 },
      { key: 'degustation', label: 'soirée dégustation', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin', ref: 0 },
    ],
    context: [],
    outcomes: [
      { key: 'pintes', label: 'les pintes vendues', plural: true, of: 'des pintes vendues', inputs: ['prix', 'serveurs', 'degustation'], prior: { mean: Math.log(150), sd: 3 }, priors: { prix: { mean: -1, sd: 1 } } },
      { key: 'plaintes', label: 'les plaintes', plural: true, of: 'des plaintes', inputs: ['prix', 'serveurs', 'degustation'], prior: { mean: Math.log(3), sd: 3 } },
    ],
    reward,
    contextAt: () => ({}),
    step(a) {
      const t = T++;
      const pintes = Math.max(0, Math.round(Math.exp(pintesMu(t, a) + 0.1 * N.p[t])));
      const plaintes = poissonInv(Math.exp(plaintesMu(a, pintes)), N.u[t]);
      carry = 0.3 * a.degustation + 0.7 * carry;
      rep = 0.9 * rep + 0.1 * plaintes;
      const o = { pintes, plaintes };
      return { outcomes: o, censored: { pintes: false, plaintes: false }, reward: reward(a, o) };
    },
    habit: () => ({ prix: 6, serveurs: 3, degustation: 0 }),
    truth: {
      mu: (k, t, a) => { const p = pintesMu(t, a); return k === 'pintes' ? p : plaintesMu(a, Math.exp(p)); },
      sd: (k) => (k === 'pintes' ? 0.1 : 0.3),
      events: () => sc.events.map((x) => ({ ...x })),
    },
    probes: [5, 7].flatMap((prix) => [2, 4].flatMap((serveurs) => [0, 1].map((degustation) => ({ prix, serveurs, degustation })))),
  };
  for (const e of sc.events) if (e.invTerms) e.expect = invKeys(body, e.invTerms);
  return body;
}
