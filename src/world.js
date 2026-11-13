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

const sig = (x) => 1 / (1 + Math.exp(-x));

export function createWorld(seed = 1, scenario = defaultScenario(seed)) {
  const sc = structuredClone(scenario);
  // Nombres aléatoires communs : pré-tirés par jour, indépendants des actions.
  const nr = makeRng(seed * 104729 + 7);
  const noise = [], unif = [];
  for (let t = 0; t < 2000; t++) { noise.push(nr.normal()); unif.push(nr.next()); }
  // pics récurrents avec aléa de date : jours pré-tirés
  const jr = makeRng(seed * 7 + 99);
  for (const e of sc.events) if (e.type === 'pulse' && e.jitter && !e.days) {
    e.days = [];
    for (let d = e.phase; d < 2000; d += e.period) e.days.push(d + jr.int(-e.jitter, e.jitter));
  }
  let adState = 0; // stock publicitaire réel (mécanisme d'effet retard)

  const on = (e, t) => t >= (e.start ?? 0) && (e.end == null || t < e.end);
  const w = {
    seed, scenario: sc, t: 0,
    dow: (t) => t % 7,
    cost(t) { let c = sc.baseCost; for (const e of sc.events) if (e.type === 'cost' && t >= e.start) c = e.value; return c; },
    // log du taux de demande. steady=true : marketing supposé constant (régime permanent de l'effet retard)
    logRate(t, price, marketing, steady = false) {
      let beta = sc.beta, lvl = sc.alpha, dow = DOW_LOG[t % 7], mEff = marketing;
      const lp = Math.log(price / P_REF);
      for (const e of sc.events) {
        switch (e.type) {
          case 'level': if (on(e, t)) lvl += e.mag; break;
          case 'elasticity': if (on(e, t)) beta += e.mag; break;
          case 'dow': if (on(e, t)) dow += e.shift[t % 7]; break;
          case 'trend': if (t >= e.start) lvl += e.perDay * (Math.min(t, e.end ?? Infinity) - e.start); break;
          case 'logistic': lvl += e.mag * sig((t - e.mid) / e.width); break;
          case 'threshold': if (on(e, t)) lvl += e.soft ? e.mag * sig((price - e.theta) / e.soft) : price > e.theta ? e.mag : 0; break;
          case 'pulse': if (on(e, t) && (e.days ? e.days.includes(t) : (t - e.phase) % e.period === 0)) lvl += e.mag; break;
          case 'season': lvl += e.amp * Math.cos((2 * Math.PI * (t - e.peak)) / 365); break;
          case 'adstock': if (on(e, t) && !steady) mEff = (1 - e.lambda) * marketing + e.lambda * adState; break;
          default: break;
        }
      }
      return lvl + beta * lp + dow + sc.gamma * Math.log1p(mEff / 10);
    },
    noiseSd(t) { let s = sc.noise; for (const e of sc.events) if (e.type === 'variance' && on(e, t)) s *= e.factor; return s; },
    trueBeta(t) { let b = sc.beta; for (const e of sc.events) if (e.type === 'elasticity' && on(e, t)) b += e.mag; return b; },
    demand(t, price, marketing) {
      const lam = Math.exp(w.logRate(t, price, marketing) + w.noiseSd(t) * noise[t]);
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
      const ad = sc.events.find((e) => e.type === 'adstock' && on(e, t));
      adState = ad ? (1 - ad.lambda) * marketing + ad.lambda * adState : marketing;
      w.t++;
      return { t, dow: t % 7, price, marketing, order, cost, sales, censored: sales >= order, waste: order - sales, profit, _demand: D };
    },
    inject(e) { sc.events.push({ ...e }); },
    activeEvents(t) { return sc.events.filter((e) => on(e, t)); },
  };
  return w;
}
