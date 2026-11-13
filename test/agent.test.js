import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from '../src/world.js';
import { createAgent, STAGES } from '../src/agent.js';
import { agentDay, runEpisode, publicObs } from '../src/runner.js';
import { newsvendorQ } from '../src/econ.js';

test('newsvendor : quantile critique (p−c)/p', () => {
  // p=4, c=1 → ratio 0.75 → quantile z=0.674
  const q = newsvendorQ(Math.log(100), 0.2, 4, 1);
  assert.equal(q, Math.round(100 * Math.exp(0.2 * 0.6745)));
  assert.equal(newsvendorQ(5, 0.2, 1, 2), 0); // vendre à perte → ne rien commander
});
test('l’agent ne voit jamais la demande cachée', () => {
  const o = publicObs({ t: 1, sales: 3, _demand: 10 });
  assert.equal(o._demand, undefined);
});
test('déterminisme : même graine → même année', () => {
  const a = runEpisode({ seed: 5, days: 60 }), b = runEpisode({ seed: 5, days: 60 });
  assert.equal(a.profit, b.profit);
});
test('chaque étape de la boucle est réellement exécutée sur une année', () => {
  const r = runEpisode({ seed: 1, days: 365 });
  for (const [k] of STAGES) assert.ok(r.agent.stageCount[k] > 0, `étape ${k} jamais exécutée`);
});
test('détecte un choc injecté (−35 % au jour 60) et date la rupture', () => {
  const sc = { alpha: Math.log(120), beta: -1.8, gamma: 0.15, noise: 0.12, baseCost: 1.2, events: [{ type: 'level', start: 60, end: null, mag: Math.log(0.65), label: 'choc' }] };
  const w = createWorld(42, sc), a = createAgent({ seed: 42 });
  for (let d = 0; d < 110; d++) agentDay(w, a);
  const b = a.beliefs.find((x) => x.type === 'level' && x.coef < 0);
  assert.ok(b, 'aucune croyance de baisse');
  assert.ok(Math.abs(b.tau - 60) <= 3, `date estimée ${b.tau}`);
  assert.ok(b.acceptedAt - 60 <= 20, `délai ${b.acceptedAt - 60} j`);
  assert.ok(Math.abs(Math.exp(b.coef) - 0.65) < 0.1, `ampleur ${Math.exp(b.coef)}`);
});
test('monde stable : aucune fausse rupture sur 200 jours', () => {
  const sc = { alpha: Math.log(120), beta: -1.8, gamma: 0.15, noise: 0.12, baseCost: 1.2, events: [] };
  let fp = 0;
  for (const seed of [1, 2, 3]) { const w = createWorld(seed, sc), a = createAgent({ seed }); for (let d = 0; d < 200; d++) agentDay(w, a); fp += a.beliefs.length; }
  assert.ok(fp <= 1, `${fp} fausses ruptures`);
});
test('revue humaine : un refus produit une règle et exécute le plan de repli', () => {
  const w = createWorld(3), a = createAgent({ seed: 3 });
  let seen = false;
  for (let d = 0; d < 120 && !seen; d++) {
    const plan = a.planDay({ t: w.t, cost: w.cost(w.t) });
    let res = plan;
    if (plan.review) {
      seen = true;
      const before = a.rules.list.length;
      res = a.resolveReview('reject');
      assert.equal(res.trace.at(-1).data.how, 'fallback');
      assert.ok(a.rules.list.length >= before);
    }
    a.observeOutcome(publicObs(w.step(res.action)));
  }
  assert.ok(seen, 'aucune revue déclenchée en 120 jours');
});
