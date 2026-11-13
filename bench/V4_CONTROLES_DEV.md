# Expériences de contrôle v4 (développement)

## 1. Placebo : la maintenance ne sert à rien (aucune usure)

| Politique | Croit à une usure « jours depuis maintenance » | Maintenances / an | % de l’oracle |
|---|---:|---:|---:|
| v3-gele | 0/4 | 2.8 | 97.9 |
| v4 | 0/4 | 2.8 | 96.9 |
| v4-myope | 0/4 | 2.8 | 96.9 |
| v4-sansmemoire | 0/4 | 2.8 | 97.9 |

## 2. Usure liée à la cadence récente (et non au temps depuis la maintenance)

| Politique | Trouve la mémoire de la cadence | Croit (à tort) à « jours depuis maintenance » | Maintenances / an | % de l’oracle |
|---|---:|---:|---:|---:|
| v3-gele | 0/4 | 0/4 | 4.5 | 101.3 |
| v4 | 4/4 | 0/4 | 4.8 | 100.4 |
| v4-myope | 4/4 | 0/4 | 4.0 | 102.7 |
| v4-sansmemoire | 0/4 | 0/4 | 4.5 | 101.3 |

## 3. Usure réelle, et robustesse : l’usure double au jour 200

| Corps | Politique | Trouve l’usure | Intervalle moyen entre maintenances, j 60–200 | j 230–365 | % de l’oracle |
|---|---|---:|---:|---:|---:|
| usine | v3-gele | 0/4 | NaN | NaN | 24.3 |
| usine | v4 | 4/4 | 11.1 | 12.9 | 73.6 |
| usine | v4-myope | 4/4 | NaN | NaN | 55.8 |
| usine-rupture | v3-gele | 0/4 | NaN | NaN | 8.9 |
| usine-rupture | v4 | 4/4 | 11.1 | 11.4 | 73.5 |
| usine-rupture | v4-myope | 4/4 | NaN | NaN | 46.7 |

Calendrier optimal (oracle) : environ 12 jours avant la rupture, 8 jours après.

## 4. Fausses mémoires et interactions là où il n’y en a aucune

| Corps (sans mécanisme à mémoire ni interaction) | v4 : années avec ≥ 1 « mémoire » | avec ≥ 1 « interaction » | Mémoires / an |
|---|---:|---:|---:|
| calme | 1/4 | 0/4 | 0.25 |
| boulangerie | 3/4 | 0/4 | 0.75 |
| marche | 0/4 | 0/4 | 0.00 |
| glacier | 1/4 | 0/4 | 0.25 |
| restaurant | 2/4 | 0/4 | 0.75 |
| abonnement | 0/4 | 1/4 | 0.00 |
| usine-placebo | 2/4 | 0/4 | 0.50 |

Le fleuriste a un vrai effet retard du marketing : une mémoire du marketing y est correcte.

## 5. Les variables construites améliorent-elles les prévisions hors échantillon ?

Erreur RMS du log de chaque mesure, prédite **7 jours à l’avance** (jours futurs jamais vus par le modèle). Différence appariée v4 − v4 sans variables construites (négatif = mieux).

| Corps | v4 | v4 sans variables construites | Différence (IC95) |
|---|---:|---:|---:|
| usine | 0.253 | 0.256 | -0.003 ± 0.048 |
| restaurant | 0.169 | 0.182 | -0.013 ± 0.041 |
| usine-placebo | 0.284 | 0.288 | -0.004 ± 0.006 |
| usine-cadence | 0.224 | 0.353 | -0.128 ± 0.066 |
| usine-rupture | 0.258 | 0.269 | -0.011 ± 0.063 |
| abonnement | 0.343 | 0.343 | +0.000 ± 0.016 |
| boulangerie | 0.196 | 0.191 | +0.005 ± 0.032 |
| marche | 0.133 | 0.143 | -0.010 ± 0.023 |
| fleuriste | 0.183 | 0.212 | -0.029 ± 0.045 |
| glacier | 0.190 | 0.208 | -0.019 ± 0.039 |
| calme | 0.064 | 0.063 | +0.002 ± 0.004 |
| **Tous** | | | **-0.019 ± 0.015** |

## 6. Temps de calcul (s par année simulée)

| Politique | Moyenne | Max |
|---|---:|---:|
| v3-gele | 14.1 | 24.7 |
| v4 | 22.3 | 44.8 |
| v4-myope | 18.8 | 38.0 |
| v4-sansmemoire | 12.6 | 23.4 |
