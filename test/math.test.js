import test from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, normInv, normCdf, lgamma, poissonInv } from '../src/rng.js';
import { cholesky, cholSolve } from '../src/linalg.js';

test('quantile et CDF normales sont inverses', () => {
  for (const p of [0.01, 0.1, 0.5, 0.8, 0.975]) assert.ok(Math.abs(normCdf(normInv(p)) - p) < 2e-6);
});
test('lgamma exact sur les entiers', () => {
  assert.ok(Math.abs(lgamma(6) - Math.log(120)) < 1e-10);
  assert.ok(Math.abs(lgamma(0.5) - 0.5 * Math.log(Math.PI)) < 1e-10);
});
test('Poisson par inversion : moyenne correcte et monotone en lambda', () => {
  const r = makeRng(3); let s = 0; const n = 20000;
  for (let i = 0; i < n; i++) s += poissonInv(37, r.next());
  assert.ok(Math.abs(s / n - 37) < 0.3);
  for (const u of [0.1, 0.5, 0.9]) assert.ok(poissonInv(50, u) <= poissonInv(60, u));
});
test('loi gamma : moyenne = forme', () => {
  const r = makeRng(9); let s = 0; for (let i = 0; i < 20000; i++) s += r.gamma(3.5);
  assert.ok(Math.abs(s / 20000 - 3.5) < 0.06);
});
test('Cholesky résout un système SPD', () => {
  const A = [[4, 2, 0.6], [2, 5, 1], [0.6, 1, 3]], b = [1, 2, 3];
  const x = cholSolve(cholesky(A), b);
  const Ax = A.map((r) => r.reduce((s, v, j) => s + v * x[j], 0));
  Ax.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-12));
});
