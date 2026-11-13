# Prototype P1 — 100 mondes, graines 1–100

| Méthode | B1 placebo : mondes avec ≥ 1 acceptation | B3 mal spécifié | B2 fausses / monde à modes | A1 modes forts retrouvés | A2 forts lents (τ ≥ 30) | modes faibles retrouvés | A3 médiane |log τ̂/τ| | imprécises / monde | s / monde |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| P1 (τ continu + pari invariant) | 1/33 (IC haut 15 %) | 16/16 | 0.04 | 69 % (52) | 64 % (25) | 27 % (22) | 0.10 | 1.02 | 4.52 |
| Grille v5 (τ ∈ {3,3 ; 10 ; 33} + même pari) | 0/33 (IC haut 10 %) | 16/16 | 0.06 | 35 % (52) | 24 % (25) | 23 % (22) | 0.17 | 1.51 | 0.27 |
| Facteur de Bayes naïf (meilleur τ, log BF > 3) | 15/33 (IC haut 62 %) | 16/16 | 0.45 | 71 % (52) | 68 % (25) | 23 % (22) | 0.14 | 1.10 | 1.23 |

A2 apparié (P1 − grille v5, modes forts lents) : 40 ± 23 points (25 modes).

## Verdicts (critères de PROTOCOLE_P1.md)

- B1 (≤ 10 %, borne haute ≤ 15 %) : 3.0 %, borne 15.3 % ❌
- B2 (≤ 0,10 / monde) : 0.039 ✅
- A1 (≥ 60 %) : 69 % ✅
- A2 (≥ 50 % et > grille) : 64 %, différence 40 ± 23 ✅
- Abandon (B1 échoue ou A1 < 40 %) : **OUI**
