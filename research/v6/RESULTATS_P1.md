# Prototype P1 — 300 mondes, graines 1001–1300

| Méthode | B1 placebo : mondes avec ≥ 1 acceptation | B3 mal spécifié | B2 fausses / monde à modes | A1 modes forts retrouvés | A2 forts lents (τ ≥ 30) | modes faibles retrouvés | A3 médiane |log τ̂/τ| | imprécises / monde | s / monde |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 (τ continu + pari invariant) | 4/100 (IC haut 10 %) | 50/50 | 0.02 | 63 % (167) | 56 % (55) | 40 % (52) | 0.11 | 0.89 | 4.52 |
| Grille v5 (τ ∈ {3,3 ; 10 ; 33} + même pari) | 6/100 (IC haut 12 %) | 50/50 | 0.03 | 41 % (167) | 25 % (55) | 37 % (52) | 0.17 | 1.20 | 0.27 |
| Facteur de Bayes naïf (meilleur τ, log BF > 3) | 50/100 (IC haut 60 %) | 50/50 | 0.62 | 68 % (167) | 58 % (55) | 42 % (52) | 0.11 | 0.80 | 1.20 |

A2 apparié (P1 − grille v5, modes forts lents) : 31 ± 14 points (55 modes).

## Verdicts (critères de PROTOCOLE_P1.md)

- B1 (≤ 10 %, borne haute ≤ 15 %) : 4.0 %, borne 9.8 % ✅
- B2 (≤ 0,10 / monde) : 0.020 ✅
- A1 (≥ 60 %) : 63 % ✅
- A2 (≥ 50 % et > grille) : 56 %, différence 31 ± 14 ✅
- Abandon (B1 échoue ou A1 < 40 %) : non

## Lecture honnête (rédigée après l'exécution unique ; prototype gelé `ea4d1fb`)
**Ce qui est démontré.** Les deux paris du prototype tiennent leurs critères pré-enregistrés.
- **A, inventer des états cachés sans grille.** Une recherche continue de τ, avec des concepts parcimonieux (1 ou 2 sources), retrouve 63 % des modes forts (cible, τ à ±50 %, source dominante). Pour les modes lents (τ de 30 à 120 j), elle en retrouve **56 %, contre 25 % pour la grille de la v5**, soit **+31 ± 14 points** en comparaison appariée. La médiane d'erreur sur τ vaut 0,11 en log (environ 12 %).
- **B, ne croire qu'après un pari gagné.** Dans les 100 mondes sans aucun mode, P1 accepte quelque chose dans **4 %** des mondes (borne haute 9,8 %), conformément à α = 10 %. La règle naïve de la v4/v5 (facteur de Bayes du meilleur modèle) se trompe dans **50 %** des mondes placebo, pour un gain de détection faible : 68 % contre 63 %.

**Ce qui n'est pas démontré, ou qui échoue.**
1. **Monde mal spécifié : 50/50.** Une rupture de niveau, que le modèle nul ne contient pas, est **toujours** « expliquée » par un mode lent inventé. Ce n'est pas une violation de la garantie, qui ne vaut que si le modèle nul est juste. C'est la limite la plus importante : un système qui invente des concepts invente aussi des explications fausses aux phénomènes qu'il ne sait pas représenter. Dans CORTEX, la grammaire de la v4 (ruptures datées, seuils, saisons) devra **entrer dans le modèle nul et concourir** avec les modes inventés, et les mondes mal spécifiés devront faire partie du protocole n° 5. C'est aussi un argument expérimental en faveur du diagnostic « hors de portée » (sonde des résidus, composant C).
2. **Existence prouvée, description parfois fausse** : 0,89 mode « imprécis » par monde à modes. Le pari certifie qu'il existe une dynamique cachée sur la bonne mesure, mais τ ou la source dominante sont alors mal estimés. La garantie porte sur l'existence, pas sur la description.
3. **Modes faibles** (force < 0,10) : 40 % retrouvés seulement.
4. **Conditions favorables** : bruit gaussien en log, leviers changés par blocs de façon exogène (excitation persistante), 3 mesures, 2 leviers. Dans CORTEX, c'est le cerveau qui choisit les leviers, en boucle fermée : l'excitation persistante devra venir de l'exploration (composant D).
5. **Garantie formelle partielle** : elle ne couvre pas les modes qui se nourrissent de la mesure testée ni les chaînes de rétroaction. Elle est vérifiée empiriquement (B1, B2), pas démontrée.
6. **Coût** : 4,5 s par monde-année pour P1, contre 0,3 s pour la grille.
