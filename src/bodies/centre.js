// ACTIVITÉ INCONNUE (protocole n° 4) — centre d'appels avec file d'attente CACHÉE. Écrite APRÈS le gel de la v5 (commit A).
import { makeRng, poissonInv } from '../rng.js';
import { invKeys } from './_invkeys.js';

export function centreScenario(seed) {
  const r = makeRng(seed * 3301 + 11);
  const t0 = Math.round(r.uniform(110, 170));
  return {
    t0,
    events: [
      { outcome: 'appels', type: 'level', start: t0, label: 'Un client lance une campagne : +35 % d’appels', classe: 'représentable', expect: ['level'] },
      { outcome: 'traites', type: 'training', start: 0, label: 'La formation augmente la productivité, effet qui s’estompe (mémoire λ = 0,9)', classe: 'représentable', expect: ['memory:ema9:formation', 'memory:ema7:formation', 'adstock:formation'], structural: true, anyDate: true },
      { outcome: 'abandons', type: 'queue', start: 0, label: 'File d’attente cachée : accumulation amortie (λ = 0,9) des appels reçus − traités, qui multiplie les abandons (saturé)', classe: 'inventable (à une normalisation et une saturation près)', invTerms: ['appels', 'traites'], expect: [], structural: true, anyDate: true },
    ],
  };
}

export function centreBody(seed, sc = centreScenario(seed)) {
  const nr = makeRng(seed * 4423 + 7);
  const N = { a: [], c: [], u: [] };
  for (let t = 0; t < 400; t++) { N.a.push(nr.normal()); N.c.push(nr.normal()); N.u.push(nr.next()); }
  let T = 0, F = 0, z = 0;
  const DOW = [0.2, 0.1, 0.05, 0.05, 0, -0.5, -0.9];
  const appelsMu = (t) => Math.log(240) + DOW[t % 7] + (t >= sc.t0 ? Math.log(1.35) : 0);
  const capacity = (a, f = F) => a.agents * 38 * (1 + 0.6 * (0.1 * a.formation + 0.9 * f));
  const abandonsMu = (appels, zz = z) => Math.log(0.02 * appels + 0.5) + 0.03 * Math.min(80, Math.max(-20, zz));
  const reward = (a, o) => 9 * o.traites - 12 * o.abandons - 150 * a.agents - 400 * a.formation - 300;
  const body = {
    id: 'centre', label: 'Centre d’appels (inconnu)',
    levers: [
      { key: 'agents', label: 'agents', unit: '', kind: 'discrete', values: [4, 5, 6, 7, 8, 9, 10], init: 6, transform: 'log', ref: 6 },
      { key: 'formation', label: 'journée de formation', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin', ref: 0 },
    ],
    context: [],
    outcomes: [
      { key: 'appels', label: 'les appels reçus', plural: true, of: 'des appels reçus', inputs: ['agents', 'formation'], prior: { mean: Math.log(200), sd: 3 } },
      { key: 'traites', label: 'les appels traités', plural: true, of: 'des appels traités', inputs: ['agents', 'formation'], prior: { mean: Math.log(200), sd: 3 } },
      { key: 'abandons', label: 'les abandons', plural: true, of: 'des abandons', inputs: ['agents', 'formation'], prior: { mean: Math.log(5), sd: 3 } },
    ],
    reward,
    contextAt: () => ({}),
    step(a) {
      const t = T++;
      const appels = Math.max(0, Math.round(Math.exp(appelsMu(t) + 0.08 * N.a[t])));
      const traites = Math.min(appels, Math.round(capacity(a) * Math.exp(0.04 * N.c[t])));
      const abandons = poissonInv(Math.exp(abandonsMu(appels)), N.u[t]);
      F = 0.1 * a.formation + 0.9 * F;
      z = 0.9 * z + 0.1 * (appels - traites);
      const o = { appels, traites, abandons };
      return { outcomes: o, censored: { appels: false, traites: false, abandons: false }, reward: reward(a, o) };
    },
    habit: () => ({ agents: 7, formation: 0 }),
    truth: {
      mu: (k, t, a) => { const ap = Math.exp(appelsMu(t)); return k === 'appels' ? Math.log(ap) : k === 'traites' ? Math.log(Math.max(0.5, Math.min(ap, capacity(a)))) : abandonsMu(ap); },
      sd: (k) => (k === 'appels' ? 0.08 : k === 'traites' ? 0.05 : 0.3),
      events: () => sc.events.map((x) => ({ ...x })),
      // oracle non myope : formation tous les 3 jours (meilleur rythme sur la vraie dynamique, vérifié avant toute exécution du cerveau)
      oracleAdjust: (t, a) => ({ ...a, formation: t % 3 === 0 ? 1 : 0 }),
    },
    probes: [5, 8].flatMap((agents) => [0, 1].map((formation) => ({ agents, formation }))),
  };
  for (const e of sc.events) if (e.invTerms) e.expect = invKeys(body, e.invTerms);
  return body;
}
