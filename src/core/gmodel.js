// CERVEAU GÉNÉRIQUE — modèle du monde d'UNE mesure (ventes, couverts, pièces, défauts…).
// y = log(mesure) ~ caractéristiques DÉDUITES de la déclaration du corps + TERMES découverts.
// Régression bayésienne conjuguée Normale–Inverse-Gamma pondérée ; score de comparaison « Tobit »
// (jours observés : vraisemblance marginale exacte ; jours plafonnés : filtrage à densité supposée).
//
// Un terme = DÉCLENCHEUR × MÉCANISME (sur une variable quelconque de l'espace) :
//   déclencheur : all | step(τ, fin) | ramp(τ) | sigmoid(τ, largeur)
//   mécanisme   : const | in(j) | in2(j) | thresh(j, θ) | dow(d) | season | pulse(k, φ) | adstock(j, λ) | variance(ratio)
import { cholesky, cholSolve, cholInverse, cholLogDet, dot } from '../linalg.js';
import { lgamma } from '../rng.js';

export function logSurv(a) {
  const z = Math.abs(a) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return a >= 0 ? Math.log(0.5 * poly) - (a * a) / 2 : Math.log(1 - 0.5 * poly * Math.exp(-(a * a) / 2));
}

// ---------- espace de caractéristiques d'une mesure ----------
// inputs : [{ key, transform: 'log'|'log1p'|'lin', ref, scale, prior: {mean, sd} }]
export function transformValue(inp, v) {
  if (inp.transform === 'log') return Math.log(Math.max(1e-9, v) / (inp.ref ?? 1));
  if (inp.transform === 'log1p') return Math.log1p(Math.max(0, v) / (inp.scale ?? 1));
  return (v - (inp.ref ?? 0)) / (inp.scale ?? 1);
}
export function makeSpace(outcome, inputs) {
  const idx = Object.fromEntries(inputs.map((x, i) => [x.key, i]));
  return {
    outcome, inputs, idx, nBase: 7 + inputs.length,
    xval: (r, j) => transformValue(inputs[j], r.x[inputs[j].key]),
    base(r) {
      const x = [1];
      for (let d = 1; d < 7; d++) x.push(r.dow === d ? 1 : 0);
      for (let j = 0; j < inputs.length; j++) x.push(transformValue(inputs[j], r.x[inputs[j].key]));
      return x;
    },
    basePrior() {
      const m0 = [outcome.prior?.mean ?? Math.log(100)], sd = [outcome.prior?.sd ?? 3];
      for (let d = 1; d < 7; d++) { m0.push(0); sd.push(0.5); }
      for (const inp of inputs) { m0.push(inp.prior?.mean ?? 0); sd.push(inp.prior?.sd ?? 1); }
      return { m0, sd };
    },
  };
}

// ---------- termes ----------
const sig = (x) => 1 / (1 + Math.exp(-x));
export function gateValue(g, t) {
  if (g.kind === 'all') return 1;
  const end = g.end ?? Infinity;
  if (g.kind === 'sigmoid') return t >= end ? 0 : sig((t - g.tau) / g.width);
  if (t < g.tau) return 0;
  if (g.kind === 'step') return t < end ? 1 : 0;
  if (g.kind === 'ramp') return (Math.min(t, end) - g.tau) / 30;
  return 0;
}
export function basisValues(space, b, r) {
  switch (b.kind) {
    case 'const': return [1];
    case 'in': return [space.xval(r, b.j)];
    case 'in2': { const v = space.xval(r, b.j); return [v * v]; }
    case 'thresh': return [r.x[space.inputs[b.j].key] > b.theta ? 1 : 0];
    case 'dow': return [r.dow === b.d ? 1 : 0];
    case 'season': return [Math.sin((2 * Math.PI * r.t) / 365), Math.cos((2 * Math.PI * r.t) / 365)];
    case 'pulse': return [(((r.t - b.phase) % b.period) + b.period) % b.period === 0 ? 1 : 0];
    case 'adstock': {
      const inp = space.inputs[b.j], cur = r.x[inp.key], st = r.ad?.[inp.key]?.[b.lambda] ?? cur;
      return [transformValue(inp, st) - transformValue(inp, cur)];
    }
    default: return [];
  }
}
export const isVariance = (term) => term.basis.kind === 'variance';
export const termWidth = (term) => (isVariance(term) ? 0 : term.basis.kind === 'season' ? 2 : 1);
export function termValues(space, term, r) { const g = gateValue(term.gate, r.t); return basisValues(space, term.basis, r).map((v) => v * g); }
export function features(space, r, terms) {
  const x = space.base(r);
  for (const term of terms) if (!isVariance(term)) x.push(...termValues(space, term, r));
  return x;
}
export function varianceWeight(t, terms) {
  let w = 1;
  for (const term of terms) if (isVariance(term) && gateValue(term.gate, t) > 0) w *= term.basis.ratio;
  return w;
}

