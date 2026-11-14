# Prototype P4 — 960 années simulées, graines 1–20

## Profit (% de l’oracle patient)

| Bras | τ 33, c 0 | τ 33, c 0.25 | τ 60, c 0 | τ 60, c 0.25 | τ 120, c 0 | τ 120, c 0.25 |
|---|---:|---:|---:|---:|---:|---:|
| oracle-patient | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| oracle-patient-j30 | 98.7 | 99.1 | 98.7 | 99.1 | 98.7 | 99.2 |
| oracle-myope | 100.0 | 85.3 | 100.0 | 88.2 | 100.0 | 94.6 |
| habitude | 86.6 | 92.2 | 86.6 | 93.5 | 86.6 | 96.4 |
| E0P0 | 98.3 | 86.1 | 98.3 | 88.7 | 98.3 | 94.8 |
| E1P0 | 97.1 | 86.5 | 97.1 | 89.5 | 97.1 | 95.5 |
| E0P1 | 96.0 | 90.1 | 96.0 | 90.9 | 96.0 | 94.9 |
| E1P1 | 96.1 | 90.0 | 96.1 | 91.3 | 96.1 | 95.6 |

## Hypothèses (points de % de l’oracle patient, différences appariées, IC95)

| Hypothèse | Différence | Verdict |
|---|---:|---|
| H1 la patience a besoin du savoir : E1P1 − E1P0, c = 0,25, τ ∈ {33, 60} | +2.64 ± 0.74 | ✅ |
| H2 le savoir a besoin de l’exploration : E1P1 − E0P1, c = 0,25, τ ∈ {33, 60} | +0.15 ± 0.98 | ❌ |
| H3 τ = 33 : moyenne sur c de (E1P1 − E0P1) | +0.01 ± 1.07 | ❌ |
| H3 τ = 60 : moyenne sur c de (E1P1 − E0P1) | +0.24 ± 0.97 | ❌ |
| H4 (prédiction, rapportée) τ = 120 : moyenne sur c de (E1P1 − E0P1) ≤ 0 | +0.42 ± 0.89 | ❌ |

Abandon (H1 et H2 échouent toutes deux) : non

## Rapporté (H5, H6)

| Cellule | coût de l’exploration à c = 0 (E1P1 − E0P1) | E1P1 − habitude | E1P1 − oracle myope | E1P1 − oracle patient après j30 | élasticité LT apprise au j180 (E1P1 / E0P1) | vraie |
|---|---:|---:|---:|---:|---:|---:|
| τ 33, c 0 | +0.10 ± 1.38 | +9.50 ± 1.39 | -3.91 ± 1.34 | -2.65 ± 1.36 | -1.19 / -1.12 | -1.20 |
| τ 33, c 0.25 | — | -2.23 ± 1.18 | +4.75 ± 1.24 | -9.06 ± 1.05 | -1.45 / -1.31 | -1.54 |
| τ 60, c 0 | +0.10 ± 1.38 | +9.50 ± 1.39 | -3.91 ± 1.34 | -2.65 ± 1.36 | -1.19 / -1.12 | -1.20 |
| τ 60, c 0.25 | — | -2.27 ± 1.05 | +3.09 ± 1.09 | -7.84 ± 1.01 | -1.33 / -1.22 | -1.54 |
| τ 120, c 0 | +0.10 ± 1.38 | +9.50 ± 1.39 | -3.91 ± 1.34 | -2.65 ± 1.36 | -1.19 / -1.12 | -1.20 |
| τ 120, c 0.25 | — | -0.74 ± 0.66 | +1.02 ± 0.62 | -3.55 ± 1.07 | -1.24 / -1.18 | -1.54 |
