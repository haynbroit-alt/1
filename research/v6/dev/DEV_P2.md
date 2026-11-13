# Prototype P2 — 100 mondes, graines 1–100

## Diagnostic par classe de monde

| Classe | Mondes | Mondes avec ≥ 1 « hors de portée » | Mesures touchées déclarées hors de portée | … avec la bonne famille | « mal estimé » (mesures) |
|---|---:|---:|---:|---:|---:|
| compris | 20 | 1 | — | — | 16/60 |
| forme | 20 | 7 | 7/20 | 7/20 | 8/60 |
| rupture | 20 | 14 | 14/20 | 14/20 | 12/60 |
| regime | 20 | 3 | 3/20 | 0/20 | 13/60 |
| flou | 20 | 0 | — | — | 16/60 |

Plafond oracle (forme) : la vraie formule en colonne libre dépasse le seuil de la sonde pour 7/20 mesures touchées ; la sonde en déclare 7.

AUC de la sonde (C4) : 0.820 (40 mesures touchées, 60 mesures de mondes compris)

## GALILÉE

| Essai | Appels | Formules acceptées sur C |
|---|---:|---:|
| G1 vraies formes (après sonde) | 7 | 1 |
| G2 écarts mélangés (contamination) | 20 | 0 |
| G3 mondes compris (appel forcé) | 20 | 0 |

G1 — variation de l'erreur de prévision sur C avec la formule : -0.0197 ± 0.0128

Formules proposées (G1) : carre → `1.278e-4` ✗ · carre → `−0.09723·cos(π·u0)` ✓ · interaction → `0.2728·u0·(u1 − 0.4361)` ✗ · carre → `sin(u0 − π/2) + 0.8687` ✗ · carre → `1 / cos(u0)^0.4314 − 1.09` ✗ · carre → `8.415e-5` ✗ · interaction → `1.44e-4` ✗

## Verdicts (critères de PROTOCOLE_P2.md)

- C1 compris, mondes avec fausse alarme ≤ 10 % (borne ≤ 15 %) : 5 % (borne 24 %) ❌
- C2 forme ≥ 60 % : 35 % ❌ · rupture ≥ 60 % : 70 % ✅
- C3 flou, mondes avec « hors de portée » ≤ 15 % : 0 % ✅
- C4 AUC ≥ 0,80 : 0.820 ✅
- G1 formules acceptées ≥ 50 % et erreur en baisse : 14 %, -0.0197 ± 0.0128 ❌
- G2 contamination ≤ 10 % : 0 % ✅
- G3 compris ≤ 10 % : 0 % ✅
- Abandon (C1 échoue ou AUC < 0,70) : **OUI**

Temps moyen par monde : 7.4 s
