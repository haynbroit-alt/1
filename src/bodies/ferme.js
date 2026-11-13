// ACTIVITÉ INCONNUE n° 1 — serre maraîchère. Écrite APRÈS le gel de la v4 (commit a7d0da6).
// Mécanismes cachés, classés AVANT toute exécution : représentable / approximable / hors de portée.
import { makeRng, poissonInv } from '../rng.js';

export function fermeScenario(seed) {
  const r = makeRng(seed * 911 + 17);
  const pest = Math.round(r.uniform(150, 200));
  return {
    events: [
      { outcome: 'recolte', type: 'inter', start: 0, label: 'L’arrosage rapporte d’autant plus qu’il fait chaud', classe: 'représentable', expect: ['interaction:irrigation×temperature'], structural: true, anyDate: true },
      { outcome: 'recolte', type: 'inter', start: 0, label: 'Arroser un jour de pluie ne sert presque à rien', classe: 'représentable', expect: ['interaction:irrigation×pluie'], structural: true, anyDate: true },
      { outcome: 'recolte', type: 'level', start: pest, end: pest + 20, mag: Math.log(r.uniform(0.6, 0.7)), label: 'Attaque de pucerons (20 jours)', classe: 'représentable', expect: ['level'] },
      { outcome: 'recolte', type: 'fert', start: 0, label: 'La fertilité du sol se construit lentement avec l’engrais (mémoire λ = 0,93)', classe: 'approximable', expect: ['memory:ema9:engrais', 'memory:ema7:engrais'], structural: true, anyDate: true },
      { outcome: 'recolte', type: 'rot', start: 0, label: 'Trois jours de suite d’arrosage fort font pourrir les racines', classe: 'approximable', expect: ['memory:ema7:irrigation', 'memory:ema9:irrigation'], structural: true, anyDate: true },
      { outcome: 'recolte', type: 'cap', start: 0, label: 'Plafond caché : un cueilleur ne ramasse pas plus de 70 kg', classe: 'approximable', expect: ['threshold:cueilleurs', 'interaction:cueilleurs×temperature'], structural: true, anyDate: true },
    ],
  };
}

export function fermeBody(seed, sc = fermeScenario(seed)) {
  const nr = makeRng(seed * 7703 + 1);
  const N = { e: [], u: [], T: [], p: [] };
  for (let t = 0; t < 400; t++) { N.e.push(nr.normal()); N.u.push(nr.next()); N.T.push(nr.normal()); N.p.push(nr.next()); }
  const temp = (t) => Math.round((20 + 8 * Math.cos((2 * Math.PI * (t - 200)) / 365) + 3 * N.T[t]) * 10) / 10;
  const rain = (t) => (N.p[t] < 0.25 ? 1 : 0);
  const pest = sc.events.find((e) => e.type === 'level');
  let T = 0, fert = 0.3, wetRun = 0;
  const ripe = (t, a, f = fert, run = wetRun) => {
    const T0 = (temp(t) - 18) / 8, R = rain(t);
    let v = Math.log(260) + 0.1 * a.irrigation + 0.15 * a.irrigation * T0 - 0.12 * a.irrigation * R + 0.35 * (f - 0.5) + 0.1 * T0;
    if (a.irrigation === 2 && run >= 2) v -= 0.35;
    if (t >= pest.start && t < pest.end) v += pest.mag;
    return v;
  };
  const harvestMu = (t, a, f, run) => Math.log(Math.min(Math.exp(ripe(t, a, f, run)), 70 * a.cueilleurs));
  const reward = (a, o) => 4 * o.recolte - 60 * a.irrigation - 150 * a.engrais - 110 * a.cueilleurs - 200;
  return {
    id: 'ferme', label: 'Serre maraîchère (inconnue)',
    levers: [
      { key: 'irrigation', label: 'arrosage', unit: '', kind: 'discrete', values: [0, 1, 2], init: 1, transform: 'lin' },
      { key: 'engrais', label: 'engrais', unit: '', kind: 'discrete', values: [0, 1], init: 0, transform: 'lin' },
      { key: 'cueilleurs', label: 'cueilleurs', unit: '', kind: 'discrete', values: [2, 3, 4, 5, 6], init: 4, transform: 'log', ref: 4 },
    ],
    context: [
      { key: 'temperature', label: 'température prévue', unit: '°C', transform: 'lin', ref: 18, scale: 8 },
      { key: 'pluie', label: 'pluie prévue', unit: '', transform: 'lin' },
    ],
    outcomes: [{ key: 'recolte', label: 'la récolte', of: 'de la récolte', inputs: ['irrigation', 'engrais', 'cueilleurs', 'temperature', 'pluie'], prior: { mean: Math.log(200), sd: 3 } }],
    reward,
    contextAt: (t) => ({ temperature: temp(t), pluie: rain(t) }),
    step(a) {
      const t = T++;
      const lam = Math.min(Math.exp(ripe(t, a) + 0.12 * N.e[t]), 70 * a.cueilleurs);
      const recolte = poissonInv(lam, N.u[t]);
      fert = 0.07 * a.engrais + 0.93 * fert;
      wetRun = a.irrigation === 2 ? wetRun + 1 : 0;
      return { outcomes: { recolte }, censored: { recolte: false }, reward: reward(a, { recolte }) };
    },
    habit: () => ({ irrigation: 1, engrais: 0, cueilleurs: 4 }),
    truth: {
      mu: (k, t, a) => harvestMu(t, a, fert, wetRun), sd: () => 0.12, events: () => sc.events.map((x) => ({ ...x })),
      // l'oracle jour par jour ne voit pas la fertilité future : on lui ajoute une règle d'entretien raisonnable
      oracleAdjust: (t, a) => ({ ...a, engrais: fert < 0.75 ? 1 : 0, irrigation: a.irrigation === 2 && wetRun >= 2 ? 1 : a.irrigation }),
    },
    probes: [0, 1, 2].flatMap((irrigation) => [3, 5].map((cueilleurs) => ({ irrigation, cueilleurs, engrais: 0 }))),
  };
}
