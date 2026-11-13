// Politiques de référence pour mesurer honnêtement la valeur de CORTEX.
import { optimize } from './econ.js';
import { DOW_LOG } from './world.js';

// L'oracle connaît la vérité cachée (paramètres, événements, bruit σ) : borne supérieure.
export function createOracle(world) {
  return {
    name: 'Oracle (connaît la vérité cachée)',
    act(t) {
      const sigma = world.scenario.noise;
      return optimize((p, m) => ({ mu: world.logRate(t, p, m), s: sigma }), world.cost(t));
    },
    observe() {},
  };
}

// L'habitude : prix fixe 4 €, pas de marketing, commande = moyenne des ventes récentes + 10 %.
export function createHabit() {
  const hist = [];
  return {
    name: 'Habitude (prix fixe, stock moyen)',
    act() { const r = hist.slice(-7); const m = r.length ? r.reduce((s, x) => s + x, 0) / r.length : 120; return { price: 4, marketing: 0, order: Math.round(m * 1.1) }; },
    observe(o) { hist.push(o.sales); },
  };
}

export const _unused = DOW_LOG;
