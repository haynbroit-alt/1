// ACTIVITÉ INCONNUE n° 2 — hôtel de 80 chambres. Écrite APRÈS le gel de la v4 (commit a7d0da6).
import { makeRng, poissonInv } from '../rng.js';

export function hotelScenario(seed) {
  const r = makeRng(seed * 613 + 29);
  return {
    peak: Math.round(r.uniform(150, 230)),
    events: [
      { outcome: 'reservations', type: 'season', start: 0, label: 'Saison touristique', classe: 'représentable', expect: ['season'], structural: true, anyDate: true },
      { outcome: 'reservations', type: 'level', start: Math.round(r.uniform(110, 160)), mag: Math.log(r.uniform(1.2, 1.3)), label: 'Un hôtel concurrent ferme pour travaux', classe: 'représentable', expect: ['level'] },
      { outcome: 'reservations', type: 'promoFatigue', start: 0, label: 'Une promotion répétée perd son effet (mémoire λ = 0,9 de la promotion)', classe: 'représentable', expect: ['memory:ema9:promo', 'memory:ema7:promo'], structural: true, anyDate: true },
      { outcome: 'reservations', type: 'reputation', start: 0, label: 'Réputation : mémoire lente (λ = 0,97) de la satisfaction des clients', classe: 'hors de portée', expect: ['memory:lag:satisfaction'], structural: true, anyDate: true },
      { outcome: 'satisfaction', type: 'ratio', start: 0, label: 'La satisfaction dépend du personnel PAR chambre occupée (rapport à une autre mesure)', classe: 'hors de portée', expect: ['memory:lag:reservations'], structural: true, anyDate: true },
    ],
  };
}

export function hotelBody(seed, sc = hotelScenario(seed)) {
  const nr = makeRng(seed * 3301 + 7);
  const N = { e: [], u: [], s: [], ev: [] };
  for (let t = 0; t < 400; t++) { N.e.push(nr.normal()); N.u.push(nr.next()); N.s.push(nr.normal()); N.ev.push(nr.next()); }
  const evt = (t) => (N.ev[t] < 0.08 ? 1 : 0);
  const lvl = sc.events.find((e) => e.type === 'level');
  let T = 0, rep = 7.5, emaPromo = 0;
  const demandMu = (t, a, r0 = rep, ep = emaPromo) => {
    let v = Math.log(55) - 1.3 * Math.log(a.prix / 110) + 0.35 * Math.cos((2 * Math.PI * (t - sc.peak)) / 365) + 0.5 * evt(t) + 0.8 * (r0 - 7.5) / 7.5;
    v += 0.3 * a.promo * (1 - (0.1 * a.promo + 0.9 * ep));
    if (t >= lvl.start) v += lvl.mag;
    if (t % 7 === 4 || t % 7 === 5) v += 0.2;
    return v;
  };
  const satMu = (a, occ) => Math.log(7.5) + 0.25 * Math.log((a.personnel / Math.max(5, occ)) / (6 / 50)) - 0.05 * a.promo;
  const reward = (a, o) => o.reservations * a.prix - 140 * a.personnel - 300 * a.promo - 2500;
  return {
    id: 'hotel', label: 'Hôtel (inconnu)',
    levers: [
      { key: 'prix', label: 'prix de la chambre', unit: '€', kind: 'continuous', min: 60, max: 180, step: 5, init: 110, transform: 'log', ref: 110, sign: -1 },
      { key: 'personnel', label: 'personnel', unit: '', kind: 'discrete', values: [4, 6, 8, 10], init: 6, transform: 'log', ref: 6 },
      { key: 'promo', label: 'promotion en ligne', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin' },
    ],
    context: [{ key: 'evenement', label: 'congrès en ville', unit: '', transform: 'lin' }],
    outcomes: [
      { key: 'reservations', label: 'les réservations', plural: true, of: 'des réservations', inputs: ['prix', 'personnel', 'promo', 'evenement'], prior: { mean: Math.log(40), sd: 3 }, priors: { prix: { mean: -1, sd: 1 } }, cap: () => 80 },
      { key: 'satisfaction', label: 'la satisfaction', of: 'de la satisfaction', inputs: ['prix', 'personnel', 'promo', 'evenement'], prior: { mean: Math.log(7), sd: 2 } },
    ],
    reward,
    contextAt: (t) => ({ evenement: evt(t) }),
    step(a) {
      const t = T++;
      const D = poissonInv(Math.exp(demandMu(t, a) + 0.15 * N.e[t]), N.u[t]);
      const reservations = Math.min(D, 80);
      const satisfaction = Math.min(10, Math.exp(satMu(a, reservations) + 0.06 * N.s[t]));
      rep = 0.03 * satisfaction + 0.97 * rep;
      emaPromo = 0.1 * a.promo + 0.9 * emaPromo;
      const o = { reservations, satisfaction };
      return { outcomes: o, censored: { reservations: D >= 80, satisfaction: false }, reward: reward(a, o) };
    },
    habit: () => ({ prix: 110, personnel: 6, promo: 0 }),
    truth: {
      mu: (k, t, a) => (k === 'reservations' ? demandMu(t, a) : satMu(a, Math.min(80, Math.exp(demandMu(t, a))))), sd: (k) => (k === 'reservations' ? 0.15 : 0.06),
      events: () => sc.events.map((x) => ({ ...x })),
    },
    probes: [80, 110, 150].flatMap((prix) => [4, 8].map((personnel) => ({ prix, personnel, promo: 0 }))),
  };
}
