# Transfert — 240 épisodes, graines 1–6

## Profit (% de l'oracle)

| Politique | restaurant | calme | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (règle fixe) | 55.7 | 58.4 | 46.4 | 60.8 | 53.8 | 45.2 | 45.5 | **52.3** |
| CORTEX v1 (spécialisé commerce, gelé) | — | 94.9 | 77.8 | 71.2 | 83.9 | 82.9 | 78.3 | **81.5** |
| CORTEX v2 (spécialisé commerce) | — | 94.3 | 77.1 | 82.9 | 88.4 | 77.8 | 84.7 | **84.2** |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 87.5 | 94.3 | 75.5 | 80.6 | 84.2 | 85.8 | 82.8 | **84.4** |
| CORTEX v3 : cerveau générique | 87.4 | 94.0 | 77.7 | 83.2 | 85.4 | 83.5 | 84.1 | **85.0** |

## Erreur du modèle du monde (RMS du log, 7 j à l'avance ; plus bas = mieux)

| Politique | restaurant | calme | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 (spécialisé commerce, gelé) | — | 0.072 | 0.230 | 0.353 | 0.242 | 0.225 | 0.368 | **0.248** |
| CORTEX v2 (spécialisé commerce) | — | 0.070 | 0.207 | 0.221 | 0.142 | 0.240 | 0.268 | **0.191** |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 0.156 | 0.062 | 0.228 | 0.245 | 0.162 | 0.215 | 0.313 | **0.197** |
| CORTEX v3 : cerveau générique | 0.175 | 0.062 | 0.199 | 0.223 | 0.142 | 0.218 | 0.294 | **0.188** |

## Compréhension (bonne famille, bonne variable, bonne date ±14 j) et fausses découvertes

| Politique | level | slope:meteo | dow | slope:price | season | threshold | trend | variance | adstock | pulse | logistic | **Compris** | Délai médian | Fausses / an |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 (spécialisé commerce, gelé) | 16/24 | — | 0/12 | 7/12 | 0/12 | 0/12 | 0/6 | 0/12 | 0/6 | 0/12 | 3/6 | **23 %** | 10 j | 1.53 |
| CORTEX v2 (spécialisé commerce) | 17/24 | — | 10/12 | 2/12 | 5/12 | 3/12 | 3/6 | 4/12 | 2/6 | 4/12 | 2/6 | **46 %** | 16 j | 1.00 |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 23/42 | 3/6 | 0/18 | 6/12 | 0/12 | 0/12 | 0/6 | 0/12 | 0/6 | 0/12 | 3/6 | **24 %** | 13 j | 1.24 |
| CORTEX v3 : cerveau générique | 23/42 | 0/6 | 13/18 | 4/12 | 6/12 | 2/12 | 1/6 | 2/12 | 2/6 | 2/12 | 3/6 | **40 %** | 17 j | 1.36 |

## Différences appariées v3 − références (IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v3 − CORTEX v1 (spécialisé commerce, gelé) | +2742 ± 2786 | 22/36 | -0.059 ± 0.033 | +17.2 ± 10.9 |
| v3 − CORTEX v2 (spécialisé commerce) | +702 ± 2631 | 16/36 | -0.002 ± 0.015 | -7.8 ± 8.2 |
| v3 − Cerveau générique, vocabulaire fermé (niveau + sensibilité) | +358 ± 2157 | 21/42 | -0.010 ± 0.011 | +17.4 ± 10.3 |

Temps moyen par année (v3) : 14.1 s.
