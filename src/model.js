// Modèle du monde : régression linéaire bayésienne conjuguée Normale–Inverse-Gamma.
// y = log(demande) ; x = caractéristiques (prix, jour, marketing, + ruptures structurelles crues).
// Tout est exact et fermé : postérieure, prédictive de Student, vraisemblance marginale
// (utilisée pour comparer des hypothèses par facteur de Bayes).
import { cholesky, cholSolve, cholInverse, cholLogDet, dot, matVec } from './linalg.js';
import { lgamma } from './rng.js';

export const P_REF = 4.0;
export const DOW_NAMES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];

// Caractéristiques de base. r = {t, dow, price, marketing}
export function baseFeatures(r) {
  const x = [1, Math.log(r.price / P_REF)];
  for (let d = 1; d < 7; d++) x.push(r.dow === d ? 1 : 0);
  x.push(Math.log1p(r.marketing / 10));
  return x;
}
export const BASE_NAMES = ['niveau', 'élasticité', ...DOW_NAMES.slice(1).map((d) => `effet ${d}`), 'effet marketing'];

export function beliefFeature(b, r) {
  const on = r.t >= b.tau && (b.end == null || r.t < b.end);
  if (b.type === 'level') return on ? 1 : 0;
  if (b.type === 'elasticity') return on ? Math.log(r.price / P_REF) : 0;
  if (b.type === 'marketing') return on ? Math.log1p(r.marketing / 10) : 0;
  return 0;
}

export function features(r, beliefs) {
  const x = baseFeatures(r);
  for (const b of beliefs) x.push(beliefFeature(b, r));
  return x;
}

// Prior : connaissances génériques d'un commerçant, volontairement faibles.
// NB : dans le prior conjugué NIG, la covariance a priori est σ²·V0. On exprime donc des
// écarts-types ABSOLUS (sd) et on divise par la variance de bruit a priori S0² pour obtenir V0.
export const S0 = 0.15;
export function priorFor(beliefs) {
  const m0 = [Math.log(100), -1, 0, 0, 0, 0, 0, 0, 0.05];
  const sd = [2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  for (const b of beliefs) { m0.push(0); sd.push(0.7); }
  const v0 = sd.map((x) => (x * x) / (S0 * S0));
  return { m0, v0, a0: 3, b0: 2 * S0 * S0 };
}

// Ajuste la postérieure sur des enregistrements (non censurés) avec un jeu de croyances.
export function fit(records, beliefsIn) {
  const beliefs = beliefsIn.map((b) => ({ type: b.type, tau: b.tau, end: b.end }));
  const { m0, v0, a0, b0 } = priorFor(beliefs);
  const d = m0.length;
  const P = Array.from({ length: d }, (_, i) => { const r = new Array(d).fill(0); r[i] = 1 / v0[i]; return r; });
  const rhs = m0.map((m, i) => m / v0[i]);
  let yy = 0, n = 0;
  for (const r of records) {
    // jours de rupture : demande ≥ stock → on utilise l'espérance tronquée imputée (pas d'EM)
    const y = r.censored ? r.yImp : r.y;
    if (y == null) continue;
    const x = features(r, beliefs);
    for (let i = 0; i < d; i++) { rhs[i] += x[i] * y; const xi = x[i]; if (xi === 0) continue; const Pi = P[i]; for (let j = 0; j < d; j++) Pi[j] += xi * x[j]; }
    yy += y * y; n++;
  }
  const L = cholesky(P);
  const mn = cholSolve(L, rhs);
  const m0Pm0 = m0.reduce((s, m, i) => s + (m * m) / v0[i], 0);
  const an = a0 + n / 2;
  const bn = Math.max(1e-9, b0 + 0.5 * (yy + m0Pm0 - dot(mn, rhs)));
  const logDetV0 = v0.reduce((s, v) => s + Math.log(v), 0);
  const logDetVn = -cholLogDet(L);
  const logML = -0.5 * n * Math.log(2 * Math.PI) + 0.5 * (logDetVn - logDetV0) + a0 * Math.log(b0) - an * Math.log(bn) + lgamma(an) - lgamma(a0);
  let Vn = null;
  const getVn = () => (Vn ??= cholInverse(L));
  return {
    beliefs, mn, an, bn, n, logML, L,
    get Vn() { return getVn(); },
    sigma2: bn / an,
    // Prédictive de Student : moyenne, échelle, ddl
    predict(r) {
      const x = features(r, beliefs);
      const Vx = matVec(getVn(), x);
      const s2 = (bn / an) * (1 + dot(x, Vx));
      return { mu: dot(x, mn), scale: Math.sqrt(s2), dof: 2 * an };
    },
    coefSd(i) { return Math.sqrt((bn / an) * getVn()[i][i]); },
    // Tirage (θ, σ²) a posteriori — pour Thompson sampling et le bac à sable
    sample(rng) {
      const sigma2 = 1 / (rng.gamma(an) / bn);
      const C = cholesky(getVn().map((row) => row.map((v) => v * sigma2)));
      const z = mn.map(() => rng.normal());
      const theta = mn.map((m, i) => { let s = m; for (let k = 0; k <= i; k++) s += C[i][k] * z[k]; return s; });
      return { theta, sigma: Math.sqrt(sigma2) };
    },
  };
}

export const predictWith = (theta, r, beliefs) => dot(features(r, beliefs), theta);
