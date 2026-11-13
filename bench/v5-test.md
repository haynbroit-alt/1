# Évaluation pré-enregistrée n° 4 (CORTEX v5) — 810 années simulées, graines 401–430

## Profit (% de l’oracle)

| Politique | brasserie | centre | velos | **Tous** |
|---|---:|---:|---:|---:|
| Oracle (vraie dynamique ; non myope là où l’activité le permet) | 100.0 | 100.0 | 100.0 | **100.0** |
| Habitude (règle fixe) | 56.1 | 42.6 | 90.0 | **62.9** |
| CORTEX v3 (gelée) | 91.0 | 46.8 | 45.0 | **60.9** |
| CORTEX v4 (gelée) | 84.9 | 55.3 | 46.6 | **62.3** |
| **CORTEX v5** | 81.2 | 67.6 | 48.6 | **65.8** |
| v5 sans exploration (C1) | 82.2 | 39.7 | 47.6 | **56.5** |
| v5 sans variables inventées (C2) | 88.9 | 61.7 | 47.0 | **65.9** |
| v5 sans incompréhension (C4) | 83.5 | 70.5 | 47.0 | **67.0** |
| v5 avec remise en cause (C3, rejetée en dev) | 79.1 | 65.2 | 44.9 | **63.1** |

## Erreur du modèle du monde (RMS du log, 7 jours à l’avance ; plus bas = mieux)

| Politique | brasserie | centre | velos | **Tous** |
|---|---:|---:|---:|---:|
| CORTEX v3 (gelée) | 0.648 | 0.391 | 0.816 | **0.618** |
| CORTEX v4 (gelée) | 0.669 | 0.299 | 0.719 | **0.562** |
| **CORTEX v5** | 0.605 | 0.287 | 0.659 | **0.517** |
| v5 sans exploration (C1) | 0.668 | 0.273 | 0.679 | **0.540** |
| v5 sans variables inventées (C2) | 0.660 | 0.298 | 0.681 | **0.546** |
| v5 sans incompréhension (C4) | 0.607 | 0.275 | 0.699 | **0.527** |
| v5 avec remise en cause (C3, rejetée en dev) | 0.666 | 0.268 | 0.663 | **0.532** |

## Hypothèses pré-enregistrées (différences appariées, IC95, trois activités)

| Hypothèse | Différence appariée (IC95) | Verdict |
|---|---:|---|
| G1 profit v5 > v4 | +13082 ± 18222 | ❌ non confirmée |
| ↳ brasserie | -2972 ± 4145 | ❌ |
| ↳ centre | +40116 ± 52803 | ❌ |
| ↳ velos | +2102 ± 10240 | ❌ |
| G2 profit v5 > habitude | +18726 ± 14741 | ✅ confirmée |
| ↳ brasserie | +19583 ± 3913 | ✅ |
| ↳ centre | +81750 ± 29434 | ✅ |
| ↳ velos | -45156 ± 7220 | ❌ |
| E1 profit v5 > v5 sans C1 | +30467 ± 23873 | ✅ confirmée |
| ↳ brasserie | -1055 ± 5205 | ❌ |
| ↳ centre | +91430 ± 66249 | ✅ |
| ↳ velos | +1026 ± 9613 | ❌ |
| E2a erreur v5 < v5 sans C2 | -0.029 ± 0.044 | ❌ non confirmée |
| ↳ brasserie | -0.055 ± 0.117 | ❌ |
| ↳ centre | -0.011 ± 0.045 | ❌ |
| ↳ velos | -0.022 ± 0.042 | ❌ |
| E2b mécanismes inventables : v5 > v4 | +0.40 ± 0.10 | ✅ confirmée |
| ↳ brasserie | +0.50 ± 0.18 | ✅ |
| ↳ centre | +0.67 ± 0.17 | ✅ |
| ↳ velos | +0.03 ± 0.07 | ❌ |
| E4 fausses découvertes v5 < v5 sans C4 | -0.47 ± 0.44 | ✅ confirmée |
| ↳ brasserie | -0.47 ± 0.68 | ❌ |
| ↳ centre | +0.33 ± 0.89 | ❌ |
| ↳ velos | -1.27 ± 0.59 | ✅ |
| (C3, sans hypothèse) profit v5 avec C3 − v5 | -4095 ± 13452 | rapporté |
| ↳ brasserie | -875 ± 3419 |  |
| ↳ centre | -7404 ± 40101 |  |
| ↳ velos | -4006 ± 6591 |  |
| S fausses découvertes v5 ≤ 2 par an et par activité | brasserie 3.93 · centre 6.00 · velos 2.10 | ❌ dépassé |
| E4b jours d’incompréhension par mesure : activités avec mécanisme hors de portée (15.4) − sans (48.5) | -33.0 ± 9.4 | ❌ non confirmée |