export const S0 = 0.15;
const TERM_SD = { const: 0.7, in: 0.7, in2: 0.7, thresh: 0.7, dow: 0.5, season: 0.5, pulse: 0.7, adstock: 0.7 };
export function priorFor(space, terms) {
  const { m0, sd } = space.basePrior();
  for (const term of terms) {
    const k = termWidth(term), s = term.gate.kind === 'ramp' ? 0.3 : TERM_SD[term.basis.kind] ?? 0.7;
    for (let i = 0; i < k; i++) { m0.push(0); sd.push(s); }
  }
  return { m0, v0: sd.map((x) => (x * x) / (S0 * S0)), a0: 3, b0: 2 * S0 * S0 };
}

function design(space, records, terms) {
  const rows = []; let logW = 0;
  for (const r of records) {
    const y = r.censored ? r.yImp : r.y;
    if (y == null) continue;
    const w = varianceWeight(r.t, terms), sw = Math.sqrt(w);
    rows.push({ x: features(space, r, terms).map((v) => v / sw), y: y / sw, r, sw, cens: !!r.censored, yObs: r.y / sw });
    logW += Math.log(w);
  }
  return { rows, logW };
}
function moments(D, prior, onlyUnc) {
  const d = prior.m0.length;
  const P = Array.from({ length: d }, (_, i) => { const row = new Array(d).fill(0); row[i] = 1 / prior.v0[i]; return row; });
  const rhs = prior.m0.map((m, i) => m / prior.v0[i]);
  let yy = 0, n = 0;
  for (const { x, y, cens } of D.rows) {
    if (onlyUnc && cens) continue;
    n++;
    for (let i = 0; i < d; i++) { const xi = x[i]; if (xi === 0) continue; rhs[i] += xi * y; const Pi = P[i]; for (let j = 0; j < d; j++) Pi[j] += xi * x[j]; }
    yy += y * y;
  }
  return { P, rhs, yy, n };
}
function solveNIG(P, rhs, yy, n, prior, logW) {
  const { m0, v0, a0, b0 } = prior;
  const L = cholesky(P), mn = cholSolve(L, rhs);
  const m0Pm0 = m0.reduce((s, m, i) => s + (m * m) / v0[i], 0);
  const an = a0 + n / 2, bn = Math.max(1e-9, b0 + 0.5 * (yy + m0Pm0 - dot(mn, rhs)));
  const logML = -0.5 * n * Math.log(2 * Math.PI) + 0.5 * (-cholLogDet(L) - v0.reduce((s, v) => s + Math.log(v), 0)) + a0 * Math.log(b0) - an * Math.log(bn) + lgamma(an) - lgamma(a0) - 0.5 * logW;
  return { L, mn, an, bn, logML };
}
function censTerm(rows, xOf, Su) {
  const cens = rows.filter((r) => r.cens);
  if (!cens.length) return { s: 0, m: Su.mn };
  const sig2 = Su.bn / Su.an;
  const S = cholInverse(Su.L).map((row) => row.map((v) => v * sig2));
  const m = Su.mn.slice(), d = m.length;
  let s = 0;
  for (const row of cens) {
    const x = xOf(row), Sx = new Array(d);
    for (let i = 0; i < d; i++) { let v = 0; const Si = S[i]; for (let j = 0; j < d; j++) v += Si[j] * x[j]; Sx[i] = v; }
    const vf = Math.max(1e-12, dot(x, Sx)), s2 = vf + sig2, sc = Math.sqrt(s2);
    const a = (row.yObs - dot(x, m)) / sc, lz = logSurv(a);
    s += lz;
    const lam = Math.exp(-0.5 * a * a - 0.5 * Math.log(2 * Math.PI) - lz), delta = Math.min(1, lam * (lam - a));
    for (let i = 0; i < d; i++) m[i] += Sx[i] * (lam / sc);
    for (let i = 0; i < d; i++) { const Si = S[i], c = Sx[i] * (delta / s2); for (let j = 0; j < d; j++) Si[j] -= c * Sx[j]; }
  }
  return { s, m };
}

const cloneTerm = (t) => ({ family: t.family, gate: { ...t.gate }, basis: { ...t.basis } });

