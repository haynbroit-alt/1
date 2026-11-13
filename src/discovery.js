// Découverte ouverte : générer des explications candidates par une GRAMMAIRE
// (déclencheur × mécanisme), les comparer par vraisemblance marginale exacte avec un
// prior hiérarchique (familles équiprobables, puis uniforme dans chaque famille),
// puis les raconter en langage clair à partir de leur structure.
import { DOW_FULL, P_REF } from './model.js';

// Familles d'explications. 'closed' = vocabulaire de CORTEX v1 ; 'open' = grammaire complète.
export const FAMILY_FR = {
  level: 'rupture de niveau', elasticity: 'sensibilité au prix', marketing: 'efficacité marketing', end: 'fin d’un effet',
  dow: 'habitude hebdomadaire', trend: 'dérive progressive', threshold: 'seuil de prix', curvature: 'courbure de la réponse au prix',
  pulse: 'pic récurrent', season: 'saisonnalité annuelle', adstock: 'effet retard du marketing', variance: 'volatilité',
};
export const GRAMMARS = {
  closed: ['level', 'elasticity', 'marketing'],
  open: ['level', 'elasticity', 'marketing', 'dow', 'trend', 'threshold', 'curvature', 'pulse', 'season', 'adstock', 'variance'],
};
const THETAS = [3, 3.5, 4, 4.5, 5];
// A priori métier (choisi sur les graines de développement, documenté) : les ruptures de niveau sont
// les changements les plus fréquents en commerce, puis ceux de sensibilité au prix ; le reste est équiprobable.
export const FAMILY_PRIOR = { level: 3, elasticity: 1.5, end: 2 };
const PERIODS = [14, 30];
const RATIOS = [0.3, 3.5]; // seules les ruptures de volatilité franches (le bruit de comptage rend la variance du log légèrement hétérogène)
const LAMBDAS = [0.5, 0.8];

const same = (a, b) => a.family === b.family && JSON.stringify(a.basis) === JSON.stringify(b.basis) && a.gate.kind === b.gate.kind && (a.gate.kind === 'all' || Math.abs(a.gate.tau - b.gate.tau) < 10);

// Candidats datés (déclencheur step/ramp à τ) pour une famille.
function dated(family, tau) {
  const s = (basis) => ({ family, gate: { kind: 'step', tau, end: null }, basis });
  switch (family) {
    case 'level': return [s({ kind: 'const' })];
    case 'elasticity': return [s({ kind: 'lp' })];
    case 'marketing': return [s({ kind: 'lm' })];
    case 'dow': return [0, 1, 2, 3, 4, 5, 6].map((d) => s({ kind: 'dow', d }));
    case 'trend': return [{ family, gate: { kind: 'ramp', tau, end: null }, basis: { kind: 'const' } }];
    case 'threshold': return THETAS.map((theta) => s({ kind: 'thresh', theta }));
    case 'curvature': return [s({ kind: 'lp2' })];
    case 'variance': return RATIOS.map((ratio) => s({ kind: 'variance', ratio }));
    case 'pulse': { const out = []; for (const period of PERIODS) for (let phase = 0; phase < period; phase++) out.push(s({ kind: 'pulse', period, phase })); return out; }
    default: return [];
  }
}
// familles coûteuses : grille de dates plus grossière
const COARSE = { pulse: 3 };
// Candidats structurels (présents depuis toujours) : composantes manquantes du modèle.
function structural(family) {
  const a = (basis) => ({ family, gate: { kind: 'all' }, basis });
  switch (family) {
    case 'threshold': return THETAS.map((theta) => a({ kind: 'thresh', theta }));
    case 'curvature': return [a({ kind: 'lp2' })];
    case 'season': return [a({ kind: 'season' })];
    case 'adstock': return LAMBDAS.map((lambda) => a({ kind: 'adstock', lambda }));
    case 'pulse': { const out = []; for (const period of PERIODS) for (let phase = 0; phase < period; phase++) out.push(a({ kind: 'pulse', period, phase })); return out; }
    default: return [];
  }
}

