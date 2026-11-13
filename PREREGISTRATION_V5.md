# Protocole pré-enregistré n° 4 — CORTEX v5 et les quatre capacités manquantes

**Ordre des opérations (vérifiable dans git) :**
1. **Commit A**, celui qui contient ce fichier : le cerveau `src/core/` (v5) est **gelé**. La v4 est conservée telle quelle dans `src_v4/` (identique à `a7d0da6`). Aucune activité d'évaluation n'existe.
2. **Commit B** : trois activités nouvelles, écrites après le gel et conçues **différemment** des activités de développement, sans modification de `src/core/`. On le vérifie avec `git diff A B -- src/core`, qui doit être vide.
3. Exécution unique sur les **graines 401 à 430**, jamais utilisées, puis publication de tout.

## Les quatre capacités et leur état au gel
| Capacité | Mécanisme v5 | État après développement |
|---|---|---|
| C1 explorer une option prometteuse mais incertaine | bonus égal à l'incertitude (entre mondes plausibles) de l'avantage d'une option ; borné (jamais contre une stratégie planifiée, 1 essai/semaine/option, coût ≤ 10 %) | **actif** |
| C2 inventer des variables cachées | générateur de dynamiques latentes : z ← λz + (1−λ)·Σ wₖuₖ sur 1 ou 2 sources (mesures, leviers), λ ∈ {0,9 ; 0,97} | **actif** |
| C3 remettre en cause une stratégie | détecteur de dérive du résultat et vieillissement de l'information | **désactivé** (il nuisait en développement : −30,6 ± 28,6 k€/an) ; évalué en variante |
| C4 dire « je ne comprends pas » | test d'adéquation (le modèle bat-il un prolongement naïf ?) ; en cas d'échec, plus d'empilement d'explications et une incertitude élargie | **actif** |

## Politiques comparées
Oracle (jour par jour, vraie dynamique ; ce n'est pas une borne supérieure quand l'activité a un état) · Habitude · v3 gelée · **v4 gelée** · **v5** · v5 sans C1 · v5 sans C2 · v5 sans C4 · v5 avec C3.

## Mesures
Les mêmes que le protocole n° 3 : profit, erreur du modèle à 7 jours, découverte des mécanismes cachés (famille, mesure, date), fausses découvertes, temps de calcul. Une mesure s'ajoute : les **jours d'incompréhension** déclarés par mesure.

Les mécanismes cachés sont classés à l'avance dans le commit B en quatre classes :
- **représentable** : grammaire de la v4 ;
- **inventable** : un stock ou une mémoire de mesure que seul le générateur C2 peut construire ;
- **approximable** ;
- **hors de portée**.

## Hypothèses (différences appariées, IC95, sur les trois nouvelles activités)
- **G1** : profit de v5 > profit de v4.
- **G2** : profit de v5 > profit de l'habitude.
- **E1 (C1)** : profit de v5 > profit de v5 sans C1.
- **E2 (C2)** : erreur du modèle de v5 < erreur de v5 sans C2, et v5 découvre plus de mécanismes « inventables » que v4.
- **E4 (C4)** : fausses découvertes de v5 < fausses découvertes de v5 sans C4.
- **E4b (C4)** : les jours d'incompréhension par mesure sont plus nombreux dans les activités qui contiennent un mécanisme **hors de portée** que dans celles qui n'en contiennent pas (comparaison descriptive, rapportée).
- **S (garde-fou)** : au plus 2 fausses découvertes par an et par activité pour v5.
- C3 (v5 avec C3 contre v5) est rapportée sans hypothèse de succès.

Commande : `node bench/transfer.js --seeds 401-430 --bodies <3 activités> --policies oracle,habit,v3-gele,v4-gele,v5,v5-sansC1,v5-sansC2,v5-sansC4,v5-avecC3 --out bench/v5-test.json`
