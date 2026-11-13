// Le monde caché : une boulangerie (produit périssable, invendus perdus chaque soir).
// L'agent ne voit QUE : jour, coût unitaire du jour, ses propres actions, et ses ventes
// (plafonnées par son stock → demande censurée). Tout le reste est caché.
import { makeRng, poissonInv } from './rng.js';
import { P_REF } from './model.js';

export const DOW_LOG = [0.85, 0.9, 0.95, 1.0, 1.15, 1.35, 1.1].map(Math.log);
export const PRICE_MIN = 1.5, PRICE_MAX = 6.0;
export const MARKETING_LEVELS = [0, 20, 50, 100];
export const FIXED_COST = 150;
export const HORIZON = 365;

export function defaultScenario(seed) {
  const r = makeRng(seed * 7919 + 13);
  const comp = Math.round(r.uniform(85, 120));
  const cost = Math.round(r.uniform(140, 170));
  const elas = Math.round(r.uniform(190, 225));
  const viral = Math.round(r.uniform(255, 285));
  return {
    alpha: Math.log(r.uniform(110, 135)),
    beta: r.uniform(-1.95, -1.6),
    gamma: r.uniform(0.12, 0.2),
    noise: 0.12,
    baseCost: 1.2,
    events: [
      { type: 'level', start: comp, end: null, mag: Math.log(r.uniform(0.7, 0.8)), label: 'Un concurrent ouvre en face' },
      { type: 'cost', start: cost, value: r.uniform(1.6, 1.8), label: 'Le prix de la farine flambe' },
      { type: 'elasticity', start: elas, mag: r.uniform(-0.9, -0.6), label: 'Les clients deviennent plus sensibles au prix' },
      { type: 'level', start: viral, end: viral + Math.round(r.uniform(22, 35)), mag: Math.log(r.uniform(1.4, 1.65)), label: 'Une vidéo virale attire du monde' },
    ],
  };
}

export function createWorld(seed = 1, scenario = defaultScenario(seed)) {
  const sc = structuredClone(scenario);
  // Nombres aléatoires communs : pré-tirés par jour, indépendants des actions.
  const nr = makeRng(seed * 104729 + 7);
  const noise = [], unif = [];
  for (let t = 0; t < 2000; t++) { noise.push(nr.normal()); unif.push(nr.next()); }

  const w = {
    seed, scenario: sc, t: 0,
    dow: (t) => t % 7,
    cost(t) { let c = sc.baseCost; for (const e of sc.events) if (e.type === 'cost' && t >= e.start) c = e.value; return c; },
    logRate(t, price, marketing) {
      let beta = sc.beta, lvl = sc.alpha;
      for (const e of sc.events) {
        const on = t >= e.start && (e.end == null || t < e.end);
        if (!on) continue;
        if (e.type === 'level') lvl += e.mag;
        if (e.type === 'elasticity') beta += e.mag;
      }
      return lvl + beta * Math.log(price / P_REF) + DOW_LOG[t % 7] + sc.gamma * Math.log1p(marketing / 10);
    },
    trueBeta(t) { let b = sc.beta; for (const e of sc.events) if (e.type === 'elasticity' && t >= e.start) b += e.mag; return b; },
    demand(t, price, marketing) {
      const lam = Math.exp(w.logRate(t, price, marketing) + sc.noise * noise[t]);
      return poissonInv(lam, unif[t]);
    },
    // Exécute une journée. action = {price, marketing, order}
    step(action) {
      const t = w.t;
      const price = Math.min(PRICE_MAX, Math.max(PRICE_MIN, action.price));
      const marketing = action.marketing;
      const order = Math.max(0, Math.round(action.order));
      const cost = w.cost(t);
      const D = w.demand(t, price, marketing);
      const sales = Math.min(D, order);
      const profit = price * sales - cost * order - marketing - FIXED_COST;
      w.t++;
      return { t, dow: t % 7, price, marketing, order, cost, sales, censored: sales >= order, waste: order - sales, profit, _demand: D };
    },
    inject(e) { sc.events.push({ ...e }); },
    activeEvents(t) { return sc.events.filter((e) => t >= e.start && (e.end == null || t < e.end)); },
  };
  return w;
}
