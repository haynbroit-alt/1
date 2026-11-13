// Modèle du monde : régression linéaire bayésienne conjuguée Normale–Inverse-Gamma, pondérée.
// y = log(demande) ; x = caractéristiques de base (prix, jour, marketing) + TERMES découverts.
//
// Un terme est une composition  DÉCLENCHEUR TEMPOREL × MÉCANISME :
//   déclencheur : 'all' (depuis toujours) | 'step' (à partir de τ, jusqu'à end) | 'ramp' (croît linéairement depuis τ)
//   mécanisme   : const | lp (log prix) | lp2 (courbure) | lm (marketing) | dow (un jour de semaine)
//                 | thresh (prix > θ) | season (annuelle, 2 colonnes) | pulse (tous les k jours, phase φ)
//                 | adstock (rémanence du marketing, λ) | variance (volatilité ×ratio : pondération, pas une colonne)
// Tout reste exact : postérieure, prédictive de Student, vraisemblance marginale (facteurs de Bayes).
import { cholesky, cholSolve, cholInverse, cholLogDet, dot, matVec } from './linalg.js';

// log P(Z > a) pour Z ~ N(0,1), précis aussi dans la queue (forme d'Abramowitz–Stegun).
export function logSurv(a) {
  const z = Math.abs(a) / Math.SQRT2, t = 1 / (1 + 0.3275911 * z);
  const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
  return a >= 0 ? Math.log(0.5 * poly) - (a * a) / 2 : Math.log(1 - 0.5 * poly * Math.exp(-(a * a) / 2));
}
// forward-substitution : ||L⁻¹ x||²
function quadInv(L, x) {
  const n = L.length, y = new Array(n); let s2 = 0;
  for (let i = 0; i < n; i++) { let v = x[i]; for (let k = 0; k < i; k++) v -= L[i][k] * y[k]; y[i] = v / L[i][i]; s2 += y[i] * y[i]; }
  return s2;
}
import { lgamma } from './rng.js';

export const P_REF = 4.0;
export const DOW_NAMES = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
export const DOW_FULL = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export const N_BASE = 9;

export function baseFeatures(r) {
  const x = [1, Math.log(r.price / P_REF)];
  for (let d = 1; d < 7; d++) x.push(r.dow === d ? 1 : 0);
  x.push(Math.log1p(r.marketing / 10));
  return x;
}
export const BASE_NAMES = ['niveau', 'élasticité', ...DOW_NAMES.slice(1).map((d) => `effet ${d}`), 'effet marketing'];

// Compatibilité : les anciennes croyances {type, tau, end} deviennent des termes.
const LEGACY = { level: 'const', elasticity: 'lp', marketing: 'lm' };
export function toTerm(b) {
  if (b.basis) return b;
  return { ...b, family: b.type, gate: { kind: 'step', tau: b.tau, end: b.end ?? null }, basis: { kind: LEGACY[b.type] } };
}

export function gateValue(g, t) {
  if (g.kind === 'all') return 1;
  if (t < g.tau) return 0;
  const end = g.end ?? Infinity;
  if (g.kind === 'step') return t < end ? 1 : 0;
  if (g.kind === 'ramp') return (Math.min(t, end) - g.tau) / 30; // unité : mois
  return 0;
}

export function basisValues(b, r) {
  const lp = Math.log(r.price / P_REF);
  switch (b.kind) {
    case 'const': return [1];
    case 'lp': return [lp];
    case 'lp2': return [lp * lp];
    case 'lm': return [Math.log1p(r.marketing / 10)];
    case 'dow': return [r.dow === b.d ? 1 : 0];
    case 'thresh': return [r.price > b.theta ? 1 : 0];
    case 'season': return [Math.sin((2 * Math.PI * r.t) / 365), Math.cos((2 * Math.PI * r.t) / 365)];
    case 'pulse': return [(((r.t - b.phase) % b.period) + b.period) % b.period === 0 ? 1 : 0];
    case 'adstock': { const a = r.ad?.[b.lambda] ?? r.marketing; return [Math.log1p(a / 10) - Math.log1p(r.marketing / 10)]; }
    default: return [];
  }
}
export const isVariance = (term) => term.basis.kind === 'variance';
export const termWidth = (term) => (isVariance(term) ? 0 : term.basis.kind === 'season' ? 2 : 1);

export function termValues(term, r) {
  const g = gateValue(term.gate, r.t);
  const v = basisValues(term.basis, r);
  return v.map((x) => x * g);
}

export function features(r, termsIn) {
  const x = baseFeatures(r);
  for (const b of termsIn) { const term = toTerm(b); if (!isVariance(term)) x.push(...termValues(term, r)); }
  return x;
}
// variance relative du bruit au jour t (produit des ratios des termes de volatilité actifs)
export function varianceWeight(t, terms) {
  let w = 1;
  for (const b of terms) { const term = toTerm(b); if (isVariance(term) && gateValue(term.gate, t) > 0) w *= term.basis.ratio; }
  return w;
}

