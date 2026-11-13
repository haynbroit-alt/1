import { termValues, gateValue, basisValues } from './gmodel.js';
import { normCdf } from '../rng.js';
// CERVEAU GÉNÉRIQUE — découverte : grammaire DÉCLENCHEUR × MÉCANISME × VARIABLE, sélection bayésienne
// (prior hiérarchique par famille), narration à partir de la structure et des libellés du corps.
export const FAMILY_FR = {
  level: 'rupture de niveau', trend: 'dérive progressive', slope: 'sensibilité', curvature: 'réponse non linéaire',
  threshold: 'effet de seuil', dow: 'habitude hebdomadaire', season: 'cycle annuel', pulse: 'pic récurrent',
  adstock: 'effet retard', variance: 'volatilité', end: 'fin d’un effet',
  memory: 'mécanisme à mémoire (variable construite)', interaction: 'interaction entre deux variables',
};
export const FAMILIES = ['level', 'trend', 'slope', 'curvature', 'threshold', 'dow', 'season', 'pulse', 'adstock', 'variance', 'memory', 'interaction'];
// A priori « métier » générique : les ruptures de niveau sont les changements les plus courants, puis les changements de sensibilité.
export const FAMILY_PRIOR = { level: 3, slope: 1.5, end: 2 };
const PERIODS = [14, 30], RATIOS = [0.3, 3.5], LAMBDAS = [0.5, 0.8], WIDTHS = [6, 12];

export const famKey = (c) => (c.basis && c.basis.j != null && ['slope', 'curvature', 'threshold', 'adstock', 'memory', 'interaction'].includes(c.family) ? `${c.family}:${c.inputKey}` : c.family);
const sameTerm = (a, b) => famKey(a) === famKey(b) && JSON.stringify(a.basis) === JSON.stringify(b.basis) && a.gate.kind === b.gate.kind && (a.gate.kind === 'all' || Math.abs(a.gate.tau - b.gate.tau) < 10);

function mk(space, family, gate, basis) {
  const c = { family, gate, basis };
  if (basis.j != null) c.inputKey = space.inputs[basis.j].key + (basis.k != null ? `×${space.inputs[basis.k].key}` : '');
  return c;
}
function dated(space, family, tau) {
  const S = (basis) => mk(space, family, { kind: 'step', tau, end: null }, basis);
  const J = space.inputs.map((_, j) => j).filter((j) => !space.inputs[j].latent);
  const LAT = space.inputs.map((_, j) => j).filter((j) => space.inputs[j].latent && space.inputs[j].latentKind !== 'inv');
  switch (family) {
    case 'level': return [S({ kind: 'const' }), ...WIDTHS.map((width) => mk(space, family, { kind: 'sigmoid', tau, width, end: null }, { kind: 'const' }))];
    case 'trend': return [mk(space, family, { kind: 'ramp', tau, end: null }, { kind: 'const' })];
    case 'slope': return J.map((j) => S({ kind: 'in', j }));
    case 'curvature': return J.filter((j) => space.inputs[j].continuous).map((j) => S({ kind: 'in2', j }));
    case 'threshold': return J.flatMap((j) => (space.inputs[j].thetas ?? []).map((theta) => S({ kind: 'thresh', j, theta })));
    case 'dow': return [0, 1, 2, 3, 4, 5, 6].map((d) => S({ kind: 'dow', d }));
    case 'variance': return RATIOS.map((ratio) => S({ kind: 'variance', ratio }));
    case 'pulse': { const o = []; for (const period of PERIODS) for (let phase = 0; phase < period; phase++) o.push(S({ kind: 'pulse', period, phase })); return o; }
    case 'memory': return LAT.map((j) => S({ kind: 'in', j }));
    default: return [];
  }
}
function structural(space, family) {
  const A = (basis) => mk(space, family, { kind: 'all' }, basis);
  const J = space.inputs.map((_, j) => j).filter((j) => !space.inputs[j].latent);
  const LAT = space.inputs.map((_, j) => j).filter((j) => space.inputs[j].latent);
  switch (family) {
    case 'threshold': return J.flatMap((j) => (space.inputs[j].thetas ?? []).map((theta) => A({ kind: 'thresh', j, theta })));
    case 'curvature': return J.filter((j) => space.inputs[j].continuous).map((j) => A({ kind: 'in2', j }));
    case 'season': return [A({ kind: 'season' })];
    case 'adstock': return J.filter((j) => space.inputs[j].carry).flatMap((j) => LAMBDAS.map((lambda) => A({ kind: 'adstock', j, lambda })));
    case 'pulse': { const o = []; for (const period of PERIODS) for (let phase = 0; phase < period; phase++) o.push(A({ kind: 'pulse', period, phase })); return o; }
    // variables construites par l'agent (mémoires, jours depuis…, valeur de la veille)
    case 'memory': return LAT.map((j) => A({ kind: 'in', j }));
    // interactions : l'effet d'une variable dépend d'une autre
    case 'interaction': { const o = []; for (let a = 0; a < J.length; a++) for (let b = a + 1; b < J.length; b++) o.push(A({ kind: 'inter', j: J[a], k: J[b] })); return o; }
    default: return [];
  }
}
const COARSE = { pulse: 3 };
// confronter les composantes structurelles à des ruptures datées : essayé en dev, a dégradé la saisonnalité (10/12 → 4/12) → désactivé
const STRUCT_VS_DATED = false;

