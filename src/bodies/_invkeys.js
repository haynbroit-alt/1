// POUR LA NOTATION SEULEMENT (jamais lu par le cerveau) : réplique l'ordre d'énumération du générateur C2 gelé
// (src/core/brain.js, commit A) afin de traduire « accumulation de A − B » en clé de croyance « memory:invN ».
// Ordre : pour λ ∈ {0,9 ; 0,97} — mesures seules, puis paires i<j (mesures puis leviers non « capacité ») avec au moins une mesure.
export function invKeys(body, terms, lams = [0.9, 0.97]) {
  const src = [...body.outcomes.map((o) => ({ key: o.key, out: true })), ...body.levers.filter((l) => l.kind !== 'capacity').map((l) => ({ key: l.key, out: false }))];
  const outs = src.filter((s) => s.out);
  const keys = []; let n = 0;
  for (const lam of [0.9, 0.97]) {
    for (const a of outs) { if (terms.length === 1 && terms[0] === a.key && lams.includes(lam)) keys.push(`memory:inv${n}`); n++; }
    for (let i = 0; i < src.length; i++) for (let j = i + 1; j < src.length; j++) {
      if (!src[i].out && !src[j].out) continue;
      if (terms.length === 2 && lams.includes(lam) && new Set(terms).has(src[i].key) && new Set(terms).has(src[j].key)) keys.push(`memory:inv${n}`);
      n++;
    }
  }
  return keys;
}
