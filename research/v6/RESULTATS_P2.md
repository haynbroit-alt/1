# Prototype P2 — 300 mondes, graines 3001–3300

## Diagnostic par classe de monde

| Classe | Mondes | Mondes avec ≥ 1 « hors de portée » | Mesures touchées déclarées hors de portée | … avec la bonne famille | « mal estimé » (mesures) |
|---|---:|---:|---:|---:|---:|
| compris | 60 | 0 | — | — | 47/180 |
| forme | 60 | 25 | 25/60 | 25/60 | 36/180 |
| rupture | 60 | 42 | 41/60 | 37/60 | 34/180 |
| regime | 60 | 10 | 10/60 | 4/60 | 54/180 |
| flou | 60 | 0 | — | — | 46/180 |

Plafond oracle (forme) : la vraie formule en colonne libre dépasse le seuil de la sonde pour 34/60 mesures touchées ; la sonde en déclare 25.

AUC de la sonde (C4) : 0.885 (120 mesures touchées, 180 mesures de mondes compris)

## GALILÉE

| Essai | Appels | Formules acceptées sur C |
|---|---:|---:|
| G1 vraies formes (après sonde) | 25 | 1 |
| G2 écarts mélangés (contamination) | 60 | 0 |
| G3 mondes compris (appel forcé) | 60 | 0 |

G1 — variation de l'erreur de prévision sur C avec la formule : -0.0027 ± 0.0272

Formules proposées (G1) : carre → `0.9163 − cos(u0)` ✗ · carre → `−0.09831·cos(4·u0)` ✗ · carre → `0.5751 − 2·cos(u0) / 3` ✗ · carre → `−0.07002·cos(π·u0)` ✓ · carre → `5.41e-5` ✗ · interaction → `sin(u0)·(u1 − 0.3999) / 3` ✗ · interaction → `u0·(u1 − 0.3638) / 4` ✗ · carre → `1.493e-4` ✗ · carre → `1 / (u0 + 2)^48.55` ✗ · interaction → `−0.1103·(u0 − u1 / u0)` ✗ · interaction → `u1·u0 / 4` ✗ · carre → `6.167e-5` ✗

## Verdicts (critères de PROTOCOLE_P2.md)

- C1 compris, mondes avec fausse alarme ≤ 10 % (borne ≤ 15 %) : 0 % (borne 6 %) ✅
- C2 forme ≥ 60 % : 42 % ❌ · rupture ≥ 60 % : 68 % ✅
- C3 flou, mondes avec « hors de portée » ≤ 15 % : 0 % ✅
- C4 AUC ≥ 0,80 : 0.885 ✅
- G1 formules acceptées ≥ 50 % et erreur en baisse : 4 %, -0.0027 ± 0.0272 ❌
- G2 contamination ≤ 10 % : 0 % ✅
- G3 compris ≤ 10 % : 0 % ✅
- Abandon (C1 échoue ou AUC < 0,70) : non

Temps moyen par monde : 7.2 s

## Lecture honnête (rédigée après l'exécution unique ; prototype gelé `1121b10`)
**Ce qui est démontré : CORTEX sait dire « il me manque quelque chose », sans fausse alarme.**
- **Mondes compris** : **0 fausse alarme sur 60** (borne haute 6 %). L'échec E4b de la v5 venait de ce que le signal se déclenchait sur les mauvaises prévisions ; ici, il ne se déclenche pas quand le modèle est juste.
- **AUC de 0,885** : la sonde sépare les mesures porteuses d'une structure manquante (forme ou rupture) des mesures de mondes compris.
- **Mondes flous** (exprimable mais pas encore appris) : **jamais** déclarés « hors de portée », 0 sur 60. La distinction « je ne sais pas encore » / « mon langage ne peut pas le dire » fonctionne dans ce cas.
- **Ruptures** : 68 % déclarées hors de portée, en majorité avec la bonne famille (temps : 37 sur 60).
- **GALILÉE ne contamine pas.** Il a été appelé sur des écarts mélangés (60 fois) ou dans des mondes compris (60 fois). **Aucune** de ses formules n'a franchi le pari sur C. Le garde-fou protège CORTEX contre une source externe qui se tromperait.

**Ce qui échoue.**
1. **C2, formes statiques : 42 %**, pour un seuil de 60 %. Le plafond oracle est de 34 sur 60 (57 %) : même la vraie formule ne franchit pas le seuil ailleurs. Le critère était donc en partie hors d'atteinte par construction (saturation quasi linéaire, voir le journal). La sonde atteint 25 sur 34 du plafond.
2. **G1, GALILÉE : 1 formule acceptée sur 25.** Ce n'est pas faute de bonnes formes : il propose souvent la **bonne structure**, `u1·u0 / 4` (vrai : 0,3·u₀·u₁), `u0·(u1 − 0,36) / 4`, et des cosinus qui approchent u₀² sur [−1, 1]. Mais le pari sur C (93 jours) ne les confirme presque jamais, et l'erreur de prévision sur C ne baisse pas (−0,003 ± 0,027). **Cause non vérifiée** : C contient probablement trop peu de variété des leviers pour départager (par exemple u₁ rarement actif pendant C). C'est à mesurer avant toute conclusion sur GALILÉE.
3. **Régimes cachés** : 10 mesures sur 60 seulement, dont 4 avec la bonne famille. Un régime sans source observable reste mal saisi.
4. **Coût** : 7,2 s par monde-année.

**Conséquence pour la v6.** La sonde (composant C) est retenue. Le couplage avec GALILÉE est **sûr mais pas encore utile** : ses formes ne deviennent des connaissances que si on peut les confirmer. Dans CORTEX, c'est l'exploration active (composant D) qui devra créer la variété de leviers nécessaire, sur le modèle de GALILÉE qui choisit lui-même ses expériences.