// seuils candidats placés là où sont les données : déciles des valeurs observées de chaque variable
export function adaptThetas(space, records) {
  space.inputs.forEach((inp) => {
    const v = records.map((r) => r.x[inp.key]).filter((x) => x != null).sort((a, b) => a - b);
    if (v.length < 20 || v[0] === v[v.length - 1]) { inp.thetas = []; return; }
    const th = [0.1, 0.25, 0.4, 0.55, 0.7, 0.85].map((q) => v[Math.floor(q * (v.length - 1))]);
    inp.thetas = [...new Set(th.map((x) => Math.round(x * 100) / 100))].filter((x) => x < v[v.length - 1]);
  });
}

export function searchExplanations(space, model, t, { warmup = 28, lookback = 60, stepTau = 3, minDays = 60, families = FAMILIES, records = null } = {}) {
  if (records) adaptThetas(space, records);
  const terms = model.terms, cands = [];
  const lo = Math.max(warmup, t - lookback), hi = t - 3;
  for (const f of families) {
    for (let tau = lo; tau <= hi; tau += stepTau * (COARSE[f] ?? 1)) for (const c of dated(space, f, tau)) cands.push(c);
    if (f !== 'season' || t >= minDays) for (const c of structural(space, f)) cands.push(c);
  }
  terms.forEach((x, i) => {
    if ((x.gate.kind !== 'step' && x.gate.kind !== 'sigmoid') || x.gate.end != null || x.family === 'variance') return;
    for (let tau = Math.max(lo, x.gate.tau + 6); tau <= hi; tau += stepTau) cands.push({ family: 'end', target: i, tau });
  });
  // Identifiabilité : un mécanisme lié à une variable (sensibilité, seuil, courbure) n'est candidat que si
  // cette variable VARIE là où il agit ; sinon il équivaut à une simple rupture de niveau (plus simple).
  const rows = model.rows.map((x) => x.r);
  const distinct = (c) => {
    if (!['in', 'in2', 'thresh', 'inter'].includes(c.basis?.kind)) return true;
    const v = [];
    for (const r of rows) if (gateValue(c.gate, r.t) > 0) v.push(basisValues(space, c.basis, r)[0]);
    if (v.length < 10) return false;
    const m = v.reduce((s, x) => s + x, 0) / v.length, sd = Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length);
    // sensibilité / courbure : la variable doit varier (écart-type absolu, sur l'échelle transformée) ;
    // seuil : les deux côtés doivent être représentés
    return c.basis.kind === 'thresh' ? sd / (Math.abs(m) + sd + 1e-12) > 0.25 : sd > 0.04;
  };
  const pool = cands.filter((c) => c.family === 'end' || (!terms.some((x) => sameTerm(x, c)) && distinct(c)));
  // Deux étages : pré-score rapide de TOUS les candidats, puis score exact (Tobit/ADF) des 5 meilleurs
  // de CHAQUE famille (aucune famille n'est écartée par le pré-filtre ; les non retenus comptent dans le prior).
  // Le pré-score par imputation est aveugle à ce que cachent les ruptures (un pic, un effet viral pendant
  // une rupture) : on retient aussi les candidats qui expliqueraient le mieux les jours plafonnés
  // (statistique de score : Σ valeur du terme × écart tronqué attendu, sous le modèle actuel).
  const cens = model.rows.filter((row) => row.cens).map((row) => {
    const p = model.predict(row.r), a = (row.r.y - p.mu) / p.scale;
    return { r: row.r, lam: Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI) / Math.max(1e-9, 1 - normCdf(a)) };
  });
  const groups = {};
  for (const c of pool) {
    if (c.family === 'end' || c.basis.kind === 'variance') { c.exact = true; continue; }
    c.proxy = model.proxyScore(c);
    let num = 0, den = 1e-9;
    for (const x of cens) { const v = termValues(space, c, x.r)[0]; if (v) { num += v * x.lam; den += v * v; } }
    c.censStat = Math.abs(num) / Math.sqrt(den);
    (groups[famKey(c)] ??= []).push(c);
  }
  for (const g of Object.values(groups)) {
    g.sort((a, b) => b.proxy - a.proxy); g.slice(0, 6).forEach((c) => { c.exact = true; });
    if (cens.length) { g.sort((a, b) => b.censStat - a.censStat); g.slice(0, 6).forEach((c) => { c.exact = true; }); }
  }
  for (const c of pool) {
    if (!c.exact) { c.logML = -Infinity; continue; }
    if (c.family === 'end') c.logML = model.refitWith(terms.map((x, i) => (i === c.target ? { ...x, gate: { ...x.gate, end: c.tau } } : x))).logML;
    else { const s = model.scoreCandidate(c); c.logML = s.logML; c.coef = s.coef; }
  }
  // affinage de la date des meilleurs candidats datés de chaque famille
  const best = {};
  for (const c of pool) if (c.exact && c.gate && c.gate.kind !== 'all' && (!best[famKey(c)] || c.logML > best[famKey(c)].logML)) best[famKey(c)] = c;
  for (const c of Object.values(best)) for (const d of [-2, -1, 1, 2]) {
    const v = { ...c, gate: { ...c.gate, tau: c.gate.tau + d } }; const s = model.scoreCandidate(v); v.logML = s.logML; v.coef = s.coef; pool.push(v);
  }
  const byFam = {};
  for (const c of pool) (byFam[famKey(c)] ??= []).push(c);
  // la masse a priori d'une NATURE de changement ne grandit pas avec le nombre de variables du corps :
  // elle est partagée entre les variables (sensibilité au prix, à l'effectif… se partagent « sensibilité »)
  const nPer = {}; for (const k of Object.keys(byFam)) nPer[k.split(':')[0]] = (nPer[k.split(':')[0]] || 0) + 1;
  const weight = (k) => (FAMILY_PRIOR[k.split(':')[0]] ?? 1) / nPer[k.split(':')[0]];
  const wsum = Object.keys(byFam).reduce((s, k) => s + weight(k), 0);
  const scores = [model.logML + Math.log(0.5)];
  for (const c of pool) { c.logPrior = Math.log((0.5 * weight(famKey(c))) / wsum / byFam[famKey(c)].length); scores.push(c.logML + c.logPrior); }
  const mx = Math.max(...scores), Z = scores.reduce((s, x) => s + Math.exp(x - mx), 0);
  const famMass = {};
  pool.forEach((c, i) => { c.post = Math.exp(scores[i + 1] - mx) / Z; c.logBF = c.logML - model.logML; famMass[famKey(c)] = (famMass[famKey(c)] || 0) + c.post; });
  pool.sort((a, b) => b.post - a.post);
  const nCandidates = pool.length;
  return { pNull: Math.exp(scores[0] - mx) / Z, famMass, top: pool.slice(0, 8), all: pool.filter((c) => c.exact), nCandidates };
}

