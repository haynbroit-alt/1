# Prototype P2 (CORTEX v6) — reconnaître ce qu'on ne sait pas exprimer (C), et le faire découvrir par GALILÉE

**Statut** : protocole écrit **avant** le code. Développement sur les graines 1 à 100 ; gel ; exécution **unique** sur les graines 3001 à 3300. Le moteur P1 (`engine.js`, gelé en `ea4d1fb`) sert de modèle. GALILÉE est utilisé **sans modification** (copie gelée de `be42b7e` dans `vendor/galilee`).

## La question
La v5 a échoué au test E4b : son « je ne comprends pas » signalait les mauvaises prévisions, pas les structures hors de portée. P1 a échoué sur les mondes mal spécifiés : il invente un mode lent pour expliquer une rupture. P2 teste une réponse : **une sonde qui cherche, dans les écarts du modèle, une structure prévisible que son langage n'exprime pas**, avec une garantie contre les fausses alarmes. Si cette structure est une forme statique, GALILÉE en propose une formule, qui doit ensuite gagner un pari sur des jours neufs.

## Découpage temporel (aucune donnée n'est réutilisée pour se juger elle-même)
| Segment | Jours | Usage |
|---|---|---|
| **A** | 0 à 179 | P1 découvre les modes (moteur gelé, appliqué aux seuls jours de A) ; modèle ajusté |
| **B** | 180 à 271 | sonde (pari invariant) ; incertitude des paramètres ; GALILÉE apprend sur les écarts de B |
| **C** | 272 à 364 | pari sur la formule de GALILÉE, figée avant C |

## La sonde
Sur B, la nuisance (a priori de Haar à droite) comprend la constante, les jours de semaine, les leviers et les modes figés de A. Les coefficients de ces derniers sont libres sur B. L'alternative est un mélange uniforme sur trois **familles de structure manquante** :
- **forme** : u₀², |u₀|, u₀·u₁, u₀³ ;
- **temps** : fonctions charnières max(0, t − k), avec un nœud tous les 15 jours de B ;
- **mémoire** : la mesure de la veille et sa moyenne sur 7 jours.

« Hors de portée » est déclaré pour une mesure si log E ≥ log(K/α), avec α = 0,10 et K = 3 mesures. La famille gagnante dit **quel type** de structure manque.

**Incertitude des paramètres** (« mal estimé ») : il s'agit de la moyenne, sur B, de la variance prédictive due aux paramètres du modèle ajusté sur A, rapportée à σ̂². Le diagnostic est donc :
- **hors de portée** si la sonde gagne ;
- sinon **mal estimé** si ce rapport dépasse 0,25 ;
- sinon **compris**.

## GALILÉE
Il est appelé pour chaque mesure déclarée hors de portée avec la famille **forme**. Ses données sont les écarts de B (mesure moins prévision du modèle ajusté sur B), en fonction de u₀ et u₁. Sa formule f est figée. Sur C, un pari invariant teste la mesure contre le modèle augmenté de f (coefficient libre) : f est acceptée si E ≥ 1/α.

## Mondes (vérité connue ; classe = graine mod 5)
| Classe | Contenu | Diagnostic attendu sur la mesure touchée |
|---|---|---|
| 0 **compris** | mondes de P1 (0 à 2 modes) | aucun « hors de portée » |
| 1 **forme** | mondes de P1 plus un terme statique sur une mesure : 0,3·u₀², saturation 0,4·u₀/(1+2|u₀|) ou interaction 0,3·u₀·u₁ | hors de portée (forme), puis formule de GALILÉE acceptée |
| 2 **rupture** | rupture de niveau de ±0,2 à ±0,4 à une date dans [190, 260] | hors de portée (temps) |
| 3 **régime** | régime caché à deux états (±0,2), bascule de probabilité 1/30 par jour | hors de portée ; rapporté |
| 4 **flou** | un mode alimenté par un levier qui ne change que 2 fois dans l'année | **pas** « hors de portée » ; « mal estimé » rapporté |

