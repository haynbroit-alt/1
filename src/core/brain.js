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
  const o = { seed: 1, discovery: true, background: true, omnibus: true, vigilance: true, window: null, ...opts };
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
  const M = {};
  for (const out of body.outcomes) {
    const space = makeSpace(out, out.inputs.map((k) => describe(k, out)));
    M[out.key] = { out, space, records: [], beliefs: [], retracted: [], hypLog: [], model: null, kappa: 1, cusum: { pos: 0, neg: 0 }, ec: {}, vc: 0, lastZ: null, probe: null, nextId: 1 };
  }
  const A = {
    body, opts: o, M, stageCount: Object.fromEntries(STAGES.map(([k]) => [k, 0])), today: null, history: [], insights: [],
    ad: Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: l.init, 0.8: l.init }])), cum: 0, experimentUntil: -1, maxStep: 0.15, expLever: null, expCooldown: {},
  };
  const trace = [];
  const emit = (stage, text, data = {}) => { A.stageCount[stage]++; trace.push({ t: A.today?.t ?? null, stage, text, data }); };

  const data = (m) => (o.window ? m.records.slice(-o.window) : m.records);
  const impute = (m, r) => { const p = m.model.predict(r); const a = (r.y - p.mu) / p.scale; r.yImp = Math.max(r.y, p.mu + p.scale * truncMean(a)); };
  const refit = (m) => { if (m.model) for (const r of data(m)) if (r.censored) impute(m, r); m.model = fit(m.space, data(m), m.beliefs); };
  Object.values(M).forEach(refit);
  const adFor = (a) => Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: 0.5 * a[l.key] + 0.5 * A.ad[l.key][0.5], 0.8: 0.2 * a[l.key] + 0.8 * A.ad[l.key][0.8] }]));
  const rec = (t, a, ctx) => ({ t, dow: t % 7, x: { ...a, ...ctx }, ad: adFor(a) });
  const preds = (t, ctx) => Object.fromEntries(Object.values(M).map((m) => [m.out.key, (a) => { const p = m.model.predict(rec(t, a, ctx)); return { mu: p.mu, s: p.scale * m.kappa }; }]));
  const samplePreds = (t, ctx) => Object.fromEntries(Object.values(M).map((m) => { const s = m.model.sample(rng); return [m.out.key, (a) => { const r = rec(t, a, ctx); return { mu: m.model.muWith(s.theta, r), s: s.sigma * Math.sqrt(varianceWeight(t, m.beliefs)) }; }]; }));
  const syncCoefs = (m) => m.beliefs.forEach((b, i) => { const c = m.model.cols[i]; b.coef = c >= 0 ? m.model.mn.slice(c, c + termWidth(b)) : [b.basis.ratio]; b.key = famKey(b); b.narrative = narrate(m.space, b, b.coef); });

  // ---------- hypothèses (par mesure) ----------
  function adjudicate(m, t, H, threshold, origin) {
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
      if (!(lvlA || prA || surA)) continue;
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
    emit('decider', `Décision : ${levers.map((l) => `${l.label} ${num(proposal.action[l.key])}`).join(', ')} ; valeur espérée ${num(proposal.value)} €.${note}`, { action: proposal.action, mode });

    // SIMULER : bac à sable sur la postérieure + règle de risque
    const fallback = withCapacity(body, cur, P, ctx);
    const sim = (a) => { const v = []; for (let i = 0; i < 40; i++) v.push(expectedReward(body, a, samplePreds(t, ctx), ctx)); v.sort((x, y) => x - y); return { mean: v.reduce((s, x) => s + x, 0) / v.length, p10: v[4], pLoss: v.filter((x) => x < 0).length / v.length }; };
    const sp = sim(proposal.action), sf = sim(fallback.action);
    const reasons = [];
    if (sp.pLoss > Math.max(0.3, sf.pLoss + 0.1)) reasons.push(`P(perte) ${Math.round(sp.pLoss * 100)} %`);
    for (const l of decLevers) {
      const seen = A.history.map((h) => h.action[l.key]);
      if (!seen.length) continue;
      if (l.kind === 'discrete' && !seen.includes(proposal.action[l.key])) reasons.push(`« ${l.label} » = ${proposal.action[l.key]} jamais essayé`);
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
      const r = { t, dow: t % 7, x: { ...a, ...ctx }, ad, y, censored: !!obs.censored[m.out.key] };
      const pr = A.today.pred[m.out.key];
      if (r.censored) impute(m, r);
      const z = (y - pr.mu) / pr.s;
      r.inside = r.censored ? null : Math.abs(z) <= Z80;
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
  A.retracted = () => Object.values(M).flatMap((m) => m.retracted.map((b) => ({ ...b, outcome: m.out.key })));
  // log-moyenne prédite d'une mesure (régime permanent des effets retard) — pour mesurer la fidélité du modèle
  A.predictLog = (k, t, a, ctx) => M[k].model.predict({ t, dow: t % 7, x: { ...a, ...ctx }, ad: Object.fromEntries(decLevers.map((l) => [l.key, { 0.5: a[l.key], 0.8: a[l.key] }])) }).mu;
  return A;
}
