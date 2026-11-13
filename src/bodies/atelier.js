// ACTIVITÉ INCONNUE n° 3 — atelier de réparation avec file d'attente CACHÉE. Écrite APRÈS le gel de la v4 (commit a7d0da6).
import { makeRng, poissonInv } from '../rng.js';

export function atelierScenario(seed) {
  const r = makeRng(seed * 1409 + 3);
  return {
    events: [
      { outcome: 'demandes', type: 'level', start: Math.round(r.uniform(150, 190)), mag: Math.log(r.uniform(0.65, 0.75)), label: 'Un concurrent ouvre : moins de demandes', classe: 'représentable', expect: ['level'] },
      { outcome: 'retours', type: 'fatigue', start: 0, label: 'Fatigue : les heures supplémentaires des jours précédents multiplient les retours (mémoire λ = 0,7)', classe: 'représentable', expect: ['memory:ema7:heuresSup'], structural: true, anyDate: true },
      { outcome: 'reparations', type: 'backlog', start: 0, label: 'File d’attente cachée : les réparations du jour dépendent du stock de pannes en attente', classe: 'hors de portée', expect: ['memory:lag:reparations', 'memory:lag:demandes'], structural: true, anyDate: true },
      { outcome: 'demandes', type: 'waiting', start: 0, label: 'Les clients fuient quand l’attente s’allonge (attente cachée)', classe: 'hors de portée', expect: ['memory:lag:reparations', 'memory:lag:demandes'], structural: true, anyDate: true },
    ],
  };
}

export function atelierBody(seed, sc = atelierScenario(seed)) {
  const nr = makeRng(seed * 8807 + 13);
  const N = { d: [], u1: [], u2: [], r: [] };
  for (let t = 0; t < 400; t++) { N.d.push(nr.normal()); N.u1.push(nr.next()); N.u2.push(nr.next()); N.r.push(nr.normal()); }
  const lvl = sc.events.find((e) => e.type === 'level');
  let T = 0, backlog = 20, emaHS = 0;
  const DOW = [0.35, 0.1, 0, 0, -0.05, -0.4, -0.9];
  const capacity = (a) => a.techniciens * (8 + a.heuresSup) * 0.55;
  const demandMu = (t, a, b = backlog) => Math.log(22) + DOW[t % 7] - 1.1 * Math.log(a.tarif / 60) - 0.015 * Math.max(0, b - 15) + (t >= lvl.start ? lvl.mag : 0);
  const retoursMu = (a, rep, ehs = emaHS) => Math.log(Math.max(0.5, 0.06 * rep)) + 0.45 * (0.3 * a.heuresSup + 0.7 * ehs) / 2;
  const reward = (a, o) => 1.5 * a.tarif * o.reparations - 160 * a.techniciens - 30 * a.heuresSup * a.techniciens - 80 * o.retours - 300;
  return {
    id: 'atelier', label: 'Atelier de réparation (inconnu)',
    levers: [
      { key: 'techniciens', label: 'techniciens', unit: '', kind: 'discrete', values: [2, 3, 4, 5, 6], init: 4, transform: 'log', ref: 4 },
      { key: 'heuresSup', label: 'heures supplémentaires', unit: 'h', kind: 'discrete', values: [0, 2, 4], init: 0, transform: 'lin', ref: 0, scale: 2 },
      { key: 'tarif', label: 'tarif horaire', unit: '€', kind: 'continuous', min: 40, max: 90, step: 5, init: 60, transform: 'log', ref: 60, sign: -1 },
    ],
    context: [],
    outcomes: [
      { key: 'demandes', label: 'les nouvelles demandes', plural: true, of: 'des nouvelles demandes', inputs: ['techniciens', 'heuresSup', 'tarif'], prior: { mean: Math.log(20), sd: 3 }, priors: { tarif: { mean: -1, sd: 1 } } },
      { key: 'reparations', label: 'les réparations terminées', plural: true, of: 'des réparations terminées', inputs: ['techniciens', 'heuresSup', 'tarif'], prior: { mean: Math.log(20), sd: 3 } },
      { key: 'retours', label: 'les retours clients', plural: true, of: 'des retours clients', inputs: ['techniciens', 'heuresSup', 'tarif'], prior: { mean: Math.log(2), sd: 3 } },
    ],
    reward,
    contextAt: () => ({}),
    step(a) {
      const t = T++;
      const demandes = poissonInv(Math.exp(demandMu(t, a) + 0.12 * N.d[t]), N.u1[t]);
      const reparations = Math.min(backlog + demandes, Math.round(capacity(a) * Math.exp(0.05 * N.r[t])));
      const retours = poissonInv(Math.exp(retoursMu(a, reparations)), N.u2[t]);
      backlog = backlog + demandes - reparations;
      emaHS = 0.3 * a.heuresSup + 0.7 * emaHS;
      const o = { demandes, reparations, retours };
      return { outcomes: o, censored: { demandes: false, reparations: false, retours: false }, reward: reward(a, o) };
    },
    habit: () => ({ techniciens: 4, heuresSup: 0, tarif: 60 }),
    truth: {
      mu: (k, t, a) => { const d = Math.exp(demandMu(t, a)); const rep = Math.min(backlog + d, capacity(a)); return k === 'demandes' ? Math.log(d) : k === 'reparations' ? Math.log(Math.max(0.5, rep)) : retoursMu(a, rep); },
      sd: (k) => (k === 'demandes' ? 0.12 : 0.1), events: () => sc.events.map((x) => ({ ...x })),
    },
    probes: [3, 5].flatMap((techniciens) => [0, 2].flatMap((heuresSup) => [50, 70].map((tarif) => ({ techniciens, heuresSup, tarif })))),
  };
}
