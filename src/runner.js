// Orchestration d'une journée : matin (planification) → le monde vit → soir (bilan).
import { createWorld } from './world.js';
import { createAgent } from './agent.js';
import { createOracle, createHabit } from './policies.js';

// Relecteur simulé (utilisé quand aucun humain n'est présent) : approuve si la proposition
// bat le statu quo en espérance sans risque de perte excessif. Clairement étiqueté comme simulé.
export const simulatedReviewer = (review) => {
  const cost = review.simFallback.mean - review.sim.mean; // ce que la proposition coûte en espérance
  return cost <= Math.max(5, review.voi ?? 0) && review.sim.pLoss <= 0.5 ? 'approve' : 'reject';
};

export const publicObs = (o) => { const { _demand, ...rest } = o; return rest; };

export function agentDay(world, agent, reviewer = simulatedReviewer) {
  const t = world.t;
  const plan = agent.planDay({ t, cost: world.cost(t) });
  let res = plan, reviewed = null;
  if (plan.review) {
    const d = reviewer(plan.review);
    reviewed = d;
    res = agent.resolveReview(d, 'sim-reviewer'); // sa trace inclut déjà celle du matin
  }
  const obs = world.step(res.action);
  const ev = agent.observeOutcome(publicObs(obs));
  return { obs, trace: res.trace.concat(ev.trace), reviewed };
}

export function policyDay(world, pol) {
  const a = pol.act(world.t);
  const obs = world.step(a);
  pol.observe(publicObs(obs));
  return obs;
}

export function runEpisode({ seed = 1, days = 365, agentOpts = {}, policy = null, reviewer } = {}) {
  const world = createWorld(seed);
  const log = [];
  if (policy) {
    const pol = policy === 'oracle' ? createOracle(world) : createHabit();
    for (let d = 0; d < days; d++) log.push(policyDay(world, pol));
    return { world, log, profit: log.reduce((s, o) => s + o.profit, 0) };
  }
  const agent = createAgent({ seed, ...agentOpts });
  let reviews = 0, approvals = 0;
  for (let d = 0; d < days; d++) {
    const r = agentDay(world, agent, reviewer);
    if (r.reviewed) { reviews++; if (r.reviewed === 'approve') approvals++; }
    log.push(r.obs);
  }
  return { world, agent, log, profit: log.reduce((s, o) => s + o.profit, 0), reviews, approvals };
}