export function alternatives(space, term, t = null, families = FAMILIES) {
  const out = [];
  // une composante « depuis toujours » doit aussi affronter des explications DATÉES (sinon son avantage
  // a priori — aucune date à estimer — la protège à tort) : grille hebdomadaire de dates
  if (term.gate.kind === 'all' && t != null && STRUCT_VS_DATED) for (let tau = 28; tau <= t - 7; tau += 7) for (const f of ['level', 'trend', 'slope'].filter((x) => families.includes(x))) for (const c of dated(space, f, tau)) out.push(c);
  if (term.gate.kind !== 'all') for (const f of families) for (const c of dated(space, f, term.gate.tau)) if (JSON.stringify(c.basis) !== JSON.stringify(term.basis) || c.gate.kind !== term.gate.kind) out.push({ ...c, gate: { ...c.gate, end: term.gate.end ?? null } });
  for (const f of families) if (f !== 'pulse') for (const c of structural(space, f)) if (JSON.stringify(c.basis) !== JSON.stringify(term.basis)) out.push(c);
  return out;
}

const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)} %`;
const DOW = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
export function narrate(space, term, coef) {
  const c = coef?.[0] ?? 0, g = term.gate, b = term.basis, out = space.outcome;
  const what = out.label, of = out.of ?? `de ${out.label}`;
  const v = (sg, pl) => (out.plural ? pl : sg);
  const inp = b.j != null ? space.inputs[b.j] : null;
  const since = g.kind === 'all' ? 'Depuis toujours' : g.kind === 'sigmoid' ? `Autour du jour ${g.tau}` : `Depuis le jour ${g.tau}`;
  const until = g.end != null ? ` (jusqu’au jour ${g.end})` : '';
  switch (b.kind) {
    case 'const':
      if (g.kind === 'ramp') return `${since}${until}, ${what} ${v('dérive', 'dérivent')} progressivement de ${pct(Math.exp(c) - 1)} par mois.`;
      if (g.kind === 'sigmoid') return `${since}${until}, ${what} ${v('a', 'ont')} basculé progressivement (sur ~${Math.round(4 * g.width)} jours) de ${pct(Math.exp(c) - 1)}.`;
      return `${since}${until}, ${what} ${v('a', 'ont')} ${c < 0 ? 'chuté' : 'bondi'} de ${pct(Math.exp(c) - 1)}.`;
    case 'in':
      if (inp.latent) {
        if (inp.latentKind === 'since') return `${since}${until}, tous les 10 jours sans « ${inp.of} », ${what} ${v('change', 'changent')} de ${pct(Math.exp(c * 10 / (inp.scale ?? 1)) - 1)} (effet cumulatif ; agir sur « ${inp.of} » le remet à zéro).`;
        if (inp.latentKind === 'inv') return `${what} ${v('dépend', 'dépendent')} d'une variable cachée que j'ai INVENTÉE : ${inp.label} (coefficient ${c >= 0 ? '+' : ''}${c.toFixed(2)}).`;
        if (inp.latentKind === 'lag') return `${since}${until}, ${what} ${v('dépend', 'dépendent')} de ${v('sa', 'leur')} valeur de la veille (inertie, coefficient ${c.toFixed(2)}).`;
        return `${since}${until}, ${what} ${v('dépend', 'dépendent')} de la mémoire récente de « ${inp.of} » (persistance λ = ${inp.lambda}) : son effet s'installe et s'efface sur plusieurs jours.`;
      }
      return `${since}${until}, ${what} ${v('réagit', 'réagissent')} ${c * (inp.sign ?? 1) > 0 ? 'plus fortement' : 'moins'} à « ${inp.label} » (sensibilité ${c >= 0 ? '+' : ''}${c.toFixed(2)}).`;
    case 'in2': return `${since}, la réponse ${of} à « ${inp.label} » n’est pas proportionnelle (courbure ${c.toFixed(2)}).`;
    case 'thresh': return `${since}, au-delà de ${b.theta} ${inp.unit ?? ''} pour « ${inp.label} », ${what} ${v('change', 'changent')} de ${pct(Math.exp(c) - 1)} (effet de seuil).`;
    case 'dow': return `${since}, le ${DOW[b.d]}, ${what} ${v('a', 'ont')} changé de ${pct(Math.exp(c) - 1)} (habitude hebdomadaire déplacée).`;
    case 'season': { const [a, bb] = coef ?? [0, 0]; const amp = Math.hypot(a, bb); const peak = ((Math.round((Math.atan2(a, bb) * 365) / (2 * Math.PI)) % 365) + 365) % 365; return `${what} ${v('suit', 'suivent')} un cycle annuel (±${Math.round((Math.exp(amp) - 1) * 100)} %, pic vers le jour ${peak}).`; }
    case 'pulse': return `${since}, ${what} ${v('présente', 'présentent')} un pic tous les ${b.period} jours (${pct(Math.exp(c) - 1)}, ex. jour ${b.phase}).`;
    case 'inter': return `L'effet de « ${inp.label} » sur ${what} dépend de « ${space.inputs[b.k].label} » (interaction ${c >= 0 ? '+' : ''}${c.toFixed(2)}).`;
    case 'adstock': return `« ${inp.label} » agit sur ${what} avec retard (demi-vie ≈ ${(Math.log(0.5) / Math.log(b.lambda)).toFixed(1)} j).`;
    case 'variance': return `${since}, ${what} ${v('est', 'sont')} ${b.ratio > 1 ? `${Math.sqrt(b.ratio).toFixed(1)} fois plus ${v('volatile', 'volatiles')}` : `${(1 / Math.sqrt(b.ratio)).toFixed(1)} fois plus ${v('stable', 'stables')}`}.`;
    default: return '';
  }
}
