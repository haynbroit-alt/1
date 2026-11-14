import test from 'node:test';
import assert from 'node:assert/strict';
import { creerRegistre } from '../src/entreprendre/registre.js';

const affaire = { id: 'a1', hypothese: 'quelqu’un paie pour X', metrique: 'un paiement reçu', critereArret: 'aucun paiement à l’échéance', echeance: '2027-01-31', budgetEUR: 30 };
const mandat = { id: 'm1', accordePar: 'propriétaire', date: '2026-11-15', expire: '2027-02-15', plafondEUR: 50, parTestMaxEUR: 20, canaux: ['courriel'], contactsMax: 2 };

test('sans mandat : aucune dépense, aucun contact', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire);
  assert.equal(r.autoriserDepense({ date: '2026-12-01', affaire: 'a1', montant: 5 }).ok, false);
  assert.equal(r.autoriserContact({ date: '2026-12-01', canal: 'courriel' }).ok, false);
  assert.throws(() => r.inscrire({ type: 'depense', date: '2026-12-01', affaire: 'a1', montant: 5, preuve: { type: 'recu', ref: 'x' } }), /refusée/);
});

test('une recette sans preuve ne compte pas', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire);
  assert.throws(() => r.inscrire({ type: 'recette', date: '2026-12-01', affaire: 'a1', montant: 100 }), /sans preuve/);
  assert.throws(() => r.inscrire({ type: 'recette', date: '2026-12-01', affaire: 'a1', montant: 100, preuve: { type: 'promesse', ref: 'x' } }), /sans preuve/);
  assert.equal(r.bilan().recettesProuvees, 0);
  r.inscrire({ type: 'recette', date: '2026-12-02', affaire: 'a1', montant: 100, preuve: { type: 'virement-recu', ref: 'relevé du 2 décembre, ligne 4' } });
  assert.equal(r.bilan().net, 100);
});

test('les plafonds du mandat et de l’affaire sont imposés', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire); r.enregistrerMandat(mandat);
  const d = (montant, extra = {}) => ({ type: 'depense', date: '2026-12-01', affaire: 'a1', montant, preuve: { type: 'facture', ref: 'f' }, ...extra });
  assert.throws(() => r.inscrire(d(25)), /plafond par test/);
  assert.throws(() => r.inscrire(d(5, { recurrente: true })), /récurrent/);
  r.inscrire(d(20));
  assert.throws(() => r.inscrire(d(15)), /budget de l’affaire/);
  r.inscrire(d(10));
  assert.equal(r.bilan().depenses, 30);
  assert.equal(r.autoriserDepense({ date: '2027-03-01', affaire: 'a1', montant: 1 }).ok, false, 'mandat expiré');
});

test('contacts : canal et volume bornés', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire); r.enregistrerMandat(mandat);
  assert.equal(r.autoriserContact({ date: '2026-12-01', canal: 'téléphone' }).ok, false);
  r.noterContact({ date: '2026-12-01', canal: 'courriel', affaire: 'a1', destinataire: 'A', objet: 'offre' });
  r.noterContact({ date: '2026-12-01', canal: 'courriel', affaire: 'a1', destinataire: 'B', objet: 'offre' });
  assert.throws(() => r.noterContact({ date: '2026-12-02', canal: 'courriel', affaire: 'a1', destinataire: 'C', objet: 'offre' }), /plafond de contacts/);
});

test('revue : arrêt mécanique à l’échéance sans recette, croissance si la recette prouvée dépasse la dépense', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire); r.ouvrirAffaire({ ...affaire, id: 'a2' }); r.enregistrerMandat(mandat);
  r.inscrire({ type: 'depense', date: '2026-12-01', affaire: 'a2', montant: 10, preuve: { type: 'recu', ref: 'r' } });
  r.inscrire({ type: 'recette', date: '2026-12-10', affaire: 'a2', montant: 40, preuve: { type: 'paiement-plateforme', ref: 'p' } });
  const rev = r.revue('2027-02-01');
  assert.equal(rev.find((x) => x.id === 'a1').statut, 'arrêtée');
  assert.equal(rev.find((x) => x.id === 'a2').statut, 'en croissance');
  assert.equal(r.autoriserDepense({ date: '2027-02-02', affaire: 'a1', montant: 1 }).ok, false, 'une affaire arrêtée ne dépense plus');
});

test('l’état se sérialise et se recharge à l’identique', () => {
  const r = creerRegistre(); r.ouvrirAffaire(affaire); r.enregistrerMandat(mandat);
  const r2 = creerRegistre(r.etat());
  assert.deepEqual(r2.etat(), r.etat());
});
