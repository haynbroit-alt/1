# Consignes de travail — CORTEX (GARDIEN global, mode ÉCONOMIQUE)

Ce dépôt est protégé par le GARDIEN de l'espace commun (`../Tr`). Les fichiers de ce moteur copiés et gelés dans
`../Tr/moteurs/` ne se modifient jamais là-bas ; ici, tout changement de moteur exige un protocole écrit avant le code.

## Avant un travail coûteux (banc, campagne, boucle, exécution unique)
- `node ../Tr/bin/commun.js gardien verifier-budget 1` — code 3 = plafond atteint : s'arrêter et demander
  une autorisation (`node ../Tr/bin/commun.js gardien autoriser --tokens … --raison "…"`). Pas de relance en boucle.
- Un résultat déjà publié dans `bench/` ou consigné au journal commun ne se recalcule pas : il se relit.
- Une exécution unique (graines de test) ne se lance qu'une fois, jamais en double.

## Économie
- Lire un fichier avant de le modifier, et seulement celui-là ; retouches ciblées, pas de réécriture.
- Ne pas parcourir tout le dépôt ; les résultats se lisent dans les fichiers de `bench/` et les protocoles.
- `npm test` avant tout commit ; un banc long se lance en arrière-plan, une seule fois.

## Posture entrepreneuriale (voir `ENTREPRENDRE.md`)
- Chercher la valeur économique réelle fait partie du travail, sans attendre qu'on le demande : pour chaque capacité
  construite, se demander qui paierait, combien, et quel est le plus petit test réel.
- Une réussite est un paiement prouvé, inscrit au registre (`src/entreprendre/registre.js`). Jamais un chiffre simulé.
- Seul, l'agent prépare, analyse, rédige et propose. Dépenser, contacter quelqu'un, créer un compte, s'inscrire ou
  signer exige un mandat écrit du propriétaire (plafonds, canaux, expiration) : sans mandat, s'arrêter au dernier pas
  et le dire.
