# Prototype P3 — 100 mondes (50 forme, 50 compris), graines 1–100

## Confirmation des formes sur C selon le plan d’expériences

| | Passif (blocs aléatoires) | Habitude (leviers fixes) | **Actif (D-optimal, budget égal)** |
|---|---:|---:|---:|
| Formules de GALILÉE confirmées (D1, 9 formules) | 22 % | 0 % | **100 %** |
| Plafond : la vraie forme jugée sur C (D4) | 14 % (50) | 0 % | plan pour la formule de GALILÉE : 100 % · plan pour la vraie forme : 60 % (50) |

D1 apparié (actif − passif) : 78 ± 29 points.

## Fausses confirmations (D2)

| | Passif | Actif |
|---|---:|---:|
| Formules apprises sur écarts mélangés | 0/0 | 0/0 |
| Formules forcées, mondes compris | — | 0/0 |
| Formules non constantes injectées, mondes compris | — | 1/100 |

Formules constantes (non testables, donc jamais confirmées) : 50 sur écarts mélangés, 50 dans les mondes compris.

Budget du plan actif (D3) : |u₀| moyen max 0.50 (≤ 0,5) · part u₁ max 0.23 (≤ 0,3)

Formules jugées (D1) : carre → `0.3931 − cos(u0) / 2` P✗ A✓ · carre → `1/3 − 0.418·cos(u0)` P✗ A✓ · interaction → `0.2728·u0·(u1 − 0.4361)` P✗ A✓ · interaction → `0.1721·u0·u1` P✗ A✓ · interaction → `0.162·u1·u0` P✗ A✓ · interaction → `−0.2845·(2/3 − u1)·u0` P✗ A✓ · carre → `u0^2 / 4 − 0.06931` P✓ A✓ · carre → `1 / cos(u0)^0.4271 − 1.093` P✗ A✓ · interaction → `0.269·u0·(u1 − 1/3)` P✓ A✓

## Verdicts (critères de PROTOCOLE_P3.md)

- D1 actif ≥ 50 % et > passif : 100 %, différence 78 ± 29 ✅
- D2 fausses confirmations ≤ 10 % (borne ≤ 15 %) : 1 % (borne 5 %, 100 formules) ✅
- D3 budget : ✅
- Abandon (D2 échoue) : non

Temps moyen par monde : 40.4 s
