// Prototype P4 : apprenant conjugué, mis à jour chaque jour, du log des locations, moyenné sur « au plus un mode lent ».
// Régresseurs : constante, jours de semaine, sin/cos annuels, x = log(prix/12) ; mode : source filtrée à τ_m (prix ou
// locations passées), normalisée comme dans P1 (échelle √((1+λ)/(1−λ))). Ne lit jamais la vérité du monde.
import { Stats, nig, TAU_GRID } from '../engine.js';
import { FLEET, PRICES } from './world4.js';

const TAUS = TAU_GRID.filter((t) => t >= 5);
const P0 = 10; // constante + 6 jours + sin + cos + x
const V_NUIS = 1e4, G_MODE = 1, A0 = 2, B0 = 0.02;
const WARM = 28;

export class Learner4 {
  // opts.only = { src, tau } : diagnostic « structure connue » (un seul modèle, sans « pas de mode ») — développement seulement
  constructor(opts = {}) {
    const mk = (src, tau) => { const lam = 1 - 1 / tau; return { src, tau, lam, k: Math.sqrt((1 + lam) / (1 - lam)), prev: 0 }; };
    this.models = opts.only ? [mk(opts.only.src, opts.only.tau)] : [{ src: null }, ...['prix', 'loc'].flatMap((src) => TAUS.map((tau) => mk(src, tau)))];
    for (const m of this.models) m.S = new Stats(m.src ? P0 + 1 : P0);
    // a priori : moitié de la masse sur « pas de mode », l'autre moitié répartie uniformément
    const nm = Math.max(1, this.models.filter((m) => m.src).length), hasNull = this.models.some((m) => !m.src);
    this.logPrior = this.models.map((m) => Math.log(m.src ? (hasNull ? 0.5 : 1) / nm : 0.5));
    this.ybuf = []; this.ybar = null; this.post = null;
  }
  base(t, x) { const r = [1, 0, 0, 0, 0, 0, 0, Math.sin((2 * Math.PI * t) / 365), Math.cos((2 * Math.PI * t) / 365), x]; const d = t % 7; if (d) r[d] = 1; return r; }
  row(m, t, x) { const b = this.base(t, x); return m.src ? [...b, m.k * m.prev] : b; }
  observe(t, prix, locations, censored) {
    const x = Math.log(prix / 12), y = Math.log(Math.max(1, locations));
    if (t < WARM) this.ybuf.push(y); else if (this.ybar == null) this.ybar = this.ybuf.reduce((s, v) => s + v, 0) / this.ybuf.length;
    for (const m of this.models) {
      if (!censored && (m.src !== 'loc' || t >= WARM)) m.S.add(this.row(m, t, x), y);
      // état filtré (n'utilise que le passé : la ligne du jour t a été formée avant cette mise à jour)
      if (m.src === 'prix') m.prev = m.lam * m.prev + (1 - m.lam) * x;
      else if (m.src === 'loc' && t >= WARM) m.prev = m.lam * m.prev + (1 - m.lam) * (y - this.ybar);
    }
    this.post = null;
  }
  posterior() {
    if (this.post) return this.post;
    const fits = this.models.map((m) => { const p = m.src ? P0 + 1 : P0; const post = nig(m.S, Array.from({ length: p }, (_, i) => (i < P0 ? V_NUIS : G_MODE)), A0, B0); return { m, coef: Array.from(post.m), s2: post.bn / post.an, logML: post.logML }; });
    const lw = fits.map((f, i) => f.logML + this.logPrior[i]), mx = Math.max(...lw);
    const w = lw.map((v) => Math.exp(v - mx)), sw = w.reduce((s, v) => s + v, 0);
    fits.forEach((f, i) => { f.w = w[i] / sw; });
    this.post = fits;
    return fits;
  }
  // log-moyenne prévue au prix p : myope (état lent du jour, inchangé par le prix du jour) ou à l'équilibre (prix tenu)
  mu(f, t, p, patient) {
    const x = Math.log(p / 12), b = this.base(t, x);
    let lin = 0; for (let i = 0; i < P0; i++) lin += b[i] * f.coef[i];
    if (!f.m.src) return lin;
    const g = f.coef[P0];
    if (!patient) return lin + g * f.m.k * f.m.prev;
    if (f.m.src === 'prix') return lin + g * f.m.k * x; // régime permanent : prev → x
    // source = locations : y = lin + g·k·(y − ȳ)  ⇒  y = (lin − g·k·ȳ)/(1 − g·k), si la boucle est stable
    const gk = g * f.m.k;
    if (this.ybar == null || 1 - gk < 0.2) return lin + g * f.m.k * f.m.prev;
    return (lin - gk * this.ybar) / (1 - gk);
  }
  decide(t, patient) {
    const fits = this.posterior();
    let best = null;
    for (const p of PRICES) {
      let v = 0;
      for (const f of fits) { if (f.w < 1e-6) continue; v += f.w * (p - 3) * Math.min(FLEET, Math.exp(this.mu(f, t, p, patient) + f.s2 / 2)); }
      if (!best || v > best.v) best = { v, p };
    }
    return best.p;
  }
  longRunElasticity(t) { const fits = this.posterior(); const f = (p) => Math.log(fits.reduce((s, q) => s + q.w * Math.exp(this.mu(q, t, p, true)), 0)); return (f(12 * 1.05) - f(12 / 1.05)) / (2 * Math.log(1.05)); }
  summary() { const fits = this.posterior(); const pm = fits.filter((f) => f.m.src).reduce((s, f) => s + f.w, 0); const top = [...fits].sort((a, b) => b.w - a.w)[0]; return { pMode: pm, top: top.m.src ? { src: top.m.src, tau: top.m.tau, w: top.w } : { src: null, w: top.w } }; }
}
