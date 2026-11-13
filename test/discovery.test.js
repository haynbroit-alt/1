import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { fit, P_REF } from '../src/model.js';
import { searchExplanations, narrate } from '../src/discovery.js';
import { createWorld } from '../src/world.js';
import { createAgent } from '../src/agent.js';
import { agentDay } from '../src/runner.js';
import { ENVS } from '../src/envs.js';

function synth(n, effect, seed = 1) {
  const r = makeRng(seed), recs = [];
  for (let t = 0; t < n; t++) {
    const price = 2.5 + 2 * r.next(), marketing = [0, 20, 50][t % 3];
    const y = Math.log(120) - 1.8 * Math.log(price / P_REF) + 0.15 * Math.log1p(marketing / 10) + effect(t, price) + 0.1 * r.normal();
    recs.push({ t, dow: t % 7, price, marketing, y, censored: false });
  }
  return recs;
}
const top = (recs, t, lookback = 60) => { const H = searchExplanations(fit(recs, []), t, { grammar: 'open', lookback }); return { H, fam: Object.entries(H.famMass).sort((a, b) => b[1] - a[1])[0] }; };

test('évaluation rapide d’un candidat = ajustement complet (avec ruptures censurées)', () => {
  const recs = synth(150, () => 0);
  for (const x of recs) if (x.t % 4 === 0) { x.censored = true; x.yImp = x.y + 0.05; x.y -= 0.1; }
  const c = { family: 'trend', gate: { kind: 'ramp', tau: 70 }, basis: { kind: 'const' } };
  const m = fit(recs, []);
  assert.ok(Math.abs(m.scoreCandidate(c).logML - fit(recs, [c]).logML) < 1e-6);
});
test('découvre un déplacement d’habitude hebdomadaire (samedi → mercredi)', () => {
  const { H, fam } = top(synth(160, (t) => (t >= 100 ? (t % 7 === 5 ? -0.45 : t % 7 === 2 ? 0.45 : 0) : 0)), 160);
  assert.equal(fam[0], 'dow'); assert.ok(1 - H.pNull > 0.99);
});
test('découvre une dérive progressive et la distingue d’une rupture', () => {
  // la date de début doit être dans la fenêtre de recherche (sinon un cycle annuel l'imite)
  const { fam, H } = top(synth(210, (t) => (t >= 100 ? -0.004 * (t - 100) : 0)), 210, 120);
  assert.equal(fam[0], 'trend');
  const b = H.all.find((c) => c.family === 'trend');
  assert.match(narrate(b, b.coef), /dérive progressivement de -1[0-5] % par mois/);
});
test('découvre un seuil de prix psychologique', () => {
  const { fam, H } = top(synth(160, (t, p) => (t >= 90 && p > 4 ? -0.4 : 0)), 160);
  assert.equal(fam[0], 'threshold');
  assert.equal(H.all.find((c) => c.family === 'threshold').basis.theta, 4);
});
test('découvre une saisonnalité annuelle', () => {
  const { fam } = top(synth(250, (t) => 0.4 * Math.cos((2 * Math.PI * (t - 200)) / 365)), 250);
  assert.equal(fam[0], 'season');
});
test('un pic toujours masqué par une rupture de stock reste détectable (vraisemblance Tobit/ADF)', () => {
  const recs = synth(170, () => 0);
  for (const x of recs) {
    const pulse = x.t >= 60 && (x.t - 3) % 14 === 0;
    const q = Math.log(120) - 1.8 * Math.log(x.price / P_REF) + 0.15 * Math.log1p(x.marketing / 10) + 0.05;
    if (pulse) x.y += 0.4;
    if (x.y > q) { x.censored = true; x.y = q; x.yImp = q + 0.08; }
  }
  const m = fit(recs, []);
  const c = { family: 'pulse', gate: { kind: 'step', tau: 60 }, basis: { kind: 'pulse', period: 14, phase: 3 } };
  const wrong = { ...c, basis: { ...c.basis, phase: 8 } };
  assert.ok(m.scoreCandidate(c).logML - m.logML > 4, 'pic non soutenu');
  assert.ok(m.scoreCandidate(c).logML > m.scoreCandidate(wrong).logML + 4);
});
test('monde calme : aucune fausse découverte sur 250 jours (grammaire ouverte)', () => {
  let fp = 0;
  for (const seed of [11, 12]) { const w = createWorld(seed, ENVS.calme.make(seed)), a = createAgent({ seed }); for (let d = 0; d < 250; d++) agentDay(w, a); fp += a.beliefs.length + a.retracted.length; }
  assert.ok(fp <= 1, `${fp} fausses découvertes`);
});