export function fit(space, records, termsIn) {
  const terms = termsIn.map(cloneTerm);
  const prior = priorFor(space, terms);
  const D = design(space, records, terms);
  const M = moments(D, prior, false);
  const S = solveNIG(M.P, M.rhs, M.yy, M.n, prior, D.logW);
  const Mu = moments(D, prior, true);
  const logWu = D.rows.reduce((s, r) => s + (r.cens ? 0 : 2 * Math.log(r.sw)), 0);
  const Su = solveNIG(Mu.P, Mu.rhs, Mu.yy, Mu.n, prior, logWu);
  const score = Su.logML + censTerm(D.rows, (row) => row.x, Su).s;
  const { mn, an, bn, L } = S;
  let Vn = null; const getVn = () => (Vn ??= cholInverse(L));
  const cols = []; let c = space.nBase;
  for (const t of terms) { const k = termWidth(t); cols.push(k ? c : -1); c += k; }
  return {
    space, terms, mn, an, bn, L, cols, n: M.n, logML: score, logMLu: Su.logML, rows: D.rows,
    sigma2: bn / an,
    get Vn() { return getVn(); },
    refitWith(ts) { return fit(space, D.rows.map((x) => x.r), ts); },
    predict(r) {
      const x = features(space, r, terms), V = getVn();
      let q = 0; for (let i = 0; i < x.length; i++) { let v = 0; for (let j = 0; j < x.length; j++) v += V[i][j] * x[j]; q += x[i] * v; }
      return { mu: dot(x, mn), scale: Math.sqrt((bn / an) * (varianceWeight(r.t, terms) + q)) };
    },
    sample(rng) {
      const sigma2 = 1 / (rng.gamma(an) / bn);
      const C = cholesky(getVn().map((row) => row.map((v) => v * sigma2)));
      const z = mn.map(() => rng.normal());
      return { theta: mn.map((m, i) => { let s = m; for (let k = 0; k <= i; k++) s += C[i][k] * z[k]; return s; }), sigma: Math.sqrt(sigma2) };
    },
    muWith(theta, r) { return dot(features(space, r, terms), theta); },
    // pré-score rapide (jours plafonnés remplacés par leur imputation) : sert seulement à présélectionner
    proxyScore(cand) {
      const term = cloneTerm(cand);
      if (isVariance(term)) return -Infinity;
      const k = termWidth(term), d = mn.length, p2 = priorFor(space, [...terms, term]);
      const P = M.P.map((row) => row.concat(new Array(k).fill(0)));
      for (let i = 0; i < k; i++) P.push(new Array(d + k).fill(0));
      const rhs = M.rhs.concat(new Array(k).fill(0));
      for (let i = 0; i < k; i++) P[d + i][d + i] = 1 / p2.v0[d + i];
      for (const row of D.rows) {
        const cv = termValues(space, term, row.r).map((v) => v / row.sw);
        for (let a = 0; a < k; a++) {
          const ca = cv[a]; if (ca === 0) continue;
          rhs[d + a] += ca * row.y;
          for (let j = 0; j < d; j++) { const v = ca * row.x[j]; P[d + a][j] += v; P[j][d + a] += v; }
          for (let b = 0; b < k; b++) P[d + a][d + b] += ca * cv[b];
        }
      }
      return solveNIG(P, rhs, M.yy, M.n, p2, D.logW).logML - S.logML;
    },
    // évaluation exacte d'un terme candidat (moments augmentés + ADF sur les jours plafonnés)
    scoreCandidate(cand) {
      const term = cloneTerm(cand);
      if (isVariance(term)) { const m = fit(space, D.rows.map((x) => x.r), [...terms, term]); return { logML: score + (m.logMLu - Su.logML), coef: [term.basis.ratio] }; }
      const k = termWidth(term), d = mn.length, p2 = priorFor(space, [...terms, term]);
      const P = Mu.P.map((row) => row.concat(new Array(k).fill(0)));
      for (let i = 0; i < k; i++) P.push(new Array(d + k).fill(0));
      const rhs = Mu.rhs.concat(new Array(k).fill(0));
      for (let i = 0; i < k; i++) P[d + i][d + i] = 1 / p2.v0[d + i];
      const extra = new Map();
      for (const row of D.rows) {
        const cv = termValues(space, term, row.r).map((v) => v / row.sw);
        if (row.cens) { extra.set(row, cv); continue; }
        for (let a = 0; a < k; a++) {
          const ca = cv[a]; if (ca === 0) continue;
          rhs[d + a] += ca * row.y;
          for (let j = 0; j < d; j++) { const v = ca * row.x[j]; P[d + a][j] += v; P[j][d + a] += v; }
          for (let b = 0; b < k; b++) P[d + a][d + b] += ca * cv[b];
        }
      }
      const S2 = solveNIG(P, rhs, Mu.yy, Mu.n, p2, logWu);
      const ct = censTerm(D.rows, (row) => row.x.concat(extra.get(row)), S2);
      return { logML: S2.logML + ct.s, coef: ct.m.slice(d) };
    },
  };
}
