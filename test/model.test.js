import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../src/rng.js';
import { fit, P_REF } from '../src/model.js';

function synth({ n = 200, beta = -1.8, shiftAt = null, shift = 0, elasAt = null, elas = 0, seed = 1 }) {
  const r = makeRng(seed), recs = [];
  for (let t = 0; t < n; t++) {
    const price = 2.5 + 2 * r.next(), marketing = [0, 20, 50][t % 3], lp = Math.log(price / P_REF);
    let y = Math.log(120) + beta * lp + 0.15 * Math.log1p(marketing / 10) + (t % 7 === 5 ? 0.3 : 0) + 0.1 * r.normal();
    if (shiftAt != null && t >= shiftAt) y += shift;
    if (elasAt != null && t >= elasAt) y += elas * lp;
    recs.push({ t, dow: t % 7, price, marketing, y, censored: false });
  }
  return recs;
}

test('la postérieure retrouve les vrais coefficients', () => {
  const m = fit(synth({}), []);
  assert.ok(Math.abs(m.mn[1] - -1.8) < 3 * m.coefSd(1), `élasticité ${m.mn[1]}`);
  assert.ok(Math.abs(m.mn[8] - 0.15) < 0.06, `marketing ${m.mn[8]}`);
  assert.ok(Math.abs(Math.sqrt(m.sigma2) - 0.1) < 0.02);
});
test('la vraisemblance marginale préfère la vraie rupture (facteur de Bayes)', () => {
  const recs = synth({ shiftAt: 120, shift: -0.3 });
  const none = fit(recs, []).logML;
  const right = fit(recs, [{ type: 'level', tau: 120 }]).logML;
  const wrong = fit(recs, [{ type: 'level', tau: 60 }]).logML;
  assert.ok(right - none > 20, `logBF vs rien ${right - none}`);
  assert.ok(right > wrong + 10);
});
test('sans rupture réelle, ajouter une rupture est pénalisé (rasoir d’Occam bayésien)', () => {
  const recs = synth({ seed: 4 });
  assert.ok(fit(recs, [{ type: 'level', tau: 100 }]).logML < fit(recs, []).logML);
});
test('un changement d’élasticité est distingué d’une rupture de niveau quand les prix varient', () => {
  const recs = synth({ elasAt: 100, elas: -0.8, seed: 7 });
  const e = fit(recs, [{ type: 'elasticity', tau: 100 }]).logML;
  const l = fit(recs, [{ type: 'level', tau: 100 }]).logML;
  assert.ok(e > l + 5, `élasticité ${e} vs niveau ${l}`);
});
test('la prédictive est calibrée (≈80 % dans l’IC80)', () => {
  const train = synth({ seed: 11 }), testS = synth({ seed: 12 });
  const m = fit(train, []);
  const inside = testS.filter((r) => { const p = m.predict(r); return Math.abs(r.y - p.mu) <= 1.2816 * p.scale; }).length / testS.length;
  assert.ok(inside > 0.72 && inside < 0.88, `couverture ${inside}`);
});
