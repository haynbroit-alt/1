# Transfert — 264 épisodes, graines 1–4

## Profit (% de l'oracle)

| Politique | usine | restaurant | usine-placebo | usine-cadence | usine-rupture | abonnement | boulangerie | marche | fleuriste | glacier | calme | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (règle fixe) | 27.2 | 57.1 | 27.5 | 69.6 | 26.6 | 35.6 | 47.5 | 57.4 | 46.0 | 62.4 | 60.2 | **47.0** |
| CORTEX v3 gelé (src_v3) | 24.3 | 87.3 | 97.9 | 101.3 | 8.9 | 95.2 | 78.0 | 84.2 | 87.4 | 84.1 | 94.1 | **76.6** |
| v4 sans planification | 55.8 | 85.5 | 96.9 | 102.7 | 46.7 | 95.0 | 78.1 | 85.7 | 90.4 | 83.6 | 93.8 | **83.1** |
| v4 sans variables construites | 24.3 | 86.1 | 97.9 | 101.3 | 8.9 | 95.2 | 78.3 | 84.7 | 87.4 | 84.1 | 94.1 | **76.6** |
| CORTEX v4 : modèles construits + stratégies | 73.6 | 85.8 | 96.9 | 100.4 | 73.5 | 95.0 | 78.6 | 85.7 | 91.8 | 85.2 | 93.8 | **87.3** |

## Erreur du modèle du monde (RMS du log, 7 j à l'avance ; plus bas = mieux)

| Politique | usine | restaurant | usine-placebo | usine-cadence | usine-rupture | abonnement | boulangerie | marche | fleuriste | glacier | calme | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v3 gelé (src_v3) | 0.278 | 0.179 | 0.288 | 0.353 | 0.274 | 0.326 | 0.194 | 0.149 | 0.212 | 0.208 | 0.063 | **0.229** |
| v4 sans planification | 0.254 | 0.162 | 0.284 | 0.229 | 0.290 | 0.343 | 0.190 | 0.133 | 0.198 | 0.191 | 0.064 | **0.213** |
| v4 sans variables construites | 0.256 | 0.182 | 0.288 | 0.353 | 0.269 | 0.343 | 0.191 | 0.143 | 0.212 | 0.208 | 0.063 | **0.228** |
| CORTEX v4 : modèles construits + stratégies | 0.253 | 0.169 | 0.284 | 0.224 | 0.258 | 0.343 | 0.196 | 0.133 | 0.183 | 0.190 | 0.064 | **0.209** |

## Compréhension (bonne famille, bonne variable, bonne date ±14 j) et fausses découvertes

| Politique | level | slope:cadence | dow | memory | slope:meteo | slope:prix | slope:pub | slope:price | trend | variance | adstock | pulse | season | threshold | **Compris** | Délai médian | Fausses / an |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v3 gelé (src_v3) | 40/68 | 2/16 | 20/24 | 0/12 | 0/4 | 3/4 | 0/4 | 4/8 | 1/4 | 1/4 | 2/4 | 1/4 | 1/4 | 1/4 | **46 %** | 9 j | 2.41 |
| v4 sans planification | 36/68 | 1/16 | 24/24 | 10/12 | 0/4 | 4/4 | 0/4 | 3/8 | 3/4 | 3/4 | 0/4 | 2/4 | 2/4 | 2/4 | **55 %** | 14 j | 1.73 |
| v4 sans variables construites | 38/68 | 3/16 | 20/24 | 0/12 | 0/4 | 3/4 | 0/4 | 4/8 | 2/4 | 1/4 | 2/4 | 1/4 | 1/4 | 1/4 | **46 %** | 10 j | 2.27 |
| CORTEX v4 : modèles construits + stratégies | 36/68 | 2/16 | 23/24 | 10/12 | 0/4 | 4/4 | 0/4 | 4/8 | 3/4 | 3/4 | 1/4 | 2/4 | 2/4 | 2/4 | **56 %** | 14 j | 1.64 |

## Différences appariées (IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v4 − CORTEX v3 gelé (src_v3) | +294542 ± 199949 | 24/44 | -0.020 ± 0.016 | +9.6 ± 8.2 |
| v4 − v4 sans planification | +115318 ± 85076 | 16/44 | -0.004 ± 0.008 | +1.8 ± 3.4 |
| v4 − v4 sans variables construites | +294893 ± 199893 | 23/44 | -0.019 ± 0.015 | +9.6 ± 7.4 |

Temps moyen par année (v4) : 22.3 s.
