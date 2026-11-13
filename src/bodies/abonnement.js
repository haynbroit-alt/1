// CORPS « abonnement » — écrit APRÈS le gel du cerveau (protocole n° 2). Un service en ligne :
// inscriptions et résiliations quotidiennes, prix mensuel, publicité, essai gratuit, vacances scolaires.
// Contient volontairement un mécanisme HORS grammaire : l'usure PROGRESSIVE de l'effet publicitaire.
import { makeRng, poissonInv } from '../rng.js';

const DOW = [0, -0.05, -0.05, 0, 0.05, 0.15, 0.12];
const sig = (x) => 1 / (1 + Math.exp(-x));
export function abonnementScenario(seed) {
  const r = makeRng(seed * 307 + 11);
  const viral = Math.round(r.uniform(165, 190)), out = Math.round(r.uniform(280, 310));
  return {
    beta: r.uniform(-1.6, -1.2),
    events: [
      { outcome: 'inscriptions', type: 'slope', key: 'prix', start: Math.round(r.uniform(100, 140)), mag: -r.uniform(0.7, 1.0), label: 'Un concurrent moins cher arrive : les prospects regardent le prix', expect: ['slope:prix'] },
      { outcome: 'inscriptions', type: 'level', start: viral, end: viral + 12, mag: Math.log(r.uniform(1.6, 2.0)), label: 'Mention par un influenceur (12 jours)', expect: ['level'] },
      { outcome: 'inscriptions', type: 'pubFatigue', start: 0, mid: Math.round(r.uniform(230, 270)), width: 10, label: 'Lassitude publicitaire progressive (hors grammaire : sigmoïde sur une sensibilité)', expect: ['slope:pub'] },
      { outcome: 'resiliations', type: 'level', start: out, end: out + 7, mag: Math.log(r.uniform(1.6, 1.9)), label: 'Panne du service (7 jours) : les clients partent', expect: ['level'] },
    ],
  };
}

export function abonnementBody(seed, sc = abonnementScenario(seed)) {
  const nr = makeRng(seed * 6007 + 5);
  const N = { a: [], b: [], u1: [], u2: [] };
  for (let t = 0; t < 400; t++) { N.a.push(nr.normal()); N.b.push(nr.normal()); N.u1.push(nr.next()); N.u2.push(nr.next()); }
  const vac = (t) => (t % 365 >= 180 && t % 365 < 240) || (t % 365 >= 290 && t % 365 < 300) ? 1 : 0;
  const on = (ev, t) => t >= ev.start && (ev.end == null || t < ev.end);
  let T = 0;
  const mu = (k, t, a) => {
    const lp = Math.log(a.prix / 15), lm = Math.log1p(a.pub / 100);
    if (k === 'inscriptions') {
      let beta = sc.beta, gPub = 0.3, v = Math.log(60) + DOW[t % 7] + 0.15 * (a.essai / 7) + 0.2 * vac(t);
      for (const ev of sc.events) if (ev.outcome === 'inscriptions') {
        if (ev.type === 'slope' && on(ev, t)) beta += ev.mag;
        if (ev.type === 'level' && on(ev, t)) v += ev.mag;
        if (ev.type === 'pubFatigue') gPub *= 1 - 0.7 * sig((t - ev.mid) / ev.width);
      }
      return v + beta * lp + gPub * lm;
    }
    let v = Math.log(18) + 0.8 * lp + 0.12 * (a.essai / 7);
    for (const ev of sc.events) if (ev.outcome === 'resiliations' && ev.type === 'level' && on(ev, t)) v += ev.mag;
    return v;
  };
  const reward = (a, o) => 3 * a.prix * o.inscriptions - 2 * a.prix * o.resiliations - a.pub - 1.5 * a.essai / 7 * o.inscriptions - 400;
  return {
    id: 'abonnement', label: 'Service d’abonnement (écrit après le gel)',
    levers: [
      { key: 'prix', label: 'prix mensuel', unit: '€', kind: 'continuous', min: 9, max: 29, step: 1, init: 15, transform: 'log', ref: 15, sign: -1 },
      { key: 'pub', label: 'publicité', unit: '€/j', kind: 'discrete', values: [0, 300, 700, 1500], init: 300, transform: 'log1p', scale: 100 },
      { key: 'essai', label: 'essai gratuit', unit: 'jours', kind: 'discrete', values: [0, 7, 14], init: 7, transform: 'lin', ref: 7, scale: 7 },
    ],
    context: [{ key: 'vacances', label: 'vacances scolaires', unit: '', transform: 'lin' }],
    outcomes: [
      { key: 'inscriptions', label: 'les inscriptions', plural: true, of: 'des inscriptions', inputs: ['prix', 'pub', 'essai', 'vacances'], prior: { mean: Math.log(50), sd: 3 }, priors: { prix: { mean: -1, sd: 1 } } },
      { key: 'resiliations', label: 'les résiliations', plural: true, of: 'des résiliations', inputs: ['prix', 'pub', 'essai', 'vacances'], prior: { mean: Math.log(20), sd: 3 } },
    ],
    reward,
    contextAt: (t) => ({ vacances: vac(t) }),
    step(a) {
      const t = T++;
      const ins = poissonInv(Math.exp(mu('inscriptions', t, a) + 0.15 * N.a[t]), N.u1[t]);
      const res = poissonInv(Math.exp(mu('resiliations', t, a) + 0.12 * N.b[t]), N.u2[t]);
      const o = { inscriptions: ins, resiliations: res };
      return { outcomes: o, censored: { inscriptions: false, resiliations: false }, reward: reward(a, o) };
    },
    habit: () => ({ prix: 15, pub: 300, essai: 7 }),
    truth: { mu: (k, t, a) => mu(k, t, a), sd: (k) => (k === 'inscriptions' ? 0.15 : 0.12), events: () => sc.events.map((x) => ({ ...x })) },
    probes: [10, 15, 20, 26].flatMap((prix) => [0, 700].map((pub) => ({ prix, pub, essai: 7 }))),
  };
}
