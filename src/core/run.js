// Orchestration générique : un corps (déclaration + monde caché) × une politique.
import { createBrain } from './brain.js';
import { optimizeAction } from './decide.js';

export function trueOptimum(body, t) {
  const ctx = body.contextAt(t);
  const P = Object.fromEntries(body.outcomes.map((o) => [o.key, () => null]));
  for (const o of body.outcomes) P[o.key] = (a) => ({ mu: body.truth.mu(o.key, t, a, false), s: body.truth.sd(o.key, t) });
  return optimizeAction(body, P, ctx).action;
}

export function runYear(body, policy, { seed = 1, days = 365, brainOpts = {}, onDay } = {}) {
  const brain = policy === 'brain' ? createBrain(body, { seed, ...brainOpts }) : null;
  let total = 0;
  const sq = [];
  for (let t = 0; t < days; t++) {
    const ctx = body.contextAt(t);
    let action;
    if (brain) action = brain.planDay({ t, context: ctx }).action;
    else if (policy === 'oracle') action = trueOptimum(body, t);
    else action = body.habit(t);
    const r = body.step(action);
    total += r.reward;
    if (brain) {
      brain.observeOutcome({ t, action, outcomes: r.outcomes, censored: r.censored, reward: r.reward });
      if (t >= 28 && t % 7 === 0) for (let k = 1; k <= 7; k++) for (const pa of body.probes) for (const o of body.outcomes) {
        const a = { ...action, ...pa }, tt = t + k;
        sq.push((brain.predictLog(o.key, tt, a, body.contextAt(Math.min(tt, days - 1))) - body.truth.mu(o.key, tt, a, true)) ** 2);
      }
    }
    onDay?.(t, action, r, brain);
  }
  return { reward: total, brain, rmse: sq.length ? Math.sqrt(sq.reduce((s, x) => s + x, 0) / sq.length) : null };
}
