// Banc d'essai de TRANSFERT : le même cerveau générique (v3) sur des corps différents, en parallèle.
// Usage : node bench/transfer.js --seeds 1-10 --bodies calme,boulangerie,...,restaurant --policies oracle,habit,v1-gele,v2,v3,v3-ferme --out f.json
import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import os from 'node:os';

export const LABELS = {
  oracle: 'Oracle (connaît la vérité)', habit: 'Habitude (règle fixe)', 'v1-gele': 'CORTEX v1 (spécialisé commerce, gelé)',
  v2: 'CORTEX v2 (spécialisé commerce)', 'v3-ferme': 'Cerveau générique, vocabulaire fermé (niveau + sensibilité)', v3: 'CORTEX v3 : cerveau générique',
  'v3-gele': 'CORTEX v3 gelé (src_v3)', 'v4-myope': 'v4 sans planification', 'v4-sansmemoire': 'v4 sans variables construites', 'v4-sanscurio': 'v4 sans curiosité', 'v4-curio': 'v4 avec curiosité', v4: 'CORTEX v4 : modèles construits + stratégies',
};
const V2MAP = { elasticity: 'slope:price', marketing: 'slope:marketing', threshold: 'threshold:price', curvature: 'curvature:price', adstock: 'adstock:marketing' };

async function makeBody(name, seed) {
  if (name === 'restaurant') return (await import('../src/bodies/restaurant.js')).restaurantBody(seed);
  const extra = await import('../src/bodies/index.js').catch(() => null);
  if (extra?.BODIES?.[name]) return extra.BODIES[name](seed);
  return (await import('../src/bodies/commerce.js')).commerceBody(name, seed);
}

async function runJob({ body: name, seed, policy }) {
  const t0 = Date.now();
  const body = await makeBody(name, seed);
  const events = body.truth.events();
  if (policy === 'v2' || policy === 'v1-gele') {
    if (!body.id.startsWith('commerce:')) return null;
    const { agentDay } = await import('../src/runner.js');
    const agent = policy === 'v2' ? (await import('../src/agent.js')).createAgent({ seed }) : (await import('../src_v1/agent.js')).createAgent({ seed });
    const w = body.world; let reward = 0; const sq = [];
    for (let d = 0; d < 365; d++) {
      reward += agentDay(w, agent).obs.profit;
      if (d >= 28 && d % 7 === 0) for (let k = 1; k <= 7; k++) for (const pa of body.probes) { const t = d + k; const mu = agent.predictLog ? agent.predictLog(t, pa.price, pa.marketing) : agent.model.predict({ t, dow: t % 7, price: pa.price, marketing: pa.marketing }).mu; sq.push((mu - w.logRate(t, pa.price, pa.marketing, true)) ** 2); }
    }
    const nb = (b) => ({ outcome: 'sales', key: V2MAP[b.family ?? b.type] ?? (b.family ?? b.type), tau: b.gate ? (b.gate.kind === 'all' ? null : b.gate.tau) : b.tau, acceptedAt: b.acceptedAt, retractedAt: b.retractedAt ?? null });
    return { body: name, seed, policy, reward, rmse: Math.sqrt(sq.reduce((s, x) => s + x, 0) / sq.length), beliefs: [...agent.beliefs, ...agent.retracted].map(nb), events, secs: (Date.now() - t0) / 1000 };
  }
  const { runYear } = policy === 'v3-gele' ? await import('../src_v3/core/run.js') : await import('../src/core/run.js');
  const pol = policy.startsWith('v3') || policy.startsWith('v4') ? 'brain' : policy;
  const V4 = { v4: {}, 'v4-myope': { planning: false }, 'v4-sansmemoire': { memory: false, planning: false }, 'v4-sanscurio': { curiosity: false }, 'v4-curio': { curiosity: true } };
  const brainOpts = policy === 'v3-ferme' ? { families: ['level', 'slope'], omnibus: false, background: false, memory: false, planning: false, curiosity: false } : policy === 'v3' ? { memory: false, planning: false, curiosity: false } : V4[policy] ?? {};
  let runBody = body, runPol = pol;
  if (pol === 'oracle' && body.truth.oracleAdjust) {
    // oracle non myope quand le corps fournit une correction (ex. calendrier de maintenance de l'usine)
    const { trueOptimum } = await import('../src/core/run.js');
    runBody = { ...body, habit: (t) => body.truth.oracleAdjust(t, trueOptimum(body, t)) }; runPol = 'habit';
  }
  // jours où chaque levier discret est activé (≠ sa première valeur) — pour mesurer les stratégies découvertes
  const actDays = {};
  const disc = body.levers.filter((l) => l.kind === 'discrete');
  const r = runYear(runBody, runPol, { seed, brainOpts, onDay: (t, a) => { for (const l of disc) if (a[l.key] !== l.values[0]) (actDays[l.key] ??= []).push(t); } });
  const beliefs = r.brain ? [...r.brain.beliefs(), ...r.brain.retracted()].map((b) => ({ outcome: b.outcome, key: b.key ?? b.family, tau: b.gate.kind === 'all' ? null : b.gate.tau, acceptedAt: b.acceptedAt, retractedAt: b.retractedAt ?? null })) : [];
  return { body: name, seed, policy, reward: r.reward, rmse: r.rmse, beliefs, events, actDays, secs: (Date.now() - t0) / 1000 };
}

if (!isMainThread) parentPort.on('message', async (job) => { try { parentPort.postMessage({ ok: true, res: await runJob(job) }); } catch (e) { parentPort.postMessage({ ok: false, err: `${JSON.stringify(job)} ${e.stack}` }); } });
else if (process.argv[1].endsWith('transfer.js')) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const [a, b] = arg('--seeds', '1-10').split('-').map(Number);
  const bodies = arg('--bodies', 'calme,boulangerie,glacier,marche,fleuriste,restaurant').split(',');
  const pols = arg('--policies', 'oracle,habit,v1-gele,v2,v3-ferme,v3').split(',');
  const out = arg('--out', 'bench/transfer-dev.json');
  const jobs = [];
  for (let s = a; s <= (b ?? a); s++) for (const body of bodies) for (const policy of pols) jobs.push({ body, seed: s, policy });
  const w8 = (j) => (j.policy.startsWith('v4') ? 4 : j.policy.startsWith('v3') ? 3 : j.policy === 'v2' ? 2 : 1) * (j.body === 'restaurant' || j.body === 'usine' ? 2 : 1);
  jobs.sort((x, y) => w8(y) - w8(x));
  const results = []; let next = 0, done = 0; const t0 = Date.now();
  await Promise.all(Array.from({ length: os.cpus().length }, () => new Promise((resolve) => {
    const w = new Worker(new URL(import.meta.url));
    const feed = () => { if (next >= jobs.length) { w.terminate(); resolve(); return; } w.postMessage(jobs[next++]); };
    w.on('message', (m) => { if (!m.ok) { console.error(m.err); process.exit(1); } if (m.res) results.push(m.res); done++; process.stderr.write(`\r${done}/${jobs.length} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); feed(); });
    feed();
  })));
  process.stderr.write('\n');
  writeFileSync(out, JSON.stringify(results));
  console.log(`écrit ${out} (${results.length} épisodes)`);
}
