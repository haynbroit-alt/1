# Prototype P3 (CORTEX v6) — choisir ses propres expériences pour confirmer une forme (composant D)

**Statut** : protocole écrit **avant** le code. Développement sur les graines 1 à 100 ; gel ; exécution **unique** sur les graines 5001 à 5400. P1 (`ea4d1fb`), P2 (`1121b10`) et GALILÉE (`be42b7e`) sont utilisés sans modification de leur logique.

## La question
Dans P2, GALILÉE proposait souvent la **bonne structure** (`u1·u0/4` pour 0,3·u₀·u₁, des cosinus pour u₀²), mais elle n'était confirmée que dans **1 cas sur 25**. Ma cause supposée, non vérifiée : sur les 93 jours de C, les leviers (tirés au hasard par blocs) ne varient pas assez pour départager la formule et le modèle. P3 teste deux choses :
- **la cause** (plafond oracle sous chaque plan d'expériences) ;
- **le remède** : CORTEX choisit les réglages de C là où la formule et le modèle **divergent le plus**, le principe même de GALILÉE, transposé à des journées d'exploitation et **à budget égal**.

## Dispositif
- Mondes de P2 restreints à deux classes (graine paire : compris ; impaire : forme). A et B sont identiques à P2 : mêmes données, même sonde, même appel à GALILÉE, donc **même formule** pour tous les plans. Seuls les leviers de C (jours 272 à 364) changent, et le monde est re-simulé avec eux. Rien avant le jour 272 ne change, par causalité.
- **Plans d'expériences sur C** :
  - **passif** : les blocs aléatoires de P2 ;
  - **habitude** : leviers fixés à (0, 0) ;
  - **actif** : 13 blocs de 7 jours. Chaque bloc prend le réglage, parmi u₀ ∈ {−1 ; −0,5 ; 0 ; 0,5 ; 1} × u₁ ∈ {0, 1}, qui maximise la part de variance de la formule **non expliquée** par la nuisance (constante, u₀, u₁) sur le plan déjà choisi (plan D-optimal glouton pour le coefficient de la formule).
  - **Budget** : la moyenne de |u₀| sur C reste ≤ 0,5 et la part de jours avec u₁ = 1 reste ≤ 0,3. Ce sont les valeurs attendues du plan passif.
- Le plan actif est fixé **avant** C. Il ne dépend que de la formule, elle-même figée avant C. Le pari invariant sur C reste donc un e-processus valide.

## Hypothèses et critères (fixés d'avance)
| | Critère | Seuil |
|---|---|---|
| **D1** | formes signalées par la sonde, avec une formule non constante : part confirmée sur C, plan actif | ≥ 50 % **et** supérieure au plan passif (différence appariée, IC95 > 0) |
| **D2** | fausses confirmations sous le plan actif : formules apprises sur des écarts mélangés (mondes forme) et formules forcées dans les mondes compris | ≤ 10 %, borne haute de Wilson ≤ 15 % |
| **D3** | budget respecté par le plan actif | moyenne de \|u₀\| ≤ 0,5 et part u₁ ≤ 0,3 |
| D4 | plafond oracle : la **vraie** forme jugée sur C, sous chaque plan | rapporté ; il vérifie la cause supposée |
| D5 | plan habitude : part confirmée | rapportée |

**Critère d'abandon** : si D2 échoue, un plan adaptatif mal construit casse la garantie, et le composant D est rejeté sous cette forme.

**Hors du champ de P3, prévu pour P4** : plans d'expériences pour les modes lents (paliers maintenus), et arbitrage avec le profit.

## Journal de développement (graines 1 à 100 ; hypothèses et seuils inchangés)
1. **D2 était impossible à mesurer tel que défini.** Sur des écarts mélangés et dans les mondes compris, GALILÉE ne rend **que des constantes** (100 sur 100). Elles ne sont pas testables, donc jamais confirmées. Pour éprouver la garantie sous plan adaptatif, D2 inclut désormais des **formules non constantes injectées**, fausses par construction, dans les mondes compris : u₀², |u₀|, u₀·u₁, cos(π·u₀), u₀³, u₀²·u₁, deux par monde. Chacune est jugée sous un plan actif construit **pour la confirmer**.
2. **Le plan glouton (bloc par bloc) était défectueux.** Il dépensait tout le budget de u₁ dès les premiers blocs, au même u₀, ce qui rendait u₀·u₁ exactement colinéaire à la nuisance : log E ≈ 0 pour toutes les interactions, même l'oracle. Il est remplacé par une **optimisation du plan entier** (échanges simples et par paires, type Fedorov), avec trois départs faisables et variés.

| Développement (100 mondes) | Passif | Habitude | Actif (glouton) | Actif (plan entier) |
|---|---:|---:|---:|---:|
| Formules de GALILÉE confirmées (9) | 22 % | 0 % | 44 % | **100 %** |
| Plafond oracle, plan pour la vraie forme | — | — | 20 % | 60 % |
| Fausses confirmations, formules injectées | — | — | 1/100 | 1/100 |

**Commande de test (exécution unique)** : `node research/v6/p3.js --seeds 5001-5400` en 4 tranches parallèles, puis `node research/v6/p3-report.js research/v6/p3-test.json --md research/v6/RESULTATS_P3.md`.
