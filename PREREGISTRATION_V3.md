# Protocole pré-enregistré n° 2 — CORTEX v3 : un même cerveau pour des entreprises inconnues

**Ordre des opérations, vérifiable dans l'historique git :**
1. Commit A : le cerveau générique (`src/core/`) est **gelé**, avec ce protocole. Les corps `usine` et `abonnement` **n'existent pas encore**.
2. Commit B : écriture des deux corps (déclaration + monde caché) **sans aucune modification de `src/core/`** (vérifiable par `git diff A B -- src/core`).
3. Exécution unique sur les graines 101 à 130, puis publication de tous les résultats.

## Ce qui est testé
« Sans reconstruire le cerveau » signifie qu'un nouveau corps n'apporte qu'une **déclaration** :
- ses leviers (nom, plage, nature continue, discrète ou capacité) ;
- ses informations du matin ;
- ses mesures et les variables qui peuvent les influencer, avec d'éventuels a priori de signe ;
- sa comptabilité (une fonction action, mesures → €).

Le cerveau n'a accès à rien d'autre. Le monde caché de chaque corps (son simulateur) sert uniquement à générer les journées, à calculer l'oracle et à noter le résultat.

## Corps évalués (graines 101 à 130)
- **Nouveaux, écrits après le gel** : `usine` et `abonnement`.
- **Connus**, comme contrôle de non-régression : `calme`, `boulangerie`, `glacier`, `marche`, `fleuriste`, `kiosque` et `restaurant`.

## Politiques
Oracle (connaît la vérité) · Habitude (règle fixe déclarée par le corps) · **v3** (cerveau générique) · **v3-fermé** (même cerveau, vocabulaire limité à niveau et sensibilité, sans détecteur générique ni recherche de fond). Sur les corps commerce uniquement : v1 gelée et v2.

## Mesures
Les mêmes que dans le protocole n° 1 : compréhension (bonne famille, **bonne variable**, **bonne mesure**, date à ±14 jours ; une période pour les pics ; règle du point milieu pour un déclin logistique), erreur RMS du modèle du monde, fausses découvertes et profit en % de l'oracle.

## Hypothèses
- **T1 (gestion d'une entreprise inconnue)** : sur `usine` et `abonnement`, le profit de v3 dépasse celui de l'habitude (IC95 de la différence appariée > 0), et v3 atteint au moins 75 % de l'oracle en moyenne.
- **T2 (compréhension transférée)** : sur `usine` et `abonnement`, la compréhension de v3 dépasse celle de v3-fermé (IC95 > 0).
- **T3 (modèle du monde)** : sur `usine` et `abonnement`, l'erreur du modèle de v3 est inférieure à celle de v3-fermé (IC95 < 0).
- **T4 (garde-fou)** : sur `usine` et `abonnement`, v3 fait au plus 1,5 fausse découverte par an en moyenne.
- **R1 (non-régression)** : sur les corps commerce, la compréhension de v3 n'est pas inférieure à celle de v2 de plus de 5 points (borne basse de l'IC95 > −5).
- **R2 (régressions demandées)** : les comptes « sensibilité au prix » et « déclin logistique » de v3, v2 et v1 sont rapportés tels quels, sans critère de succès fixé à l'avance.

Commandes :
`node bench/transfer.js --seeds 101-130 --bodies usine,abonnement,restaurant,calme,boulangerie,glacier,marche,fleuriste,kiosque --policies oracle,habit,v1-gele,v2,v3-ferme,v3 --out bench/v3-test.json`
`node bench/transfer-report.js bench/v3-test.json`
