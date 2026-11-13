# Évaluation pré-enregistrée n° 3 — 540 années simulées, graines 301–330

## Profit (% de l’oracle jour par jour ; > 100 % possible quand l’activité a un état)

| Politique | ferme | hotel | atelier |
|---|---:|---:|---:|
| Oracle (jour par jour, vraie dynamique) | 100.0 | 100.0 | 100.0 |
| Habitude | 63.1 | 93.3 | 62.7 |
| CORTEX v3 (gelée) | 50.0 | 90.9 | 75.0 |
| CORTEX v4 | 50.3 | 91.4 | 74.2 |
| v4 sans planification | 50.1 | 91.0 | 76.4 |
| v4 sans variables construites | 49.9 | 90.9 | 74.4 |

## Erreur du modèle du monde (RMS du log, 7 jours à l’avance)

| Politique | ferme | hotel | atelier |
|---|---:|---:|---:|
| CORTEX v3 (gelée) | 0.334 | 0.198 | 0.543 |
| CORTEX v4 | 0.328 | 0.182 | 0.541 |
| v4 sans planification | 0.328 | 0.190 | 0.559 |
| v4 sans variables construites | 0.338 | 0.193 | 0.554 |

## Hypothèses

| Hypothèse | Différence appariée (IC95) | Verdict |
|---|---:|---|
| H1 profit v4 > v3 | +1457 ± 7250 | ❌ non confirmée |
| H2 profit v4 > habitude | -6390 ± 9973 | ❌ non confirmée |
| H3 erreur v4 < v4 sans variables construites | -0.011 ± 0.033 | ❌ non confirmée |
| H4 profit v4 > v4 sans planification | +56 ± 4895 | ❌ non confirmée |
| ↳ ferme : H1 profit v4 > v3 | +366 ± 1813 | ❌ |
| ↳ ferme : H2 profit v4 > habitude | -18557 ± 6795 | ❌ |
| ↳ ferme : H3 erreur v4 < v4 sans variables construites | -0.010 ± 0.011 | ❌ |
| ↳ ferme : H4 profit v4 > v4 sans planification | +199 ± 385 | ❌ |
| ↳ hotel : H1 profit v4 > v3 | +6231 ± 18845 | ❌ |
| ↳ hotel : H2 profit v4 > habitude | -28023 ± 23167 | ❌ |
| ↳ hotel : H3 erreur v4 < v4 sans variables construites | -0.010 ± 0.019 | ❌ |
| ↳ hotel : H4 profit v4 > v4 sans planification | +5497 ± 12609 | ❌ |
| ↳ atelier : H1 profit v4 > v3 | -2225 ± 10979 | ❌ |
| ↳ atelier : H2 profit v4 > habitude | +27411 ± 9997 | ✅ |
| ↳ atelier : H3 erreur v4 < v4 sans variables construites | -0.013 ± 0.099 | ❌ |
| ↳ atelier : H4 profit v4 > v4 sans planification | -5529 ± 7307 | ❌ |

## Découverte des mécanismes cachés, par classe de représentabilité

| Activité | Mécanisme | Classe | v3 | v4 | v4 sans planif. |
|---|---|---|---:|---:|---:|
| ferme | L’arrosage rapporte d’autant plus qu’il fait chaud | représentable | 0/30 | 2/30 | 2/30 |
| ferme | Arroser un jour de pluie ne sert presque à rien | représentable | 0/30 | 1/30 | 2/30 |
| ferme | Attaque de pucerons (20 jours) | représentable | 13/30 | 11/30 | 12/30 |
| ferme | La fertilité du sol se construit lentement avec l’engrais (mémoire λ = 0,93) | approximable | 0/30 | 0/30 | 0/30 |
| ferme | Trois jours de suite d’arrosage fort font pourrir les racines | approximable | 0/30 | 1/30 | 0/30 |
| ferme | Plafond caché : un cueilleur ne ramasse pas plus de 70 kg | approximable | 20/30 | 19/30 | 18/30 |
| hotel | Saison touristique | représentable | 20/30 | 21/30 | 21/30 |
| hotel | Un hôtel concurrent ferme pour travaux | représentable | 7/30 | 5/30 | 5/30 |
| hotel | Une promotion répétée perd son effet (mémoire λ = 0,9 de la promotion) | représentable | 0/30 | 4/30 | 2/30 |
| hotel | Réputation : mémoire lente (λ = 0,97) de la satisfaction des clients | hors de portée | 0/30 | 0/30 | 0/30 |
| hotel | La satisfaction dépend du personnel PAR chambre occupée (rapport à une autre mesure) | hors de portée | 0/30 | 1/30 | 1/30 |
| atelier | Un concurrent ouvre : moins de demandes | représentable | 10/30 | 9/30 | 6/30 |
| atelier | Fatigue : les heures supplémentaires des jours précédents multiplient les retours (mémoire λ = 0,7) | représentable | 0/30 | 0/30 | 0/30 |
| atelier | File d’attente cachée : les réparations du jour dépendent du stock de pannes en attente | hors de portée | 0/30 | 1/30 | 2/30 |
| atelier | Les clients fuient quand l’attente s’allonge (attente cachée) | hors de portée | 0/30 | 1/30 | 2/30 |

| Classe | v3 | v4 |
|---|---:|---:|
| représentable | 50/240 (21 %) | 53/240 (22 %) |
| approximable | 20/90 (22 %) | 20/90 (22 %) |
| hors de portée | 0/120 (0 %) | 3/120 (3 %) |

**H5** (v4 découvre ≥ 50 % des mécanismes représentables) : 22 % → ❌ non confirmée

## Fausses découvertes (croyances ne correspondant à aucun mécanisme caché, ni par famille ni par date)

| Politique | ferme | hotel | atelier | dont « mémoire »/« interaction » (v4) |
|---|---:|---:|---:|---:|
| CORTEX v3 (gelée) | 0.23 | 1.87 | 9.03 |  |
| CORTEX v4 | 0.40 | 1.97 | 11.60 | 0.51 |
| v4 sans planification | 0.47 | 2.13 | 11.13 |  |

**H6** (≤ 2 fausses découvertes par an et par activité pour v4) : pire activité 11.60 → ❌ non confirmée

## Stratégies adoptées par v4 (jours d’activation des leviers discrets, moyenne par an)

- ferme : cueilleurs 184 j (myope : 183 j) · irrigation 5 j (myope : 10 j) · engrais 4 j (myope : 4 j)
- hotel : personnel 25 j (myope : 24 j) · promo 273 j (myope : 281 j)
- atelier : techniciens 151 j (myope : 160 j) · heuresSup 118 j (myope : 122 j)

## Temps de calcul (s par année simulée)

- CORTEX v3 (gelée) : 13.8 s
- CORTEX v4 : 29.5 s
- v4 sans planification : 24.5 s
- v4 sans variables construites : 12.7 s
