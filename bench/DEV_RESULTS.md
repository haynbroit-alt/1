# Résultats — bench/dev.json — 350 épisodes, graines 1–10

## 1. Profit (% de l'oracle, moyenne par environnement)

| Politique | calme | boulangerie | glacier | marche | fleuriste | **Tous** |
|---|---:|---:|---:|---:|---:|---:|
| Oracle (connaît la vérité) | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (prix fixe 4 €) | 58.7 | 48.6 | 60.4 | 55.7 | 44.3 | **53.5** |
| CORTEX v1 tel que fusionné (gelé) | 95.0 | 76.7 | 75.6 | 83.9 | 86.9 | **83.6** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 95.1 | 79.3 | 82.0 | 84.3 | 85.8 | **85.3** |
| Fenêtre glissante 60 j, sans hypothèses | 92.4 | 74.0 | 65.5 | 88.6 | 86.3 | **81.4** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 95.1 | 79.4 | 81.6 | 84.3 | 86.7 | **85.4** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 94.4 | 77.3 | 85.1 | 88.7 | 83.8 | **85.8** |

## 2. Fidélité du modèle du monde (erreur RMS du log-taux de demande, 7 j à l'avance ; plus bas = mieux)

| Politique | calme | boulangerie | glacier | marche | fleuriste | **Tous** |
|---|---:|---:|---:|---:|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 0.080 | 0.248 | 0.333 | 0.226 | 0.231 | **0.224** |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 0.080 | 0.231 | 0.291 | 0.186 | 0.227 | **0.203** |
| Fenêtre glissante 60 j, sans hypothèses | 0.124 | 0.240 | 0.312 | 0.145 | 0.228 | **0.210** |
| Vocabulaire fermé + détecteur générique + recherche de fond | 0.080 | 0.228 | 0.290 | 0.186 | 0.221 | **0.201** |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 0.078 | 0.201 | 0.232 | 0.142 | 0.222 | **0.175** |

## 3. Compréhension des changements cachés (bonne famille à ±14 j) et fausses découvertes

| Politique | level | elasticity | season | threshold | dow | trend | variance | adstock | pulse | **Compris (tous)** | Délai médian | Fausses découvertes / an (dont monde calme) |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| CORTEX v1 tel que fusionné (gelé) | 28/40 | 11/20 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | **30 %** | 11 j | 1.38 (0.10) |
| v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | 28/40 | 4/20 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | **25 %** | 8 j | 1.54 (0.20) |
| Fenêtre glissante 60 j, sans hypothèses | 0/40 | 0/20 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | **0 %** | — | 0.00 (0.00) |
| Vocabulaire fermé + détecteur générique + recherche de fond | 29/40 | 5/20 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | 0/10 | **26 %** | 9 j | 1.70 (0.20) |
| CORTEX v2 : grammaire ouverte + détecteurs + recherche de fond | 28/40 | 4/20 | 7/10 | 3/10 | 10/10 | 5/10 | 5/10 | 4/10 | 5/10 | **55 %** | 17 j | 0.74 (0.00) |

## 4. Différences appariées v2 − références (mêmes mondes, mêmes aléas ; IC95)

| Comparaison | Profit (€/an) | Gagne | Erreur du modèle (RMS) | Compréhension (pts) |
|---|---:|---:|---:|---:|
| v2 − CORTEX v1 tel que fusionné (gelé) | +1676 ± 2013 | 29/50 | -0.049 ± 0.023 | +26.5 ± 11.2 |
| v2 − v1 + nouvelle infrastructure (score Tobit), vocabulaire fermé | +283 ± 1426 | 26/50 | -0.028 ± 0.015 | +30.6 ± 10.7 |
| v2 − Fenêtre glissante 60 j, sans hypothèses | +3643 ± 3069 | 37/50 | -0.035 ± 0.019 | +55.2 ± 6.2 |
| v2 − Vocabulaire fermé + détecteur générique + recherche de fond | +159 ± 1573 | 24/50 | -0.026 ± 0.016 | +29.2 ± 10.5 |

Temps de calcul moyen par année simulée (v2) : 11.3 s.
