// Registre des affaires réelles. Deux règles, imposées par le code et non par la bonne volonté :
//   1. une recette ne compte que si elle porte une preuve externe vérifiable (paiement reçu) ;
//   2. aucune dépense, aucun engagement, aucun contact sortant sans mandat écrit du propriétaire, dans ses plafonds.
// Rien ici ne dépense ni ne contacte : le registre autorise, refuse et compte. Les montants sont en euros.

export const PREUVES_RECETTE = ['virement-recu', 'paiement-plateforme', 'facture-payee', 'prime-versee'];
export const PREUVES_DEPENSE = ['facture', 'recu', 'releve'];
const jour = (d) => { if (!/^\d{4}-\d{2}-\d{2}$/.test(d ?? '')) throw new Error(`date invalide : ${d}`); return d; };
const montant = (x) => { if (!(typeof x === 'number' && Number.isFinite(x) && x > 0)) throw new Error(`montant invalide : ${x}`); return Math.round(x * 100) / 100; };

// mandat : { id, accordePar, date, expire, plafondEUR, parTestMaxEUR, canaux: [...], contactsMax } — écrit par le propriétaire, jamais par l'agent
export function creerRegistre(etat = {}) {
  const R = { mandats: etat.mandats ?? [], affaires: etat.affaires ?? [], ecritures: etat.ecritures ?? [], contacts: etat.contacts ?? [] };
  const mandatActif = (date) => R.mandats.filter((m) => !m.revoque && m.date <= date && date <= m.expire).at(-1) ?? null;
  const depense = (filtre = () => true) => R.ecritures.filter((e) => e.type === 'depense' && filtre(e)).reduce((s, e) => s + e.montant, 0);
  const recette = (filtre = () => true) => R.ecritures.filter((e) => e.type === 'recette' && filtre(e)).reduce((s, e) => s + e.montant, 0);
  const affaire = (id) => { const a = R.affaires.find((x) => x.id === id); if (!a) throw new Error(`affaire inconnue : ${id}`); return a; };

  return {
    etat: () => JSON.parse(JSON.stringify(R)),

    enregistrerMandat(m) {
      for (const k of ['id', 'accordePar', 'date', 'expire']) if (!m[k]) throw new Error(`mandat incomplet : ${k}`);
      jour(m.date); jour(m.expire);
      if (!(m.plafondEUR >= 0) || !(m.parTestMaxEUR >= 0)) throw new Error('mandat sans plafonds');
      if (m.parTestMaxEUR > m.plafondEUR) throw new Error('le plafond par test dépasse le plafond total');
      R.mandats.push({ canaux: [], contactsMax: 0, ...m });
      return m.id;
    },
    revoquerMandat(id) { const m = R.mandats.find((x) => x.id === id); if (m) m.revoque = true; },

    // Une affaire est une hypothèse : métrique de succès (un paiement réel) et critère d'arrêt fixés AVANT le premier euro.
    ouvrirAffaire(a) {
      for (const k of ['id', 'hypothese', 'metrique', 'critereArret', 'echeance']) if (!a[k]) throw new Error(`affaire incomplète : ${k}`);
      jour(a.echeance);
      if (!(a.budgetEUR >= 0)) throw new Error('affaire sans budget');
      if (R.affaires.some((x) => x.id === a.id)) throw new Error(`affaire déjà ouverte : ${a.id}`);
      R.affaires.push({ ...a, statut: 'en test' });
      return a.id;
    },

    // Peut-on dépenser ? Répond sans rien faire. Refus par défaut.
    autoriserDepense({ date, affaire: id, montant: x, recurrente = false }) {
      jour(date); x = montant(x);
      const m = mandatActif(date);
      if (!m) return { ok: false, raison: 'aucun mandat actif : demander l’autorisation du propriétaire' };
      const a = affaire(id);
      if (a.statut !== 'en test' && a.statut !== 'en croissance') return { ok: false, raison: `affaire ${a.statut}` };
      if (recurrente) return { ok: false, raison: 'engagement récurrent : jamais sans accord spécifique' };
      if (x > m.parTestMaxEUR) return { ok: false, raison: `dépasse le plafond par test (${m.parTestMaxEUR} €)` };
      if (depense((e) => e.mandat === m.id) + x > m.plafondEUR) return { ok: false, raison: `dépasse le plafond du mandat (${m.plafondEUR} €)` };
      if (depense((e) => e.affaire === id) + x > a.budgetEUR) return { ok: false, raison: `dépasse le budget de l’affaire (${a.budgetEUR} €)` };
      return { ok: true, mandat: m.id };
    },
    // Peut-on contacter quelqu'un au nom du propriétaire ? Canal et volume bornés par le mandat.
    autoriserContact({ date, canal }) {
      jour(date);
      const m = mandatActif(date);
      if (!m) return { ok: false, raison: 'aucun mandat actif : aucun contact sortant' };
      if (!m.canaux.includes(canal)) return { ok: false, raison: `canal non autorisé : ${canal}` };
      if (R.contacts.filter((c) => c.mandat === m.id).length >= m.contactsMax) return { ok: false, raison: `plafond de contacts atteint (${m.contactsMax})` };
      return { ok: true, mandat: m.id };
    },
    noterContact({ date, canal, affaire: id, destinataire, objet }) {
      const v = this.autoriserContact({ date, canal });
      if (!v.ok) throw new Error(`contact refusé : ${v.raison}`);
      affaire(id);
      R.contacts.push({ date, canal, affaire: id, destinataire, objet, mandat: v.mandat });
    },

    inscrire(e) {
      jour(e.date); const x = montant(e.montant); const a = affaire(e.affaire);
      if (e.type === 'recette') {
        if (!e.preuve || !PREUVES_RECETTE.includes(e.preuve.type) || !e.preuve.ref) throw new Error('recette sans preuve vérifiable : elle ne compte pas');
        R.ecritures.push({ ...e, montant: x });
      } else if (e.type === 'depense') {
        const v = this.autoriserDepense({ date: e.date, affaire: e.affaire, montant: x, recurrente: e.recurrente });
        if (!v.ok) throw new Error(`dépense refusée : ${v.raison}`);
        if (!e.preuve || !PREUVES_DEPENSE.includes(e.preuve.type) || !e.preuve.ref) throw new Error('dépense sans pièce');
        R.ecritures.push({ ...e, montant: x, mandat: v.mandat });
      } else throw new Error(`type inconnu : ${e.type}`);
      return a.id;
    },

    // Revue : applique les critères d'arrêt mécaniques (échéance passée sans recette prouvée, budget épuisé sans recette).
    revue(date) {
      jour(date);
      const out = [];
      for (const a of R.affaires) {
        if (a.statut !== 'en test') continue;
        const rec = recette((e) => e.affaire === a.id), dep = depense((e) => e.affaire === a.id);
        if (rec > 0 && rec > dep) a.statut = 'en croissance';
        else if (date > a.echeance && rec === 0) a.statut = 'arrêtée';
        else if (a.budgetEUR > 0 && dep >= a.budgetEUR && rec === 0) a.statut = 'arrêtée';
        out.push({ id: a.id, statut: a.statut, recettes: rec, depenses: dep });
      }
      return out;
    },

    bilan() {
      const parAffaire = R.affaires.map((a) => { const rec = recette((e) => e.affaire === a.id), dep = depense((e) => e.affaire === a.id); return { id: a.id, statut: a.statut, recettesProuvees: rec, depenses: dep, net: Math.round((rec - dep) * 100) / 100 }; });
      const rec = recette(), dep = depense();
      return { recettesProuvees: rec, depenses: dep, net: Math.round((rec - dep) * 100) / 100, contacts: R.contacts.length, parAffaire };
    },
  };
}
