// CORPS « restaurant » (développement). Deux mesures (couverts, ticket moyen), effectif qui plafonne le service,
// météo connue chaque matin. La DYNAMIQUE CACHÉE est simulée ici ; l'agent n'en voit que les conséquences.
import { makeRng, poissonInv } from '../rng.js';

const DOW = [0.7, 0.8, 0.9, 1.0, 1.3, 1.5, 1.1].map(Math.log);
const sig = (x) => 1 / (1 + Math.exp(-x));

export function restaurantScenario(seed) {
  const r = makeRng(seed * 131 + 5);
  return {
    a: Math.log(r.uniform(95, 125)), beta: r.uniform(-1.5, -1.1), tAlpha: Math.log(r.uniform(1.3, 1.4)),
    events: [
      { outcome: 'covers', type: 'level', start: Math.round(r.uniform(70, 110)), mag: Math.log(r.uniform(1.25, 1.4)), label: 'Critique élogieuse dans la presse', expect: ['level'] },
      { outcome: 'covers', type: 'meteo', start: Math.round(r.uniform(110, 150)), mag: r.uniform(0.25, 0.35), label: 'Ouverture de la terrasse : la météo compte désormais', expect: ['slope:meteo'] },
      { outcome: 'ticket', type: 'level', start: Math.round(r.uniform(160, 190)), mag: Math.log(r.uniform(1.08, 1.12)), label: 'Nouvelle carte des vins', expect: ['level'] },
      { outcome: 'covers', type: 'level', start: Math.round(r.uniform(200, 240)), mag: Math.log(r.uniform(0.7, 0.8)), label: 'Un concurrent ouvre dans la rue', expect: ['level'] },
      { outcome: 'covers', type: 'dow', start: Math.round(r.uniform(260, 300)), shift: [0, 0, 0, 0, 0, -0.25, 0.45], label: 'Le brunch du dimanche prend', expect: ['dow'] },
    ],
  };
}

export function restaurantBody(seed, scenario = restaurantScenario(seed)) {
  const sc = scenario, nr = makeRng(seed * 977 + 1);
  const noise = { covers: [], ticket: [], u: [], temp: [] };
  for (let t = 0; t < 400; t++) { noise.covers.push(nr.normal()); noise.ticket.push(nr.normal()); noise.u.push(nr.next()); noise.temp.push(nr.normal()); }
  const temp = (t) => 15 + 9 * Math.cos((2 * Math.PI * (t - 200)) / 365) + 3 * noise.temp[t];
  const on = (e, t) => t >= e.start && (e.end == null || t < e.end);
  let T = 0;
  const hist = [];
  const mu = (k, t, a) => {
    const lp = Math.log(a.menu / 18), T0 = (temp(t) - 15) / 10;
    if (k === 'covers') {
      let v = sc.a + DOW[t % 7] + sc.beta * lp + 0.25 * Math.log(a.staff / 5) + 0.2 * a.promo;
      for (const e of sc.events) if (e.outcome === 'covers' && on(e, t)) { if (e.type === 'level') v += e.mag; if (e.type === 'meteo') v += e.mag * T0; if (e.type === 'dow') v += e.shift[t % 7]; }
      return v;
    }
    let v = sc.tAlpha + Math.log(a.menu) + 0.08 * Math.log(a.staff / 5) - 0.12 * a.promo;
    for (const e of sc.events) if (e.outcome === 'ticket' && on(e, t) && e.type === 'level') v += e.mag;
    return v;
  };
  const SD = { covers: 0.15, ticket: 0.07 };
  return {
    id: 'restaurant', label: 'Restaurant',
    levers: [
      { key: 'menu', label: 'prix moyen d’un plat', unit: '€', kind: 'continuous', min: 12, max: 28, step: 1, init: 18, transform: 'log', ref: 18, sign: -1 },
      { key: 'staff', label: 'serveurs', unit: '', kind: 'discrete', values: [3, 4, 5, 6, 7], init: 5, transform: 'log', ref: 5 },
      { key: 'promo', label: 'happy hour', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin' },
      { key: 'prep', label: 'couverts préparés', unit: '', kind: 'capacity', for: 'covers', init: 120, min: 0, step: 1 },
    ],
    context: [{ key: 'meteo', label: 'température prévue', unit: '°C', transform: 'lin', ref: 15, scale: 10 }],
    outcomes: [
      { key: 'covers', label: 'les couverts', plural: true, of: 'des couverts', inputs: ['menu', 'staff', 'promo', 'meteo'], prior: { mean: Math.log(100), sd: 2 }, priors: { menu: { mean: -1, sd: 1 } }, cap: (a) => Math.min(a.prep, a.staff * 30) },
      { key: 'ticket', label: 'le ticket moyen', of: 'du ticket moyen', inputs: ['menu', 'staff', 'promo', 'meteo'], prior: { mean: Math.log(25), sd: 2 }, priors: { menu: { mean: 1, sd: 1 } } },
    ],
    reward: (a, o) => o.covers * o.ticket - 7 * a.prep - 130 * a.staff - 40 * a.promo - 600,
    contextAt: (t) => ({ meteo: Math.round(temp(t) * 10) / 10 }),
    step(a) {
      const t = T++;
      const cap = Math.min(a.prep, a.staff * 30);
      const D = poissonInv(Math.exp(mu('covers', t, a) + SD.covers * noise.covers[t]), noise.u[t]);
      const covers = Math.min(D, cap);
      const ticket = Math.exp(mu('ticket', t, a) + SD.ticket * noise.ticket[t]);
      const o = { covers, ticket };
      hist.push(covers);
      return { outcomes: o, censored: { covers: D >= cap, ticket: false }, reward: o.covers * o.ticket - 7 * a.prep - 130 * a.staff - 40 * a.promo - 600 };
    },
    habit() { const h = hist.slice(-7); return { menu: 18, staff: 5, promo: 0, prep: Math.round((h.length ? h.reduce((s, x) => s + x, 0) / h.length : 120) * 1.1) }; },
    truth: { mu: (k, t, a) => mu(k, t, a), sd: (k) => SD[k], events: () => sc.events.map((e) => ({ ...e })) },
    probes: [14, 18, 22, 26].flatMap((menu) => [4, 6].map((staff) => ({ menu, staff, promo: 0 }))),
  };
}
