// CORTEX v3 — CERVEAU GÉNÉRIQUE. Il ne connaît aucun métier : tout ce qu'il sait d'une entreprise
// vient de la DÉCLARATION de son corps (leviers, informations du matin, mesures, comptabilité).
// Même boucle : Observer → Comprendre → Confronter → Hypothèses → Anticiper → Prioriser → Décider →
// Simuler → Exécuter | Revue → Mesurer → Apprendre → Réviser → Dreaming.
import { makeRng, normCdf } from '../rng.js';
import { makeSpace, fit, termWidth, termValues, varianceWeight } from './gmodel.js';
import { searchExplanations, alternatives, narrate, famKey, FAMILY_FR, FAMILIES } from './gdiscovery.js';
import { optimizeAction, withCapacity, expectedReward, leverGrid } from './decide.js';

export const STAGES = [
  ['observer', 'Observer'], ['comprendre', 'Comprendre'], ['confronter', 'Confronter'], ['hypotheses', 'Hypothèses'],
  ['anticiper', 'Anticiper'], ['prioriser', 'Prioriser'], ['decider', 'Décider'], ['simuler', 'Simuler'],
  ['executer', 'Exécuter'], ['revue', 'Revue'], ['mesurer', 'Mesurer'], ['apprendre', 'Apprendre'],
  ['reviser', 'Réviser'], ['dreaming', 'Dreaming'],
];
const WARMUP = 28, CK = 0.5, CH = 5, EK = 0.25, EH = 5, VK = 0.75, VH = 12, Z80 = 1.2816;
const P_CONTRA = 0.99, P_BACK = 0.999, DITHER = 0.08, PROBE_FAMILIES = ['pulse', 'dow'];
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)} %`;
const num = (x) => (Math.abs(x) >= 100 ? Math.round(x).toString() : x.toFixed(2));
const truncMean = (a) => Math.exp(-0.5 * a * a) / Math.sqrt(2 * Math.PI) / Math.max(1e-9, 1 - normCdf(a));

export function createBrain(body, opts = {}) {
  // curiosity : testée en développement (v4-dev1) puis désactivée — aucun gain de profit, compréhension −9 ± 7 pts
  const o = { seed: 1, discovery: true, background: true, omnibus: true, vigilance: true, window: null, memory: true, planning: true, curiosity: false, horizon: 21,
    // v5 : C1 exploration par la valeur de l'information · C2 variables latentes inventées · C3 remise en cause · C4 incompréhension
    explore: true, invent: true, challenge: true, perplexity: true, ...opts };
  o.families ??= FAMILIES;
  const rng = makeRng(o.seed * 7919 + 3);
  const levers = body.levers, ctxDefs = body.context ?? [];
  const decLevers = levers.filter((l) => l.kind !== 'capacity');
  const contLevers = levers.filter((l) => l.kind === 'continuous');
  // ---- l'espace de chaque mesure est DÉDUIT de la déclaration ----
  const describe = (key, outcome) => {
    const lv = levers.find((l) => l.key === key), cx = ctxDefs.find((c) => c.key === key);
    const d = lv ?? cx;
    const thetas = d.thetas ?? (lv && lv.kind !== 'capacity' ? (() => { const g = leverGrid(lv); return [0.2, 0.35, 0.5, 0.65, 0.8].map((q) => g[Math.floor(q * (g.length - 1))]).filter((v, i, a) => a.indexOf(v) === i); })() : []);
    return { key, label: d.label, unit: d.unit, transform: d.transform ?? 'lin', ref: d.ref, scale: d.scale, prior: outcome.priors?.[key], continuous: !lv || lv.kind === 'continuous', carry: !!lv, thetas, sign: d.sign };
  };
  // ---- variables CONSTRUITES par l'agent (aucune n'est déclarée par le corps) ----
  // mémoire exponentielle de chaque levier · jours depuis la dernière activation d'un levier discret
  // · valeur de la veille de chaque mesure. La découverte décidera seule lesquelles comptent.
  const discLevers = decLevers.filter((l) => l.kind === 'discrete');
  const latentDefs = [];
  if (o.memory) {
    for (const l of decLevers) for (const lam of [0.7, 0.9]) latentDefs.push({ key: `ema${lam * 10}:${l.key}`, label: `mémoire de « ${l.label} » (λ=${lam})`, of: l.label, latent: true, latentKind: 'ema', lambda: lam, lever: l.key, transform: l.transform ?? 'lin', ref: l.ref, scale: l.scale, continuous: true });
    for (const l of discLevers) latentDefs.push({ key: `since:${l.key}`, label: `jours depuis « ${l.label} »`, of: l.label, latent: true, latentKind: 'since', lever: l.key, transform: 'lin', ref: 0, scale: 10, continuous: true });
    for (const ox of body.outcomes) latentDefs.push({ key: `lag:${ox.key}`, label: `${ox.label} de la veille`, of: ox.label, latent: true, latentKind: 'lag', outcome: ox.key, transform: 'lin', ref: 0, scale: 1, continuous: true });
  }
  // C2 — VARIABLES LATENTES INVENTÉES : dynamiques amorties composées à partir de plusieurs sources
  // (mesures et leviers déclarés) : z ← λ·z + (1−λ)·Σ wₖ·uₖ/échelleₖ, avec au plus deux sources (w = +1/−1).
  // Mémoires lentes d'une mesure, « stocks » (différence de deux flux), écart entre un flux et un levier…
  // Aucune n'est prévue pour une activité : c'est un espace combinatoire, trié ensuite par la preuve.
  const invSources = [...body.outcomes.map((x) => ({ key: x.key, label: x.label, kind: 'outcome' })), ...decLevers.map((l) => ({ key: l.key, label: l.label, kind: 'lever' }))];
  const invDefs = [];
  if (o.invent) {
    const outs = invSources.filter((x) => x.kind === 'outcome');
    for (const lam of [0.9, 0.97]) {
      for (const a of outs) invDefs.push({ terms: [[a, 1]], lam });
      for (let i = 0; i < invSources.length; i++) for (let j = i + 1; j < invSources.length; j++) {
        if (invSources[i].kind !== 'outcome' && invSources[j].kind !== 'outcome') continue;
        invDefs.push({ terms: [[invSources[i], 1], [invSources[j], -1]], lam });
      }
    }
    invDefs.forEach((d, i) => {
      d.key = `inv${i}`;
      d.label = d.terms.length === 1 ? `mémoire lente de « ${d.terms[0][0].label} » (λ=${d.lam})` : `stock caché « ${d.terms[0][0].label} » − « ${d.terms[1][0].label} » (λ=${d.lam})`;
      latentDefs.push({ key: d.key, label: d.label, of: d.label, latent: true, latentKind: 'inv', inv: d, transform: 'lin', ref: 0, scale: 1, continuous: true });
    });
  }
  const invScale = {};
  const invStep = (z, d, src) => d.lam * z + (1 - d.lam) * d.terms.reduce((s, [u, w]) => s + w * (src[u.key] ?? 0) / (invScale[u.key] || 1), 0);
  const isActive = (l, v) => v !== l.values[0];
  const freshState = () => ({ ema: Object.fromEntries(decLevers.map((l) => [l.key, { 0.7: l.init, 0.9: l.init }])), since: Object.fromEntries(discLevers.map((l) => [l.key, 0])), lag: {}, inv: {} });
  // valeurs des variables construites pour une action donnée, à partir de l'état de la veille
  const derived = (st, a) => {
    const x = {};
    for (const d of latentDefs) {
      if (d.latentKind === 'ema') x[d.key] = (1 - d.lambda) * a[d.lever] + d.lambda * st.ema[d.lever][d.lambda];
      else if (d.latentKind === 'since') { const l = discLevers.find((y) => y.key === d.lever); x[d.key] = isActive(l, a[d.lever]) ? 0 : st.since[d.lever] + 1; }
      else if (d.latentKind === 'inv') x[d.key] = st.inv?.[d.key] ?? 0;
      else x[d.key] = st.lag[d.outcome] ?? null;
    }
    return x;
  };
  const nextState = (st, a, logOut) => ({
    ema: Object.fromEntries(decLevers.map((l) => [l.key, { 0.7: 0.3 * a[l.key] + 0.7 * st.ema[l.key][0.7], 0.9: 0.1 * a[l.key] + 0.9 * st.ema[l.key][0.9] }])),
    since: Object.fromEntries(discLevers.map((l) => [l.key, isActive(l, a[l.key]) ? 0 : st.since[l.key] + 1])),
    lag: { ...st.lag, ...logOut },
    inv: Object.fromEntries(invDefs.map((d) => [d.key, invStep(st.inv?.[d.key] ?? 0, d, { ...a, ...Object.fromEntries(Object.entries(logOut).map(([k, v]) => [k, Math.exp(v)])) })])),
  });
  const M = {};
  for (const out of body.outcomes) {
    const space = makeSpace(out, [...out.inputs.map((k) => describe(k, out)), ...latentDefs.map((d) => ({ ...d }))]);
    M[out.key] = { out, space, records: [], beliefs: [], retracted: [], hypLog: [], model: null, kappa: 1, cusum: { pos: 0, neg: 0 }, ec: {}, vc: 0, lastZ: null, probe: null, nextId: 1, ls: [], perplexed: false, perplexDays: 0 };
  }
  const A = {
    body, opts: o, M, stageCount: Object.fromEntries(STAGES.map(([k]) => [k, 0])), today: null, history: [], insights: [],
    ad: Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: l.init, 0.8: l.init }])), dstate: null, tried: {}, lastCurious: -99, curiositySpent: 0, cum: 0, lastUsed: {}, rcusum: { pos: 0, neg: 0 }, forceSearch: false, perplexLog: [], experimentUntil: -1, maxStep: 0.15, expLever: null, expCooldown: {},
  };
  const trace = [];
  const emit = (stage, text, data = {}) => { A.stageCount[stage]++; trace.push({ t: A.today?.t ?? null, stage, text, data }); };

  const data = (m) => (o.window ? m.records.slice(-o.window) : m.records);
  const impute = (m, r) => { const p = m.model.predict(r); const a = (r.y - p.mu) / p.scale; r.yImp = Math.max(r.y, p.mu + p.scale * truncMean(a)); };
  const refit = (m) => { if (m.model) for (const r of data(m)) if (r.censored) impute(m, r); m.model = fit(m.space, data(m), m.beliefs); };
  Object.values(M).forEach(refit);
  const adFor = (a) => Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: 0.5 * a[l.key] + 0.5 * A.ad[l.key][0.5], 0.8: 0.2 * a[l.key] + 0.8 * A.ad[l.key][0.8] }]));
  A.dstate = freshState();
  const rec = (t, a, ctx, st = A.dstate) => ({ t, dow: t % 7, x: { ...a, ...ctx, ...derived(st, a) }, ad: adFor(a) });
  const preds = (t, ctx, st = A.dstate) => Object.fromEntries(Object.values(M).map((m) => [m.out.key, (a) => { const p = m.model.predict(rec(t, a, ctx, st)); return { mu: p.mu, s: p.scale * m.kappa }; }]));
  const samplePreds = (t, ctx, st = A.dstate) => Object.fromEntries(Object.values(M).map((m) => { const s = m.model.sample(rng); return [m.out.key, (a) => { const r = rec(t, a, ctx, st); return { mu: m.model.muWith(s.theta, r), s: s.sigma * Math.sqrt(varianceWeight(t, m.beliefs)) }; }]; }));

  // ---------- PLANIFICATION : découvrir des stratégies dans son propre modèle ----------
  // Familles de plans : statu quo optimisé, et pour chaque levier discret, chaque valeur, chaque période
  // et chaque phase, un calendrier périodique. Chaque plan est simulé sur l'horizon dans le modèle appris
  // (état dérivé propagé jour après jour). Rien n'est spécifique à un métier.
  function simulatePlan(t, ctx, planFn, H, predsFn = preds) {
    let st = A.dstate, total = 0;
    for (let d = 0; d < H; d++) {
      const tt = t + d, P = predsFn(tt, ctx, st);
      const r = withCapacity(body, planFn(d), P, ctx);
      total += Math.pow(0.995, d) * r.value;
      const logOut = Object.fromEntries(body.outcomes.map((x) => [x.key, P[x.key](r.action).mu]));
      st = nextState(st, r.action, logOut);
    }
    return total;
  }
  // un plan à plusieurs jours n'a d'intérêt que si le modèle contient un mécanisme à ÉTAT
  const dynamicBeliefs = () => Object.values(M).some((m) => m.beliefs.some((b) => ['memory', 'adstock', 'pulse'].includes(b.family)));
  function plan(t, ctx, today) {
    const H = o.horizon;
    // référence : l'optimum du jour pour chaque jour de semaine (le calendrier hebdomadaire est déjà géré)
    const byDow = {};
    for (let d = 0; d < 7; d++) { const tt = t + d; byDow[tt % 7] = d === 0 ? today : optimizeAction(body, preds(tt, ctx), ctx, { start: today }).action; }
    const base = (d) => byDow[(t + d) % 7];
    const v0 = simulatePlan(t, ctx, base, H);
    let best = { v: v0, desc: null, fn: base };
    for (const l of discLevers) {
      const i0 = l.values.indexOf(today[l.key]);
      const alts = [...new Set([l.values[0], l.values[i0 - 1], l.values[i0 + 1]].filter((x) => x != null && x !== today[l.key]))];
      for (const val of alts) {
        const over = (d) => ({ ...base(d), [l.key]: val });
        const vc = simulatePlan(t, ctx, over, H);
        if (vc > best.v) best = { v: vc, desc: `« ${l.label} » = ${val} en permanence`, fn: over };
        for (const k of [3, 5, 7, 10, 14]) for (let ph = 0; ph < Math.min(k, 5); ph++) {
          const fn = (d) => ((d - ph) % k === 0 && d >= ph ? over(d) : base(d));
          const v = simulatePlan(t, ctx, fn, H);
          if (v > best.v) best = { v, desc: `« ${l.label} » = ${val} tous les ${k} jours${ph ? ` (prochaine fois dans ${ph} j)` : ' (dès aujourd’hui)'}`, fn };
        }
      }
    }
    if (!best.desc) return { gain: 0, v0 };
    // robustesse : le gain doit se confirmer dans des mondes tirés de la postérieure (malédiction de l'optimiseur)
    let robust = true;
    for (let i = 0; i < 2 && robust; i++) {
      const sp = samplePreds(t, ctx);
      const ws = Object.fromEntries(Object.keys(sp).map((k) => [k, sp[k]]));
      const sPreds = (tt, c, st) => { const P2 = preds(tt, c, st); return Object.fromEntries(Object.keys(P2).map((k) => [k, (a) => { const p = P2[k](a), q = ws[k](a); return { mu: p.mu + (q.mu - preds(t, c)[k](a).mu), s: p.s }; }])); };
      if (simulatePlan(t, ctx, best.fn, H, sPreds) <= simulatePlan(t, ctx, base, H, sPreds)) robust = false;
    }
    return robust ? { ...best, gain: best.v - v0, v0 } : { gain: 0, v0 };
  }
  const syncCoefs = (m) => m.beliefs.forEach((b, i) => { const c = m.model.cols[i]; b.coef = c >= 0 ? m.model.mn.slice(c, c + termWidth(b)) : [b.basis.ratio]; b.key = famKey(b); b.narrative = narrate(m.space, b, b.coef); });

  // ---------- hypothèses (par mesure) ----------
  function adjudicate(m, t, H, threshold, origin) {
    if (m.perplexed) threshold = Math.max(threshold, 0.99999); // C4 : je ne comprends pas cette mesure → je n'empile plus d'explications
    const pChange = 1 - H.pNull;
    const fams = Object.entries(H.famMass).sort((a, b) => b[1] - a[1]);
    let accepted = null, ambiguous = false;
    if (pChange > threshold && fams.length) {
      const [bestFam, mass] = fams[0];
      ambiguous = mass / pChange < 0.6 && bestFam !== 'end';
      if (!(origin === 'background' && ambiguous)) {
        const c = H.all.find((x) => famKey(x) === bestFam);
        if (c.family === 'end') { accepted = m.beliefs[c.target]; accepted.gate.end = c.tau; }
        else {
          accepted = { id: m.nextId++, family: c.family, inputKey: c.inputKey, gate: { ...c.gate }, basis: { ...c.basis }, acceptedAt: t, logBF: c.logBF, provisional: ambiguous, origin };
          m.beliefs.push(accepted);
          if (ambiguous) A.experimentUntil = t + 10;
        }
        refit(m); syncCoefs(m);
      }
    }
    const sparse = fams.find(([f, v]) => PROBE_FAMILIES.includes(f) && v > 0.2);
    if (!accepted && m.out.cap && pChange > 0.5 && sparse && !(m.probe && m.probe.key === sparse[0])) {
      const c = H.all.find((x) => famKey(x) === sparse[0]);
      if (c?.coef?.[0] > 0.05) m.probe = { key: sparse[0], term: { family: c.family, gate: { ...c.gate }, basis: { ...c.basis } }, coef: c.coef, until: t + 42, budget: 6, p: sparse[1] };
    }
    m.hypLog.push({ t, origin, pChange, famMass: H.famMass, n: H.nCandidates, accepted: accepted ? { key: famKey(accepted), tau: accepted.gate.tau ?? null } : null });
    return { pChange, fams, accepted, ambiguous };
  }

  // ---------- MATIN ----------
  function planDay(ctxIn) {
    trace.length = 0;
    const t = ctxIn.t, ctx = ctxIn.context ?? {};
    A.today = { t, ctx };
    const last = A.history[A.history.length - 1];
    emit('observer', `Jour ${t}. Informations du matin : ${ctxDefs.map((c) => `${c.label} ${num(ctx[c.key])}${c.unit ? ' ' + c.unit : ''}`).join(', ') || '—'}.${last ? ` Hier : ${body.outcomes.map((x) => `${x.label} ${num(last.outcomes[x.key])}${last.censored[x.key] ? ' (plafonné)' : ''}`).join(', ')} ; résultat ${num(last.reward)} €.` : ''}`);
    emit('comprendre', `Mon modèle : ${Object.values(M).map((m) => `${m.out.label} (${m.model.n} obs., σ=${Math.sqrt(m.model.sigma2).toFixed(2)}, ${m.beliefs.length} croyance(s))`).join(' ; ')}.`);

    // CONFRONTER + HYPOTHÈSES, mesure par mesure
    for (const m of Object.values(M)) {
      if (t < WARMUP || m.lastZ == null) continue;
      const lvlA = m.cusum.pos > CH || m.cusum.neg > CH;
      const prA = Object.entries(m.ec).find(([, v]) => v.pos > EH || v.neg > EH);
      const surA = o.omnibus && m.vc > VH;
      const stratA = A.forceSearch; // C3 : ma stratégie ne donne plus les résultats prévus
      if (!(lvlA || prA || surA || stratA)) continue;
      emit('confronter', `Contradiction sur « ${m.out.label} » : ${[lvlA && 'écart durable à la théorie', prA && `erreurs corrélées à « ${m.space.inputs.find((x) => x.key === prA[0]).label} »`, surA && 'surprise anormale (mécanisme inconnu ?)'].filter(Boolean).join(' ; ')}.`, { outcome: m.out.key, verdict: 'contradiction' });
      if (!o.discovery) { m.cusum = { pos: 0, neg: 0 }; m.ec = {}; m.vc = 0; continue; }
      const H = searchExplanations(m.space, m.model, t, { warmup: WARMUP, families: o.families, records: data(m) });
      const r = adjudicate(m, t, H, P_CONTRA, 'contradiction');
      const famTxt = r.fams.slice(0, 3).map(([k, v]) => `${FAMILY_FR[k.split(':')[0]]}${k.includes(':') ? ' (' + k.split(':')[1] + ')' : ''} ${Math.round(v * 100)} %`).join(', ');
      emit('hypotheses', r.accepted ? `Pourquoi ? ${r.accepted.narrative} (${H.nCandidates} explications testées ; P = ${(r.pChange * 100).toFixed(1)} % ; ${famTxt}).` : `Pourquoi ? ${H.nCandidates} explications testées pour « ${m.out.label} » (${famTxt}) : P(changement) ${Math.round(r.pChange * 100)} %, insuffisant.`, { outcome: m.out.key, accepted: r.accepted, pChange: r.pChange, nCandidates: H.nCandidates });
      const f = r.accepted ? 0 : r.pChange > 0.7 ? 0.8 : 0.6;
      m.cusum = { pos: Math.min(m.cusum.pos, CH * f), neg: Math.min(m.cusum.neg, CH * f) }; m.vc = Math.min(m.vc, VH * f);
      for (const k in m.ec) m.ec[k] = { pos: Math.min(m.ec[k].pos, EH * f), neg: Math.min(m.ec[k].neg, EH * f) };
      if (!r.accepted && r.pChange > 0.7) A.experimentUntil = Math.max(A.experimentUntil, t + 7);
    }
    // apprentissage actif : une corrélation erreur–levier qui monte (sans preuve encore) déclenche une
    // expérience ciblée sur ce levier, pour rendre son effet mesurable
    for (const m of Object.values(M)) for (const [k, v] of Object.entries(m.ec)) {
      const lv = contLevers.find((l) => l.key === k);
      if (!lv || t < WARMUP || Math.max(v.pos, v.neg) < EH * 0.5 || t < (A.expCooldown[k] ?? -1)) continue;
      A.experimentUntil = Math.max(A.experimentUntil, t + 10); A.expLever = k; A.expCooldown[k] = t + 40;
      emit('confronter', `Soupçon : mes erreurs sur « ${m.out.label} » se corrèlent à « ${lv.label} » → expérience ciblée de 10 jours (variations de ±15 %).`, { verdict: 'soupcon', lever: k });
    }
    A.forceSearch = false;
    if (!trace.some((e) => e.stage === 'confronter')) emit('confronter', t < WARMUP ? `Phase d'apprentissage (${t}/${WARMUP}).` : `Confirmation : les faits d'hier sont compatibles avec ma théorie.`, { verdict: t < WARMUP ? 'apprentissage' : 'confirmation' });

    // ANTICIPER / PRIORISER
    const P = preds(t, ctx);
    const cur = last ? { ...last.action } : Object.fromEntries(levers.map((l) => [l.key, l.init]));
    const free = optimizeAction(body, P, ctx, { start: cur });
    const curV = withCapacity(body, cur, P, ctx).value;
    emit('anticiper', `Valeur espérée aujourd'hui : statu quo ${num(curV)} €, optimum ${num(free.value)} € (${decLevers.map((l) => `${l.label} ${num(free.action[l.key])}`).join(', ')}).`, { opportunity: free.value - curV });
    let evpi = 0;
    const samples = [];
    for (let i = 0; i < 3; i++) {
      const sp = samplePreds(t, ctx); samples.push(sp);
      const b = optimizeAction(body, sp, ctx, { start: free.action });
      evpi += b.value - withCapacity(body, free.action, sp, ctx).value;
    }
    evpi /= 3;
    const experimenting = t <= A.experimentUntil;
    if (!experimenting) A.expLever = null;
    const mode = experimenting ? 'experiment' : evpi > Math.max(1, 0.01 * Math.abs(free.value)) && t < 300 ? 'explore' : 'exploit';
    emit('prioriser', `Valeur de l'information ≈ ${num(evpi)} €/jour → mode ${mode === 'explore' ? 'EXPLORATION (Thompson)' : mode === 'experiment' ? 'EXPÉRIENCE' : 'EXPLOITATION'}.`, { evpi, mode });

    // DÉCIDER
    const within = (a) => decLevers.every((l) => (l.kind !== 'continuous' || !last ? true : Math.abs(a[l.key] / last.action[l.key] - 1) <= A.maxStep + 1e-9));
    const decP = mode === 'explore' ? samples[0] : P;
    let proposal = optimizeAction(body, decP, ctx, { constraint: within, start: cur });
    proposal = withCapacity(body, proposal.action, P, ctx);
    let note = '';
    const ditherLever = mode === 'experiment' && A.expLever ? contLevers.find((l) => l.key === A.expLever) : contLevers.length ? contLevers[Math.floor(t / 2) % contLevers.length] : null;
    const amp = mode === 'experiment' && A.expLever ? 0.15 : DITHER;
    if ((mode === 'experiment' || (mode === 'exploit' && o.vigilance && t >= WARMUP)) && ditherLever) {
      const sign = t % 2 === 0 ? 1 : -1, lv = ditherLever;
      const v = Math.min(lv.max, Math.max(lv.min, Math.round((proposal.action[lv.key] * (1 + amp * sign)) / lv.step) * lv.step));
      // jour de variation : un cran de capacité en plus, pour voir la réponse non plafonnée
      const cand = withCapacity(body, { ...proposal.action, [lv.key]: v }, P, ctx, 0.05);
      if (mode === 'experiment' || proposal.value - cand.value < 0.03 * Math.abs(proposal.value) + 2) { proposal = cand; note = ` Variation ${mode === 'experiment' ? 'expérimentale' : 'de vigilance'} de « ${lv.label} » (${sign > 0 ? '+' : '−'}${Math.round(amp * 100)} %).`; }
    }
    // expériences de dé-censure (hypothèses calendaires plausibles mais masquées)
    for (const m of Object.values(M)) {
      if (!m.probe || t > m.probe.until || m.probe.budget <= 0) { m.probe = null; continue; }
      const v = termValues(m.space, m.probe.term, rec(t, proposal.action, ctx)).reduce((s, x, i) => s + x * (m.probe.coef[i] ?? 0), 0);
      if (v > 0.05) {
        const boosted = { ...P, [m.out.key]: (a) => { const p = P[m.out.key](a); return { mu: p.mu + v, s: p.s }; } };
        proposal = { action: withCapacity(body, proposal.action, boosted, ctx).action, value: proposal.value };
        m.probe.budget--; note += ` EXPÉRIENCE : capacité accrue pour tester « ${FAMILY_FR[m.probe.term.family]} » sur ${m.out.label}.`;
      }
    }
    // stratégie à plusieurs jours, découverte par simulation dans le modèle appris
    if (o.planning && t >= WARMUP && discLevers.length && dynamicBeliefs()) {
      const pl = plan(t, ctx, proposal.action);
      if (pl.desc && pl.gain > Math.max(5, 0.01 * Math.abs(pl.v0))) {
        proposal = withCapacity(body, pl.fn(0), P, ctx);
        A.strategy = { t, desc: pl.desc, gain: pl.gain };
        note += ` STRATÉGIE découverte : ${pl.desc} (+${num(pl.gain)} € simulés sur ${o.horizon} j).`;
      }
    }
    // curiosité : une option jamais (ou presque jamais) essayée ne peut pas être apprise
    let curious = false;
    // budget d'exploration : au plus 2 % de ce que l'activité a rapporté jusqu'ici
    if (o.curiosity && t >= 7 && t < 200 && t - A.lastCurious >= 5) {
      const budget = 0.02 * Math.max(0, A.cum) - A.curiositySpent;
      for (const l of discLevers) for (const val of l.values) {
        if ((A.tried[`${l.key}=${val}`] ?? 0) >= 2 || val === proposal.action[l.key] || curious) continue;
        const cand = withCapacity(body, { ...proposal.action, [l.key]: val }, P, ctx);
        const cost = Math.max(0, proposal.value - cand.value);
        if (cost <= budget) {
          note += ` CURIOSITÉ : j'essaie « ${l.label} » = ${val} (peu essayé ; coût espéré ${num(cost)} €, budget d'exploration restant ${num(budget - cost)} €).`;
          proposal = cand; curious = true; A.lastCurious = t; A.curiositySpent += cost;
        }
      }
    }
    // C1 — EXPLORATION PAR LA VALEUR DE L'INFORMATION : chaque option discrète reçoit un bonus égal à
    // l'incertitude (entre mondes plausibles) de son avantage ; C3 : ce bonus grandit avec le temps depuis
    // le dernier essai (le monde a pu changer). On ne renonce pas à une option prometteuse mais incertaine.
    let exploring = false;
    if (o.explore && t >= 7 && t < 330 && discLevers.length) {
      const sps = [...samples, samplePreds(t, ctx), samplePreds(t, ctx)];
      const base = proposal, vb = sps.map((sp) => withCapacity(body, base.action, sp, ctx).value);
      let best = null;
      for (const l of discLevers) for (const val of l.values) {
        if (val === base.action[l.key]) continue;
        const cand = withCapacity(body, { ...base.action, [l.key]: val }, P, ctx);
        const d = sps.map((sp, i) => withCapacity(body, cand.action, sp, ctx).value - vb[i]);
        const md = d.reduce((x, y) => x + y, 0) / d.length, U = Math.sqrt(d.reduce((x, y) => x + (y - md) ** 2, 0) / (d.length - 1));
        const stale = o.challenge ? t - (A.lastUsed[`${l.key}=${val}`] ?? -60) : 0;
        const bonus = U * Math.sqrt(1 + stale / 30) * Math.sqrt(Math.max(0, 365 - t) / 365);
        const score = cand.value - base.value + bonus;
        if (score > 0 && (!best || score > best.score)) best = { cand, score, l, val, U, stale, gap: base.value - cand.value };
      }
      if (best) {
        proposal = best.cand; exploring = true;
        note += ` EXPLORATION : « ${best.l.label} » = ${best.val} (coût espéré ${num(Math.max(0, best.gap))} €, incertitude de son avantage ±${num(best.U)} €${best.stale > 30 ? `, pas essayé depuis ${best.stale} j` : ''}).`;
      }
    }
    emit('decider', `Décision : ${levers.map((l) => `${l.label} ${num(proposal.action[l.key])}`).join(', ')} ; valeur espérée ${num(proposal.value)} €.${note}`, { action: proposal.action, mode });

    // SIMULER : bac à sable sur la postérieure + règle de risque
    const fallback = withCapacity(body, cur, P, ctx);
    const sim = (a) => { const v = []; for (let i = 0; i < 40; i++) v.push(expectedReward(body, a, samplePreds(t, ctx), ctx)); v.sort((x, y) => x - y); return { mean: v.reduce((s, x) => s + x, 0) / v.length, p10: v[4], pLoss: v.filter((x) => x < 0).length / v.length }; };
    const sp = sim(proposal.action), sf = sim(fallback.action);
    A.today.value = sp.mean; A.today.vsd = Math.max(1e-6, (sp.mean - sp.p10) / 1.28);
    const reasons = [];
    if (sp.pLoss > Math.max(0.3, sf.pLoss + 0.1)) reasons.push(`P(perte) ${Math.round(sp.pLoss * 100)} %`);
    for (const l of decLevers) {
      const seen = A.history.map((h) => h.action[l.key]);
      if (!seen.length) continue;
      if (l.kind === 'discrete' && !curious && !exploring && !seen.includes(proposal.action[l.key])) reasons.push(`« ${l.label} » = ${proposal.action[l.key]} jamais essayé`);
      if (l.kind === 'continuous') { const lo = Math.min(...seen), hi = Math.max(...seen), v = proposal.action[l.key]; if (v < lo / 1.2 || v > hi * 1.2) reasons.push(`« ${l.label} » hors du domaine observé`); }
    }
    let action = proposal.action, how = 'auto';
    emit('simuler', `Bac à sable (40 mondes tirés de ma postérieure) : moyenne ${num(sp.mean)} €, P10 ${num(sp.p10)} €, P(perte) ${Math.round(sp.pLoss * 100)} % ; statu quo ${num(sf.mean)} €. Risque ${reasons.length ? 'ÉLEVÉ — ' + reasons.join(' ; ') : 'faible'}.`, { risk: reasons.length ? 'élevé' : 'faible' });
    if (reasons.length) {
      const voi = evpi * 6;
      const ok = sp.mean >= sf.mean - Math.max(5, voi) && sp.pLoss <= 0.5;
      if (!ok) { action = fallback.action; how = 'fallback'; }
      emit('revue', `Arbitrage automatique (aucun humain) : ${ok ? 'risque accepté' : 'plan de repli'} (coût espéré ${num(sf.mean - sp.mean)} €, valeur de l'information ${num(voi)} €).`, { ok });
    }
    A.today.action = action; A.today.how = how;
    A.today.pred = Object.fromEntries(Object.values(M).map((m) => { const p = m.model.predict(rec(t, action, ctx)); return [m.out.key, { mu: p.mu, s: p.scale * m.kappa }]; }));
    emit('executer', `Exécution ${how === 'auto' ? 'autonome' : 'du plan de repli'} : ${levers.map((l) => `${l.label} ${num(action[l.key])}`).join(', ')}.`, { action, how });
    return { action, trace: trace.slice() };
  }

  // ---------- SOIR ----------
  function observeOutcome(obs) {
    trace.length = 0;
    const t = obs.t, ctx = A.today.ctx, a = obs.action;
    A.cum += obs.reward;
    A.history.push({ t, action: a, outcomes: obs.outcomes, censored: obs.censored, reward: obs.reward });
    const ad = adFor(a);
    const lines = [];
    for (const m of Object.values(M)) {
      const y = Math.log(Math.max(obs.outcomes[m.out.key], 0.5));
      const r = { t, dow: t % 7, x: { ...a, ...ctx, ...derived(A.dstate, a) }, ad, y, censored: !!obs.censored[m.out.key] };
      const pr = A.today.pred[m.out.key];
      if (r.censored) impute(m, r);
      const z = (y - pr.mu) / pr.s;
      r.inside = r.censored ? null : Math.abs(z) <= Z80;
      // C4 — TEST D'ADÉQUATION : ma théorie prédit-elle mieux qu'un simple prolongement des derniers jours ?
      if (o.perplexity && !r.censored && m.records.length >= 14) {
        const prev = m.records.slice(-7).map((x) => (x.censored ? x.yImp : x.y)), nm = prev.reduce((s2, v) => s2 + v, 0) / prev.length;
        const resid = m.records.slice(-28).map((x) => (x.censored ? x.yImp : x.y) - nm), ns = Math.max(0.05, Math.sqrt(resid.reduce((s2, v) => s2 + v * v, 0) / resid.length));
        const lsM = -Math.log(pr.s) - 0.5 * z * z, lsN = -Math.log(ns) - 0.5 * ((y - nm) / ns) ** 2;
        m.ls.push(lsM - lsN); if (m.ls.length > 28) m.ls.shift();
        const recent = m.beliefs.filter((b) => b.acceptedAt > t - 60).length;
        const adv = m.ls.reduce((s2, v) => s2 + v, 0) / m.ls.length;
        if (!m.perplexed && t >= WARMUP + 14 && m.ls.length >= 20 && (adv < -0.05 || recent >= 4)) {
          m.perplexed = true; m.kappa = Math.max(m.kappa, 1.3);
          A.perplexLog.push({ t, outcome: m.out.key, on: true, adv, recent });
          emit('confronter', `JE NE COMPRENDS PAS « ${m.out.label} » : ${adv < -0.05 ? 'un simple prolongement des derniers jours prédit mieux que ma théorie' : `j'ai dû ajouter ${recent} explications en deux mois`}. Je cesse d'empiler des hypothèses sur cette mesure et j'élargis mon incertitude.`, { perplexed: true, outcome: m.out.key });
        } else if (m.perplexed && adv > 0.05 && recent < 4) {
          m.perplexed = false; A.perplexLog.push({ t, outcome: m.out.key, on: false, adv });
          emit('confronter', `Je comprends de nouveau « ${m.out.label} » : ma théorie prédit mieux que le prolongement naïf.`, { perplexed: false, outcome: m.out.key });
        }
        if (m.perplexed) m.perplexDays++;
      }
      lines.push(`${m.out.label} ${num(obs.outcomes[m.out.key])}${r.censored ? ' (plafonné)' : ''} (z=${z.toFixed(2)})`);
      if (t >= WARMUP - 1) {
        let zc = Math.max(-6, Math.min(6, z));
        if (r.censored) zc = Math.max(zc, truncMean(zc));
        m.cusum.pos = Math.max(0, m.cusum.pos + zc - CK);
        m.cusum.neg = r.censored ? m.cusum.neg : Math.max(0, m.cusum.neg - zc - CK);
        if (!r.censored) m.vc = Math.max(0, m.vc + Math.min(16, zc * zc) - 1 - VK);
        // détecteur de corrélation erreur–variable, pour chaque variable continue (jours plafonnés inclus, preuve tronquée)
        for (const inp of m.space.inputs.filter((x) => x.continuous)) {
          const w = m.records.slice(-28).map((x) => x.x[inp.key]);
          if (w.length < 14) continue;
          const mu = w.reduce((s, v) => s + v, 0) / w.length, sd = Math.sqrt(w.reduce((s, v) => s + (v - mu) ** 2, 0) / w.length);
          if (sd < 1e-9 || sd / (Math.abs(mu) + 1e-9) < 0.02) continue;
          const u = Math.max(-2, Math.min(2, (r.x[inp.key] - mu) / sd));
          const sc = Math.max(-4, Math.min(4, zc * u));
          if (r.censored && sc < 0) continue; // un plafond ne prouve qu'une hausse
          const e = (m.ec[inp.key] ??= { pos: 0, neg: 0 });
          e.pos = Math.max(0, e.pos + sc - EK); e.neg = Math.max(0, e.neg - sc - EK);
        }
        m.lastZ = z;
      }
      m.records.push(r);
      refit(m); syncCoefs(m);
    }
    for (const l of decLevers) A.ad[l.key] = ad[l.key];
    for (const l of discLevers) A.lastUsed[`${l.key}=${a[l.key]}`] = t;
    // C3 — REMISE EN CAUSE : le résultat réalisé s'écarte-t-il durablement de ce que ma stratégie promettait ?
    if (o.challenge && A.today.value != null && t >= WARMUP) {
      const rz = Math.max(-6, Math.min(6, (obs.reward - A.today.value) / A.today.vsd));
      A.rcusum.pos = Math.max(0, A.rcusum.pos + rz - 0.5); A.rcusum.neg = Math.max(0, A.rcusum.neg - rz - 0.5);
      if (A.rcusum.pos > 8 || A.rcusum.neg > 8) {
        emit('mesurer', `Ma stratégie ne donne plus les résultats prévus (${A.rcusum.neg > A.rcusum.pos ? 'en dessous' : 'au-dessus'} de mes prévisions depuis plusieurs jours) : je remets en cause mes croyances et je ré-explore mes options.`, { challenge: true });
        A.rcusum = { pos: 0, neg: 0 }; A.forceSearch = true; A.lastUsed = {}; A.experimentUntil = Math.max(A.experimentUntil, t + 7);
      }
    }
    for (const l of discLevers) A.tried[`${l.key}=${a[l.key]}`] = (A.tried[`${l.key}=${a[l.key]}`] ?? 0) + 1;
    A.dstate = nextState(A.dstate, a, Object.fromEntries(body.outcomes.map((x) => [x.key, Math.log(Math.max(obs.outcomes[x.key], 0.5))])));
    // C2 : à la fin de l'échauffement, échelles fixées et séries latentes recalculées rétroactivement
    if (invDefs.length && t === WARMUP - 1) {
      for (const u of invSources) { const v = A.history.map((h) => Math.abs(u.kind === 'outcome' ? h.outcomes[u.key] : h.action[u.key])); invScale[u.key] = Math.max(1e-6, v.reduce((x, y) => x + y, 0) / v.length); }
      const z = Object.fromEntries(invDefs.map((d) => [d.key, 0]));
      for (const h of A.history) {
        for (const m2 of Object.values(M)) { const r2 = m2.records.find((x) => x.t === h.t); if (r2) for (const d of invDefs) r2.x[d.key] = z[d.key]; }
        const src = { ...h.action, ...h.outcomes };
        for (const d of invDefs) z[d.key] = invStep(z[d.key], d, src);
      }
      A.dstate.inv = z;
      Object.values(M).forEach((m2) => { refit(m2); syncCoefs(m2); });
    }
    emit('mesurer', `Résultat : ${lines.join(', ')} ; ${num(obs.reward)} € (cumul ${num(A.cum)} €).`, { reward: obs.reward });
    emit('apprendre', `Épisode ${t} mémorisé.`);
    emit('reviser', `Postérieures mises à jour (${Object.values(M).map((m) => `${m.out.label} : ${m.model.n} obs.`).join(', ')}).`);
    if (t % 7 === 6 && t >= WARMUP) dream(t);
    return { trace: trace.slice() };
  }

  function dream(t) {
    const notes = [];
    for (const m of Object.values(M)) {
      const d = data(m);
      if (o.discovery) {
        for (const b of [...m.beliefs]) {
          if (!m.beliefs.includes(b)) continue;
          const mw = fit(m.space, d, m.beliefs.filter((x) => x !== b));
          const withB = mw.scoreCandidate(b).logML;
          let best = { term: b, ml: withB };
          const consider = (v, margin) => { const ml = mw.scoreCandidate(v).logML; if (ml > best.ml + margin) best = { term: v, ml }; };
          if (b.gate.kind !== 'all') for (let tau = Math.max(WARMUP, b.gate.tau - 10); tau <= Math.min(t - 2, b.gate.tau + 10); tau++) if (tau !== b.gate.tau && !(b.gate.end != null && tau >= b.gate.end - 2)) consider({ ...b, gate: { ...b.gate, tau } }, 1);
          if (t - b.acceptedAt >= 5) for (const alt of alternatives(m.space, best.term, t, o.families)) consider(alt, b.gate.kind === 'all' ? 3 : 2);
          if (best.term !== b) {
            const v = best.term;
            if (famKey(v) !== famKey(b) || JSON.stringify(v.basis) !== JSON.stringify(b.basis) || v.gate.kind !== b.gate.kind) notes.push(`${m.out.label} : croyance #${b.id} REQUALIFIÉE (${FAMILY_FR[b.family]} → ${FAMILY_FR[v.family]})`);
            Object.assign(b, { family: v.family, inputKey: v.inputKey, gate: { ...v.gate }, basis: { ...v.basis }, provisional: false });
          }
          b.logBF = best.ml - mw.logML;
          if (b.logBF < 0) { m.beliefs = m.beliefs.filter((x) => x !== b); m.retracted.push({ ...b, retractedAt: t }); notes.push(`${m.out.label} : croyance #${b.id} RÉTRACTÉE`); }
          refit(m);
        }
        syncCoefs(m);
        if (o.background && t >= WARMUP + 14) {
          const H = searchExplanations(m.space, m.model, t + 1, { warmup: WARMUP, lookback: 63, families: o.families, records: data(m) });
          const r = adjudicate(m, t, H, P_BACK, 'background');
          if (r.accepted) notes.push(`DÉCOUVERTE sur ${m.out.label} : ${r.accepted.narrative}`);
        }
      }
      const cov = m.records.slice(-28).filter((r) => r.inside != null);
      if (cov.length >= 10) {
        const c = cov.filter((r) => r.inside).length / cov.length;
        if (c < 0.7) m.kappa = Math.min(2.5, m.kappa * 1.15); else if (c > 0.9) m.kappa = Math.max(0.8, m.kappa / 1.1);
      }
    }
    A.insights.push({ t, notes });
    emit('dreaming', `Nuit de rêve : ${notes.length ? notes.join(' · ') : 'audit des croyances et recherche de structure — rien de nouveau'}.`, { notes });
  }

  A.planDay = planDay; A.observeOutcome = observeOutcome;
  A.beliefs = () => Object.values(M).flatMap((m) => m.beliefs.map((b) => ({ ...b, outcome: m.out.key })));
  A.perplexity = () => ({ log: A.perplexLog, days: Object.fromEntries(Object.values(M).map((m) => [m.out.key, m.perplexDays])) });
  A.retracted = () => Object.values(M).flatMap((m) => m.retracted.map((b) => ({ ...b, outcome: m.out.key })));
  // log-moyenne prédite d'une mesure (régime permanent des effets retard) — pour mesurer la fidélité du modèle
  A.predictLog = (k, t, a, ctx) => M[k].model.predict({ t, dow: t % 7, x: { ...a, ...ctx, ...derived(A.dstate, a) }, ad: Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: a[l.key], 0.8: a[l.key] }])) }).mu;
  return A;
}
