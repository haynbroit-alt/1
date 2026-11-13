// Banc d'essai « découverte de l'inconnu » : environnements × graines × politiques, en parallèle.
// Usage : node bench/discovery.js --seeds 1-10 [--envs calme,glacier] [--out bench/dev.json]
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import os from 'node:os';

import { POLICIES, AGENT_OPTS } from './policies-def.js';

async function runJob({ env, seed, policy }) {
  const { createWorld } = await import('../src/world.js');
  const { ENVS } = await import('../src/envs.js');
  const { agentDay, policyDay } = await import('../src/runner.js');
  const { createOracle, createHabit } = await import('../src/policies.js');
  const world = createWorld(seed, ENVS[env].make(seed));
  const days = 365, t0 = Date.now();
  let profit = 0, agent = null, pol = null, reviews = 0;
  if (policy === 'oracle') pol = createOracle(world);
  else if (policy === 'habit') pol = createHabit();
  else if (policy === 'v1-gele') agent = (await import('../src_v1/agent.js')).createAgent({ seed });
  else agent = (await import('../src/agent.js')).createAgent({ seed, ...AGENT_OPTS[policy] });
  const sq = [];
  for (let d = 0; d < days; d++) {
    if (pol) { profit += policyDay(world, pol).profit; continue; }
    const r = agentDay(world, agent); profit += r.obs.profit; if (r.reviewed) reviews++;
    // fidélité du modèle du monde : erreur du log-taux prédit sur les 7 prochains jours, grille de prix × marketing
    if (d >= 28 && d % 7 === 0) {
      for (let k = 1; k <= 7; k++) for (const p of [2.5, 3.5, 4.5, 5.5]) for (const m of [0, 50]) {
        const t = d + k;
        const mu = agent.predictLog ? agent.predictLog(t, p, m) : agent.model.predict({ t, dow: t % 7, price: p, marketing: m }).mu;
        sq.push((mu - world.logRate(t, p, m, true)) ** 2);
      }
    }
  }
  const norm = (b, retractedAt = null) => ({ family: b.family ?? b.type, gate: b.gate?.kind ?? 'step', tau: b.gate ? (b.gate.kind === 'all' ? null : b.gate.tau) : b.tau, acceptedAt: b.acceptedAt, retractedAt: b.retractedAt ?? retractedAt });
  return {
    env, seed, policy, profit, reviews, secs: (Date.now() - t0) / 1000,
    rmse: sq.length ? Math.sqrt(sq.reduce((s, x) => s + x, 0) / sq.length) : null,
    beliefs: agent ? [...agent.beliefs.map((b) => norm(b)), ...agent.retracted.map((b) => norm(b))] : [],
    events: world.scenario.events.filter((e) => e.expect).map((e) => ({ type: e.type, start: e.start ?? 0, expect: e.expect, structural: !!e.structural, label: e.label, period: e.period, mid: e.mid, width: e.width })),
  };
}

if (!isMainThread) {
  parentPort.on('message', async (job) => { try { parentPort.postMessage({ ok: true, res: await runJob(job) }); } catch (e) { parentPort.postMessage({ ok: false, job, err: String(e.stack) }); } });
} else {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const [a, b] = arg('--seeds', '1-10').split('-').map(Number);
  const { DEV_ENVS } = await import('../src/envs.js');
  const envs = arg('--envs', DEV_ENVS.join(',')).split(',');
  const pols = arg('--policies', Object.keys(POLICIES).join(',')).split(',');
  const out = arg('--out', 'bench/dev.json');
  const jobs = [];
  for (let seed = a; seed <= (b ?? a); seed++) for (const env of envs) for (const policy of pols) jobs.push({ env, seed, policy });
  jobs.sort((x, y) => (y.policy.startsWith('v2') || y.policy.includes('detect') ? 1 : 0) - (x.policy.startsWith('v2') || x.policy.includes('detect') ? 1 : 0));
  const results = []; let next = 0, done = 0; const t0 = Date.now();
  const nW = Math.max(1, os.cpus().length);
  await Promise.all(Array.from({ length: nW }, () => new Promise((resolve) => {
    const w = new Worker(new URL(import.meta.url), { workerData: {} });
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } w.postMessage(jobs[next++]); };
    w.on('message', (m) => { if (!m.ok) { console.error(m.err); process.exit(1); } results.push(m.res); done++; process.stderr.write(`\r${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); feed(); });
    feed();
  })));
  process.stderr.write('\n');
  writeFileSync(out, JSON.stringify(results));
  console.log(`écrit ${out} (${results.length} épisodes)`);
}
