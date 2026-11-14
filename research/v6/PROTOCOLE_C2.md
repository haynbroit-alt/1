# Protocole C2 — le juge de CORTEX (sonde et pari) exporté pour des données extérieures

**Statut** : protocole écrit **avant** le code du module. `p2.js` (gelé `1121b10`) et `engine.js` ne sont pas
modifiés : le nouveau module `juge.js` recopie à l'identique les deux primitives internes de `p2.js`
(`invariantLogE`, `probeFamilies`, provenance commentée) et bâtit dessus une interface pour des données `{Y, U}`
et une formule quelconques. Développement sur les graines 1 à 60 de P2 ; les mondes placebo extérieurs
(graines 9001 à 9200) ne sont exécutés qu'une fois, après le gel du module.

## La question

Dans l'espace commun (`haynbroit-alt/Tr`), CORTEX n'a pas pu juger les lois quantité–prix de GALILÉE sur les
débits reconstruits par LAVOISIER : sa sonde et son pari n'existaient que dans `runWorld`, lié à ses propres
mondes. C2 les exporte, avec un contrôle de recevabilité des séries (leçon de la confrontation T1 : des factures
mensuelles avaient été prises pour des mesures quotidiennes).

## Interface

- `recevable({Y, U})` : longueur ≥ 120 jours, au moins un levier, aucune mesure constante, au moins un tiers de
  jours informatifs par mesure (valeur différente de la médiane de la colonne). Refus motivé.
- `analyser({Y, U}, options)` : modes de P1 sur la première partie (A), sonde de P2 sur A ∪ B ; par mesure :
  log E, famille, diagnostic (« compris », « mal estimé », « hors de portée »). Bornes A et B proportionnelles à
  celles de P2 (150/365 et 272/365).
- `jugerFormule(analyse, mesure, formule)` : pari invariant de la formule sur les jours C, jamais vus par elle ;
  log E, seuil log(1/α), erreurs de prévision avec et sans la formule.
- Avec un seul levier, un levier nul est ajouté (le moteur gelé en attend au moins deux et neutralise lui-même les leviers constants). Option `standardiserLeviers` (défaut : non) pour des leviers qui ne sont pas d'ordre 1 ; jamais utilisée dans
  l'épreuve d'identité.

## Hypothèses et critères (fixés d'avance)

| | Critère | Seuil |
|---|---|---|
| **E1** identité | sur les graines 1 à 60 de P2 (mêmes mondes, mêmes données), `analyser` rend exactement les diagnostics et familles de `runWorld`, et les mêmes log E à 10⁻⁶ près ; `jugerFormule` rend les mêmes verdicts que le juge interne pour la formule oracle | 60/60 |
| **E2** placebo extérieurs | 200 mondes SANS structure cachée, étrangers à P2 : comptages de Poisson journaliers (λ de 3 à 60), semaine marquée, leviers par blocs sans effet, 1 à 3 leviers ; part de mesures déclarées « structure manquante » | ≤ 10 %, borne haute de Wilson ≤ 15 % |
| **E3** recevabilité | séries dégénérées (longueur < 120, mesure constante, série à 12 jours actifs par an) | 100 % refusées, avec motif |

**Critère d'abandon** : si E1 échoue, le module n'est pas un export du juge mais un autre juge ; il est rejeté
sous cette forme et publié.
