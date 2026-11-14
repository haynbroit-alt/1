# Prototype P4 — 1440 années simulées, graines 9001–9030

## Profit (% de l’oracle patient)

| Bras | τ 33, c 0 | τ 33, c 0.25 | τ 60, c 0 | τ 60, c 0.25 | τ 120, c 0 | τ 120, c 0.25 |
|---|---:|---:|---:|---:|---:|---:|
| oracle-patient | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 |
| oracle-patient-j30 | 98.9 | 99.3 | 98.9 | 99.3 | 98.9 | 99.3 |
| oracle-myope | 100.0 | 84.8 | 100.0 | 87.8 | 100.0 | 94.3 |
| habitude | 86.7 | 92.2 | 86.7 | 93.5 | 86.7 | 96.4 |
| E0P0 | 97.9 | 85.9 | 97.9 | 88.8 | 97.9 | 94.9 |
| E1P0 | 97.2 | 87.4 | 97.2 | 90.1 | 97.2 | 96.0 |
| E0P1 | 95.3 | 89.7 | 95.3 | 90.6 | 95.3 | 94.3 |
| E1P1 | 96.7 | 90.0 | 96.7 | 90.8 | 96.7 | 95.4 |

## Hypothèses (points de % de l’oracle patient, différences appariées, IC95)

| Hypothèse | Différence | Verdict |
|---|---:|---|
| H1 la patience a besoin du savoir : E1P1 − E1P0, c = 0,25, τ ∈ {33, 60} | +1.59 ± 0.65 | ✅ |
| H2 le savoir a besoin de l’exploration : E1P1 − E0P1, c = 0,25, τ ∈ {33, 60} | +0.21 ± 0.93 | ❌ |
| H3 τ = 33 : moyenne sur c de (E1P1 − E0P1) | +0.83 ± 1.44 | ❌ |
| H3 τ = 60 : moyenne sur c de (E1P1 − E0P1) | +0.80 ± 1.34 | ❌ |
| H4 (prédiction, rapportée) τ = 120 : moyenne sur c de (E1P1 − E0P1) ≤ 0 | +1.26 ± 1.17 | ❌ |

Abandon (H1 et H2 échouent toutes deux) : non

## Rapporté (H5, H6)

| Cellule | coût de l’exploration à c = 0 (E1P1 − E0P1) | E1P1 − habitude | E1P1 − oracle myope | E1P1 − oracle patient après j30 | élasticité LT apprise au j180 (E1P1 / E0P1) | vraie |
|---|---:|---:|---:|---:|---:|---:|
| τ 33, c 0 | +1.43 ± 2.20 | +10.07 ± 1.10 | -3.28 ± 1.07 | -2.18 ± 1.07 | -1.17 / -1.22 | -1.20 |
| τ 33, c 0.25 | — | -2.22 ± 1.06 | +5.14 ± 1.01 | -9.30 ± 1.01 | -1.35 / -1.45 | -1.55 |
| τ 60, c 0 | +1.43 ± 2.20 | +10.07 ± 1.10 | -3.28 ± 1.07 | -2.18 ± 1.07 | -1.17 / -1.22 | -1.20 |
| τ 60, c 0.25 | — | -2.78 ± 0.98 | +2.97 ± 0.90 | -8.50 ± 0.97 | -1.23 / -1.30 | -1.55 |
| τ 120, c 0 | +1.43 ± 2.20 | +10.07 ± 1.10 | -3.28 ± 1.07 | -2.18 ± 1.07 | -1.17 / -1.22 | -1.20 |
| τ 120, c 0.25 | — | -0.92 ± 0.85 | +1.13 ± 0.78 | -3.88 ± 1.01 | -1.21 / -1.22 | -1.55 |

## Lecture honnête (rédigée après l'exécution unique ; prototype gelé `587bda8`)
**Ce qui est démontré.**
- **La patience paie, à condition de s'appuyer sur ce qui a été appris (H1 ✅).** Dans les mondes à bouche-à-oreille (τ = 33 et 60), le même apprenant gagne **+1,6 ± 0,7 point** quand il pilote à l'équilibre plutôt qu'au jour le jour.
- **Savoir sans patience ne suffit pas.** L'apprenant patient (E1P1) bat de **3 à 5 points** un oracle **myope qui connaît la vraie dynamique** (τ = 33 et 60). C'est la confirmation, en boucle fermée, du diagnostic de l'échec de la v5 sur les vélos : la cause première est une commande myope, pas un défaut de compréhension.
- **Explorer par créneaux carrés ne coûte presque rien** quand il n'y a rien à trouver (c = 0 : +1,4 ± 2,2 point par rapport à E0P1, et 1,2 point sous E0P0).

**Ce qui échoue.**
1. **L'exploration délibérée n'apporte rien de mesurable (H2 ❌, H3 ❌).** Dans les mondes à effet lent, E1P1 − E0P1 = +0,2 ± 0,9 point. La variation que la commande produit elle-même suffit à l'identification : le passage de 12 € au prix recommandé au jour 30, la petite variation quotidienne, le mouvement vers le prix patient. Les conditions où une exploration délibérée serait nécessaire, comme un levier qui ne bouge jamais de lui-même, ne sont pas réunies dans ces mondes.
2. **La prédiction du rapport de recherche pour τ = 120 (renoncer à explorer) n'est pas vérifiée (H4 ❌)** : +1,3 ± 1,2 point, non significatif. L'onde carrée ne coûte presque rien, si bien qu'il n'y a pas de perte à éviter. Ses autres recommandations chiffrées ont, elles aussi, été mises en défaut en développement : un palier unique long est confondu avec la saison (voir le journal du protocole).
3. **L'habitude (12 € fixes) bat tous les apprenants dans les mondes à effet lent**, de 2,2 à 2,8 points à τ = 33 et 60. L'écart avec l'oracle patient (même période de référence) reste de **8 à 9 points**. C'est le coût d'apprendre un effet qui ne paie que lentement : pendant que l'apprenant hésite, le bouche-à-oreille s'érode, et le reconstruire prend τ jours. Au jour 180, l'élasticité de long terme apprise est encore sous-estimée (−1,35 contre −1,55 à τ = 33).
4. **Limites.**
   - Une seule famille de mondes (les vélos), sans le seuil concurrent et avec les réparations fixées.
   - Les jours censurés sont exclus de l'ajustement.
   - L'apprenant moyenne les modèles mais n'utilise pas le pari de P1.
   - Le bras E0 contient lui aussi une marche au jour 30.

**Conséquence pour la v6.** Le composant « commande patiente » (calcul du régime permanent sur le modèle appris) est **retenu** : il corrige la cause principale de l'échec de la v5 sur les vélos. Le composant « exploration par paliers » n'est **pas justifié par ces données**. Il reste sans danger sous forme d'onde carrée, mais il n'est pas utile tant que la commande fait déjà bouger ses leviers. La question ouverte la plus importante est le coût de l'apprentissage des effets lents : une simple habitude fait mieux pendant la première année. Elle pourrait relever d'un a priori plus prudent ou de la transmission de connaissances d'une année à l'autre ; ce sont des hypothèses non testées ici.