// Prior : écarts-types ABSOLUS divisés par la variance de bruit a priori (prior NIG : cov = σ²·V0).
export const S0 = 0.15;
const TERM_SD = { const: 0.7, lp: 0.7, lp2: 0.7, lm: 0.5, dow: 0.5, thresh: 0.7, season: 0.5, pulse: 0.7, adstock: 0.7 };
export function priorFor(terms) {
  const m0 = [Math.log(100), -1, 0, 0, 0, 0, 0, 0, 0.05];
  const sd = [2, 1, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5];
  for (const b of terms) {
    const term = toTerm(b), k = termWidth(term);
    const s = term.gate.kind === 'ramp' ? 0.3 : TERM_SD[term.basis.kind] ?? 0.7;
    for (let i = 0; i < k; i++) { m0.push(0); sd.push(s); }
  }
  const v0 = sd.map((x) => (x * x) / (S0 * S0));
  return { m0, v0, a0: 3, b0: 2 * S0 * S0 };
}

// Lignes pondérées (x/√w, y/√w) prêtes pour les moments suffisants.
export function design(records, termsIn) {
  const terms = termsIn.map(toTerm);
  const rows = [];
  let logW = 0;
  for (const r of records) {
    const y = r.censored ? r.yImp : r.y;
    if (y == null) continue;
    const w = varianceWeight(r.t, terms);
    const sw = Math.sqrt(w);
    const x = features(r, terms).map((v) => v / sw);
    rows.push({ x, y: y / sw, r, sw, cens: !!r.censored, yObs: r.y / sw });
    logW += Math.log(w);
  }
  return { terms, rows, logW };
}

function solveNIG(P, rhs, yy, n, prior, logW) {
  const { m0, v0, a0, b0 } = prior;
  const L = cholesky(P);
  const mn = cholSolve(L, rhs);
  const m0Pm0 = m0.reduce((s, m, i) => s + (m * m) / v0[i], 0);
  const an = a0 + n / 2;
  const bn = Math.max(1e-9, b0 + 0.5 * (yy + m0Pm0 - dot(mn, rhs)));
  const logDetV0 = v0.reduce((s, v) => s + Math.log(v), 0);
  const logML = -0.5 * n * Math.log(2 * Math.PI) + 0.5 * (-cholLogDet(L) - logDetV0) + a0 * Math.log(b0) - an * Math.log(bn) + lgamma(an) - lgamma(a0) - 0.5 * logW;
  return { L, mn, an, bn, logML };
}

function moments(D, prior, onlyUncensored = false) {
  const d = prior.m0.length;
  const P = Array.from({ length: d }, (_, i) => { const r = new Array(d).fill(0); r[i] = 1 / prior.v0[i]; return r; });
  const rhs = prior.m0.map((m, i) => m / prior.v0[i]);
  let yy = 0;
  let n = 0;
  for (const { x, y, cens } of D.rows) {
    if (onlyUncensored && cens) continue;
    n++;
    for (let i = 0; i < d; i++) { const xi = x[i]; if (xi === 0) continue; rhs[i] += xi * y; const Pi = P[i]; for (let j = 0; j < d; j++) Pi[j] += xi * x[j]; }
    yy += y * y;
  }
  return { P, rhs, yy, n };
}

export function fit(records, termsIn) {
  const terms = termsIn.map((b) => { const t = toTerm(b); return { family: t.family, gate: { ...t.gate }, basis: { ...t.basis } }; });
  const prior = priorFor(terms);
  const D = design(records, terms);
  const M = moments(D, prior);
  const S = solveNIG(M.P, M.rhs, M.yy, M.n, prior, D.logW);
  // Score de comparaison « Tobit » : vraisemblance marginale exacte des jours observés
  // × probabilité prédictive des ruptures (demande ≥ stock) sous la postérieure des jours observés.
  const Mu = moments(D, prior, true);
  const logWu = D.rows.reduce((s, r) => s + (r.cens ? 0 : 2 * Math.log(r.sw)), 0);
  const Su = solveNIG(Mu.P, Mu.rhs, Mu.yy, Mu.n, prior, logWu);
  const score = Su.logML + censTerm(D.rows, (row) => row.x, Su);
  return makeModel(terms, { ...S, logML: score, logMLImputed: S.logML, logMLu: Su.logML }, M, D, prior, Mu, logWu);
}

