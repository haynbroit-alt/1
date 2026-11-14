// Prototype P4 : boucle fermée. Usage : node research/v6/p4/run4.js --seeds 1-20 --out research/v6/p4/p4-dev.json
import { writeFileSync } from 'node:fs';
import { makeVelos4 } from './world4.js';
import { Learner4 } from './learner4.js';

export const CELLS = [33, 60, 120].flatMap((tau) => [0, 0.25].map((c) => ({ tau, c })));
export const ARMS = ['oracle-patient', 'oracle-patient-j30', 'oracle-myope', 'habitude', 'E0P0', 'E1P0', 'E0P1', 'E1P1'];
const BASE_END = 30, PLATEAU = { from: 30, to: 120, prix: 10 };
const clamp = (p) => Math.max(8, Math.min(20, p));

// opts.explore : 'palier' (10 € des jours 30 à 119) | 'carre45' | 'carre30' (créneaux de ±20 % autour du prix recommandé,
// demi-période 45 ou 30 jours, des jours 30 à 209 ou 30 à 269) — variantes étudiées en développement
export function runArm(seed, cell, arm, opts = {}) {
  const design = opts.explore ?? 'carre45'; // choix gelé après développement (voir PROTOCOLE_P4.md, journal)
  const w = makeVelos4(seed, cell);
  const L = arm.startsWith('E') ? new Learner4(opts.only ? { only: opts.only === 'vrai' ? { src: 'loc', tau: cell.tau } : opts.only } : {}) : null;
  const explore = arm.startsWith('E1'), patient = arm.endsWith('P1');
  let profit = 0, sumP = 0, censored = 0, base = 12;
  const snap = {};
  for (let t = 0; t < 365; t++) {
    let prix;
    if (arm === 'oracle-patient') prix = w.oraclePatient(t);
    else if (arm === 'oracle-patient-j30') prix = t < BASE_END ? 12 : w.oraclePatient(t); // même période de référence que les apprenants
    else if (arm === 'oracle-myope') prix = w.oracleMyope(t);
    else if (arm === 'habitude' || t < BASE_END) prix = 12;
    else if (explore && design === 'palier' && t >= PLATEAU.from && t < PLATEAU.to) prix = PLATEAU.prix;
    else if (explore && design.startsWith('carre') && t >= 30 && t < (design === 'carre45' ? 210 : 270)) {
      const h = design === 'carre45' ? 45 : 30, blk = Math.floor((t - 30) / h);
      if ((t - 30) % h === 0) base = L.decide(t, patient); // prix recommandé, fixé au début de chaque créneau
      prix = clamp(Math.round(base * (blk % 2 ? 1.2 : 0.8)));
    }
    else prix = clamp(L.decide(t, patient) + (t % 2 ? 1 : -1)); // petite variation alternée (±1 €), identique pour tous les apprenants
    const o = w.step(prix);
    profit += o.reward; sumP += prix; censored += o.censored ? 1 : 0;
    if (L) L.observe(t, prix, o.locations, o.censored);
    if (L && (t === 179 || t === 364)) snap[t] = { ...L.summary(), elasticity: L.longRunElasticity(t + 1), trueElasticity: w.trueLongRunElasticity(t + 1) };
  }
  return { seed, tau: cell.tau, c: cell.c, arm, profit, meanPrice: sumP / 365, censored, snap };
}

if (process.argv[1]?.endsWith('run4.js')) {
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
  const [a, b] = arg('--seeds', '1-3').split('-').map(Number);
  const out = [];
  const t0 = Date.now();
  for (let s = a; s <= (b ?? a); s++) { for (const cell of CELLS) for (const arm of ARMS) out.push(runArm(s, cell, arm)); process.stderr.write(`\r${s} (${((Date.now() - t0) / 1000).toFixed(0)} s)`); }
  writeFileSync(arg('--out', 'research/v6/p4/p4-dev.json'), JSON.stringify(out));
  console.error('\nok', out.length);
}