## Hypothèses et critères (fixés d'avance)
| | Critère | Seuil |
|---|---|---|
| **C1** | compris : part des mondes avec au moins un « hors de portée » | ≤ 0,10, borne haute de Wilson ≤ 0,15 |
| **C2** | forme et rupture : part des mesures touchées déclarées hors de portée | ≥ 60 % chacune |
| **C3** | flou : part des mondes avec au moins un « hors de portée » | ≤ 0,15 |
| **C4** | pouvoir de séparation : AUC du log E de la sonde, mesures touchées contre mesures de mondes compris | ≥ 0,80 |
| C5 | la famille gagnante est la bonne (forme pour forme, temps pour rupture) | rapportée |
| **G1** | forme : formules de GALILÉE acceptées sur C, parmi les mesures où il a été appelé | ≥ 50 %, et l'erreur de prévision sur C baisse (différence appariée, IC95 < 0) |
| **G2** | contamination : GALILÉE appris sur des écarts de B **mélangés** (lignes permutées) ; part des formules acceptées sur C | ≤ 0,10 |
| **G3** | compris : GALILÉE appelé de force sur une mesure au hasard ; part des formules acceptées sur C | ≤ 0,10 |

**Critère d'abandon** : si C1 échoue ou si l'AUC (C4) est inférieure à 0,70, la sonde est rejetée sous cette forme, et je le publie.

## Journal de développement (graines 1 à 100 ; hypothèses, seuils et mondes inchangés)
1. **Fenêtre B trop courte** : 92 jours, avec des leviers changés par blocs, laissaient 5 à 7 valeurs distinctes de u₀. La sonde opère désormais sur **A ∪ B** (jours 28 à 271). La nuisance y comprend la famille des modes appris sur A (sources filtrées à τ̂/1,5, τ̂ et τ̂·1,5, coefficients libres). C reste intact pour juger GALILÉE. Cette réutilisation de A ne peut que rendre la sonde **plus prudente** ; C1 le vérifie. A est ramené aux jours 0 à 149.
2. **Une structure exprimable mais non apprise** (classe flou, et modes manqués par P1) était déclarée « hors de portée ». Une famille **« langage du modèle »** a donc été ajoutée : un mode à 1 ou 2 sources, avec τ ∈ {5, 15, 40, 100, 200}.
3. **Existence et attribution séparées.** L'existence d'une structure manquante est le pari garanti (mélange sur toutes les familles, seuil log(K/α)). L'attribution compare le meilleur modèle de chaque famille. Le diagnostic « hors de portée » exige que le langage du modèle **ne l'emporte pas**. Une règle intermédiaire (« ce qui reste après la meilleure extension du langage ») a été essayée puis rejetée : avec 75 modes candidats, une rupture de niveau est presque toujours imitée par un mode lent (1 sur 20 déclarée). C'est l'échec de P1 en monde mal spécifié qui réapparaît.
4. **GALILÉE** : moyenner les écarts par réglage de levier l'a rendu **pire** (constantes presque toujours). Ce changement a été retiré ; GALILÉE reçoit les écarts quotidiens.
5. **Plafond oracle** (ajouté au rapport, sans effet sur les critères) : une sonde munie de la **vraie** formule en colonne libre ne franchit le seuil que pour 7 mesures touchées sur 20 en classe forme. La forme « saturation » (tirée dans 11 mondes sur 20) est **indétectable même par l'oracle** : sur u₀ ∈ [−1, 1], le terme linéaire du levier l'absorbe presque entièrement. C'est un défaut de conception du protocole ; il est **conservé**, puisque pré-enregistré, et rapporté avec le plafond. **C2 (forme ≥ 60 %) est donc probablement hors d'atteinte par construction.**

| Développement (100 mondes) | Résultat |
|---|---|
| compris, fausses alarmes | 1/20 |
| forme | 7/20, égal au plafond oracle de 7/20 |
| rupture | 14/20 |
| régime | 3/20 |
| flou | 0/20 |
| AUC | 0,82 |
| GALILÉE, formules acceptées | 1/7 |
| contamination (G2) | 0/20 |
| compris forcé (G3) | 0/20 |

**Commande de test (exécution unique)** : `node research/v6/p2.js --seeds 3001-3300` en 4 tranches parallèles, puis `node research/v6/p2-report.js research/v6/p2-test.json --md research/v6/RESULTATS_P2.md`.
