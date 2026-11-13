// Environnements : des commerces différents, chacun avec ses changements cachés.
// L'agent est IDENTIQUE partout : il ne sait pas dans quel environnement il se trouve.
// Les familles attendues (`expect`) servent uniquement à NOTER la compréhension dans le banc d'essai.
import { makeRng } from './rng.js';
import { defaultScenario } from './world.js';

const base = (r, extra = {}) => ({ alpha: Math.log(r.uniform(110, 135)), beta: r.uniform(-1.95, -1.6), gamma: r.uniform(0.12, 0.2), noise: 0.12, baseCost: 1.2, events: [], ...extra });

export const ENVS = {
  // contrôle : rien ne change → toute « découverte » est une fausse découverte
  calme: { label: 'Monde calme (contrôle)', make: (seed) => base(makeRng(seed * 31 + 1)) },

  boulangerie: {
    label: 'Boulangerie (changements de CORTEX v1)',
    make: (seed) => {
      const sc = defaultScenario(seed);
      sc.events[0].expect = ['level']; sc.events[2].expect = ['elasticity']; sc.events[3].expect = ['level'];
      return sc;
    },
  },

  glacier: {
    label: 'Glacier (saison, canicule, seuil de prix)',
    make: (seed) => {
      const r = makeRng(seed * 31 + 2), sc = base(r);
      const hw = Math.round(r.uniform(185, 230));
      sc.events.push(
        { type: 'season', amp: r.uniform(0.35, 0.5), peak: Math.round(r.uniform(180, 220)), label: 'Saison : la demande suit l’été', expect: ['season'], structural: true },
        { type: 'threshold', start: Math.round(r.uniform(110, 150)), theta: 4.5, mag: Math.log(r.uniform(0.6, 0.72)), label: 'Une glace à plus de 4,50 € ne se vend plus', expect: ['threshold'] },
        { type: 'level', start: hw, end: hw + 12, mag: Math.log(r.uniform(1.4, 1.6)), label: 'Canicule (12 jours)', expect: ['level'] },
        { type: 'cost', start: Math.round(r.uniform(140, 170)), value: 1.6, label: 'Le lait augmente' },
      );
      return sc;
    },
  },

  marche: {
    label: 'Stand de marché (habitudes, érosion, volatilité)',
    make: (seed) => {
      const r = makeRng(seed * 31 + 3), sc = base(r);
      sc.events.push(
        { type: 'dow', start: Math.round(r.uniform(100, 140)), shift: [0, 0, 0.45, 0, 0, -0.45, 0], label: 'Le marché passe du samedi au mercredi', expect: ['dow'] },
        { type: 'trend', start: Math.round(r.uniform(190, 230)), perDay: -r.uniform(0.003, 0.005), label: 'Un supermarché ouvre : érosion lente de la clientèle', expect: ['trend'] },
        { type: 'variance', start: Math.round(r.uniform(260, 290)), factor: 1.9, label: 'Météo capricieuse : demande bien plus volatile', expect: ['variance'] },
      );
      return sc;
    },
  },

  fleuriste: {
    label: 'Fleuriste (pics récurrents, effet retard, concurrence)',
    make: (seed) => {
      const r = makeRng(seed * 31 + 4), sc = base(r, { gamma: r.uniform(0.18, 0.25) });
      sc.events.push(
        { type: 'adstock', start: 0, lambda: 0.7, label: 'La publicité agit sur plusieurs jours', expect: ['adstock'], structural: true },
        { type: 'pulse', start: Math.round(r.uniform(50, 90)), period: 14, phase: r.int(0, 13), mag: Math.log(r.uniform(1.4, 1.6)), label: 'Jour de paie tous les 14 jours', expect: ['pulse'] },
        { type: 'level', start: Math.round(r.uniform(150, 180)), end: null, mag: Math.log(r.uniform(0.7, 0.8)), label: 'Une jardinerie ouvre', expect: ['level'] },
        { type: 'elasticity', start: Math.round(r.uniform(240, 270)), mag: r.uniform(-0.9, -0.6), label: 'Clients plus regardants sur le prix', expect: ['elasticity'] },
      );
      return sc;
    },
  },
};
export const DEV_ENVS = ['calme', 'boulangerie', 'glacier', 'marche', 'fleuriste'];

// ───────────────────────────────────────────────────────────────────────────────
// ENVIRONNEMENT TENU SECRET (pré-enregistré) : écrit AVANT toute exécution, jamais utilisé
// pendant le développement. Ses mécanismes ne sont PAS ceux de la grammaire : déclin en S
// (logistique) au lieu d'une rampe, seuil de prix progressif (sigmoïde) au lieu d'une marche,
// pics mensuels à date irrégulière (±1 j), saison d'amplitude et de phase aléatoires.
// ───────────────────────────────────────────────────────────────────────────────
export const HELDOUT = {
  kiosque: {
    label: 'Kiosque de gare (tenu secret)',
    make: (seed) => {
      const r = makeRng(seed * 31 + 77), sc = base(r);
      sc.events.push(
        { type: 'season', amp: r.uniform(0.2, 0.3), peak: Math.round(r.uniform(0, 364)), label: 'Fréquentation saisonnière de la gare', expect: ['season'], structural: true },
        { type: 'pulse', start: Math.round(r.uniform(40, 70)), period: 30, phase: r.int(0, 29), jitter: 1, mag: Math.log(r.uniform(1.4, 1.7)), label: 'Salon mensuel (date ±1 j)', expect: ['pulse'] },
        { type: 'threshold', start: Math.round(r.uniform(90, 130)), theta: r.uniform(3.8, 4.6), soft: 0.15, mag: Math.log(r.uniform(0.55, 0.7)), label: 'Seuil de prix progressif (sigmoïde)', expect: ['threshold', 'curvature'] },
        { type: 'logistic', start: 0, mid: Math.round(r.uniform(150, 200)), width: r.uniform(8, 15), mag: Math.log(r.uniform(0.6, 0.7)), label: 'Travaux : déclin en S de la fréquentation', expect: ['trend', 'level'] },
        { type: 'variance', start: Math.round(r.uniform(230, 260)), factor: 1.7, label: 'Grèves : demande plus volatile', expect: ['variance'] },
        { type: 'dow', start: Math.round(r.uniform(280, 320)), shift: [0, 0, 0, 0, 0, 0, -0.6], label: 'Fermeture partielle le dimanche', expect: ['dow'] },
      );
      return sc;
    },
  },
};
Object.assign(ENVS, HELDOUT);
export const TEST_ENVS = [...DEV_ENVS, 'kiosque'];
