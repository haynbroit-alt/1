# Protocole pré-enregistré n° 4 — CORTEX v5 et les quatre capacités manquantes

**Ordre des opérations (vérifiable dans git) :**
1. **Commit A** — le commit intitulé « GEL de CORTEX v5 (commit A, corrigé) ». Un premier gel (`c4581de`) échouait au test d'audit, à cause du mot « stock » dans l'étiquette des variables inventées ; seule cette étiquette a changé, aucun comportement. Dans ce commit : le cerveau `src/core/` (v5) est **gelé**. La v4 est conservée telle quelle dans `src_v4/` (identique à `a7d0da6`). Aucune activité d'évaluation n'existe.
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
- **inventable** : un accumulation ou une mémoire de mesure que seul le générateur C2 peut construire ;
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

## Commit B — les trois activités inconnues (écrites après le gel, `git diff a03ba73 B -- src/core` vide)
| Activité | Mécanisme caché | Classe | Clé attendue |
|---|---|---|---|
| **brasserie** (`src/bodies/brasserie.js`) | sensibilité au prix accrue à une date tirée entre 160 et 210 (élasticité −1,4 → −2,2) | représentable | `slope:prix` (date ±14 j) |
| | une dégustation attire encore du monde les jours suivants (λ = 0,7) | représentable | `adstock`/`memory:ema7·9:degustation` |
| | réputation cachée : mémoire lente (λ = 0,9) des plaintes, qui fait fuir les clients | **inventable** | variable inventée « mémoire lente des plaintes » (λ quelconque) |
| | régime caché à deux états (±22 %), bascules aléatoires (≈ 1 / 45 j) | **hors de portée** | aucune ; les croyances de niveau/volatilité datées à ±14 j d'une bascule ne sont pas comptées fausses |
| **centre** d'appels (`centre.js`) | campagne d'un client : +35 % d'appels à une date tirée entre 110 et 170 | représentable | `level` (date ±14 j) |
| | formation : productivité accrue qui s'estompe (λ = 0,9) | représentable | `memory:ema9·7:formation`, `adstock:formation` |
| | file d'attente cachée : accumulation amortie (λ = 0,9) des appels reçus − traités, qui multiplie les abandons (saturée) | **inventable** à une normalisation et une saturation près | variable inventée « appels reçus − traités » |
| **vélos** (`velos.js`) | cycle annuel (±35 %) | représentable | `season` |
| | concurrent à 15 € à une date tirée entre 140 et 200 : au-delà, −35 % | représentable | `threshold:prix` (date ±14 j) |
| | bouche-à-oreille : mémoire très lente (λ = 0,97) des locations (flotte bornée à 120, locations censurées) | **inventable** | variable inventée « mémoire lente des locations » |
| | pannes croissantes avec les jours sans réparateur, saturées à 25 j | approximable | `memory:since:reparateur` |

La traduction des variables inventées en clés `memory:invN` est faite par `src/bodies/_invkeys.js`, qui réplique l'ordre du générateur gelé. Elle est vérifiée sur l'atelier : `inv3` = « demandes − réparations ».

**Contrôles faits avant toute exécution du cerveau** (oracle et habitude seulement, graines 1 à 3) :
- **centre** : l'habitude perdait 350 k€/an, à cause de l'effet exponentiel non borné de la file. L'effet a été saturé et l'habitude passée à 7 agents. L'oracle forme un jour sur trois, le meilleur rythme sur la vraie dynamique.
- **vélos** : le bouche-à-oreille divergeait à bas prix. La flotte a été bornée à 120 et le coefficient ramené de 0,4 à 0,25. L'oracle myope restait sous l'habitude ; il reçoit un prix « patient » (équilibre du bouche-à-oreille) et un intervalle de réparation optimal.
- **brasserie** : rien à corriger. La dégustation n'est pas rentable pour l'oracle ; c'est voulu, et cela mesure le coût de l'exploration.

**Analyse** : `bench/v5-test-report.js`, écrit avant l'exécution. Définitions retenues :
- E2b compare, année par année, le nombre de mécanismes inventables découverts.
- E4b compare la moyenne, par année, des jours d'incompréhension par mesure : brasserie contre centre et vélos (différence non appariée, IC95).
- Les mécanismes hors de portée sont exclus du score de découverte.