// Génère, évalue et pèse toutes les explications. model = modèle courant (termes admis).
export function searchExplanations(model, t, { grammar = 'open', warmup = 28, lookback = 60, stepTau = 3, minDays = 60 } = {}) {
  const fams = GRAMMARS[grammar];
  const terms = model.terms;
  const cands = [];
  const lo = Math.max(warmup, t - lookback), hi = t - 3;
  for (const f of fams) {
    for (let tau = lo; tau <= hi; tau += stepTau * (COARSE[f] ?? 1)) for (const c of dated(f, tau)) cands.push(c);
    // une saisonnalité annuelle n'est identifiable qu'avec assez d'historique
    if (f !== 'season' || t >= minDays) for (const c of structural(f)) cands.push(c);
  }
  // fin d'un effet admis (déclencheur step sans fin)
  terms.forEach((x, i) => {
    if (x.gate.kind !== 'step' || x.gate.end != null || x.family === 'variance') return;
    for (let tau = Math.max(lo, x.gate.tau + 6); tau <= hi; tau += stepTau) cands.push({ family: 'end', target: i, tau });
  });
  const pool = cands.filter((c) => c.family === 'end' || !terms.some((x) => same(x, c)));
  // évaluation
  for (const c of pool) {
    if (c.family === 'end') {
      const alt = terms.map((x, i) => (i === c.target ? { ...x, gate: { ...x.gate, end: c.tau } } : x));
      c.logML = model.refitWith(alt).logML;
    } else {
      const s = model.scoreCandidate(c); c.logML = s.logML; c.coef = s.coef;
    }
  }
  refineBest(model, pool);
  // prior hiérarchique : P(rien) = 1/2 ; chaque famille présente reçoit (1/2)/F, partagée entre ses candidats
  const byFam = {};
  for (const c of pool) (byFam[c.family] ??= []).push(c);
  const wsum = Object.keys(byFam).reduce((s, f) => s + (FAMILY_PRIOR[f] ?? 1), 0);
  const scores = [model.logML + Math.log(0.5)];
  for (const c of pool) { c.logPrior = Math.log((0.5 * (FAMILY_PRIOR[c.family] ?? 1)) / wsum / byFam[c.family].length); scores.push(c.logML + c.logPrior); }
  const mx = Math.max(...scores);
  const Z = scores.reduce((s, x) => s + Math.exp(x - mx), 0);
  const pNull = Math.exp(scores[0] - mx) / Z;
  const famMass = {};
  pool.forEach((c, i) => { c.post = Math.exp(scores[i + 1] - mx) / Z; c.logBF = c.logML - model.logML; famMass[c.family] = (famMass[c.family] || 0) + c.post; });
  pool.sort((a, b) => b.post - a.post);
  return { pNull, famMass, top: pool.slice(0, 8), all: pool, nCandidates: pool.length };
}

// Affinage de la date au jour près autour des meilleurs candidats datés de chaque famille.
function refineBest(model, pool) {
  const bestByFam = {};
  for (const c of pool) if (c.gate && c.gate.kind !== 'all' && (!bestByFam[c.family] || c.logML > bestByFam[c.family].logML)) bestByFam[c.family] = c;
  for (const c of Object.values(bestByFam)) {
    for (const d of [-2, -1, 1, 2]) {
      const v = { ...c, gate: { ...c.gate, tau: c.gate.tau + d }, refined: true };
      const s = model.scoreCandidate(v);
      v.logML = s.logML; v.coef = s.coef;
      pool.push(v);
    }
  }
}

