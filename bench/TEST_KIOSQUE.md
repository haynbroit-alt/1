# Résultats — bench/test.json — 210 épisodes, graines 101–130

## 1. Profit (% de l'oracle, moyenne par environnement)

| Politique | kiosque | **Tous** |
|---|---:|---:|
| Oracle (connaît la vérité) | 100.0 | **100.0** |
| Habitude (prix fixe 4 €) | 46.5 | **46.5** |
| CORTEX v1 tel que fusionné (gelé) | 78.4 | **78.4** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 77.4 | **77.4** |
| Fenêtre glissante 60 j, sans hypothèses | 77.9 | **77.9** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 77.5 | **77.5** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 80.5 | **80.5** |

## 2. Fidélité du modèle du monde (erreur RMS du log-taux de demande, 7 j à l'avance ; plus bas = mieux)

| Politique | kiosque | **Tous** |
|---|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 0.328 | **0.328** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 0.329 | **0.329** |
| Fenêtre glissante 60 j, sans hypothèses | 0.323 | **0.323** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 0.344 | **0.344** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 0.313 | **0.313** |

## 3. Compréhension des changements cachés (bonne famille à ±14 j) et fausses découvertes

| Politique | season | pulse | threshold | logistic | variance | dow | **Compris (tous)** | Délai médian | Fausses découvertes / an (dont monde calme) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 0/30 | 0/30 | 0/30 | 26/30 | 0/30 | 0/30 | **14 %** | -3 j | 1.67 (—) |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 0/30 | 0/30 | 0/30 | 22/30 | 0/30 | 0/30 | **12 %** | -7 j | 1.63 (—) |
| Fenêtre glissante 60 j, sans hypothèses | 0/30 | 0/30 | 0/30 | 0/30 | 0/30 | 0/30 | **0 %** | — | 0.00 (—) |
| Vocabulaire fermé + détecteur générique + recherche de fond | 0/30 | 0/30 | 0/30 | 23/30 | 0/30 | 0/30 | **13 %** | -8 j | 1.80 (—) |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 23/30 | 0/30 | 3/30 | 12/30 | 4/30 | 23/30 | **36 %** | 47 j | 0.63 (—) |

## 4. Différences appariées v2 − références (mêmes mondes, mêmes aléas ; IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle (RMS) | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v2 − CORTEX v1 tel que fusionné (gelé) | +1305 ± 1855 | 22/30 | -0.015 ± 0.041 | +21.7 ± 5.2 |
| v2 − v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | +2140 ± 2073 | 18/30 | -0.016 ± 0.044 | +23.9 ± 6.0 |
| v2 − Fenêtre glissante 60 j, sans hypothèses | +1908 ± 1948 | 23/30 | -0.010 ± 0.032 | +36.1 ± 5.7 |
| v2 − Vocabulaire fermé + détecteur générique + recherche de fond | +2078 ± 1915 | 19/30 | -0.032 ± 0.045 | +23.3 ± 6.2 |

Temps de calcul moyen par année simulée (v2) : 11.6 s.
