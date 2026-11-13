# CORTEX — une boucle cognitive qui pilote une entreprise aux règles cachées

CORTEX implémente, étape par étape, la boucle
**Observer → Comprendre → Confronter → (Hypothèses) → Anticiper → Prioriser → Décider → Simuler → Exécuter | Revue humaine → Mesurer → Apprendre → Réviser → Dreaming ↺**
sous forme de moteur réel, déterministe et testé. Pas de maquette, et **aucun LLM à l'exécution** : chaque étape est un calcul explicite que l'on peut inspecter.

L'agent dirige une boulangerie simulée : produit périssable, invendus perdus chaque soir. Chaque jour, il fixe le prix, la commande et le budget marketing. Le monde change en secret au cours de l'année : un concurrent ouvre, le coût de la farine flambe, les clients deviennent plus sensibles au prix, une vidéo virale attire du monde pendant quelques semaines. L'agent ne voit que le jour, le coût, ses propres décisions et ses ventes. Quand il est en rupture de stock, il ne voit pas la demande réelle.

## Essayer

- **Dans le navigateur** : ouvrir `dist/cortex.html` (fichier autonome, sans dépendance). Vous pouvez valider ou refuser les décisions risquées, provoquer un événement, puis révéler la vérité cachée pour comparer avec ce que l'agent a déduit.
- **Terminal** : `npm run cli -- 3` (une année, graine 3), `npm test` (17 tests), `npm run bench` (20 années × 7 politiques, environ 2 min), `npm run build` (régénère la page).

Node ≥ 20, aucune dépendance npm.

## Ce que fait chaque étape (`src/agent.js`)

| Étape | Mécanisme réel |
|---|---|
| Comprendre | Modèle du monde : régression bayésienne conjuguée Normale-Inverse-Gamma sur log(demande) : prix, jour de semaine, marketing, plus les ruptures admises (`src/model.js`). |
| Confronter | Écart standardisé de la veille à la prédictive de Student. Deux CUSUM : dérive du niveau, et corrélation erreur–prix (signature d'un changement d'élasticité). Les ruptures de stock comptent comme preuve tronquée. |
| Hypothèses | En cas de contradiction : environ 130 explications candidates (niveau, élasticité, marketing, fin d'un effet temporaire, × date). Chacune est comparée par **vraisemblance marginale exacte**, ce qui donne des probabilités a posteriori. Elle est admise si P(changement) > 95 %. Si les explications restent indiscernables, la croyance est **provisoire** et une **expérience discriminante** est lancée. |
| Anticiper | Prévision 7 jours avec intervalles, opportunités chiffrées, risques. |
| Prioriser | Agenda trié par impact × urgence. La **valeur de l'information parfaite (EVPI)**, estimée par tirages a posteriori, décide entre exploration (Thompson sampling) et exploitation. |
| Décider (CEO) | Optimisation prix × marketing ; commande au quantile critique (newsvendor) ; petite variation de vigilance. |
| Simuler (Risque) | Bac à sable Monte-Carlo : 240 mondes tirés de la postérieure. Profit médian, P5, CVaR, P(perte). Risque jugé relativement au statu quo, plus extrapolation et nouveauté. |
| Exécuter / Revue humaine | Risque faible : exécution. Risque élevé : l'humain tranche, avec le coût espéré et la valeur de l'information sous les yeux. |
| Apprendre | Mémoire épisodique ; compétence « commande » auto-corrigée ; un refus humain devient une règle, et quatre semaines sans refus l'assouplissent. |
| Réviser | Mise à jour bayésienne ; ré-imputation (EM) des jours de rupture. |
| Dreaming | Chaque dimanche : audit des croyances (rétractation si le facteur de Bayes devient négatif, date affinée, requalification de la nature du changement), calibration (facteur d'humilité κ), regret contrefactuel de la semaine, anticipation. |

## Résultats mesurés (`npm run bench`, 20 mondes, mêmes nombres aléatoires pour toutes les politiques)

| Politique | Profit annuel moyen | % de l'oracle |
|---|---:|---:|
| Oracle (voit la vérité cachée) | 61 864 € | 100 % |
| **CORTEX complet** | **48 483 €** | **78,1 %** |
| CORTEX sans hypothèses ni rêve | 46 414 € | 74,5 % |
| Fenêtre glissante 60 j (oubli au lieu de comprendre) | 46 955 € | 75,2 % |
| CORTEX sans vigilance | 48 033 € | 77,4 % |
| CORTEX sans apprentissage (règles/compétence/calibration) | 48 604 € | 78,7 % |
| Habitude (prix fixe 4 €, stock moyen) | 30 675 € | 50,0 % |

Différences appariées : hypothèses **+2 069 € ± 1 638 €** (IC95, positif 16/20) ; contre l'oubli +1 528 € ± 1 649 € ; contre l'habitude +17 808 € ± 3 075 € (20/20).

Découverte des ruptures cachées (bonne nature, ±10 jours) :
- **Concurrent : 19/20**, erreur de date médiane 0 jour, admis en 4 jours.
- Effet viral : 9/20, erreur de date 1 jour, admis en 15 jours.
- Changement d'élasticité : **7/20 seulement**, admis en 25 jours.
- **Zéro** fausse rupture avant le premier vrai événement, sur 20 années.
- Environ 10 revues humaines par an (relecteur simulé).

### Limites, dites franchement
- Le module « apprentissage » (règles, compétence de commande, calibration) **n'améliore pas le profit de façon mesurable** (−121 € ± 1 560 €). Il fonctionne et il est visible, mais sa valeur économique n'est pas démontrée ici.
- Les changements d'élasticité restent difficiles à voir. C'est une limite de fond : quand le prix varie peu, ils sont presque indiscernables d'une baisse de niveau. La vigilance et les expériences aident sans résoudre le problème.
- L'effet viral se produit souvent pendant des ruptures de stock, donc la demande correspondante n'est pas observée. Il est alors parfois attribué à une autre cause.
- Dans le banc d'essai, l'humain est remplacé par un **relecteur simulé** à règle simple. Les décisions d'un vrai humain changent les résultats.
- Le monde est une simulation que j'ai écrite. Les chiffres valent pour ce monde-là, pas pour une vraie boulangerie.

## Structure
```
src/   rng, linalg, model (bayésien), world (vérité cachée), econ (newsvendor), agent (la boucle), policies (oracle, habitude), runner
test/  17 tests (mathématiques, inférence, détection, absence de faux positifs, revue humaine, déterminisme)
bench/ bench.js (ablations), cli.js (une année commentée), RESULTS.txt
web/   interface ; scripts/build.js l'assemble avec le moteur réel dans dist/cortex.html
```
