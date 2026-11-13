import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { makeSpace, fit } from '../src/core/gmodel.js';
import { searchExplanations, narrate } from '../src/core/gdiscovery.js';
import { restaurantBody } from '../src/bodies/restaurant.js';
import { commerceBody } from '../src/bodies/commerce.js';
import { runYear } from '../src/core/run.js';

const space = () => makeSpace({ key: 'y', label: 'la production', of: 'de la production' }, [
  { key: 'speed', label: 'cadence', transform: 'log', ref: 100, continuous: true, thetas: [90, 110] },
  { key: 'temp', label: 'température', transform: 'lin', ref: 15, scale: 10, continuous: true },
]);
function synth(n, effect, seed = 1) {
  const r = makeRng(seed), recs = [];
  for (let t = 0; t < n; t++) {
    const speed = 80 + 40 * r.next(), temp = 15 + 8 * r.normal();
    const y = Math.log(500) + 0.8 * Math.log(speed / 100) + effect(t, speed, temp) + 0.08 * r.normal();
    recs.push({ t, dow: t % 7, x: { speed, temp }, y, censored: false });
  }
  return recs;
}
const best = (recs, t) => { const sp = space(); const H = searchExplanations(sp, fit(sp, recs, []), t, { records: recs, lookback: 80 }); return { H, k: Object.entries(H.famMass).sort((a, b) => b[1] - a[1])[0][0] }; };

test('cerveau générique : évaluation rapide = ajustement complet', () => {
  const sp = space(), recs = synth(120, () => 0);
  for (const x of recs) if (x.t % 5 === 0) { x.censored = true; x.yImp = x.y + 0.05; x.y -= 0.1; }
  const c = { family: 'slope', gate: { kind: 'step', tau: 60 }, basis: { kind: 'in', j: 1 } };
  assert.ok(Math.abs(fit(sp, recs, []).scoreCandidate(c).logML - fit(sp, recs, [c]).logML) < 1e-6);
});
test('découvre qu’une variable quelconque s’est mise à compter (sensibilité à la température)', () => {
  const { k } = best(synth(170, (t, s, temp) => (t >= 100 ? 0.04 * (temp - 15) : 0)), 170);
  assert.equal(k, 'slope:temp');
});
test('découvre une transition progressive (déclencheur sigmoïde) sur une mesure quelconque', () => {
  const { k, H } = best(synth(200, (t) => -0.4 / (1 + Math.exp(-(t - 140) / 8))), 200);
  assert.equal(k, 'level');
  assert.equal(H.all.find((c) => c.family === 'level').gate.kind, 'sigmoid');
});
test('identifiabilité : un seuil jamais franchi n’est pas proposé (ce serait une rupture de niveau déguisée)', () => {
  const sp = space(), recs = synth(150, () => 0);
  const H = searchExplanations(sp, fit(sp, recs, []), 150, { records: recs });
  assert.ok(!H.all.some((c) => c.basis?.kind === 'thresh' && c.basis.j === 0 && c.basis.theta < 80));
});
test('narration accordée à la déclaration du corps', () => {
  const sp = makeSpace({ key: 'c', label: 'les couverts', plural: true, of: 'des couverts' }, [{ key: 'p', label: 'prix', transform: 'log', ref: 18, sign: -1 }]);
  assert.match(narrate(sp, { family: 'level', gate: { kind: 'step', tau: 50 }, basis: { kind: 'const' } }, [-0.3]), /les couverts ont chuté de -26 %/);
  assert.match(narrate(sp, { family: 'slope', gate: { kind: 'step', tau: 50 }, basis: { kind: 'in', j: 0 } }, [-0.5]), /réagissent plus fortement/);
});
test('le même cerveau gère un restaurant (deux mesures, effectif, météo) mieux que l’habitude', () => {
  const v3 = runYear(restaurantBody(9), 'brain', { seed: 9, days: 150 }), hb = runYear(restaurantBody(9), 'habit', { days: 150 });
  assert.ok(v3.reward > hb.reward, `${v3.reward} vs ${hb.reward}`);
});
test('le même cerveau, sans changement, gère le commerce', () => {
  const v3 = runYear(commerceBody('marche', 9), 'brain', { seed: 9, days: 150 }), hb = runYear(commerceBody('marche', 9), 'habit', { days: 150 });
  assert.ok(v3.reward > hb.reward);
});
