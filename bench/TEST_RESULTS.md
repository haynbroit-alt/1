# Résultats — bench/test.json — 1260 épisodes, graines 101–130

## 1. Profit (% de l'oracle, moyenne par environnement)

| Politique | calme | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (prix fixe 4 €) | 59.7 | 51.0 | 60.5 | 57.9 | 43.5 | 46.5 | **53.2** |
| CORTEX v1 tel que fusionné (gelé) | 94.7 | 76.4 | 75.8 | 82.8 | 87.1 | 78.4 | **82.6** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 95.0 | 77.7 | 78.1 | 83.3 | 85.4 | 77.4 | **82.8** |
| Fenêtre glissante 60 j, sans hypothèses | 91.1 | 75.7 | 68.1 | 87.3 | 82.9 | 77.9 | **80.5** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 94.8 | 78.1 | 78.0 | 83.3 | 85.1 | 77.5 | **82.8** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 94.3 | 74.8 | 86.7 | 88.5 | 87.0 | 80.5 | **85.3** |

## 2. Fidélité du modèle du monde (erreur RMS du log-taux de demande, 7 j à l'avance ; plus bas = mieux)

| Politique | calme | boulangerie | glacier | marche | fleuriste | kiosque | **Tous** |
|---|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 0.070 | 0.224 | 0.370 | 0.223 | 0.234 | 0.328 | **0.242** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 0.067 | 0.208 | 0.327 | 0.185 | 0.258 | 0.329 | **0.229** |
| Fenêtre glissante 60 j, sans hypothèses | 0.113 | 0.208 | 0.328 | 0.157 | 0.237 | 0.323 | **0.228** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 0.069 | 0.204 | 0.331 | 0.184 | 0.262 | 0.344 | **0.232** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 0.065 | 0.219 | 0.233 | 0.141 | 0.232 | 0.313 | **0.201** |

## 3. Compréhension des changements cachés (bonne famille à ±14 j) et fausses découvertes

| Politique | level | elasticity | season | threshold | dow | trend | variance | adstock | pulse | logistic | **Compris (tous)** | Délai médian | Fausses découvertes / an (dont monde calme) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 76/120 | 28/60 | 0/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/30 | 0/60 | 26/30 | **23 %** | 9 j | 1.64 (0.20) |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 88/120 | 14/60 | 0/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/30 | 0/60 | 22/30 | **22 %** | 7 j | 1.58 (0.20) |
| Fenêtre glissante 60 j, sans hypothèses | 0/120 | 0/60 | 0/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/30 | 0/60 | 0/30 | **0 %** | — | 0.00 (0.00) |
| Vocabulaire fermé + détecteur générique + recherche de fond | 89/120 | 13/60 | 0/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/30 | 0/60 | 23/30 | **22 %** | 7 j | 1.59 (0.23) |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 84/120 | 18/60 | 46/60 | 9/60 | 52/60 | 17/30 | 18/60 | 14/30 | 8/60 | 12/30 | **49 %** | 24 j | 0.74 (0.07) |

## 4. Différences appariées v2 − références (mêmes mondes, mêmes aléas ; IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle (RMS) | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v2 − CORTEX v1 tel que fusionné (gelé) | +2307 ± 855 | 112/180 | -0.041 ± 0.014 | +27.8 ± 6.0 |
| v2 − v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | +2237 ± 890 | 98/180 | -0.028 ± 0.012 | +27.9 ± 5.3 |
| v2 − Fenêtre glissante 60 j, sans hypothèses | +4619 ± 1356 | 140/180 | -0.027 ± 0.010 | +51.2 ± 3.9 |
| v2 − Vocabulaire fermé + détecteur générique + recherche de fond | +2274 ± 893 | 101/180 | -0.032 ± 0.012 | +27.7 ± 5.3 |

Temps de calcul moyen par année simulée (v2) : 10.8 s.
