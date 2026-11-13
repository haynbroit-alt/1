// ACTIVITÉ INCONNUE (protocole n° 4) — location de vélos. Écrite APRÈS le gel de la v5 (commit A).
import { makeRng, poissonInv } from '../rng.js';
import { invKeys } from './_invkeys.js';

export function velosScenario(seed) {
  const r = makeRng(seed * 5153 + 17);
  const phase = Math.round(r.uniform(0, 365)), t2 = Math.round(r.uniform(140, 200));
  return {
    phase, t2,
    events: [
      { outcome: 'locations', type: 'season', start: 0, label: 'Cycle annuel de la demande (±35 %)', classe: 'représentable', expect: ['season'], structural: true, anyDate: true },
      { outcome: 'locations', type: 'threshold', start: t2, label: 'Un concurrent s’installe à 15 € : au-delà, −35 % de locations', classe: 'représentable', expect: ['threshold:prix'] },
      { outcome: 'locations', type: 'wom', start: 0, label: 'Bouche-à-oreille caché : mémoire très lente (λ = 0,97) des locations passées (flotte bornée à 120 vélos)', classe: 'inventable', invTerms: ['locations'], expect: [], structural: true, anyDate: true },
      { outcome: 'pannes', type: 'wear', start: 0, label: 'Les pannes augmentent avec les jours sans réparateur, avec saturation à 25 j', classe: 'approximable', expect: ['memory:since:reparateur'], structural: true, anyDate: true },
    ],
  };
}

export function velosBody(seed, sc = velosScenario(seed)) {
  const nr = makeRng(seed * 7717 + 3);
  const N = { l: [], u: [] };
  for (let t = 0; t < 400; t++) { N.l.push(nr.normal()); N.u.push(nr.next()); }
  const FLEET = 120;
  let T = 0, M = 70, since = 0;
  const DOW = [-0.25, -0.2, -0.15, -0.1, 0.05, 0.4, 0.3];
  const locMu = (t, a, m = M) => Math.log(70) + DOW[t % 7] + 0.35 * Math.sin(2 * Math.PI * (t - sc.phase) / 365) - 1.2 * Math.log(a.prix / 12) + (t >= sc.t2 && a.prix > 15 ? Math.log(0.65) : 0) + 0.25 * (m / 70 - 1);
  const pannesMu = (a, loc, s = since) => Math.log(0.6) + 0.07 * Math.min(25, a.reparateur ? 0 : s + 1) + 0.8 * Math.log(Math.max(1, loc) / 70);
  const reward = (a, o) => (a.prix - 3) * o.locations - 35 * o.pannes - 180 * a.reparateur - 350;
  // oracle non myope pour la réparation : intervalle de réparation qui minimise le coût moyen attendu (calculé sur la vraie dynamique)
  const cost = (k) => { let c = 0; for (let d = 1; d <= k; d++) c += 35 * Math.exp(Math.log(0.6) + 0.07 * Math.min(25, d % k === 0 ? 0 : d)); return (c + 180) / k; };
  let bestK = 1; for (let k = 1; k <= 60; k++) if (cost(k) < cost(bestK)) bestK = k;
  const body = {
    id: 'velos', label: 'Location de vélos (inconnue)',
    levers: [
      { key: 'prix', label: 'prix de la journée', unit: '€', kind: 'continuous', min: 8, max: 20, step: 1, init: 12, transform: 'log', ref: 12, sign: -1 },
      { key: 'reparateur', label: 'passage du réparateur', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin', ref: 0 },
    ],
    context: [],
    outcomes: [
      { key: 'locations', label: 'les locations', plural: true, of: 'des locations', inputs: ['prix', 'reparateur'], prior: { mean: Math.log(60), sd: 3 }, priors: { prix: { mean: -1, sd: 1 } }, cap: () => FLEET },
      { key: 'pannes', label: 'les pannes', plural: true, of: 'des pannes', inputs: ['prix', 'reparateur'], prior: { mean: Math.log(1), sd: 3 } },
    ],
    reward,
    contextAt: () => ({}),
    step(a) {
      const t = T++;
      const D = Math.max(0, Math.round(Math.exp(locMu(t, a) + 0.1 * N.l[t])));
      const locations = Math.min(D, FLEET);
      const pannes = poissonInv(Math.exp(pannesMu(a, locations)), N.u[t]);
      since = a.reparateur ? 0 : since + 1;
      M = 0.97 * M + 0.03 * locations;
      const o = { locations, pannes };
      return { outcomes: o, censored: { locations: D >= FLEET, pannes: false }, reward: reward(a, o) };
    },
    habit: (t) => ({ prix: 12, reparateur: t % 7 === 0 ? 1 : 0 }),
    truth: {
      mu: (k, t, a) => { const l = locMu(t, a); return k === 'locations' ? l : pannesMu(a, Math.min(FLEET, Math.exp(l))); },
      sd: (k) => (k === 'locations' ? 0.1 : 0.3),
      events: () => sc.events.map((x) => ({ ...x })),
      // oracle non myope : prix « patient » (bouche-à-oreille à l'équilibre de ce prix, moyenne de la semaine) et réparation à intervalle optimal
      oracleAdjust: (t, a) => {
        let best = null;
        for (let prix = 8; prix <= 20; prix++) {
          const aa = { prix, reparateur: 0 }; let m = M;
          for (let it = 0; it < 60; it++) { let s = 0; for (let d = 0; d < 7; d++) s += Math.min(FLEET, Math.exp(locMu(t + d, aa, m))); m = s / 7; }
          const v = (prix - 3) * Math.min(FLEET, Math.exp(locMu(t, aa, m)));
          if (!best || v > best.v) best = { v, prix };
        }
        return { prix: best.prix, reparateur: t % bestK === bestK - 1 ? 1 : 0 };
      },
    },
    probes: [10, 16].flatMap((prix) => [0, 1].map((reparateur) => ({ prix, reparateur }))),
  };
  for (const e of sc.events) if (e.invTerms) e.expect = invKeys(body, e.invTerms);
  return body;
}
