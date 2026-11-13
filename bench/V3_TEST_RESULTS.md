# Transfert — 1440 épisodes, graines 101–130

## Profit (% de l'oracle)

| Politique | usine | restaurant | calme | abonnement | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (règle fixe) | 27.3 | 53.6 | 59.7 | 35.1 | 51.1 | 60.6 | 57.9 | 43.6 | 46.5 | **48.4** |
| CORTEX v1 (spécialisé commerce, gelé) | — | — | 94.7 | — | 76.5 | 75.9 | 82.8 | 87.2 | 78.5 | **82.6** |
| CORTEX v2 (spécialisé commerce) | — | — | 94.4 | — | 74.9 | 86.7 | 88.5 | 87.2 | 80.6 | **85.4** |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 25.8 | 87.0 | 94.2 | 96.4 | 78.0 | 79.7 | 83.4 | 87.6 | 82.5 | **79.4** |
| CORTEX v3 : cerveau générique | 25.5 | 86.7 | 93.5 | 95.8 | 77.0 | 84.2 | 87.6 | 86.5 | 83.5 | **80.0** |

## Erreur du modèle du monde (RMS du log, 7 j à l'avance ; plus bas = mieux)

| Politique | usine | restaurant | calme | abonnement | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 (spécialisé commerce, gelé) | — | — | 0.070 | — | 0.224 | 0.370 | 0.223 | 0.234 | 0.328 | **0.242** |
| CORTEX v2 (spécialisé commerce) | — | — | 0.065 | — | 0.219 | 0.233 | 0.141 | 0.232 | 0.313 | **0.201** |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 0.302 | 0.142 | 0.066 | 0.358 | 0.195 | 0.271 | 0.178 | 0.233 | 0.299 | **0.227** |
| CORTEX v3 : cerveau générique | 0.270 | 0.140 | 0.069 | 0.369 | 0.194 | 0.239 | 0.130 | 0.218 | 0.293 | **0.214** |

## Compréhension (bonne famille, bonne variable, bonne date ±14 j) et fausses découvertes

| Politique | level | slope:cadence | dow | adstock | slope:meteo | slope:prix | slope:pub | slope:price | season | threshold | trend | variance | pulse | logistic | **Compris** | Délai médian | Fausses / an |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 (spécialisé commerce, gelé) | 76/120 | — | 0/60 | 0/30 | — | — | — | 28/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/60 | 26/30 | **23 %** | 9 j | 1.64 |
| CORTEX v2 (spécialisé commerce) | 84/120 | — | 52/60 | 14/30 | — | — | — | 18/60 | 46/60 | 9/60 | 17/30 | 18/60 | 8/60 | 12/30 | **49 %** | 24 j | 0.74 |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 227/330 | 11/30 | 0/120 | 0/60 | 16/30 | 21/30 | 0/30 | 18/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/60 | 22/30 | **32 %** | 6 j | 1.67 |
| CORTEX v3 : cerveau générique | 208/330 | 11/30 | 96/120 | 16/60 | 15/30 | 22/30 | 0/30 | 16/60 | 47/60 | 6/60 | 17/30 | 11/60 | 11/60 | 14/30 | **49 %** | 14 j | 1.42 |

## Différences appariées v3 − références (IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v3 − CORTEX v1 (spécialisé commerce, gelé) | +1956 ± 1348 | 112/180 | -0.051 ± 0.015 | +25.3 ± 5.3 |
| v3 − CORTEX v2 (spécialisé commerce) | -350 ± 1115 | 80/180 | -0.010 ± 0.009 | -2.4 ± 5.0 |
| v3 − Cerveau générique, vocabulaire fermé (niveau + sensibilité) | -2703 ± 1625 | 116/270 | -0.014 ± 0.006 | +19.1 ± 3.6 |

Temps moyen par année (v3) : 13.2 s.
