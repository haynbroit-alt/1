// Économie de la décision : newsvendor sous demande log-normale, optimisation prix × marketing.
import { normInv, normalNodes } from './rng.js';
import { PRICE_MIN, PRICE_MAX, MARKETING_LEVELS, FIXED_COST } from './world.js';

export const NODES = normalNodes(32);
export const PRICE_GRID = (() => { const g = []; for (let p = PRICE_MIN; p <= PRICE_MAX + 1e-9; p += 0.1) g.push(Math.round(p * 100) / 100); return g; })();

// Quantité optimale (newsvendor) : quantile (p-c)/p de la demande, décalé de `delta` (compétence apprise).
export function newsvendorQ(mu, s, price, cost, delta = 0) {
  if (price <= cost) return 0;
  const cr = (price - cost) / price;
  return Math.max(0, Math.round(Math.exp(mu + s * (normInv(cr) + delta))));
}

// Profit espéré d'une action sous une demande log-normale(mu, s).
export function expectedProfit(mu, s, price, marketing, cost, q) {
  let sales = 0;
  for (let i = 0; i < NODES.length; i++) sales += Math.min(Math.exp(mu + s * NODES[i]), q);
  sales /= NODES.length;
  return { profit: price * sales - cost * q - marketing - FIXED_COST, sales, q };
}

// Optimise (prix, marketing) ; predict(price, marketing) → {mu, s}.
// constraint(price, marketing) → bool (règles apprises / pas maximal).
export function optimize(predict, cost, delta = 0, constraint = () => true) {
  let best = null;
  for (const m of MARKETING_LEVELS) {
    for (const p of PRICE_GRID) {
      if (!constraint(p, m)) continue;
      const { mu, s } = predict(p, m);
      const q = newsvendorQ(mu, s, p, cost, delta);
      const ev = expectedProfit(mu, s, p, m, cost, q);
      if (!best || ev.profit > best.profit) best = { price: p, marketing: m, order: q, profit: ev.profit, sales: ev.sales };
    }
  }
  return best;
}
