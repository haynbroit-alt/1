// CORPS « commerce » : enveloppe les mondes de boulangerie/glacier/marché/fleuriste/kiosque (src/envs.js).
// Ce fichier DÉCLARE l'entreprise ; il ne contient aucune intelligence.
import { createWorld } from '../world.js';
import { ENVS } from '../envs.js';

const MAP = { elasticity: 'slope:price', marketing: 'slope:marketing', threshold: 'threshold:price', curvature: 'curvature:price', adstock: 'adstock:marketing' };

export function commerceBody(env, seed) {
  const world = createWorld(seed, ENVS[env].make(seed));
  const hist = [];
  return {
    id: `commerce:${env}`, label: ENVS[env].label,
    levers: [
      { key: 'price', label: 'prix', unit: '€', kind: 'continuous', min: 1.5, max: 6, step: 0.1, init: 4, transform: 'log', ref: 4, sign: -1 },
      { key: 'marketing', label: 'marketing', unit: '€/j', kind: 'discrete', values: [0, 20, 50, 100], init: 0, transform: 'log1p', scale: 10 },
      { key: 'order', label: 'commande', unit: 'u.', kind: 'capacity', for: 'sales', init: 120, min: 0, step: 1 },
    ],
    context: [{ key: 'cost', label: 'coût unitaire', unit: '€', transform: 'lin', ref: 1.2 }],
    outcomes: [{ key: 'sales', label: 'les ventes', plural: true, of: 'des ventes', inputs: ['price', 'marketing'], prior: { mean: Math.log(100), sd: 2 }, priors: { price: { mean: -1, sd: 1 }, marketing: { mean: 0.05, sd: 0.5 } }, cap: (a) => a.order }],
    reward: (a, o, ctx) => a.price * o.sales - ctx.cost * a.order - a.marketing - 150,
    contextAt: (t) => ({ cost: world.cost(t) }),
    step(a) {
      const r = world.step(a);
      hist.push(r.sales);
      return { outcomes: { sales: r.sales }, censored: { sales: r.censored }, reward: r.profit };
    },
    habit() { const h = hist.slice(-7); return { price: 4, marketing: 0, order: Math.round((h.length ? h.reduce((s, x) => s + x, 0) / h.length : 120) * 1.1) }; },
    truth: {
      mu: (k, t, a, steady = false) => world.logRate(t, a.price, a.marketing, steady),
      sd: (k, t) => world.noiseSd(t),
      events: () => world.scenario.events.filter((e) => e.expect).map((e) => ({ outcome: 'sales', type: e.type, start: e.start ?? 0, mid: e.mid, width: e.width, period: e.period, structural: !!e.structural, label: e.label, expect: e.expect.map((x) => MAP[x] ?? x) })),
    },
    probes: [2.5, 3.5, 4.5, 5.5].flatMap((price) => [0, 50].map((marketing) => ({ price, marketing }))),
    world,
  };
}
