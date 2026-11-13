// CORTEX — la boucle cognitive.
// Matin  : OBSERVER → COMPRENDRE → CONFRONTER → (HYPOTHÈSES) → ANTICIPER → PRIORISER → DÉCIDER → SIMULER → EXÉCUTER | REVUE HUMAINE
// Soir   : MESURER → APPRENDRE → RÉVISER → (DREAMING, chaque dimanche soir) → retour
// Aucune magie : chaque étape est un calcul explicite et traçable.
import { makeRng, normCdf } from './rng.js';
import { fit, features, DOW_NAMES, P_REF, varianceWeight, termWidth, gateValue, termValues } from './model.js';
import { searchExplanations, narrate as narrateTerm, alternatives, FAMILY_FR } from './discovery.js';
import { optimize, newsvendorQ, expectedProfit } from './econ.js';
import { MARKETING_LEVELS, FIXED_COST, HORIZON } from './world.js';
import { dot, matVec } from './linalg.js';

export const STAGES = [
  ['observer', 'Observer'], ['comprendre', 'Comprendre'], ['confronter', 'Confronter'], ['hypotheses', 'Hypothèses'],
  ['anticiper', 'Anticiper'], ['prioriser', 'Prioriser'], ['decider', 'Décider'], ['simuler', 'Simuler'],
  ['executer', 'Exécuter'], ['revue', 'Revue humaine'], ['mesurer', 'Mesurer'], ['apprendre', 'Apprendre'],
  ['reviser', 'Réviser'], ['dreaming', 'Dreaming'],
];