## Découverte des mécanismes cachés (part des années où le mécanisme est trouvé)

| Activité | Mécanisme | Classe | CORTEX v3 (gelée) | CORTEX v4 (gelée) | **CORTEX v5** | v5 sans exploration (C1) | v5 sans variables inventées (C2) | v5 sans incompréhension (C4) | v5 avec remise en cause (C3, rejetée en dev) |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| brasserie | Les clients deviennent plus sensibles au prix (élasticité −1,4 → −2,2) | représentable | 27 % | 47 % | 77 % | 47 % | 53 % | 63 % | 77 % |
| brasserie | Une dégustation attire encore du monde les jours suivants (mémoire λ = 0,7) | représentable | 3 % | 3 % | 20 % | 13 % | 10 % | 20 % | 27 % |
| brasserie | Réputation cachée : mémoire lente (λ = 0,9) des plaintes, qui fait fuir les clients | inventable | 0 % | 0 % | 50 % | 27 % | 0 % | 50 % | 43 % |
| brasserie | Régime caché à deux états (±22 %), bascules aléatoires (≈ 1 tous les 45 j) | hors de portée | — | — | — | — | — | — | — |
| centre | Un client lance une campagne : +35 % d’appels | représentable | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % | 100 % |
| centre | La formation augmente la productivité, effet qui s’estompe (mémoire λ = 0,9) | représentable | 17 % | 17 % | 10 % | 10 % | 10 % | 7 % | 7 % |
| centre | File d’attente cachée : accumulation amortie (λ = 0,9) des appels reçus − traités, qui multiplie les abandons (saturé) | inventable (à une normalisation et une saturation près) | 0 % | 0 % | 67 % | 53 % | 0 % | 73 % | 73 % |
| velos | Cycle annuel de la demande (±35 %) | représentable | 100 % | 100 % | 97 % | 97 % | 97 % | 90 % | 97 % |
| velos | Un concurrent s’installe à 15 € : au-delà, −35 % de locations | représentable | 43 % | 37 % | 37 % | 47 % | 40 % | 37 % | 37 % |
| velos | Bouche-à-oreille caché : mémoire très lente (λ = 0,97) des locations passées (flotte bornée à 120 vélos) | inventable | 0 % | 0 % | 3 % | 0 % | 0 % | 3 % | 0 % |
| velos | Les pannes augmentent avec les jours sans réparateur, avec saturation à 25 j | approximable | 0 % | 40 % | 23 % | 27 % | 27 % | 13 % | 27 % |

## Fausses découvertes par an et jours d’incompréhension

| Politique | brasserie (fausses) | centre (fausses) | velos (fausses) | brasserie (incompr. j/mesure) | centre (incompr. j/mesure) | velos (incompr. j/mesure) |
|---|---:|---:|---:|---:|---:|---:|
| CORTEX v3 (gelée) | 3.37 | 8.10 | 2.73 | — | — | — |
| CORTEX v4 (gelée) | 4.67 | 9.67 | 2.53 | — | — | — |
| **CORTEX v5** | 3.93 | 6.00 | 2.10 | 15.4 | 21.0 | 75.9 |
| v5 sans exploration (C1) | 3.60 | 6.67 | 2.00 | 14.4 | 18.0 | 74.3 |
| v5 sans variables inventées (C2) | 4.57 | 7.53 | 2.37 | 15.2 | 22.3 | 82.7 |
| v5 sans incompréhension (C4) | 4.40 | 5.67 | 3.37 | 0.0 | 0.0 | 0.0 |
| v5 avec remise en cause (C3, rejetée en dev) | 3.73 | 6.87 | 2.17 | 12.4 | 19.6 | 77.9 |

Jours d’incompréhension de v5, par mesure :

- brasserie : pintes 16.2 j · plaintes 14.7 j
- centre : appels 0.0 j · traites 9.4 j · abandons 53.7 j
- velos : locations 3.8 j · pannes 148.0 j

## Temps de calcul (s par année simulée)

CORTEX v3 (gelée) 14.2 · CORTEX v4 (gelée) 31.2 · **CORTEX v5** 46.7 · v5 sans exploration (C1) 45.7 · v5 sans variables inventées (C2) 29.1 · v5 sans incompréhension (C4) 47.2 · v5 avec remise en cause (C3, rejetée en dev) 54.1
