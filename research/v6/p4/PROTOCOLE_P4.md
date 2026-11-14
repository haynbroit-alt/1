# Prototype P4 (CORTEX v6) — explorer par paliers et piloter avec patience, en boucle fermée, le profit pour juge

**Statut** : protocole écrit **avant** le code. Développement sur les graines 1 à 20 ; gel ; exécution **unique** sur les graines 9001 à 9030, jamais utilisées. Ni `src/` ni les prototypes P1 à P3 ne sont modifiés. Le GARDIEN de budget prévu par `CLAUDE.md` (`../Tr`) est absent de ce conteneur ; le coût est donc tenu bas par construction (bras d'apprentissage de quelques millisecondes par jour, pas de v5 dans la grille).

## Pourquoi
- **La v5 échoue sur les vélos (49 % de l'oracle).** La cartographie (diagnostic sur des graines de développement) en a établi les causes : la v5 fixe son prix **jour par jour**, à l'optimum à un jour (≈ 18 €), et son modèle n'apprend pas le bouche-à-oreille. Elle reste au-dessus du seuil de 15 € et répare trop peu. Avec le **vrai** modèle, une politique myope perd encore 4 à 12 points par rapport à l'oracle patient, et une politique patiente sur un modèle **sans** effet lent n'est que myope.
- **Le rapport de recherche** (`reports/Exploration des effets lents.md`, bornes de Cramér–Rao sous bruit blanc) prédit trois choses :
  - un palier aller-retour d'environ 90 jours, lancé vers le jour 30, rend l'effet lent identifiable ;
  - il est rentable pour τ ≈ 30 jours, l'est de moins en moins pour τ ≈ 60, et ne l'est plus pour τ ≈ 120 ;
  - ce qui décide, c'est le **gain lent** (l'élasticité de long terme), pas τ.

P4 met ces prédictions à l'épreuve en **boucle fermée**, avec le profit pour seul juge.

## Mondes : « vélos à τ réglable »
Ce sont des copies paramétrées de `src/bodies/velos.js`, avec le même bruit pré-tiré par graine : tous les bras voient les mêmes aléas (nombres aléatoires communs). Ils conservent la demande en log, le jour de semaine, le cycle annuel de ±35 % de phase inconnue, l'élasticité courte de −1,2, la flotte bornée à 120 (locations censurées) et les pannes. Les paramètres :
- **τ ∈ {33, 60, 120} jours** pour le bouche-à-oreille, M ← λ·M + (1−λ)·locations, avec λ = 1 − 1/τ ;
- **c ∈ {0 ; 0,25}** pour l'effet de M sur la demande. c = 0 donne un monde **sans** effet lent, et l'exploration y est pure perte.

Le seuil concurrent de 15 € est **retiré**, car il masquerait la question : la cartographie l'identifie comme la première cause de perte de la v5, et un bras pourrait gagner simplement en le franchissant. Les réparations suivent, pour **tous** les bras, l'intervalle optimal calculé sur la vraie dynamique : elles ne font pas partie de la question. Cela donne 6 cellules et 30 graines de test par cellule.

## Bras (mêmes graines, même bruit)
| Bras | Prix |
|---|---|
| **oracle patient** (référence = 100 %) | prix qui maximise le profit à l'équilibre du bouche-à-oreille sous ce prix, à la saison courante (vraie dynamique) |
| oracle myope | optimum à un jour sur la vraie dynamique |
| habitude | 12 € |
| **E0P0** | apprenant, sans palier, commande myope |
| **E1P0** | apprenant, palier, commande myope |
| **E0P1** | apprenant, sans palier, commande patiente |
| **E1P1** | apprenant, palier, commande patiente |

**Apprenant commun.** C'est un modèle conjugué (normal–gamma inverse), mis à jour chaque jour, du log des locations. Les jours censurés sont exclus de l'ajustement, faute de traitement de la censure (limite assumée).
- **Régresseurs** : constante, jours de semaine, sin et cos annuels, x = log(prix/12), plus au plus un **mode lent**. Le mode est une source filtrée à τ_m (grille log de 5 à 250 jours, normalisée comme dans P1) : soit le prix (mode « alimenté par le levier »), soit les locations passées (mode « alimenté par la mesure »).
- **Moyennage** sur les modèles, poids ∝ vraisemblance marginale. L'a priori met la moitié de sa masse sur « pas de mode » et répartit l'autre moitié uniformément entre les modes candidats.

**Facteur E, l'exploration.** Tous les bras jouent 12 € du jour 0 au jour 29.
- **E1** tient ensuite un **palier à 10 € du jour 30 au jour 119**, soit 90 jours (règle robuste du rapport pour τ inconnu), puis rend la main à la commande.
- **E0** rend la main à la commande dès le jour 30.

Après le jour 29 (E0) ou le jour 119 (E1), tous les bras apprenants ajoutent une petite variation de ±1 € qui alterne chaque jour.

**Facteur P, la commande.**
- **P0 (myope)** maximise l'espérance du profit **du jour**. Le prix du jour n'agit pas sur l'état lent du jour.
- **P1 (patiente)** maximise l'espérance du profit **à l'équilibre** : le régime permanent du modèle sous ce prix tenu (gain statique de la source filtrée), moyenné sur les modèles et recalculé chaque jour à la saison courante.

## Hypothèses et critères (fixés d'avance ; différences appariées, IC95 sur les graines)
| | Critère |
|---|---|
| **H1** la patience a besoin du savoir | c = 0,25, τ ∈ {33, 60} réunis : profit E1P1 − E1P0 > 0 |
| **H2** le savoir a besoin de l'exploration | c = 0,25, τ ∈ {33, 60} réunis : profit E1P1 − E0P1 > 0 |
| **H3** l'exploration vaut son coût quand on ignore si l'effet existe (a priori 50/50 sur c) | à τ = 33 **et** à τ = 60 : la moyenne sur c ∈ {0 ; 0,25} de (E1P1 − E0P1) est > 0 |
| H4 (prédiction du rapport, rapportée) | à τ = 120, la quantité de H3 est ≤ 0 : il vaut mieux renoncer |
| H5 (rapportée) | c = 0, coût de l'exploration E1P1 − E0P1 en % de l'oracle ; c = 0,25, élasticité de long terme apprise au jour 180 face à la vraie |
| H6 (rapportée) | E1P1 face à l'habitude et à l'oracle myope, par cellule |

**Critère d'abandon** : si H1 et H2 échouent toutes deux, la combinaison « paliers + commande patiente » est rejetée sous cette forme.

## Journal de développement (graines 1 à 20 ; hypothèses et seuils inchangés)
1. **Le palier unique est confondu avec la saison.** Avec le palier prévu (10 € des jours 30 à 119), les bras E1 perdaient 9 à 11 points dans les mondes **sans** effet lent, et ne gagnaient rien dans les mondes avec effet. Diagnostic sur 5 graines : sans le cycle annuel, le même palier donne E1P1 92,0 % contre 88,1 % pour E0P1 (τ = 33, c = 0,25) ; avec la saison, 85,4 % contre 89,0 %. Avec moins d'un an de données, un seul palier long ne se distingue pas du sinus annuel, et l'élasticité apprise est biaisée (−1,55). Les bornes de Cramér–Rao du rapport supposaient un bruit blanc : un facteur de confusion lisse demande plusieurs bascules. **E1 devient** une onde carrée de **demi-période 45 jours, du jour 30 au jour 209, à ±20 % du prix recommandé** au début de chaque créneau. Dans les mondes sans effet, ce plan coûte 0 à 1 point (contre 9 à 11). Une onde de demi-période 30 jours a été essayée ; elle n'est pas meilleure.
2. **Référence ajoutée** : l'oracle patient **après** la même période de 12 € (jours 0 à 29) que les apprenants. Il fait 98,7 à 99,2 % de l'oracle patient.
3. **Diagnostic « structure connue »** (option `only` de l'apprenant, développement seulement, non utilisée en test) : connaître la vraie structure n'apporte que 0,7 à 1,4 point. L'écart restant (environ 9 points à τ = 33) est le coût d'apprendre un effet qui ne paie que lentement, pas une incertitude de structure.
4. **Bras sans exploration délibérée** : le passage de 12 € au prix de la commande au jour 30 est déjà une marche. E0 n'est donc pas « sans excitation ». C'est voulu (aucun bras ne commence avec un modèle), et cela sera rapporté.

| Développement (20 graines) | Résultat |
|---|---|
| H1 | +2,64 ± 0,74 ✅ |
| H2 | +0,15 ± 0,98 ❌ |
| H3 à τ = 33 | +0,01 ± 1,07 ❌ |
| H3 à τ = 60 | +0,24 ± 0,97 ❌ |
| H4 | +0,42 ± 0,89 (non vérifiée) |
| Habitude face à E1P1 (c = 0,25) | l'habitude gagne de 0,7 à 2,3 points |

**Commande de test (exécution unique)** : `node research/v6/p4/run4.js --seeds 9001-9030 --out research/v6/p4/p4-test.json`, puis `node research/v6/p4/report4.js research/v6/p4/p4-test.json --md research/v6/p4/RESULTATS_P4.md`.
