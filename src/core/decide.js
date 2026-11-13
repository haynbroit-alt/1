// CERVEAU GÉNÉRIQUE — décision : maximiser l'espérance de la comptabilité DÉCLARÉE par le corps,
// par simulation des mesures sous leurs prédictives. Aucune formule propre à un métier.
import { normalNodes, normInv } from '../rng.js';

const NODES = normalNodes(16);
const PERM = [0, 1, 2, 3].map((k) => Array.from(NODES, (_, i) => NODES[(i * (2 * k + 5) + k * 7) % NODES.length]));
export const CAP_Q = [0.35, 0.5, 0.6, 0.7, 0.8, 0.9];

export const leverGrid = (lv) => {
  if (lv.kind === 'discrete') return lv.values;
  const g = []; for (let v = lv.min; v <= lv.max + 1e-9; v += lv.step) g.push(Math.round(v * 1e6) / 1e6); return g;
};

// preds : { outcomeKey: (action) => {mu, s} } ; capOf(outcome, action) → plafond physique ou Infinity
export function expectedReward(body, a, preds, ctx, psIn = null) {
  const outs = body.outcomes;
  const ps = psIn ?? outs.map((o) => preds[o.key](a));
  const caps = outs.map((o) => (o.cap ? o.cap(a) : Infinity));
  let s = 0;
  const o = {};
  for (let i = 0; i < NODES.length; i++) {
    for (let k = 0; k < outs.length; k++) o[outs[k].key] = Math.min(caps[k], Math.exp(ps[k].mu + ps[k].s * PERM[k % 4][i]));
    s += body.reward(a, o, ctx);
  }
  return s / NODES.length;
}

// Choisit les leviers « capacité » (stock, préparation, production) par quantiles de la mesure plafonnée.
export function withCapacity(body, a, preds, ctx, shift = 0) {
  const capLv = body.levers.filter((l) => l.kind === 'capacity');
  if (!capLv.length) return { action: a, value: expectedReward(body, a, preds, ctx) };
  let cur = { ...a };
  // les leviers de capacité ne changent pas les prédictions (ils ne font que plafonner) : on les calcule une fois
  const ps = body.outcomes.map((o) => preds[o.key](a));
  const pk = Object.fromEntries(body.outcomes.map((o, i) => [o.key, ps[i]]));
  for (const lv of capLv) {
    const p = pk[lv.for];
    let best = null;
    for (const q0 of CAP_Q) {
      const q = Math.min(0.97, q0 + shift);
      const v = Math.max(lv.min ?? 0, Math.min(lv.max ?? Infinity, Math.round(Math.exp(p.mu + p.s * normInv(q)) / (lv.step ?? 1)) * (lv.step ?? 1)));
      const cand = { ...cur, [lv.key]: v };
      const val = expectedReward(body, cand, preds, ctx, ps);
      if (!best || val > best.value) best = { action: cand, value: val };
    }
    cur = best.action;
  }
  return { action: cur, value: expectedReward(body, cur, preds, ctx, ps) };
}

// Optimisation des leviers non-capacité : grille complète si petite, sinon montée coordonnée.
export function optimizeAction(body, preds, ctx, { constraint = () => true, start = null, shift = 0 } = {}) {
  const lvs = body.levers.filter((l) => l.kind !== 'capacity');
  const grids = lvs.map((l) => leverGrid(l));
  const size = grids.reduce((p, g) => p * g.length, 1);
  let best = null;
  const tryA = (a) => {
    if (!constraint(a)) return;
    const r = withCapacity(body, a, preds, ctx, shift);
    if (!best || r.value > best.value) best = r;
  };
  if (size <= 400) {
    const rec = (i, a) => { if (i === lvs.length) return tryA({ ...a }); for (const v of grids[i]) { a[lvs[i].key] = v; rec(i + 1, a); } };
    rec(0, {});
  } else {
    let cur = start ? { ...start } : Object.fromEntries(lvs.map((l) => [l.key, l.init]));
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < lvs.length; i++) for (const v of grids[i]) tryA({ ...cur, [lvs[i].key]: v }), best && (cur = { ...best.action });
  }
  if (!best) { const a = start ?? Object.fromEntries(lvs.map((l) => [l.key, l.init])); return withCapacity(body, a, preds, ctx, shift); }
  return best;
}