// Narration : la structure du terme + ses coefficients → une explication lisible.
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)} %`;
export function narrate(term, coef) {
  const c = coef?.[0] ?? 0, g = term.gate;
  const since = g.kind === 'all' ? 'Depuis toujours' : `Depuis le jour ${g.tau}`;
  const until = g.end != null ? ` jusqu’au jour ${g.end}` : '';
  const b = term.basis;
  switch (b.kind) {
    case 'const': {
      const e = Math.exp(c) - 1;
      if (g.kind === 'ramp') return `${since}${until}, la clientèle dérive progressivement de ${pct(Math.exp(c) - 1)} par mois (${e < 0 ? 'érosion lente : quartier qui change, concurrence qui s’installe' : 'croissance lente : bouche-à-oreille'}).`;
      return `${since}${until}, la demande a ${e < 0 ? 'chuté' : 'bondi'} de ${pct(e)} (${e < 0 ? 'concurrent ou perte de clientèle' : g.end != null ? 'événement temporaire, mode passagère' : 'nouvelle clientèle ou effet de mode'}).`;
    }
    case 'lp': return `${since}, les clients ${c < 0 ? 'réagissent plus fortement' : 'réagissent moins'} au prix (élasticité ${c < 0 ? 'renforcée' : 'atténuée'} de ${Math.abs(c).toFixed(2)}).`;
    case 'lm': return `${since}, le marketing est ${c > 0 ? 'plus' : 'moins'} efficace (${c > 0 ? '+' : ''}${c.toFixed(2)}).`;
    case 'dow': return `${since}, le ${DOW_FULL[b.d]} a changé : ${pct(Math.exp(c) - 1)} de clients ce jour-là (habitude déplacée : marché, horaires, voisinage).`;
    case 'thresh': return `${since}, au-delà de ${b.theta.toFixed(2)} € les clients décrochent : ${pct(Math.exp(c) - 1)} de demande (seuil psychologique de prix).`;
    case 'lp2': return `${since}, la réponse au prix n’est pas proportionnelle : ${c < 0 ? 'les écarts au prix habituel sont punis plus fort qu’attendu' : 'les clients s’habituent aux extrêmes'} (courbure ${c.toFixed(2)}).`;
    case 'season': {
      const [a, bb] = coef ?? [0, 0];
      const amp = Math.sqrt(a * a + bb * bb);
      const peak = ((Math.round((Math.atan2(a, bb) * 365) / (2 * Math.PI)) % 365) + 365) % 365;
      return `Il existe un cycle annuel : ±${Math.round((Math.exp(amp) - 1) * 100)} % de clients, pic vers le jour ${peak}, creux vers le jour ${(peak + 182) % 365}.`;
    }
    case 'pulse': return `${since}, un pic revient tous les ${b.period} jours (${pct(Math.exp(c) - 1)}, ex. jour ${b.phase}) : événement récurrent (paie, marché, livraison).`;
    case 'adstock': return `Le marketing agit avec retard : son effet persiste plusieurs jours (demi-vie ≈ ${(Math.log(0.5) / Math.log(b.lambda)).toFixed(1)} j), il ne faut pas le juger sur le jour même.`;
    case 'variance': return `${since}, la demande est ${b.ratio > 1 ? `${Math.sqrt(b.ratio).toFixed(1)} fois plus volatile` : `${(1 / Math.sqrt(b.ratio)).toFixed(1)} fois plus stable`} : ${b.ratio > 1 ? 'prudence sur les stocks' : 'je peux serrer les stocks'}.`;
    default: return '';
  }
}

// Alternatives de requalification : même date, autres mécanismes ; ou composante structurelle.
export function alternatives(term, grammar) {
  const out = [];
  if (term.gate.kind !== 'all') {
    for (const f of GRAMMARS[grammar]) for (const c of dated(f, term.gate.tau)) if (JSON.stringify(c.basis) !== JSON.stringify(term.basis) || c.gate.kind !== term.gate.kind) out.push({ ...c, gate: { ...c.gate, end: term.gate.end ?? null } });
  }
  for (const f of GRAMMARS[grammar]) if (f !== 'pulse') for (const c of structural(f)) if (JSON.stringify(c.basis) !== JSON.stringify(term.basis)) out.push(c);
  return out;
}

export { P_REF };