// log p(ruptures | jours observés), par filtrage à densité supposée (ADF/EP) :
// chaque jour de rupture (demande ≥ stock) est intégré tour à tour ; la postérieure gaussienne des
// coefficients est mise à jour par appariement de moments de la loi tronquée (σ² fixé à sa moyenne a posteriori).
function censTerm(rows, xOf, Su, withMean = false) {
  const cens = rows.filter((r) => r.cens);
  if (!cens.length) return withMean ? { s: 0, m: Su.mn } : 0;
  const sig2 = Su.bn / Su.an;
  const S = cholInverse(Su.L).map((row) => row.map((v) => v * sig2)); // covariance des coefficients
  const m = Su.mn.slice();
  const d = m.length;
  let s = 0;
  for (const row of cens) {
    const x = xOf(row);
    const Sx = new Array(d);
    for (let i = 0; i < d; i++) { let v = 0; const Si = S[i]; for (let j = 0; j < d; j++) v += Si[j] * x[j]; Sx[i] = v; }
    const vf = Math.max(1e-12, dot(x, Sx)), mu = dot(x, m), s2 = vf + sig2, sc = Math.sqrt(s2);
    const a = (row.yObs - mu) / sc;
    const lz = logSurv(a);
    s += lz;
    const lam = Math.exp(-0.5 * a * a - 0.5 * Math.log(2 * Math.PI) - lz); // φ(a)/S(a)
    const delta = Math.min(1, lam * (lam - a));
    const k1 = lam / sc, k2 = delta / s2;
    for (let i = 0; i < d; i++) m[i] += Sx[i] * k1;
    for (let i = 0; i < d; i++) { const Si = S[i], c = Sx[i] * k2; for (let j = 0; j < d; j++) Si[j] -= c * Sx[j]; }
  }
  return withMean ? { s, m } : s;
}

function makeModel(terms, S, M, D, prior, Mu, logWu) {
  const { mn, an, bn, L, logML } = S;
  let Vn = null;
  const getVn = () => (Vn ??= cholInverse(L));
  // index de la première colonne de chaque terme (−1 pour un terme de volatilité)
  const cols = []; let c = N_BASE;
  for (const t of terms) { const k = termWidth(t); cols.push(k ? c : -1); c += k; }
  const model = {
    terms, beliefs: terms, mn, an, bn, n: M.n, logML, logMLu: S.logMLu, L, cols, _D: D, _M: M, _prior: prior,
    get Vn() { return getVn(); },
    sigma2: bn / an,
    refitWith(ts) { return fit(D.rows.map((x) => x.r), ts); },
    predict(r) {
      const x = features(r, terms);
      const Vx = matVec(getVn(), x);
      const w = varianceWeight(r.t, terms);
      const s2 = (bn / an) * (w + dot(x, Vx));
      return { mu: dot(x, mn), scale: Math.sqrt(s2), dof: 2 * an };
    },
    coefSd(i) { return Math.sqrt((bn / an) * getVn()[i][i]); },
    sample(rng) {
      const sigma2 = 1 / (rng.gamma(an) / bn);
      const C = cholesky(getVn().map((row) => row.map((v) => v * sigma2)));
      const z = mn.map(() => rng.normal());
      const theta = mn.map((m, i) => { let s = m; for (let k = 0; k <= i; k++) s += C[i][k] * z[k]; return s; });
      return { theta, sigma: Math.sqrt(sigma2) };
    },
    // Évaluation rapide d'un terme candidat (colonnes ajoutées) par moments augmentés : O(n·d) au lieu de O(n·d²).
    scoreCandidate(cand) {
      const term = toTerm(cand);
      // volatilité : preuve exigée sur les seuls jours sans rupture (conservateur face à la troncature)
      if (isVariance(term)) { const m = fit(D.rows.map((x) => x.r), [...terms, term]); return { logML: logML + (m.logMLu - S.logMLu), coef: [term.basis.ratio] }; }
      const k = termWidth(term), d = mn.length;
      const p2 = priorFor([...terms, term]);
      const P = Mu.P.map((row) => row.concat(new Array(k).fill(0)));
      for (let i = 0; i < k; i++) P.push(new Array(d + k).fill(0));
      const rhs = Mu.rhs.concat(new Array(k).fill(0));
      for (let i = 0; i < k; i++) P[d + i][d + i] = 1 / p2.v0[d + i];
      const extra = new Map();
      for (const row of D.rows) {
        const cv = termValues(term, row.r).map((v) => v / row.sw);
        if (row.cens) { extra.set(row, cv); continue; }
        for (let a = 0; a < k; a++) {
          const ca = cv[a]; if (ca === 0) continue;
          rhs[d + a] += ca * row.y;
          for (let j = 0; j < d; j++) { const v = ca * row.x[j]; P[d + a][j] += v; P[j][d + a] += v; }
          for (let b = 0; b < k; b++) P[d + a][d + b] += ca * cv[b];
        }
      }
      const S2 = solveNIG(P, rhs, Mu.yy, Mu.n, p2, logWu);
      // coefficients : moyenne a posteriori APRÈS intégration des ruptures (un pic toujours en rupture reste estimable)
      const ct = censTerm(D.rows, (row) => row.x.concat(extra.get(row)), S2, true);
      return { logML: S2.logML + ct.s, coef: ct.m.slice(d) };
    },
  };
  return model;
}

export const predictWith = (theta, r, terms) => dot(features(r, terms), theta);
