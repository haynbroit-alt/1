// CORTEX v1 GELÉ (commit 25ad9f7, fusionné dans main) — référence du banc d’essai, ne pas modifier.
// CORTEX — la boucle cognitive.
// Matin  : OBSERVER → COMPRENDRE → CONFRONTER → (HYPOTHÈSES) → ANTICIPER → PRIORISER → DÉCIDER → SIMULER → EXÉCUTER | REVUE HUMAINE
// Soir   : MESURER → APPRENDRE → RÉVISER → (DREAMING, chaque dimanche soir) → retour
// Aucune magie : chaque étape est un calcul explicite et traçable.
import { makeRng, normCdf } from './rng.js';
import { fit, features, DOW_NAMES, P_REF } from './model.js';
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
const TYPE_FR = { level: 'niveau', elasticity: 'élasticité', marketing: 'marketing', end: 'fin d’effet' };
const CUSUM_K = 0.5, CUSUM_H = 5;
const ECUSUM_K = 0.25, ECUSUM_H = 5;
const DITHER = 0.08;
const Z80 = 1.2816;
const pct = (x) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(0)} %`;
const eur = (x) => `${x >= 0 ? '' : '−'}${Math.abs(x).toFixed(0)} €`;
const f2 = (x) => x.toFixed(2);

export function createAgent(opts = {}) {
  const o = { hypotheses: true, dreaming: true, learning: true, vigilance: true, window: null, seed: 1, name: 'CORTEX', ...opts };
  const rng = makeRng(o.seed * 31337 + 1);
  const A = {
    opts: o,
    records: [], beliefs: [], retracted: [], hypothesisLog: [],
    model: null, kappa: 1, cusum: { pos: 0, neg: 0 }, ecusum: { pos: 0, neg: 0 }, lastZ: null,
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

  const dayRec = (t, price, marketing) => ({ t, dow: t % 7, price, marketing });
  const predictor = (model, t) => (price, marketing) => {
    const p = model.predict(dayRec(t, price, marketing));
    return { mu: p.mu, s: p.scale * A.kappa };
  };
  const thetaPredictor = (theta, sigma, t) => (price, marketing) => ({ mu: dot(features(dayRec(t, price, marketing), A.beliefs), theta), s: sigma });

  // élasticité effective aujourd'hui (coef de base + croyances actives) et son écart-type
  function elasticityNow(t) {
    const m = A.model, d = m.mn.length;
    const g = new Array(d).fill(0); g[1] = 1;
    A.beliefs.forEach((b, i) => { if (b.type === 'elasticity' && t >= b.tau) g[9 + i] = 1; });
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

  // ---------- HYPOTHÈSES : sélection de modèles bayésienne exacte ----------
  function generateAndTest(t) {
    const data = trainingSet();
    const base = A.model.logML;
    const cands = [];
    const lo = Math.max(WARMUP, t - 45), hi = t - 2;
    for (let tau = lo; tau <= hi; tau++) {
      for (const type of ['level', 'elasticity', 'marketing']) {
        const b = { type, tau, end: null };
        if (A.beliefs.some((x) => x.type === type && Math.abs(x.tau - tau) < 7 && x.end == null)) continue;
        const m = fit(data, [...A.beliefs, b]);
        cands.push({ ...b, logML: m.logML, coef: m.mn[m.mn.length - 1], sd: m.coefSd(m.mn.length - 1) });
      }
      // fin d'un effet temporaire déjà cru
      A.beliefs.forEach((x, i) => {
        if (x.type !== 'level' || x.end != null || tau <= x.tau + 5) return;
        const bs = A.beliefs.map((y, j) => (j === i ? { ...y, end: tau } : y));
        const m = fit(data, bs);
        cands.push({ type: 'end', tau, target: x.id, logML: m.logML, coef: m.mn[9 + i] });
      });
    }
    // prior : 50 % "rien n'a changé" ; 50 % réparti uniformément sur les ruptures candidates
    const logPriorNull = Math.log(0.5), logPriorEach = Math.log(0.5 / Math.max(1, cands.length));
    const scores = [base + logPriorNull, ...cands.map((c) => c.logML + logPriorEach)];
    const mx = Math.max(...scores);
    const Z = scores.reduce((s, x) => s + Math.exp(x - mx), 0);
    const pNull = Math.exp(scores[0] - mx) / Z;
    cands.forEach((c, i) => { c.post = Math.exp(scores[i + 1] - mx) / Z; c.logBF = c.logML - base; });
    const byType = {};
    for (const c of cands) byType[c.type] = (byType[c.type] || 0) + c.post;
    cands.sort((a, b) => b.post - a.post);
    return { pNull, byType, top: cands.slice(0, 6), best: cands[0] };
  }

  function narrate(b) {
    if (b.type === 'level') {
      const e = Math.exp(b.coef) - 1;
      return e < 0
        ? `La demande a chuté de ${pct(e)} à partir du jour ${b.tau}. Explication la plus probable : un concurrent ou une perte de clientèle.`
        : `La demande a bondi de ${pct(e)} à partir du jour ${b.tau}. Explication la plus probable : un effet de mode ou un événement local.`;
    }
    if (b.type === 'elasticity') return `Depuis le jour ${b.tau}, les clients ${b.coef < 0 ? 'réagissent plus fortement' : 'réagissent moins'} au prix (élasticité ${b.coef < 0 ? 'renforcée' : 'atténuée'} de ${f2(Math.abs(b.coef))}).`;
    if (b.type === 'marketing') return `L'efficacité du marketing a changé au jour ${b.tau} (${b.coef > 0 ? 'plus' : 'moins'} efficace).`;
    return '';
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
      contradiction = levelAlarm || priceAlarm;
      const v = contradiction ? 'contradiction' : 'confirmation';
      emit('confronter', contradiction
        ? `Contradiction : ${levelAlarm ? `les ventes s'écartent durablement de ma théorie (CUSUM ${pos > neg ? '↑' : '↓'} ${Math.max(pos, neg).toFixed(1)} > ${CUSUM_H})` : ''}${levelAlarm && priceAlarm ? ' et ' : ''}${priceAlarm ? `mes erreurs sont corrélées au prix (score ${Math.max(ep, en).toFixed(1)} > ${ECUSUM_H}) : la réaction des clients au prix a peut-être changé` : ''}. Dernier écart z=${f2(A.lastZ)}.`
        : `Confirmation : l'écart d'hier (z=${f2(A.lastZ)}) est compatible avec mon modèle (CUSUM ${pos.toFixed(1)}/${neg.toFixed(1)}, corrélation-prix ${ep.toFixed(1)}/${en.toFixed(1)}).`,
        { verdict: v, z: A.lastZ, cusumPos: pos, cusumNeg: neg, ecusumPos: ep, ecusumNeg: en, priceAlarm });
    }

    // HYPOTHÈSES
    if (contradiction && o.hypotheses) {
      const H = generateAndTest(t);
      const pChange = 1 - H.pNull;
      const lines = H.top.slice(0, 3).map((c) => `${c.type === 'level' ? 'rupture de niveau' : c.type === 'elasticity' ? 'changement d’élasticité' : c.type === 'end' ? 'fin d’un effet temporaire' : 'changement d’effet marketing'} au jour ${c.tau} (p=${(c.post * 100).toFixed(1)} %)`);
      let accepted = null, ambiguous = false;
      const types = Object.entries(H.byType).sort((a, b) => b[1] - a[1]);
      if (pChange > 0.95 && types.length) {
        const [bestType, mass] = types[0];
        ambiguous = mass / pChange < 0.6 && bestType !== 'end';
        const c = H.top.find((x) => x.type === bestType) || H.best;
        if (c.type === 'end') {
          const b = A.beliefs.find((x) => x.id === c.target);
          b.end = c.tau; b.narrative = `${narrate(b)} Cet effet a pris fin au jour ${c.tau} : retour à la normale.`;
          accepted = { ...b, kind: 'end' };
        } else {
          const b = { id: A.nextBeliefId++, type: c.type, tau: c.tau, end: null, coef: c.coef, acceptedAt: t, logBF: c.logBF, post: c.post, provisional: ambiguous, rivals: types.slice(1, 3).map(([k, v]) => ({ type: k, p: v })) };
          b.narrative = narrate(b);
          A.beliefs.push(b); accepted = b;
          if (ambiguous) A.experimentUntil = t + 10;
        }
        refit();
        A.cusum = { pos: 0, neg: 0 }; A.ecusum = { pos: 0, neg: 0 };
      } else if (pChange > 0.7) {
        A.experimentUntil = Math.max(A.experimentUntil ?? -1, t + 7);
        A.cusum = { pos: Math.min(A.cusum.pos, CUSUM_H * 0.8), neg: Math.min(A.cusum.neg, CUSUM_H * 0.8) };
        A.ecusum = { pos: Math.min(A.ecusum.pos, ECUSUM_H * 0.8), neg: Math.min(A.ecusum.neg, ECUSUM_H * 0.8) };
      } else {
        A.cusum = { pos: Math.min(A.cusum.pos, CUSUM_H * 0.6), neg: Math.min(A.cusum.neg, CUSUM_H * 0.6) };
        A.ecusum = { pos: Math.min(A.ecusum.pos, ECUSUM_H * 0.6), neg: Math.min(A.ecusum.neg, ECUSUM_H * 0.6) };
      }
      A.hypothesisLog.push({ t, pChange, byType: H.byType, top: H.top.map(({ type, tau, post, logBF, coef }) => ({ type, tau, post, logBF, coef })), accepted: accepted ? { type: accepted.type, tau: accepted.tau, kind: accepted.kind } : null });
      const typeTxt = types.map(([k, v]) => `${TYPE_FR[k]} ${(v * 100).toFixed(0)} %`).join(', ');
      emit('hypotheses', accepted
        ? `Pourquoi ? ${accepted.narrative} (P(changement) = ${(pChange * 100).toFixed(1)} % ; ${typeTxt}).${ambiguous ? ' Explications concurrentes encore indiscernables → croyance PROVISOIRE et expérience discriminante de 10 jours (variation de prix contrôlée).' : ' Théorie du monde mise à jour.'}`
        : `Pourquoi ? Hypothèses testées : ${lines.join(' ; ')}. P(vrai changement) ${(pChange * 100).toFixed(0)} % (< 95 %)${pChange > 0.7 ? ' → je lance une expérience de 7 jours pour trancher.' : ' : j’attends plus de données.'}`,
        { pChange, top: H.top, byType: H.byType, accepted, ambiguous });
    } else if (contradiction) {
      emit('hypotheses', `Contradiction détectée mais génération d'hypothèses désactivée (mode ablation) : je continue avec ma théorie.`, { disabled: true });
      A.cusum = { pos: 0, neg: 0 }; A.ecusum = { pos: 0, neg: 0 };
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
    const finalize = (a) => { const pp = pred(a.price, a.marketing); const q = newsvendorQ(pp.mu, pp.s, a.price, ctx.cost, A.skills.order.delta); return { price: a.price, marketing: a.marketing, order: q, expProfit: expectedProfit(pp.mu, pp.s, a.price, a.marketing, ctx.cost, q).profit }; };
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
    emit('decider', `Agent CEO : ${strategic ? 'DÉCISION STRATÉGIQUE — ' : ''}prix ${f2(proposal.price)} €${last ? ` (${pct(proposal.price / last.price - 1)})` : ''}, marketing ${proposal.marketing} €, commande ${proposal.order} unités. Profit espéré ${eur(proposal.expProfit)}.${dithered ? ` Variation de vigilance ±${DITHER * 100} % (pour garder la sensibilité-prix observable).` : ''}${strategic ? ` Dépasse la règle de pas maximal (±${(R.maxStep * 100).toFixed(0)} %) car +${eur(bA.expProfit - rA.expProfit)}/jour espérés.` : ''}`,
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
      const D = Math.exp(dot(x, smp.theta) + smp.sigma * A.kappa * rng.normal());
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
    const rec = { t, dow: obs.dow, price: obs.price, marketing: obs.marketing, order: obs.order, cost: obs.cost, sales: obs.sales, censored: obs.censored, profit: obs.profit, y };
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
    // 1. Audit des croyances : chaque rupture est-elle encore justifiée ? Date affinée ?
    if (o.hypotheses) {
      for (const b of [...A.beliefs]) {
        const others = A.beliefs.filter((x) => x !== b);
        const without = fit(data, others).logML;
        let bestTau = b.tau, bestML = fit(data, A.beliefs).logML;
        for (let tau = Math.max(WARMUP, b.tau - 10); tau <= Math.min(t - 2, b.tau + 10); tau++) {
          if (tau === b.tau || (b.end != null && tau >= b.end - 2)) continue;
          const m = fit(data, A.beliefs.map((x) => (x === b ? { ...x, tau } : x))).logML;
          if (m > bestML + 1) { bestML = m; bestTau = tau; }
        }
        if (bestTau !== b.tau) { notes.push(`date de la rupture #${b.id} affinée : jour ${b.tau} → ${bestTau}`); b.tau = bestTau; }
        // requalification : une autre nature de changement explique-t-elle mieux les faits ?
        if (b.type !== 'end' && t - b.acceptedAt >= 5) {
          for (const alt of ['level', 'elasticity', 'marketing']) {
            if (alt === b.type) continue;
            const m = fit(data, A.beliefs.map((x) => (x === b ? { ...x, type: alt } : x))).logML;
            if (m > bestML + 2) {
              notes.push(`croyance #${b.id} REQUALIFIÉE : ${TYPE_FR[b.type]} → ${TYPE_FR[alt]} (log BF ${f2(m - bestML)})`);
              b.type = alt; bestML = m; b.provisional = false;
            }
          }
          if (b.provisional && t - b.acceptedAt >= 14) { b.provisional = false; notes.push(`croyance #${b.id} confirmée après expérience (${TYPE_FR[b.type]})`); }
        }
        const logBF = bestML - without;
        b.logBF = logBF;
        if (logBF < 0) {
          A.beliefs = A.beliefs.filter((x) => x !== b);
          A.retracted.push({ ...b, retractedAt: t });
          notes.push(`croyance #${b.id} (${b.type}, jour ${b.tau}) RÉTRACTÉE : les données ne la soutiennent plus (log BF ${f2(logBF)})`);
        }
      }
      refit();
      A.beliefs.forEach((b, i) => { b.coef = A.model.mn[9 + i]; b.narrative = narrate(b) + (b.end != null ? ` Effet terminé au jour ${b.end}.` : ''); });
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
  return A;
}
