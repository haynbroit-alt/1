# Transfert — 240 épisodes, graines 101–130

## Profit (% de l'oracle)

| Politique | usine | abonnement | **Tous** |
|---|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | **100.0** |
| Habitude (règle fixe) | 27.3 | 35.1 | **31.2** |
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 25.8 | 96.4 | **61.1** |
| CORTEX v3 : cerveau générique | 25.5 | 95.8 | **60.6** |

## Erreur du modèle du monde (RMS du log, 7 j à l'avance ; plus bas = mieux)

| Politique | usine | abonnement | **Tous** |
|---|---:|---:|---:|
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 0.302 | 0.358 | **0.330** |
| CORTEX v3 : cerveau générique | 0.270 | 0.369 | **0.319** |

## Compréhension (bonne famille, bonne variable, bonne date ±14 j) et fausses découvertes

| Politique | level | slope:cadence | dow | adstock | slope:prix | slope:pub | **Compris** | Délai médian | Fausses / an |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cerveau générique, vocabulaire fermé (niveau + sensibilité) | 101/120 | 11/30 | 0/30 | 0/30 | 21/30 | 0/30 | **49 %** | 3 j | 3.45 |
| CORTEX v3 : cerveau générique | 89/120 | 11/30 | 28/30 | 2/30 | 22/30 | 0/30 | **56 %** | 4 j | 3.38 |

## Différences appariées v3 − références (IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v3 − Cerveau générique, vocabulaire fermé (niveau + sensibilité) | -14884 ± 5120 | 10/60 | -0.010 ± 0.017 | +5.8 ± 5.4 |

Temps moyen par année (v3) : 12.8 s.