const WARMUP = 28;
const TYPE_FR = FAMILY_FR;
const VCUSUM_K = 0.75, VCUSUM_H = 12;
// seuils de preuve (étalonnés sur les graines de développement uniquement)
const P_CONTRA_OPEN = 0.99, P_BACKGROUND = 0.999;
const PROBE_FAMILIES = ['pulse', 'dow'];
const CUSUM_K = 0.5, CUSUM_H = 5;
const ECUSUM_K = 0.25, ECUSUM_H = 5;
const DITHER = 0.08;
const Z80 = 1.2816;
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)} %`;
const eur = (x) => `${x >= 0 ? '' : '−'}${Math.abs(x).toFixed(0)} €`;
const f2 = (x) => x.toFixed(2);

export function createAgent(opts = {}) {
  // grammar : 'closed' (vocabulaire v1 : niveau/élasticité/marketing) | 'open' (grammaire déclencheur × mécanisme)
  // omnibus : détecteur générique de surprise (erreur²) ; background : recherche de structure chaque nuit de rêve
  const o = { hypotheses: true, dreaming: true, learning: true, vigilance: true, window: null, seed: 1, name: 'CORTEX', grammar: 'open', omnibus: true, background: true, ...opts };
  const rng = makeRng(o.seed * 31337 + 1);
  const A = {
    opts: o,
    records: [], beliefs: [], retracted: [], hypothesisLog: [],
    model: null, kappa: 1, cusum: { pos: 0, neg: 0 }, ecusum: { pos: 0, neg: 0 }, vcusum: 0, lastZ: null, adPrev: { 0.5: 0, 0.8: 0 },
    skills: { order: { name: 'Commande newsvendor', version: 1, delta: 0, notes: [] } },
    rules: { maxStep: 0.15, pLossMax: 0.3, marketingCap: 100, approvals: 0, rejections: 0, lastRejection: null, list: [] },
    memory: [], journal: [], stageCount: Object.fromEntries(STAGES.map(([k]) => [k, 0])),
    pending: null, today: null, kpi: { cumProfit: 0, days: 0 }, nextBeliefId: 1,
    insights: [], agenda: [],
  };

  const trace = [];
  const emit = (stage, text, data = {}) => { A.stageCount[stage]++; const e = { t: A.today?.t ?? null, stage, text, data }; trace.push(e); return e; };

  // ---------- utilitaires du modèle ----------
  const trainingSet = () => (o.window ? A.records.slice(-o.window) : A.records);
  // Ré-imputation (pas d'EM) des jours de rupture avec le modèle courant avant chaque ajustement.
  const impute = (rec, model) => {
    const pp = model.predict(rec);
    const a = (rec.y - pp.mu) / pp.scale;
    const tail = Math.max(1e-9, 1 - normCdf(a));
    rec.yImp = Math.max(rec.y, pp.mu + pp.scale * Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI) / tail);
  };
  const refit = () => {
    const data = trainingSet();
    if (A.model) for (const r of data) if (r.censored) impute(r, A.model);
    A.model = fit(data, A.beliefs);
  };
  refit();

  // l'agent connaît ses propres dépenses marketing passées → stock publicitaire (adstock) pour λ candidats
  const adFor = (m) => ({ 0.5: 0.5 * m + 0.5 * A.adPrev[0.5], 0.8: 0.2 * m + 0.8 * A.adPrev[0.8] });
  const dayRec = (t, price, marketing) => ({ t, dow: t % 7, price, marketing, ad: adFor(marketing) });
  const predictor = (model, t) => (price, marketing) => {
    const p = model.predict(dayRec(t, price, marketing));
    return { mu: p.mu, s: p.scale * A.kappa };
  };
  const thetaPredictor = (theta, sigma, t) => (price, marketing) => ({ mu: dot(features(dayRec(t, price, marketing), A.beliefs), theta), s: sigma * Math.sqrt(varianceWeight(t, A.beliefs)) });

  // élasticité effective aujourd'hui (coef de base + croyances actives) et son écart-type
  function elasticityNow(t) {
    const m = A.model, d = m.mn.length;
    const g = new Array(d).fill(0); g[1] = 1;
    A.beliefs.forEach((b, i) => { if (b.basis?.kind === 'lp' && m.cols[i] >= 0) g[m.cols[i]] = gateValue(b.gate, t); });
    const est = dot(g, m.mn);
    const sd = Math.sqrt(m.sigma2 * dot(g, matVec(m.Vn, g)));
    return { est, sd };
  }
  function levelNow(t) {
    // demande attendue au prix de référence, jour moyen, sans marketing
    const p = A.model.predict(dayRec(t, P_REF, 0));
    return Math.exp(p.mu);
  }

  const priceRange = () => {
    if (!A.records.length) return [P_REF, P_REF];
    let lo = Infinity, hi = -Infinity;
    for (const r of A.records) { lo = Math.min(lo, r.price); hi = Math.max(hi, r.price); }
    return [lo, hi];
  };
  const triedMarketing = () => new Set(A.records.map((r) => r.marketing));

  // ---------- HYPOTHÈSES : grammaire d'explications + sélection bayésienne exacte ----------
  const syncCoefs = () => {
    A.beliefs.forEach((b, i) => {
      const c = A.model.cols[i];
      b.coef = c >= 0 ? A.model.mn.slice(c, c + termWidth(b)) : [b.basis.ratio];
      b.type = b.family; b.tau = b.gate.kind === 'all' ? null : b.gate.tau; b.end = b.gate.end ?? null;
      b.narrative = narrateTerm(b, b.coef);
    });
  };
  // Admet (ou non) la meilleure explication. threshold = P(changement) requise.
  function adjudicate(t, H, threshold, origin) {
    const pChange = 1 - H.pNull;
    const fams = Object.entries(H.famMass).sort((a, b) => b[1] - a[1]);
    let accepted = null, ambiguous = false;
    if (pChange > threshold && fams.length) {
      const [bestFam, mass] = fams[0];
      ambiguous = mass / pChange < 0.6 && bestFam !== 'end';
      if (origin === 'background' && ambiguous) return { pChange, fams, accepted: null, ambiguous };
      const c = H.all.find((x) => x.family === bestFam);
      if (c.family === 'end') {
        const b = A.beliefs[c.target];
        b.gate.end = c.tau;
        accepted = b; accepted.kind = 'end';
      } else {
        const b = { id: A.nextBeliefId++, family: c.family, gate: { ...c.gate }, basis: { ...c.basis }, acceptedAt: t, logBF: c.logBF, post: c.post, provisional: ambiguous, origin,
          rivals: fams.slice(1, 3).map(([k, v]) => ({ family: k, p: v })) };
        A.beliefs.push(b); accepted = b;
        if (ambiguous) A.experimentUntil = t + 10;
      }
      refit(); syncCoefs();
    }
    // hypothèse plausible mais non prouvée → expérience de dé-censure (voir la vraie demande les jours concernés)
    // (seulement pour les hypothèses « calendaires » qui annoncent quelques jours précis : coût borné)
    const sparse = fams.find(([f, v]) => PROBE_FAMILIES.includes(f) && v > 0.2);
    if (!accepted && o.grammar === 'open' && pChange > 0.5 && sparse && !(A.probe && A.probe.term.family === sparse[0])) {
      const c = H.all.find((x) => x.family === sparse[0]);
      if (c && c.coef?.length && c.coef[0] > 0.05) A.probe = { term: { family: c.family, gate: { ...c.gate }, basis: { ...c.basis } }, coef: c.coef, until: t + 42, budget: 6, p: sparse[1], since: t };
    }
    if (accepted && A.probe && A.probe.term.family === accepted.family) A.probe = null;
    A.hypothesisLog.push({ t, origin, pChange, byType: H.famMass, nCandidates: H.nCandidates,
      top: H.top.map((c) => ({ type: c.family, family: c.family, tau: c.gate?.tau ?? c.tau ?? null, post: c.post, logBF: c.logBF, coef: c.coef?.[0], basis: c.basis })),
      accepted: accepted ? { type: accepted.family, family: accepted.family, tau: accepted.gate.kind === 'all' ? null : accepted.gate.tau, kind: accepted.kind } : null });
    return { pChange, fams, accepted, ambiguous };
  }

  // ---------- MATIN ----------
  function planDay(ctx) {
    trace.length = 0;
    const t = ctx.t; A.today = { t, cost: ctx.cost };
    const last = A.records[A.records.length - 1];

    // OBSERVER
    let obsText = `Jour ${t} (${DOW_NAMES[t % 7]}). Coût unitaire : ${f2(ctx.cost)} €.`;
    if (last) obsText += ` Hier : ${last.sales} ventes pour ${last.order} produits${last.censored ? ' (rupture : demande réelle inconnue, ≥ stock)' : ''}, profit ${eur(last.profit)}.`;
    if (last && Math.abs(ctx.cost - last.cost) > 1e-9) obsText += ` ⚠ Le coût a changé de ${pct(ctx.cost / last.cost - 1)}.`;
    emit('observer', obsText, { cost: ctx.cost });

    // COMPRENDRE
    const el = elasticityNow(t), lvl = levelNow(t);
    const mk = A.model.mn[8];
    emit('comprendre', `Mon modèle du monde : ~${lvl.toFixed(0)} clients/jour à ${P_REF} €, élasticité ${f2(el.est)} ± ${f2(el.sd)}, marketing ${mk >= 0 ? '+' : ''}${f2(mk)}, bruit σ=${f2(Math.sqrt(A.model.sigma2))}. ${A.beliefs.length} rupture(s) structurelle(s) admise(s).`,
      { level: lvl, elasticity: el.est, elasticitySd: el.sd, marketing: mk, sigma: Math.sqrt(A.model.sigma2), nBeliefs: A.beliefs.length });

    // CONFRONTER
    let contradiction = false;
    if (t < WARMUP) emit('confronter', `Phase d'apprentissage (${t}/${WARMUP} jours) : je collecte des faits avant de juger ma théorie.`, { verdict: 'apprentissage' });
    else if (A.lastZ == null) emit('confronter', `Pas de prédiction comparable hier.`, { verdict: 'n/a' });
    else {
      const { pos, neg } = A.cusum;
      const ep = A.ecusum.pos, en = A.ecusum.neg;
      const levelAlarm = pos > CUSUM_H || neg > CUSUM_H, priceAlarm = ep > ECUSUM_H || en > ECUSUM_H;
      const surpriseAlarm = o.omnibus && A.vcusum > VCUSUM_H;
      contradiction = levelAlarm || priceAlarm || surpriseAlarm;
      const v = contradiction ? 'contradiction' : 'confirmation';
      emit('confronter', contradiction
        ? `Contradiction : ${levelAlarm ? `les ventes s'écartent durablement de ma théorie (CUSUM ${pos > neg ? '↑' : '↓'} ${Math.max(pos, neg).toFixed(1)} > ${CUSUM_H})` : ''}${levelAlarm && priceAlarm ? ' et ' : ''}${priceAlarm ? `mes erreurs sont corrélées au prix (score ${Math.max(ep, en).toFixed(1)} > ${ECUSUM_H}) : la réaction des clients au prix a peut-être changé` : ''}${surpriseAlarm ? `${levelAlarm || priceAlarm ? ' ; ' : ''}mes erreurs sont anormalement grandes (surprise cumulée ${A.vcusum.toFixed(1)} > ${VCUSUM_H}) : un mécanisme inconnu est à l'œuvre` : ''}. Dernier écart z=${f2(A.lastZ)}.`
        : `Confirmation : l'écart d'hier (z=${f2(A.lastZ)}) est compatible avec mon modèle (CUSUM ${pos.toFixed(1)}/${neg.toFixed(1)}, corrélation-prix ${ep.toFixed(1)}/${en.toFixed(1)}).`,
        { verdict: v, z: A.lastZ, cusumPos: pos, cusumNeg: neg, ecusumPos: ep, ecusumNeg: en, priceAlarm });
    }

    // HYPOTHÈSES
    if (contradiction && o.hypotheses) {
      const H = searchExplanations(A.model, t, { grammar: o.grammar, warmup: WARMUP });
      const { pChange, fams, accepted, ambiguous } = adjudicate(t, H, o.grammar === 'open' ? P_CONTRA_OPEN : 0.95, 'contradiction');
      const famTxt = fams.slice(0, 4).map(([k, v]) => `${TYPE_FR[k]} ${(v * 100).toFixed(0)} %`).join(', ');
      if (accepted) { A.cusum = { pos: 0, neg: 0 }; A.ecusum = { pos: 0, neg: 0 }; A.vcusum = 0; }
      else if (pChange > 0.7) {
        A.experimentUntil = Math.max(A.experimentUntil ?? -1, t + 7);
        A.cusum = { pos: Math.min(A.cusum.pos, CUSUM_H * 0.8), neg: Math.min(A.cusum.neg, CUSUM_H * 0.8) };
        A.ecusum = { pos: Math.min(A.ecusum.pos, ECUSUM_H * 0.8), neg: Math.min(A.ecusum.neg, ECUSUM_H * 0.8) };
        A.vcusum = Math.min(A.vcusum, VCUSUM_H * 0.8);
      } else {
        A.cusum = { pos: Math.min(A.cusum.pos, CUSUM_H * 0.6), neg: Math.min(A.cusum.neg, CUSUM_H * 0.6) };
        A.ecusum = { pos: Math.min(A.ecusum.pos, ECUSUM_H * 0.6), neg: Math.min(A.ecusum.neg, ECUSUM_H * 0.6) };
        A.vcusum = Math.min(A.vcusum, VCUSUM_H * 0.6);
      }
      emit('hypotheses', accepted
        ? `Pourquoi ? ${accepted.narrative} (${H.nCandidates} explications testées ; P(changement) = ${(pChange * 100).toFixed(1)} % ; ${famTxt}).${ambiguous ? ' Explications concurrentes encore indiscernables → croyance PROVISOIRE et expérience discriminante de 10 jours.' : ' Théorie du monde mise à jour.'}`
        : `Pourquoi ? ${H.nCandidates} explications testées (${famTxt}). P(vrai changement) ${(pChange * 100).toFixed(0)} % (< 95 %)${pChange > 0.7 ? ' → je lance une expérience de 7 jours pour trancher.' : ' : j’attends plus de données.'}`,
        { pChange, top: H.top, byType: H.famMass, accepted, ambiguous, nCandidates: H.nCandidates });
    } else if (contradiction) {
      emit('hypotheses', `Contradiction détectée mais génération d'hypothèses désactivée (mode ablation) : je continue avec ma théorie.`, { disabled: true });
      A.cusum = { pos: 0, neg: 0 }; A.ecusum = { pos: 0, neg: 0 }; A.vcusum = 0;
    }

    // ANTICIPER : prévision 7 jours sous la politique actuelle + opportunités
    const cur = last ? { price: last.price, marketing: last.marketing } : { price: P_REF, marketing: 0 };
    const pred = predictor(A.model, t);
    const forecast = [];
    for (let k = 0; k < 7; k++) {
      const pk = A.model.predict(dayRec(t + k, cur.price, cur.marketing));
      const s = pk.scale * A.kappa;
      forecast.push({ t: t + k, mean: Math.exp(pk.mu), lo: Math.exp(pk.mu - Z80 * s), hi: Math.exp(pk.mu + Z80 * s) });
    }
    const curQ = newsvendorQ(pred(cur.price, cur.marketing).mu, pred(cur.price, cur.marketing).s, cur.price, ctx.cost, A.skills.order.delta);
    const curEv = expectedProfit(pred(cur.price, cur.marketing).mu, pred(cur.price, cur.marketing).s, cur.price, cur.marketing, ctx.cost, curQ);
    const freeOpt = optimize(pred, ctx.cost, A.skills.order.delta, (p, m) => m <= A.rules.marketingCap);
    const opportunity = freeOpt.profit - curEv.profit;
    const peak = forecast.reduce((a, b) => (b.mean > a.mean ? b : a));
    const risks = [];
    if (curEv.profit < 0) risks.push(`la politique actuelle perd de l'argent (${eur(curEv.profit)}/jour attendu)`);
    if (el.sd > 0.35 && t >= 7) risks.push(`élasticité encore incertaine (±${f2(el.sd)})`);
    emit('anticiper', `Prévision 7 j : ${forecast.map((f) => f.mean.toFixed(0)).join(' · ')} clients (pic ${DOW_NAMES[peak.t % 7]}). Opportunité : ${eur(opportunity)}/jour en ré-optimisant (prix ${f2(freeOpt.price)} €, marketing ${freeOpt.marketing} €).${risks.length ? ' Risques : ' + risks.join(' ; ') + '.' : ''}`,
      { forecast, opportunity, freeOpt, curEv: curEv.profit, risks });

    // PRIORISER : valeur de l'information (EVPI) vs exploitation
    const S = 12, mOpt = freeOpt;
    let evpi = 0;
    const samples = [];
    for (let i = 0; i < S; i++) {
      const smp = A.model.sample(rng);
      samples.push(smp);
      const tp = thetaPredictor(smp.theta, smp.sigma, t);
      const best = optimize(tp, ctx.cost, 0, (p, m) => m <= A.rules.marketingCap);
      const ref = tp(mOpt.price, mOpt.marketing);
      const refQ = newsvendorQ(ref.mu, ref.s, mOpt.price, ctx.cost, 0);
      evpi += best.profit - expectedProfit(ref.mu, ref.s, mOpt.price, mOpt.marketing, ctx.cost, refQ).profit;
    }
    evpi /= S;
    const remaining = Math.max(0, HORIZON - t);
    const agenda = [
      { key: 'exploit', label: 'Optimiser prix & stock', impact: Math.max(0, opportunity), urgency: opportunity > 20 ? 1 : 0.4 },
      { key: 'explore', label: 'Expérimenter pour apprendre (valeur de l’information)', impact: evpi * Math.min(remaining, 60) / 10, urgency: el.sd > 0.3 ? 0.9 : 0.3 },
      { key: 'protect', label: 'Protéger la trésorerie', impact: curEv.profit < 0 ? -curEv.profit : 0, urgency: curEv.profit < 0 ? 1 : 0 },
    ].map((x) => ({ ...x, score: x.impact * (0.5 + x.urgency) })).sort((a, b) => b.score - a.score);
    A.agenda = agenda;
    const experimenting = A.experimentUntil != null && t <= A.experimentUntil;
    if (experimenting) agenda.unshift({ key: 'experiment', label: 'Expérience discriminante en cours (trancher entre hypothèses)', impact: evpi * 10, urgency: 1, score: Infinity });
    const mode = experimenting ? 'experiment' : agenda[0].key === 'explore' && evpi > 1 ? 'explore' : 'exploit';
    emit('prioriser', `Priorités : ${agenda.map((a, i) => `${i + 1}. ${a.label}${Number.isFinite(a.score) ? ` (score ${a.score.toFixed(0)})` : ''}`).join(' · ')}. EVPI ≈ ${evpi.toFixed(1)} €/jour → mode ${mode === 'explore' ? 'EXPLORATION (Thompson)' : mode === 'experiment' ? 'EXPÉRIENCE (prix alterné ±8 %)' : 'EXPLOITATION'}.`,
      { agenda, evpi, mode });

    // DÉCIDER : agent CEO
    const R = A.rules;
    const refPrice = last ? last.price : P_REF;
    const step = mode === 'experiment' ? Math.max(R.maxStep, 0.18) : R.maxStep;
    const within = (p, m) => Math.abs(p / refPrice - 1) <= step + 1e-9 && m <= R.marketingCap;
    let proposal, strategic = false;
    const decisionPred = mode === 'explore' ? thetaPredictor(samples[0].theta, samples[0].sigma, t) : pred;
    const routine = optimize(decisionPred, ctx.cost, A.skills.order.delta, within);
    const bold = optimize(decisionPred, ctx.cost, A.skills.order.delta, (p, m) => m <= R.marketingCap);
    // la quantité est toujours recalculée avec la prédictive complète (prudence)
    if (A.probe && (t > A.probe.until || A.probe.budget <= 0)) A.probe = null;
    let probeNote = '';
    const probeBoost = (a) => {
      if (!A.probe) return 0;
      const v = termValues(A.probe.term, dayRec(t, a.price, a.marketing));
      const add = v.reduce((s, x, i) => s + x * (A.probe.coef[i] ?? 0), 0);
      return add > 0.05 ? add : 0; // on ne teste que les hausses prédites (là où la rupture masque la demande)
    };
    const finalize = (a) => {
      const pp = pred(a.price, a.marketing);
      const boost = probeBoost(a);
      const q = newsvendorQ(pp.mu + boost, pp.s, a.price, ctx.cost, A.skills.order.delta);
      return { price: a.price, marketing: a.marketing, order: q, boost, expProfit: expectedProfit(pp.mu, pp.s, a.price, a.marketing, ctx.cost, q).profit };
    };
    let rA = finalize(routine);
    const bA = finalize(bold);
    if (mode === 'experiment') {
      // plan expérimental : alterner autour de l'optimum pour faire apparaître l'élasticité
      const sign = t % 2 === 0 ? 1 : -1;
      const target = Math.round(routine.price * (1 + 0.08 * sign) * 10) / 10;
      rA = finalize({ price: Math.min(6, Math.max(1.5, target)), marketing: routine.marketing });
    }
    let dithered = false;
    if (t >= 7 && bA.expProfit - rA.expProfit > 15 && mode === 'exploit') { proposal = bA; strategic = true; } else proposal = rA;
    if (mode === 'exploit' && !strategic && t >= WARMUP && o.vigilance) {
      // vigilance : petite variation de prix alternée autour de l'optimum, pour que tout
      // changement de sensibilité au prix reste observable (coût ≈ courbure du profit, faible)
      const sign = t % 2 === 0 ? 1 : -1;
      const target = Math.round(proposal.price * (1 + DITHER * sign) * 20) / 20;
      const cand = finalize({ price: Math.min(6, Math.max(1.5, target)), marketing: proposal.marketing });
      if (proposal.expProfit - cand.expProfit < 6) { proposal = cand; dithered = true; }
    }
    if (proposal.boost) A.probe.budget--;
    if (proposal.boost) probeNote = ` EXPÉRIENCE : je commande davantage aujourd’hui pour tester l’hypothèse « ${TYPE_FR[A.probe.term.family]} » (p ≈ ${(A.probe.p * 100).toFixed(0)} %) — si elle est vraie, je verrai la demande au lieu d’une rupture.`;
    emit('decider', `Agent CEO : ${strategic ? 'DÉCISION STRATÉGIQUE — ' : ''}prix ${f2(proposal.price)} €${last ? ` (${pct(proposal.price / last.price - 1)})` : ''}, marketing ${proposal.marketing} €, commande ${proposal.order} unités. Profit espéré ${eur(proposal.expProfit)}.${dithered ? ` Variation de vigilance ±${DITHER * 100} % (pour garder la sensibilité-prix observable).` : ''}${probeNote}${strategic ? ` Dépasse la règle de pas maximal (±${(R.maxStep * 100).toFixed(0)} %) car +${eur(bA.expProfit - rA.expProfit)}/jour espérés.` : ''}`,
      { proposal, strategic, mode });

    // SIMULER : bac à sable Monte-Carlo sur la postérieure + Agent Risque
    const fallback = finalize({ price: refPrice, marketing: Math.min(last?.marketing ?? 0, R.marketingCap) });
    const sim = (a) => sandbox(a, t, ctx.cost, 240);
    const sp = sim(proposal), sf = sim(fallback);
    const [lo, hi] = priceRange();
    const extrap = proposal.price < lo ? lo / proposal.price - 1 : proposal.price > hi ? proposal.price / hi - 1 : 0;
    const reasons = [];
    // risque RELATIF : la proposition ne doit pas être nettement plus dangereuse que le statu quo
    const lossBar = Math.max(R.pLossMax, sf.pLoss + 0.1);
    if (sp.pLoss > lossBar) reasons.push(`P(perte) ${(sp.pLoss * 100).toFixed(0)} % > seuil ${(lossBar * 100).toFixed(0)} %`);
    if (sp.cvar5 < sf.cvar5 - 60) reasons.push(`pire cas (CVaR 5 %) dégradé de ${eur(sf.cvar5 - sp.cvar5)}`);
    if (extrap > 0.2) reasons.push(`prix hors du domaine déjà observé (${pct(extrap)} au-delà)`);
    if (!triedMarketing().has(proposal.marketing)) reasons.push(`niveau de marketing jamais testé (${proposal.marketing} €)`);
    if (mode === 'experiment' && Math.abs(proposal.price / refPrice - 1) > R.maxStep + 1e-9) { /* expérience planifiée : pas de revue pour la variation contrôlée */ }
    if (strategic) reasons.push(`variation de prix au-delà de la règle (±${(R.maxStep * 100).toFixed(0)} %)`);
    const risk = reasons.length ? 'élevé' : 'faible';
    emit('simuler', `Bac à sable (240 mondes tirés de ma postérieure) : profit médian ${eur(sp.p50)}, P5 ${eur(sp.p5)}, P(perte) ${(sp.pLoss * 100).toFixed(0)} %. Statu quo : ${eur(sf.mean)}. Agent Risque : risque ${risk.toUpperCase()}${reasons.length ? ' — ' + reasons.join(' ; ') : ''}.`,
      { sim: sp, simFallback: sf, risk, reasons, hist: sp.hist });

    if (risk === 'faible') return execute(proposal, 'auto');
    const voi = Math.max(0, agenda.find((x) => x.key === 'explore').impact);
    A.pending = { proposal, fallback, sim: sp, simFallback: sf, reasons, t, mode, voi, evpi };
    emit('revue', `Validation humaine requise : ${reasons.join(' ; ')}. Coût espéré vs statu quo : ${eur(sf.mean - sp.mean)} ; valeur de l’information estimée : ${eur(voi)}.`, { pending: true, proposal, fallback, sim: sp, simFallback: sf, reasons, voi });
    return { review: A.pending, trace: trace.slice() };
  }

  function sandbox(a, t, cost, S) {
    const profits = new Float64Array(S);
    const r = dayRec(t, a.price, a.marketing);
    const x = features(r, A.beliefs);
    for (let i = 0; i < S; i++) {
      const smp = A.model.sample(rng);
      const D = Math.exp(dot(x, smp.theta) + smp.sigma * Math.sqrt(varianceWeight(t, A.beliefs)) * A.kappa * rng.normal());
      const sales = Math.min(Math.round(D), a.order);
      profits[i] = a.price * sales - cost * a.order - a.marketing - FIXED_COST;
    }
    const sorted = Array.from(profits).sort((u, v) => u - v);
    const q = (p) => sorted[Math.min(S - 1, Math.floor(p * S))];
    const mean = sorted.reduce((s, v) => s + v, 0) / S;
    const pLoss = sorted.filter((v) => v < 0).length / S;
    const k5 = Math.max(1, Math.floor(0.05 * S));
    const cvar5 = sorted.slice(0, k5).reduce((s, v) => s + v, 0) / k5;
    const bins = 20, mn = sorted[0], mx = sorted[S - 1], w = (mx - mn) / bins || 1;
    const hist = new Array(bins).fill(0); for (const v of sorted) hist[Math.min(bins - 1, Math.floor((v - mn) / w))]++;
    return { mean, p5: q(0.05), p50: q(0.5), p95: q(0.95), pLoss, cvar5, hist: { min: mn, max: mx, counts: hist } };
  }

  function execute(action, how) {
    A.pending = null;
    const pp = A.model.predict(dayRec(A.today.t, action.price, action.marketing));
    A.today.action = { price: action.price, marketing: action.marketing, order: action.order };
    A.today.pred = { mu: pp.mu, s: pp.scale * A.kappa, expProfit: action.expProfit };
    A.today.how = how;
    emit('executer', `Exécution${how === 'human' ? ' (validée par l’humain)' : how === 'fallback' ? ' du plan de repli (proposition refusée)' : how === 'sim-reviewer' ? ' (validée par le relecteur simulé)' : ' autonome'} : prix ${f2(action.price)} €, marketing ${action.marketing} €, commande ${action.order}.`, { action: A.today.action, how });
    return { action: A.today.action, trace: trace.slice() };
  }

  // Décision humaine : 'approve' | 'reject'
  function resolveReview(decision, by = 'human') {
    const P = A.pending; if (!P) throw new Error('aucune revue en attente');
    const last = A.records[A.records.length - 1];
    if (decision === 'approve') {
      R_learn('approve', P, last);
      return execute(P.proposal, by);
    }
    R_learn('reject', P, last);
    // plan de repli : statu quo, borné par les règles
    return execute(P.fallback, 'fallback');
  }

  function R_learn(decision, P, last) {
    if (!o.learning) return;
    const R = A.rules;
    if (decision === 'approve') {
      R.approvals++;
      if (R.approvals % 3 === 0 && R.rejections === 0 && R.pLossMax < 0.45) {
        R.pLossMax = +(R.pLossMax + 0.05).toFixed(2);
        R.list.push({ t: P.t, text: `Confiance accordée après ${R.approvals} validations : tolérance P(perte) portée à ${(R.pLossMax * 100).toFixed(0)} %.` });
      }
    } else {
      R.rejections++; R.lastRejection = P.t;
      const dp = last ? Math.abs(P.proposal.price / last.price - 1) : 0;
      if (dp > 0.05) {
        R.maxStep = Math.max(0.05, +Math.min(R.maxStep, dp * 0.7).toFixed(2));
        R.list.push({ t: P.t, text: `Refus d’une variation de prix de ${(dp * 100).toFixed(0)} % → règle : ne pas varier de plus de ±${(R.maxStep * 100).toFixed(0)} %/jour sans validation.` });
      }
      if (P.proposal.marketing > (last?.marketing ?? 0)) {
        const lower = MARKETING_LEVELS.filter((m) => m < P.proposal.marketing);
        R.marketingCap = lower[lower.length - 1] ?? 0;
        R.list.push({ t: P.t, text: `Refus d’un marketing à ${P.proposal.marketing} € → règle : plafond marketing ${R.marketingCap} €/jour.` });
      }
      R.pLossMax = Math.max(0.15, +(R.pLossMax - 0.05).toFixed(2));
    }
  }

  // ---------- SOIR ----------
  function observeOutcome(obs) {
    trace.length = 0;
    const t = obs.t;
    const y = Math.log(Math.max(obs.sales, 0.5));
    const rec = { t, dow: obs.dow, price: obs.price, marketing: obs.marketing, order: obs.order, cost: obs.cost, sales: obs.sales, censored: obs.censored, profit: obs.profit, y, ad: adFor(obs.marketing) };
    A.adPrev = { ...rec.ad };
    const pr = A.today?.pred;
    // rupture : la demande réelle est ≥ stock → imputation par l'espérance de la loi tronquée.
    if (obs.censored) impute(rec, A.model);

    // MESURER
    A.kpi.cumProfit += obs.profit; A.kpi.days++;
    let z = null, inside = null;
    if (pr) {
      z = (y - pr.mu) / pr.s;
      inside = Math.abs(z) <= Z80;
      rec.pred = { mu: pr.mu, s: pr.s, expProfit: pr.expProfit }; rec.z = z; rec.inside = obs.censored ? null : inside;
    }
    const recent = A.records.slice(-27).concat([rec]);
    const cov = recent.filter((r) => r.inside != null);
    const coverage = cov.length ? cov.filter((r) => r.inside).length / cov.length : null;
    const unc = recent.filter((r) => !r.censored && r.pred);
    rec.coverageFlag = inside;
    const mape = unc.length ? unc.reduce((s, r) => s + Math.abs(r.sales - Math.exp(r.pred.mu)) / Math.max(1, r.sales), 0) / unc.length : null;
    const stockoutRate = recent.filter((r) => r.censored).length / recent.length;
    emit('mesurer', `Résultat : ${obs.sales}/${obs.order} vendus${obs.censored ? ' (rupture)' : `, ${obs.order - obs.sales} invendus`}, profit ${eur(obs.profit)} (espéré ${pr ? eur(pr.expProfit) : '—'}). Écart de prévision z=${z == null ? '—' : f2(z)}. KPI 28 j : couverture IC80 ${coverage == null ? '—' : (coverage * 100).toFixed(0) + ' %'}, erreur ${mape == null ? '—' : (mape * 100).toFixed(0) + ' %'}, ruptures ${(stockoutRate * 100).toFixed(0)} %.`,
      { profit: obs.profit, z, coverage, mape, stockoutRate, cumProfit: A.kpi.cumProfit });

    // CONFRONTATION préparée pour demain (CUSUM sur les écarts standardisés)
    if (z != null && t >= WARMUP - 1) {
      let zc = Math.max(-6, Math.min(6, z));
      // rupture : on ne voit pas la demande au-delà du stock. Sous le modèle, l'écart attendu
      // sachant "demande ≥ stock" est l'espérance tronquée λ(a) = φ(a)/(1−Φ(a)) : c'est une preuve
      // (modeste) de demande plus forte que prévu. Une série de ruptures finit donc par alerter.
      if (obs.censored) { const a = zc; zc = Math.max(a, Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI) / Math.max(1e-9, 1 - normCdf(a))); }
      A.cusum.pos = Math.max(0, A.cusum.pos + zc - CUSUM_K);
      A.cusum.neg = obs.censored ? A.cusum.neg : Math.max(0, A.cusum.neg - zc - CUSUM_K);
      A.lastZ = z;
      // troisième détecteur (générique) : surprise quadratique, sensible à tout mécanisme manquant
      if (!obs.censored) A.vcusum = Math.max(0, A.vcusum + Math.min(16, zc * zc) - 1 - VCUSUM_K);
      // second détecteur : l'erreur est-elle corrélée au prix ? (statistique de score d'un changement d'élasticité)
      const win = A.records.slice(-28).map((r) => Math.log(r.price));
      if (win.length >= 14 && !obs.censored) {
        const m = win.reduce((s, v) => s + v, 0) / win.length;
        const sdp = Math.sqrt(win.reduce((s, v) => s + (v - m) ** 2, 0) / win.length);
        if (sdp > 0.02) {
          const u = Math.max(-2, Math.min(2, (Math.log(obs.price) - m) / sdp));
          const sc = Math.max(-4, Math.min(4, zc * u));
          A.ecusum.pos = Math.max(0, A.ecusum.pos + sc - ECUSUM_K);
          A.ecusum.neg = Math.max(0, A.ecusum.neg - sc - ECUSUM_K);
        }
      }
    }

    // APPRENDRE : mémoire épisodique + compétence de commande
    A.memory.push({ t, action: A.today?.action, how: A.today?.how, pred: pr, outcome: { sales: obs.sales, profit: obs.profit, censored: obs.censored } });
    let learnText = `Épisode ${t} mémorisé (${A.memory.length} au total).`;
    if (o.learning && A.records.length >= 27 && t % 7 === 3) {
      const cr = obs.price > obs.cost ? (obs.price - obs.cost) / obs.price : 0.5;
      const target = 1 - cr;
      const gap = stockoutRate - target;
      if (Math.abs(gap) > 0.08) {
        const sk = A.skills.order;
        const old = sk.delta;
        sk.delta = Math.max(-0.5, Math.min(0.5, sk.delta + 0.3 * gap));
        sk.version++;
        const note = `v${sk.version} : ruptures ${(stockoutRate * 100).toFixed(0)} % vs cible ${(target * 100).toFixed(0)} % → décalage de commande ${f2(old)} → ${f2(sk.delta)} σ.`;
        sk.notes.push({ t, text: note });
        learnText += ` Compétence « ${sk.name} » ${note}`;
      }
    }
    emit('apprendre', learnText, { skills: A.skills, rules: A.rules });

    // RÉVISER : mise à jour bayésienne du modèle
    A.records.push(rec);
    const before = elasticityNow(t + 1).est, lvlBefore = levelNow(t + 1);
    refit();
    const after = elasticityNow(t + 1).est, lvlAfter = levelNow(t + 1);
    emit('reviser', `Postérieure mise à jour avec ${A.model.n} observations (dont ruptures imputées) : niveau ${lvlBefore.toFixed(0)} → ${lvlAfter.toFixed(0)}, élasticité ${f2(before)} → ${f2(after)}.`, { level: lvlAfter, elasticity: after });

    // DREAMING : chaque fin de semaine
    if (o.dreaming && t % 7 === 6 && t >= WARMUP) dream(t, coverage);
    return { trace: trace.slice() };
  }

  function dream(t, coverage) {
    const notes = [];
    const data = trainingSet();
    // 1. Audit des croyances : justifiées ? date affinée ? autre mécanisme plus convaincant ? sinon rétractation.
    //    Chaque variante est évaluée contre le modèle PRIVÉ de la croyance auditée (rapide, exact).
    if (o.hypotheses) {
      for (const b of [...A.beliefs]) {
        if (!A.beliefs.includes(b)) continue;
        const others = A.beliefs.filter((x) => x !== b);
        const mw = fit(data, others);
        const withB = mw.scoreCandidate(b).logML;
        let best = { term: b, ml: withB };
        const consider = (v, why) => { const ml = mw.scoreCandidate(v).logML; if (ml > best.ml + (why === 'tau' ? 1 : 2)) best = { term: v, ml, why }; };
        if (b.gate.kind !== 'all') {
          for (let tau = Math.max(WARMUP, b.gate.tau - 10); tau <= Math.min(t - 2, b.gate.tau + 10); tau++) {
            if (tau === b.gate.tau || (b.gate.end != null && tau >= b.gate.end - 2)) continue;
            consider({ ...b, gate: { ...b.gate, tau } }, 'tau');
          }
        }
        if (t - b.acceptedAt >= 5) for (const alt of alternatives(best.term, o.grammar)) consider(alt, 'alt');
        if (best.term !== b) {
          const v = best.term;
          if (v.family !== b.family || JSON.stringify(v.basis) !== JSON.stringify(b.basis)) notes.push(`croyance #${b.id} REQUALIFIÉE : ${TYPE_FR[b.family]} → ${TYPE_FR[v.family]} (gain log BF ${f2(best.ml - withB)})`);
          else notes.push(`date de la croyance #${b.id} affinée : jour ${b.gate.tau} → ${v.gate.tau}`);
          b.family = v.family; b.gate = { ...v.gate }; b.basis = { ...v.basis }; b.provisional = false;
        }
        if (b.provisional && t - b.acceptedAt >= 14) { b.provisional = false; notes.push(`croyance #${b.id} confirmée après expérience (${TYPE_FR[b.family]})`); }
        const logBF = best.ml - mw.logML;
        b.logBF = logBF;
        if (logBF < 0) {
          A.beliefs = A.beliefs.filter((x) => x !== b);
          A.retracted.push({ ...b, retractedAt: t });
          notes.push(`croyance #${b.id} (${TYPE_FR[b.family]}) RÉTRACTÉE : les données ne la soutiennent plus (log BF ${f2(logBF)})`);
        }
      }
      refit();
      syncCoefs();
      // 1a. Recherche de fond : même sans alarme, une structure manque-t-elle à ma théorie ?
      if (o.background && t >= WARMUP + 14) {
        const H = searchExplanations(A.model, t + 1, { grammar: o.grammar, warmup: WARMUP, lookback: 63 });
        const r = adjudicate(t, H, P_BACKGROUND, 'background');
        if (r.accepted) notes.push(`DÉCOUVERTE en rêvant (${H.nCandidates} explications testées, P = ${(r.pChange * 100).toFixed(1)} %) : ${r.accepted.narrative}`);
        else notes.push(`recherche de structure : ${H.nCandidates} explications testées, rien de convaincant (P(changement) ${(r.pChange * 100).toFixed(0)} %)`);
      }
    }
    // 1b. Les règles apprises ne sont pas des dogmes : sans refus depuis 4 semaines, on les assouplit.
    if (o.learning) {
      const R = A.rules;
      if (R.lastRejection == null || t - R.lastRejection >= 28) {
        const changes = [];
        if (R.maxStep < 0.15) { R.maxStep = Math.min(0.15, +(R.maxStep + 0.02).toFixed(2)); changes.push(`pas max ±${(R.maxStep * 100).toFixed(0)} %`); }
        if (R.marketingCap < 100) { R.marketingCap = MARKETING_LEVELS[MARKETING_LEVELS.indexOf(R.marketingCap) + 1]; changes.push(`plafond marketing ${R.marketingCap} €`); }
        if (R.pLossMax < 0.3) { R.pLossMax = +(R.pLossMax + 0.05).toFixed(2); changes.push(`tolérance perte ${(R.pLossMax * 100).toFixed(0)} %`); }
        if (changes.length) { R.list.push({ t, text: `4 semaines sans refus → règles assouplies : ${changes.join(', ')}.` }); notes.push(`règles assouplies (${changes.join(', ')})`); R.lastRejection = t; }
      }
    }
    // 2. Auto-audit de calibration
    if (coverage != null && o.learning) {
      const old = A.kappa;
      if (coverage < 0.7) A.kappa = Math.min(2.5, A.kappa * 1.15);
      else if (coverage > 0.9) A.kappa = Math.max(0.8, A.kappa / 1.1);
      if (A.kappa !== old) notes.push(`calibration : couverture IC80 = ${(coverage * 100).toFixed(0)} % → facteur d’humilité κ ${f2(old)} → ${f2(A.kappa)}`);
      else notes.push(`calibration correcte (couverture IC80 ${(coverage * 100).toFixed(0)} %)`);
    }
    // 3. Contrefactuel : avec ce que je sais maintenant, qu'aurais-je dû faire cette semaine ?
    let regret = 0, bestP = null;
    for (const r of A.records.slice(-7)) {
      const pred = predictor(A.model, r.t);
      const best = optimize(pred, r.cost, A.skills.order.delta);
      const pp = pred(r.price, r.marketing);
      const did = expectedProfit(pp.mu, pp.s, r.price, r.marketing, r.cost, r.order).profit;
      regret += Math.max(0, best.profit - did); bestP = best;
    }
    notes.push(`contrefactuel : avec mes connaissances actuelles, j’aurais pu gagner ~${eur(regret)} de plus cette semaine (prix idéal ≈ ${f2(bestP.price)} €, marketing ${bestP.marketing} €)`);
    // 4. Anticipation de la semaine à venir
    const el = elasticityNow(t + 1);
    notes.push(`semaine prochaine : élasticité ${f2(el.est)} ± ${f2(el.sd)}, ${A.beliefs.length} rupture(s) active(s), règles : pas max ±${(A.rules.maxStep * 100).toFixed(0)} %, tolérance perte ${(A.rules.pLossMax * 100).toFixed(0)} %`);
    A.insights.push({ t, regret, notes });
    emit('dreaming', `Nuit de rêve (auto-audit) : ${notes.join(' · ')}.`, { notes, regret, kappa: A.kappa });
  }

  A.planDay = planDay;
  A.resolveReview = resolveReview;
  A.observeOutcome = observeOutcome;
  A.elasticityNow = elasticityNow;
  A.levelNow = levelNow;
  A.predictor = (t) => predictor(A.model, t);
  // prédiction du log-taux en régime permanent (marketing constant) — pour mesurer la fidélité du modèle
  A.predictLog = (t, price, marketing) => A.model.predict({ t, dow: t % 7, price, marketing, ad: { 0.5: marketing, 0.8: marketing } }).mu;
  return A;
}
