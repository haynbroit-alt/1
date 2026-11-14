// Prototype P4 : « vélos à τ réglable ». Copie paramétrée de src/bodies/velos.js (non modifié) : même bruit pré-tiré par
// graine (nombres aléatoires communs entre bras), seuil concurrent de 15 € retiré, réparations à l'intervalle optimal.
import { makeRng, poissonInv } from '../../../src/rng.js';

export const FLEET = 120, PRICES = Array.from({ length: 13 }, (_, i) => 8 + i);
const DOW = [-0.25, -0.2, -0.15, -0.1, 0.05, 0.4, 0.3];

export function makeVelos4(seed, { tau, c, season = 0.35 }) {
  const r = makeRng(seed * 5153 + 17);
  const phase = Math.round(r.uniform(0, 365));
  const nr = makeRng(seed * 7717 + 3);
  const N = { l: [], u: [] };
  for (let t = 0; t < 400; t++) { N.l.push(nr.normal()); N.u.push(nr.next()); }
  const lam = 1 - 1 / tau;
  let T = 0, M = 70, since = 0;
  const locMu = (t, prix, m = M) => Math.log(70) + DOW[t % 7] + season * Math.sin((2 * Math.PI * (t - phase)) / 365) - 1.2 * Math.log(prix / 12) + c * (m / 70 - 1);
  const pannesMu = (rep, loc, s = since) => Math.log(0.6) + 0.07 * Math.min(25, rep ? 0 : s + 1) + 0.8 * Math.log(Math.max(1, loc) / 70);
  const cost = (k) => { let s = 0; for (let d = 1; d <= k; d++) s += 35 * Math.exp(Math.log(0.6) + 0.07 * Math.min(25, d % k === 0 ? 0 : d)); return (s + 180) / k; };
  let bestK = 1; for (let k = 1; k <= 60; k++) if (cost(k) < cost(bestK)) bestK = k;
  const repairAt = (t) => (t % bestK === bestK - 1 ? 1 : 0);
  // équilibre du bouche-à-oreille sous un prix tenu (moyenne de la semaine, saison courante) — indépendant de λ
  const steadyM = (t, prix) => { let m = M; for (let it = 0; it < 60; it++) { let s = 0; for (let d = 0; d < 7; d++) s += Math.min(FLEET, Math.exp(locMu(t + d, prix, m))); m = s / 7; } return m; };
  return {
    seed, tau, c, lam, bestK,
    step(prix) {
      const t = T++, rep = repairAt(t);
      const D = Math.max(0, Math.round(Math.exp(locMu(t, prix) + 0.1 * N.l[t])));
      const locations = Math.min(D, FLEET);
      const pannes = poissonInv(Math.exp(pannesMu(rep, locations)), N.u[t]);
      since = rep ? 0 : since + 1;
      M = lam * M + (1 - lam) * locations;
      return { t, prix, rep, locations, censored: D >= FLEET, pannes, reward: (prix - 3) * locations - 35 * pannes - 180 * rep - 350 };
    },
    // vérité (bras oracles et notation seulement ; jamais lue par l'apprenant)
    oraclePatient(t) { let best = null; for (const p of PRICES) { const v = (p - 3) * Math.min(FLEET, Math.exp(locMu(t, p, steadyM(t, p)))); if (!best || v > best.v) best = { v, p }; } return best.p; },
    oracleMyope(t) { let best = null; for (const p of PRICES) { const v = (p - 3) * Math.min(FLEET, Math.exp(locMu(t, p))); if (!best || v > best.v) best = { v, p }; } return best.p; },
    // élasticité de long terme vraie autour de 12 € (différence finie sur l'équilibre), au jour t
    trueLongRunElasticity(t) { const f = (p) => Math.log(Math.min(1e9, Math.exp(locMu(t, p, steadyM(t, p))))); return (f(12 * 1.05) - f(12 / 1.05)) / (2 * Math.log(1.05)); },
    state: () => ({ M, since }),
  };
}
