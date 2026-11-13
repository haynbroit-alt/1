// Interface de CORTEX — pilote le moteur réel (mêmes fichiers que les tests et le banc d'essai).
(() => {
  const $ = (id) => document.getElementById(id);
  const STAGE_LABEL = Object.fromEntries(STAGES);
  const euro = (x) => `${x < 0 ? '−' : ''}${Math.abs(Math.round(x)).toLocaleString('fr-FR')} €`;
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  let S = null, playing = false, timer = null, reviewer = 'human', showTruth = false, waiting = null;

  function newYear(seed, prerun = 0) {
    S = { seed, world: createWorld(seed), agent: createAgent({ seed }), ow: createWorld(seed), hw: createWorld(seed), habit: createHabit(),
      log: [], olog: [], hlog: [], cum: [], ocum: [], hcum: [], trace: [], reviews: { ok: 0, no: 0 }, injected: [] };
    S.oracle = createOracle(S.ow);
    waiting = null; $('review').hidden = true;
    for (let i = 0; i < prerun; i++) dayAuto(true);
    renderAll();
  }

  // ----- une journée -----
  function startDay() {
    if (S.world.t >= HORIZON) { stop(); return 'end'; }
    const t = S.world.t;
    const plan = S.agent.planDay({ t, cost: S.world.cost(t) });
    if (plan.review) {
      if (reviewer === 'human') { waiting = plan; openReview(plan); return 'wait'; }
      const d = simulatedReviewer(plan.review);
      d === 'approve' ? S.reviews.ok++ : S.reviews.no++;
      return finishDay(S.agent.resolveReview(d, 'sim-reviewer'));
    }
    return finishDay(plan);
  }
  function dayAuto() { const prev = reviewer; reviewer = 'sim'; startDay(); reviewer = prev; }
  function finishDay(res) {
    const t = S.world.t;
    const obs = S.world.step(res.action);
    const ev = S.agent.observeOutcome(publicObs(obs));
    S.log.push(obs);
    const oo = S.ow.step(S.oracle.act(t)); S.olog.push(oo);
    const ho = policyDay(S.hw, S.habit); S.hlog.push(ho);
    const last = (a) => (a.length ? a[a.length - 1] : 0);
    S.cum.push(last(S.cum) + obs.profit); S.ocum.push(last(S.ocum) + oo.profit); S.hcum.push(last(S.hcum) + ho.profit);
    S.trace = res.trace.concat(ev.trace);
    return 'ok';
  }

  // ----- lecture -----
  const SPEED = { slow: 1600, normal: 220, fast: 0 };
  function tick() {
    if (!playing) return;
    const sp = $('speed').value;
    const n = sp === 'fast' ? 6 : 1;
    let r = 'ok';
    for (let i = 0; i < n && r === 'ok'; i++) r = startDay();
    renderAll(sp === 'slow');
    if (r === 'wait') { setPlaying(false); return; }
    if (r === 'end') return;
    timer = setTimeout(tick, SPEED[sp] || 16);
  }
  function setPlaying(v) { playing = v; $('play').textContent = v ? '⏸ Pause' : '▶ Lancer'; if (v) tick(); else clearTimeout(timer); }
  const stop = () => setPlaying(false);

  // ----- revue humaine -----
  function openReview(plan) {
    const R = plan.review;
    $('rv-eyebrow').textContent = `Revue humaine · jour ${R.t}`;
    $('rv-reasons').innerHTML = R.reasons.map((x) => `<li>${esc(x)}</li>`).join('');
    const row = (a, s) => `<tr><td>Prix</td><td>${a.price.toFixed(2)} €</td></tr><tr><td>Marketing</td><td>${a.marketing} €/j</td></tr><tr><td>Commande</td><td>${a.order} u.</td></tr><tr><td>Profit moyen simulé</td><td>${euro(s.mean)}</td></tr><tr><td>Pire 5 %</td><td>${euro(s.p5)}</td></tr><tr><td>P(perte)</td><td>${Math.round(s.pLoss * 100)} %</td></tr>`;
    $('rv-prop').innerHTML = row(R.proposal, R.sim);
    $('rv-fall').innerHTML = row(R.fallback, R.simFallback);
    const cost = R.simFallback.mean - R.sim.mean;
    $('rv-voi').textContent = cost > 0
      ? `En espérance, la proposition coûte ${euro(cost)} de plus que le statu quo aujourd'hui. L'agent estime la valeur de ce qu'il apprendrait à ${euro(R.voi)}. Le relecteur simulé approuverait ${simulatedReviewer(R) === 'approve' ? 'oui' : 'non'}.`
      : `En espérance, la proposition rapporte ${euro(-cost)} de plus que le statu quo. Le relecteur simulé approuverait ${simulatedReviewer(R) === 'approve' ? 'oui' : 'non'}.`;
    $('review').hidden = false;
    drawHist(R.sim.hist);
    renderAll();
    $('rv-approve').focus();
  }
  function decide(d) {
    if (!waiting) return;
    d === 'approve' ? S.reviews.ok++ : S.reviews.no++;
    waiting = null; $('review').hidden = true;
    finishDay(S.agent.resolveReview(d, 'human'));
    renderAll(true);
  }

  // ----- événements provoqués -----
  function inject(kind) {
    const t = S.world.t;
    const e = {
      rival: { type: 'level', start: t, end: null, mag: Math.log(0.7), label: 'Un 2ᵉ concurrent ouvre (provoqué par vous)' },
      viral: { type: 'level', start: t, end: t + 21, mag: Math.log(1.6), label: 'Passage à la télé, 3 semaines (provoqué par vous)' },
      elas: { type: 'elasticity', start: t, mag: -0.8, label: 'Crise du pouvoir d’achat : clients plus sensibles au prix (provoqué par vous)' },
      cost: { type: 'cost', start: t, value: +(S.world.cost(t) * 1.4).toFixed(2), label: 'Hausse du beurre, coût +40 % (provoqué par vous)' },
    }[kind];
    for (const w of [S.world, S.ow, S.hw]) w.inject(e);
    S.injected.push(e);
    renderAll();
  }

  // ----- rendu -----
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function renderAll(animate) {
    const A = S.agent, t = S.world.t;
    $('k-day').textContent = t;
    $('k-dow').textContent = `${t > 0 ? DOW_NAMES[(t - 1) % 7] + ' · ' : ''}sur ${HORIZON}`;
    const c = S.cum.at(-1) ?? 0, oc = S.ocum.at(-1) ?? 0, hc = S.hcum.at(-1) ?? 0;
    $('k-profit').textContent = euro(c);
    $('k-pct').textContent = oc > 0 ? `${Math.round((c / oc) * 100)} % de l'oracle · ${c >= hc ? '+' : '−'}${euro(Math.abs(c - hc))} vs habitude` : '—';
    $('k-ref').textContent = euro(oc); $('k-ref-s').textContent = `habitude : ${euro(hc)} · mêmes aléas`;
    $('k-bel').textContent = A.beliefs.length;
    $('k-bel-s').textContent = `${A.retracted.length} rétractée(s) · ${A.hypothesisLog.length} enquête(s)`;
    $('k-rev').textContent = S.reviews.ok + S.reviews.no;
    $('k-rev-s').textContent = `${S.reviews.ok} validée(s) / ${S.reviews.no} refusée(s)`;
    const mes = [...S.trace].reverse().find((e) => e.stage === 'mesurer');
    $('k-cal').textContent = mes?.data.coverage != null ? `${Math.round(mes.data.coverage * 100)} %` : '—';
    $('k-cal-s').textContent = `cible 80 % · humilité κ = ${A.kappa.toFixed(2)}`;
    renderRing(animate);
    renderJournal();
    renderBeliefs();
    renderHyps();
    renderLearning();
    renderTruth();
    drawDemand(); drawPrice(); drawProfit();
  }

  // anneau de la boucle
  const ringPos = STAGES.map((_, i) => { const a = -Math.PI / 2 + (i / STAGES.length) * 2 * Math.PI; return [170 + 118 * Math.cos(a), 170 + 118 * Math.sin(a), a]; });
  function buildRing() {
    const svg = $('ring');
    let h = '';
    for (let i = 0; i < STAGES.length; i++) {
      const [x1, y1] = ringPos[i], [x2, y2] = ringPos[(i + 1) % STAGES.length];
      h += `<path class="edge" id="e-${i}" d="M${x1.toFixed(1)},${y1.toFixed(1)} A118,118 0 0 1 ${x2.toFixed(1)},${y2.toFixed(1)}"/>`;
    }
    STAGES.forEach(([k, label], i) => {
      const [x, y, a] = ringPos[i];
      const lx = 170 + 146 * Math.cos(a), ly = 170 + 146 * Math.sin(a);
      const anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
      h += `<g class="n" id="n-${k}"><circle class="n-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8"/><text class="cnt" x="${x.toFixed(1)}" y="${(y + 3).toFixed(1)}" text-anchor="middle" id="c-${k}"></text>`
        + `<text class="lbl" x="${lx.toFixed(1)}" y="${(ly + 4).toFixed(1)}" text-anchor="${anchor}">${label}</text></g>`;
    });
    h += `<text class="center-t" x="170" y="164" text-anchor="middle" id="ring-c1">CORTEX</text><text class="center-s" x="170" y="182" text-anchor="middle" id="ring-c2"></text>`;
    svg.innerHTML = h;
  }
  let ringAnim = null;
  function renderRing(animate) {
    const todays = [...new Set(S.trace.map((e) => e.stage))];
    STAGES.forEach(([k], i) => {
      const g = $(`n-${k}`); g.classList.toggle('today', todays.includes(k)); g.classList.remove('active');
      $(`e-${i}`).classList.toggle('lit', todays.includes(k) && todays.includes(STAGES[(i + 1) % STAGES.length][0]));
    });
    $('ring-sub').textContent = `jour ${S.world.t} · ${S.trace.length} étapes aujourd'hui`;
    $('ring-c2').textContent = waiting ? 'attend votre décision' : `${Object.values(S.agent.stageCount).reduce((a, b) => a + b, 0)} étapes au total`;
    clearInterval(ringAnim);
    const show = (e) => {
      if (!e) return;
      document.querySelectorAll('#ring .n.active').forEach((n) => n.classList.remove('active'));
      $(`n-${e.stage}`).classList.add('active');
      $('stage-now').innerHTML = `<b>${STAGE_LABEL[e.stage]}</b> — ${esc(e.text)}`;
    };
    const tr = waiting ? waiting.trace : S.trace;
    if (animate && tr.length && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      let i = 0; show(tr[0]);
      ringAnim = setInterval(() => { i++; if (i >= tr.length) { clearInterval(ringAnim); return; } show(tr[i]); }, Math.max(60, 1400 / tr.length));
    } else show(tr.find((e) => e.stage === 'hypotheses') || tr.find((e) => e.stage === 'revue') || tr.find((e) => e.stage === 'dreaming') || tr.find((e) => e.stage === 'decider'));
  }

  function renderJournal() {
    const tr = waiting ? waiting.trace : S.trace;
    $('j-sub').textContent = tr.length ? `jour ${tr[0].t}` : '';
    $('journal').innerHTML = tr.length ? tr.map((e) => {
      const hot = ['hypotheses', 'revue', 'dreaming'].includes(e.stage) || (e.stage === 'confronter' && e.data.verdict === 'contradiction');
      const contra = e.stage === 'confronter' && e.data.verdict === 'contradiction';
      return `<div class="jline${hot ? ' hot' : ''}${contra ? ' contra' : ''}"><div class="st">${STAGE_LABEL[e.stage]}</div><div>${esc(e.text)}</div></div>`;
    }).join('') : '<p class="empty">Lancez la simulation : chaque jour, le raisonnement complet de l’agent s’affiche ici.</p>';
  }

  function renderBeliefs() {
    const A = S.agent;
    const items = A.beliefs.map((b) => `<div class="belief${b.provisional ? ' prov' : ''}">${esc(b.narrative)}${b.provisional ? '<span class="pill warn">provisoire</span>' : ''}<span class="meta">admise au jour ${b.acceptedAt} · log BF ${b.logBF?.toFixed(1) ?? '—'}</span></div>`)
      .concat(A.retracted.map((b) => `<div class="belief gone">${esc(b.narrative || b.type)}<span class="meta">rétractée au jour ${b.retractedAt} : les données ne la soutenaient plus</span></div>`));
    $('beliefs').innerHTML = items.length ? items.join('') : `<p class="empty">Aucune rupture admise. Le monde paraît conforme au modèle de base : prix, jour de la semaine, marketing.</p>`;
  }
  const TYPE_LABEL = { level: 'rupture de niveau', elasticity: 'changement d’élasticité', marketing: 'effet marketing modifié', end: 'fin d’un effet temporaire' };
  function renderHyps() {
    const h = S.agent.hypothesisLog.at(-1);
    if (!h) { $('hyps').innerHTML = '<p class="empty">Aucune contradiction pour l’instant. Les hypothèses ne sont générées que lorsque les faits contredisent la théorie.</p>'; $('hyp-sub').textContent = ''; return; }
    $('hyp-sub').textContent = `jour ${h.t} · P(changement) ${Math.round(h.pChange * 100)} %`;
    const rows = [{ label: 'rien n’a changé (bruit)', p: 1 - h.pChange }].concat(h.top.slice(0, 4).map((c) => ({ label: `${TYPE_LABEL[c.type]} au jour ${c.tau}`, p: c.post })));
    $('hyps').innerHTML = rows.map((r) => `<div class="hbar"><div>${esc(r.label)}<div class="track"><div class="fill" style="width:${(r.p * 100).toFixed(1)}%"></div></div></div><div class="num">${(r.p * 100).toFixed(1)} %</div></div>`).join('')
      + `<p class="note">${h.accepted ? `Retenue : ${TYPE_LABEL[h.accepted.type]} au jour ${h.accepted.tau}.` : 'Aucune hypothèse retenue : preuves insuffisantes.'} Probabilités a posteriori exactes (vraisemblance marginale) sur ${Object.keys(h.byType).length} familles d’explications.</p>`;
  }
  function renderLearning() {
    const A = S.agent, sk = A.skills.order;
    $('skills').textContent = `${sk.name} v${sk.version} — décalage appris ${sk.delta >= 0 ? '+' : ''}${sk.delta.toFixed(2)} σ. ${sk.notes.at(-1)?.text ?? 'Pas encore ajustée.'}`;
    const rl = A.rules.list.slice(-4);
    $('rules').innerHTML = rl.length ? rl.map((r) => `<li><span class="mono">j${r.t}</span> ${esc(r.text)}</li>`).join('') : `<li>Aucune règle pour l’instant. Règles actives : pas de prix ±${Math.round(A.rules.maxStep * 100)} %/jour, tolérance de perte ${Math.round(A.rules.pLossMax * 100)} %.</li>`;
    const d = A.insights.at(-1);
    $('dream').innerHTML = d ? d.notes.map((n) => `<li>${esc(n)}</li>`).join('') : '<li>Le premier rêve aura lieu dimanche soir, après la phase d’apprentissage (28 jours).</li>';
  }
  function renderTruth() {
    $('truth-panel').hidden = !showTruth; $('lg-truth').hidden = !showTruth;
    $('truth-btn').setAttribute('aria-pressed', String(showTruth));
    $('truth-btn').textContent = showTruth ? 'Cacher la vérité' : 'Révéler la vérité cachée';
    if (!showTruth) return;
    const sc = S.world.scenario;
    $('truth').innerHTML = `<li>Élasticité de base ${sc.beta.toFixed(2)}, effet marketing ${sc.gamma.toFixed(2)}, bruit ${sc.noise}</li>`
      + sc.events.map((e) => `<li><span class="mono">j${e.start}${e.end ? '–' + e.end : ''}</span> ${esc(e.label)}${e.start > S.world.t ? ' <span class="pill">à venir</span>' : ''}</li>`).join('');
  }

  // ----- graphiques (canvas, couleurs issues des tokens) -----
  function setup(cv) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = +cv.getAttribute('height');
    cv.style.height = h + 'px';
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
    return { g, w, h };
  }
  function axes(g, w, h, pad, ymin, ymax, fmt, ticks = 4) {
    g.font = `11px ${css('--f-mono')}`; g.fillStyle = css('--muted'); g.strokeStyle = css('--line'); g.lineWidth = 1;
    for (let i = 0; i <= ticks; i++) {
      const v = ymin + (i / ticks) * (ymax - ymin), y = pad.t + (1 - i / ticks) * (h - pad.t - pad.b);
      g.beginPath(); g.moveTo(pad.l, y + 0.5); g.lineTo(w - pad.r, y + 0.5); g.stroke();
      g.textAlign = 'right'; g.fillText(fmt(v), pad.l - 6, y + 4);
    }
    g.textAlign = 'center';
    for (let d = 0; d <= HORIZON; d += 60) { const x = pad.l + (d / HORIZON) * (w - pad.l - pad.r); g.fillText(`j${d}`, x, h - 6); }
  }
  const X = (pad, w) => (d) => pad.l + (d / HORIZON) * (w - pad.l - pad.r);
  const Y = (pad, h, a, b) => (v) => pad.t + (1 - (v - a) / (b - a)) * (h - pad.t - pad.b);
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(Math.max(1, v)))); return Math.ceil(v / p) * p; }

  function drawDemand() {
    const { g, w, h } = setup($('c-demand'));
    const recs = S.agent.records;
    const pad = { l: 44, r: 10, t: 12, b: 22 };
    const ymax = niceMax(Math.max(150, ...recs.map((r) => Math.max(r.sales, r.pred ? Math.exp(r.pred.mu) * 1.3 : 0))) * 1.08);

    const x = X(pad, w), y = Y(pad, h, 0, ymax);
    axes(g, w, h, pad, 0, ymax, (v) => Math.round(v));
    // bande de prévision (rognée à la zone du graphique)
    g.save(); g.beginPath(); g.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b); g.clip();
    g.fillStyle = css('--band'); g.beginPath();
    const pr = recs.filter((r) => r.pred);
    pr.forEach((r, i) => { const v = Math.exp(r.pred.mu + 1.2816 * r.pred.s); i ? g.lineTo(x(r.t), y(v)) : g.moveTo(x(r.t), y(v)); });
    [...pr].reverse().forEach((r) => g.lineTo(x(r.t), y(Math.exp(r.pred.mu - 1.2816 * r.pred.s))));
    g.closePath(); g.fill();
    g.strokeStyle = css('--model'); g.lineWidth = 1.4; g.beginPath(); pr.forEach((r, i) => (i ? g.lineTo(x(r.t), y(Math.exp(r.pred.mu))) : g.moveTo(x(r.t), y(Math.exp(r.pred.mu))))); g.stroke();
    g.restore();
    // vérité
    if (showTruth) {
      g.strokeStyle = css('--oracle'); g.setLineDash([4, 4]); g.lineWidth = 1.5;
      for (const e of S.world.scenario.events) { if (e.type === 'cost') continue; for (const d of [e.start, e.end].filter((v) => v != null)) { g.beginPath(); g.moveTo(x(d), pad.t); g.lineTo(x(d), h - pad.b); g.stroke(); } }
      g.setLineDash([]);
    }
    // croyances
    g.strokeStyle = css('--accent'); g.fillStyle = css('--accent'); g.lineWidth = 2; g.font = `600 11px ${css('--f-body')}`; g.textAlign = 'left';
    S.agent.beliefs.forEach((b) => {
      for (const d of [b.tau, b.end].filter((v) => v != null)) { g.beginPath(); g.moveTo(x(d), pad.t); g.lineTo(x(d), h - pad.b); g.stroke(); }
      const lab = b.type === 'level' ? `${Math.exp(b.coef) - 1 >= 0 ? '+' : ''}${Math.round((Math.exp(b.coef) - 1) * 100)} %` : b.type === 'elasticity' ? 'élasticité' : 'marketing';
      g.fillText(lab, Math.min(x(b.tau) + 4, w - 70), pad.t + 10);
    });
    // ventes
    for (const r of recs) {
      if (r.censored) { g.fillStyle = css('--bad'); g.beginPath(); g.moveTo(x(r.t), y(r.sales) - 4); g.lineTo(x(r.t) - 3, y(r.sales) + 2); g.lineTo(x(r.t) + 3, y(r.sales) + 2); g.closePath(); g.fill(); }
      else { g.fillStyle = css('--ink'); g.beginPath(); g.arc(x(r.t), y(r.sales), 1.8, 0, 7); g.fill(); }
    }
    // aujourd'hui
    g.strokeStyle = css('--muted'); g.lineWidth = 1; g.beginPath(); g.moveTo(x(S.world.t), pad.t); g.lineTo(x(S.world.t), h - pad.b); g.stroke();
  }
  function drawPrice() {
    const { g, w, h } = setup($('c-price'));
    const pad = { l: 44, r: 10, t: 10, b: 22 };
    const x = X(pad, w), y = Y(pad, h, 1, 7);
    axes(g, w, h, pad, 1, 7, (v) => v.toFixed(0) + ' €', 6);
    const ym = Y(pad, h, 0, 300);
    g.fillStyle = css('--soft');
    const bw = Math.max(1, (w - pad.l - pad.r) / HORIZON);
    S.log.forEach((o) => { if (o.marketing) g.fillRect(x(o.t), ym(o.marketing), bw, h - pad.b - ym(o.marketing)); });
    const line = (arr, col, wd) => { g.strokeStyle = col; g.lineWidth = wd; g.beginPath(); arr.forEach((o, i) => (i ? g.lineTo(x(o.t), y(o.price)) : g.moveTo(x(o.t), y(o.price)))); g.stroke(); };
    line(S.olog, css('--oracle'), 1.4); line(S.log, css('--accent'), 1.6);
  }
  function drawProfit() {
    const { g, w, h } = setup($('c-profit'));
    const pad = { l: 56, r: 10, t: 10, b: 22 };
    const all = [...S.cum, ...S.ocum, ...S.hcum];
    const ymin = Math.min(0, ...all), ymax = niceMax(Math.max(1000, ...all));
    const x = X(pad, w), y = Y(pad, h, ymin, ymax);
    axes(g, w, h, pad, ymin, ymax, (v) => `${Math.round(v / 1000)} k€`);
    const line = (arr, col) => { g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); arr.forEach((v, i) => (i ? g.lineTo(x(i + 1), y(v)) : g.moveTo(x(1), y(v)))); g.stroke(); };
    line(S.hcum, css('--habit')); line(S.ocum, css('--oracle')); line(S.cum, css('--accent'));
    if (S.cum.length) { g.fillStyle = css('--accent'); g.beginPath(); g.arc(x(S.cum.length), y(S.cum.at(-1)), 3.5, 0, 7); g.fill(); }
  }
  function drawHist(hs) {
    const cv = $('rv-hist'); const { g, w, h } = setup(cv);
    const pad = { l: 8, r: 8, t: 6, b: 20 };
    const mx = Math.max(...hs.counts), n = hs.counts.length, bw = (w - pad.l - pad.r) / n;
    hs.counts.forEach((c, i) => {
      const v0 = hs.min + (i / n) * (hs.max - hs.min);
      g.fillStyle = v0 < 0 ? css('--bad') : css('--model');
      const bh = (c / mx) * (h - pad.t - pad.b);
      g.fillRect(pad.l + i * bw + 1, h - pad.b - bh, bw - 2, bh);
    });
    g.fillStyle = css('--muted'); g.font = `11px ${css('--f-mono')}`;
    g.textAlign = 'left'; g.fillText(euro(hs.min), pad.l, h - 5); g.textAlign = 'right'; g.fillText(euro(hs.max), w - pad.r, h - 5);
    if (hs.min < 0 && hs.max > 0) { const zx = pad.l + ((0 - hs.min) / (hs.max - hs.min)) * (w - pad.l - pad.r); g.textAlign = 'center'; g.fillText('0 €', zx, h - 5); }
  }

  // ----- câblage -----
  $('play').onclick = () => setPlaying(!playing);
  $('step1').onclick = () => { stop(); if (!waiting) startDay(); renderAll(true); };
  $('step7').onclick = () => { stop(); for (let i = 0; i < 7 && !waiting; i++) if (startDay() !== 'ok') break; renderAll(); };
  $('reset').onclick = () => { stop(); newYear(Math.max(1, Math.min(9999, +$('seed').value || 1)), 0); };
  $('rv-approve').onclick = () => decide('approve');
  $('rv-reject').onclick = () => decide('reject');
  $('inject-go').onclick = () => inject($('inject').value);
  $('truth-btn').onclick = () => { showTruth = !showTruth; renderAll(); };
  const setRev = (v) => { reviewer = v; $('rev-human').setAttribute('aria-pressed', String(v === 'human')); $('rev-sim').setAttribute('aria-pressed', String(v === 'sim')); };
  $('rev-human').onclick = () => setRev('human');
  $('rev-sim').onclick = () => { setRev('sim'); if (waiting) { const d = simulatedReviewer(waiting.review); decide(d); } };
  document.addEventListener('keydown', (e) => { if (!waiting) return; if (e.key === 'Escape') decide('reject'); });
  const redraw = () => S && (drawDemand(), drawPrice(), drawProfit());
  window.addEventListener('resize', redraw);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  buildRing();
  // État de départ réaliste : 98 jours déjà vécus (relecteur simulé), juste avant l'arrivée du concurrent.
  newYear(1, 98);
})();
