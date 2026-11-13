# CORTEX — une boucle cognitive qui cherche à découvrir et piloter des activités qu'on ne lui a jamais décrites

CORTEX implémente la boucle **Observer → Comprendre → Confronter → (Hypothèses) → Anticiper → Prioriser → Décider → Simuler → Exécuter | Revue → Mesurer → Apprendre → Réviser → Dreaming ↺** sous forme de moteur bayésien exact, déterministe et testé, **sans LLM à l'exécution et sans intervention humaine** dans le banc d'essai.

L'agent dirige un commerce (prix, commande d'un produit périssable, marketing) sans savoir lequel. Il ne voit que ses propres décisions et ses ventes. Quand il est en rupture de stock, il ne voit pas la demande réelle. Les règles cachées changent au cours de l'année.

## v4 : variables construites et stratégies découvertes — et le test décisif

**Ce qui a été ajouté** (`src/core/`, gelé au commit `a7d0da6`, protocole [`PREREGISTRATION_V4.md`](PREREGISTRATION_V4.md)) :

- **Variables construites par l'agent**, non déclarées par l'activité : mémoire exponentielle de chaque levier, jours depuis la dernière activation, valeur de la veille de chaque mesure, interactions entre variables. La découverte décide seule lesquelles comptent.
- **Planification sur 3 semaines dans le modèle appris**, pour découvrir des calendriers : chaque levier, chaque période, chaque phase. Elle n'intervient que si le modèle contient un mécanisme à état, et le gain doit se confirmer dans des mondes tirés de la postérieure.
- Un audit automatique garantit que le cerveau ne contient aucun mot de métier (`test/audit.test.js`).

### En développement (activités connues et contrôles, graines 1 à 4) — [`bench/V4_CONTROLES_DEV.md`](bench/V4_CONTROLES_DEV.md)

- **Usine** : 73,6 % de l'oracle, contre 24,3 % pour la v3. L'agent découvre seul l'usure (« jours depuis la maintenance », 4/4) et **invente** une maintenance tous les ~11 jours ; l'optimum est d'environ 12.
- **Contrôles** :
  - *placebo* : maintenance inutile, aucune usure inventée (0/4) ;
  - *usure liée à la cadence* : le bon mécanisme est trouvé (4/4), aucune usure liée au temps (0/4) ;
  - *usure qui double au jour 200* : **le calendrier ne s'adapte pas** (11 j au lieu de 8).
- Prévision hors échantillon améliorée par les variables construites : −0,019 ± 0,015.

### Le test décisif : trois activités inconnues, écrites après le gel (graines 301 à 330, 540 années) — [`bench/V4_TEST_RESULTS.md`](bench/V4_TEST_RESULTS.md)

Une **serre maraîchère**, un **hôtel** et un **atelier de réparation** à file d'attente cachée. Leurs mécanismes cachés ont été classés à l'avance en *représentables*, *approximables* ou *hors de portée*.

| Hypothèse pré-enregistrée | Résultat | Verdict |
|---|---|---|
| H1 profit v4 > v3 | +1 457 ± 7 250 € | ❌ |
| H2 profit v4 > habitude | −6 390 ± 9 973 € (serre et hôtel : **pire que l'habitude** ; atelier : mieux) | ❌ |
| H3 les variables construites améliorent la prévision | −0,011 ± 0,033 | ❌ |
| H4 la planification améliore la décision | +56 ± 4 895 € | ❌ |
| H5 ≥ 50 % des mécanismes représentables découverts | **22 %** (v3 : 21 %) | ❌ |
| H6 ≤ 2 fausses découvertes par an et par activité | atelier : **11,6 par an** | ❌ |

**Conclusion honnête : dans des mondes qu'il n'a jamais rencontrés, CORTEX v4 n'a pas démontré qu'il sait apprendre mieux que la v3, ni même mieux qu'une règle fixe simple.** Ses succès sur l'usine ne se sont pas transférés.

### Pourquoi : les causes, lues dans les données du test
1. **Piège de l'exploration.** Dans la serre, l'agent n'arrose que **5 jours par an**, alors que l'habitude arrose chaque jour. Le gain de l'arrosage dépend de la chaleur (une interaction) ; au début, il ne paraît pas rentable, donc l'agent cesse d'arroser et ne peut plus apprendre l'interaction (2/30). Il en va de même pour l'engrais (4 jours par an) : la fertilité qui s'accumule n'est jamais découverte (0/30). La curiosité, qui aurait pu l'éviter, avait été rejetée en développement parce qu'elle n'y aidait pas.
2. **Une stratégie installée sans être remise en cause.** À l'hôtel, la promotion reste active **273 jours par an** alors qu'elle s'use quand on la répète. La lassitude n'est découverte que 4 fois sur 30, et l'agent fait moins bien que l'habitude (sans promotion).
3. **Un modèle faux produit des « découvertes » fausses.** Dans l'atelier, la file d'attente cachée ne peut pas être représentée. L'agent compense par **11,6 explications erronées par an**, et la fatigue, pourtant représentable, n'est jamais trouvée (0/30).
4. **Hors de portée, il reste hors de portée** : réputation lente, rapport à une autre mesure, file d'attente cachée, soit 3/120.
5. Le coût de calcul double (29,5 s par an contre 13,8 s pour la v3) sans bénéfice ici.

### Ce que cela indique pour la suite
Ces limites ne sont pas des réglages : ce sont des capacités manquantes, chacune vérifiable.

- **Une exploration dirigée par la valeur de l'information**, qui continue d'essayer une option prometteuse mais incertaine au lieu de l'abandonner.
- **Des variables latentes vraiment inventées**, par exemple des stocks cachés reconstruits à partir de plusieurs mesures, plutôt que choisies dans une liste.
- **Une remise en cause des stratégies** quand les résultats s'écartent des prévisions.
- **Un contrôle des fausses découvertes quand aucune hypothèse ne convient**, c'est-à-dire savoir dire « je ne comprends pas ».

## v3 : un même cerveau pour des entreprises différentes

**La question posée :** CORTEX peut-il comprendre et piloter un restaurant, une usine ou une entreprise inconnue *sans qu'on lui reconstruise le cerveau* ?

**Ce qui a été construit.** Le cerveau (`src/core/`) est séparé du **corps**. Un corps n'est qu'une *déclaration* :

- ses leviers (continus, discrets, ou de « capacité » comme un stock ou une préparation) ;
- ses informations du matin ;
- ses mesures et les variables qui peuvent les influencer ;
- sa comptabilité (une fonction action, mesures → €).

Le cerveau en déduit tout le reste :

- un modèle bayésien par mesure ;
- une grammaire d'hypothèses **déclencheur × mécanisme × variable quelconque**, avec un déclencheur sigmoïde pour les transitions progressives ;
- des décisions qui maximisent la comptabilité déclarée, par simulation (sans aucune formule de métier) ;
- un apprentissage actif ciblé sur un levier, une sélection d'hypothèses qui tient compte des plafonds, un filtre d'identifiabilité et une narration accordée à la déclaration du corps.

**Protocole** ([`PREREGISTRATION_V3.md`](PREREGISTRATION_V3.md)) :

1. Gel du cerveau au commit `3229694`.
2. **Ensuite seulement**, écriture de deux entreprises jamais vues : une **usine** (cadence, heures supplémentaires, maintenance ; pièces conformes et rebuts ; usure cachée) et un **service d'abonnement** (prix, publicité, essai gratuit ; inscriptions et résiliations ; un mécanisme hors grammaire). `git diff 3229694 9e5683e -- src/core` est vide.
3. Évaluation unique sur les graines 101 à 130 : 1 440 années simulées, aucune intervention humaine.

Résultats complets : [`bench/V3_TEST_RESULTS.md`](bench/V3_TEST_RESULTS.md) · nouveaux corps seuls : [`bench/V3_TEST_NOUVEAUX.md`](bench/V3_TEST_NOUVEAUX.md) · développement : [`bench/V3_DEV_RESULTS.md`](bench/V3_DEV_RESULTS.md)

### Verdict des hypothèses pré-enregistrées

| | Mesure | Verdict |
|---|---|---|
| **T1** gérer une entreprise inconnue (v3 > habitude et ≥ 75 % de l'oracle) | Abonnement : **95,8 %** de l'oracle (habitude 35,1 %). Usine : **25,5 %** (habitude 27,3 %). Moyenne 60,6 % | ❌ **échec** (réussite nette sur l'abonnement, échec sur l'usine) |
| **T2** la compréhension se transfère (v3 > vocabulaire fermé, nouveaux corps) | 56 % contre 49 %, +5,8 ± 5,4 pts | ✅ confirmé, de justesse |
| **T3** modèle du monde plus fidèle (nouveaux corps) | −0,010 ± 0,017 | ❌ non significatif |
| **T4** ≤ 1,5 fausse découverte par an (nouveaux corps) | 3,38 par an | ❌ échec |
| **R1** pas plus de 5 points sous v2 en compréhension (commerce) | −2,4 ± 5,0 pts (borne basse −7,4) | ❌ non démontré |
| **R2** régressions demandées : sensibilité au prix · déclin en S | v1 28/60 · v2 18/60 · **v3 16/60** ; v1 26/30 · v2 12/30 · **v3 14/30** | ❌ **non corrigées** au test, bien que le développement l'ait laissé espérer |

### Ce qui fonctionne
- **Un seul cerveau, inchangé, pilote neuf entreprises différentes**, dont trois sans prix de vente ni stock de pain (restaurant 86,7 %, abonnement 95,8 %). Il atteint le niveau de la v2 spécialisée en compréhension sur l'ensemble (49 % contre 49 %), avec un modèle du monde plus fidèle (0,214 contre 0,242 pour la v1) et +25 points de compréhension face à la v1.
- Sur les entreprises inconnues, il découvre des mécanismes jamais décrits : la **nouvelle équipe de nuit du vendredi** (28/30), le **concurrent qui rend les clients sensibles au prix** (22/30), la panne et le fournisseur défaillant (ruptures de niveau).

### Ce qui échoue, et pourquoi
- **L'usine révèle une limite de fond : CORTEX décide jour par jour.** Une maintenance coûte aujourd'hui et ne rapporte que plus tard ; il n'en fait que 2 par an, l'usure s'accumule et il fait moins bien que l'habitude. Sa grammaire n'a pas non plus de mécanisme d'*usure cumulée depuis la dernière action*. Il l'explique donc à tort par un cycle annuel ou des tendances, ce qui produit l'essentiel des fausses découvertes.
- **L'usure progressive de l'effet publicitaire** (hors grammaire : une sensibilité qui décroît en S) n'est jamais comprise (0/30).
- **Sensibilité au prix et déclin en S** : les corrections (déclencheur sigmoïde, expériences ciblées, identifiabilité) amélioraient le développement mais pas le test.
- Plus de familles signifie plus de concurrence entre explications, d'où des ruptures de niveau un peu moins bien comprises que le vocabulaire fermé (208/330 contre 227/330), et un profit inférieur à celui-ci sur l'ensemble (−2,7 k€ ± 1,6 k€).

### Prochaines étapes que ces résultats désignent
1. **Planifier sur plusieurs jours** (valeur d'un état futur : usure, stock d'abonnés), et pas seulement maximiser la journée.
2. Ajouter à la grammaire des mécanismes **à mémoire longue** (cumul depuis la dernière action d'un levier) et des **sensibilités à transition progressive**.
3. Renforcer le contrôle des fausses découvertes quand le modèle est mal spécifié.

## v2 : de trois explications codées en dur à une grammaire d'explications

La v1 ne savait reconnaître que trois sortes de changements : niveau, élasticité, marketing. La v2 compose ses hypothèses :

**déclencheur temporel** × **mécanisme**

- déclencheur : depuis toujours · à partir du jour τ (avec fin éventuelle) · rampe progressive depuis τ
- mécanisme : constante · prix · prix² · seuil de prix θ · un jour de semaine · marketing · effet retard du marketing (λ) · cycle annuel · pic tous les k jours (phase φ) · volatilité

Cela fait environ 800 explications candidates par enquête. Chacune est comparée par **vraisemblance marginale** avec un **a priori hiérarchique par famille**, ce qui corrige les comparaisons multiples. L'explication retenue est ensuite racontée à partir de sa structure, par exemple : « Depuis le jour 111, le samedi a changé : −39 % de clients ce jour-là ».

Ce qu'il a fallu résoudre :

| Problème rencontré | Solution |
|---|---|
| Les pics de demande tombent **tous** en rupture de stock : l'agent ne les voit jamais | Score « Tobit » : vraisemblance exacte des jours observés × probabilité des ruptures, intégrées par **filtrage à densité supposée (ADF/EP)** |
| Fausses « hausses de volatilité » créées par la troncature | Toute hypothèse de volatilité doit être prouvée sur les seuls jours sans rupture |
| Des changements lents (érosion, saison) ne déclenchent aucune alarme | **Recherche de fond** chaque nuit de « Dreaming », avec un seuil plus strict (P > 99,9 %) |
| Les mécanismes qui ne déplacent pas la moyenne (habitudes, pics) | Troisième détecteur générique : surprise quadratique cumulée (CUSUM sur z² − 1) |
| Une hypothèse calendaire plausible mais masquée par les ruptures | **Expérience de dé-censure** : l'agent commande davantage les jours prédits pour voir la vraie demande (6 jours maximum) |
| Deux tendances qui imitent un cycle annuel | **Requalification nocturne**, y compris vers une composante structurelle |

## Résultats de l'évaluation pré-enregistrée

Le protocole ([`PREREGISTRATION.md`](PREREGISTRATION.md)) a été commité **avant** l'exécution, avec le code figé au commit `3e9e2d1`. Tout le réglage s'est fait sur les graines 1 à 10 ([`bench/DEV_RESULTS.md`](bench/DEV_RESULTS.md)). L'évaluation porte sur les **graines 101 à 130, jamais vues** : 6 environnements × 30 graines × 7 politiques = **1 260 années simulées**. L'environnement `kiosque` n'avait jamais été exécuté auparavant. Ses mécanismes sont hors grammaire : déclin en S, seuil de prix progressif, pics mensuels à date irrégulière.

Résultats complets : [`bench/TEST_RESULTS.md`](bench/TEST_RESULTS.md) · kiosque seul : [`bench/TEST_KIOSQUE.md`](bench/TEST_KIOSQUE.md)

### Hypothèses pré-enregistrées (v2 contre v1 fusionnée et gelée, différences appariées, IC95)

| | v1 | v2 | Différence | Verdict |
|---|---:|---:|---:|---|
| **H1** Changements cachés compris | 23 % | **49 %** | +27,8 ± 6,0 pts | ✅ confirmé |
| **H2** Erreur du modèle du monde (RMS log-demande) | 0,242 | **0,201** | −0,041 ± 0,014 | ✅ confirmé (−17 %) |
| **H3** Fausses découvertes / an, monde calme | 0,20 | **0,07** | ≤ v1 + 0,5 | ✅ confirmé (et 0,74 contre 1,64 sur tous les mondes) |
| **H4** Profit annuel | 82,6 % de l'oracle | **85,3 %** | +2 307 € ± 855 € | ✅ confirmé (v2 gagne 112 années sur 180) |

**Sur l'environnement tenu secret seul (30 graines)** : la compréhension passe de 14 % à 36 % (+21,7 ± 5,2 pts, ✅). En revanche, l'erreur du modèle (−0,015 ± 0,041) et le profit (+1 305 € ± 1 855 €) **ne s'améliorent pas de façon significative**.

### Par famille de changement (compris / présents, test)

| | niveau | élasticité | saison | seuil | jour de sem. | tendance | volatilité | effet retard | pics | déclin en S |
|---|---|---|---|---|---|---|---|---|---|---|
| v1 | 76/120 | **28/60** | 0/60 | 0/60 | 0/60 | 0/30 | 0/60 | 0/30 | 0/60 | **26/30** |
| v2 | 84/120 | 18/60 | **46/60** | 9/60 | **52/60** | **17/30** | 18/60 | 14/30 | 8/60 | 12/30 |

### Ce que les ablations attribuent
- Le gain vient de la **grammaire ouverte**. La v1 avec la nouvelle infrastructure, ou avec les nouveaux détecteurs et la recherche de fond mais un vocabulaire fermé, ne fait pas mieux que la v1 : 22 % de compréhension, pas de gain de profit. Seule la grammaire ouverte produit les +28 points et les +2,3 k€/an.
- « Oublier » (fenêtre glissante de 60 jours, sans hypothèses) s'adapte mais ne comprend rien (0 %), et fait −4,6 k€/an face à v2.

### Limites, dites franchement
- **Régressions par rapport à la v1.** Sensibilité au prix : 18/60 contre 28/60. Déclin en S du kiosque : 12/30 contre 26/30, car la v1 le prend simplement pour une rupture de niveau, alors que la v2 hésite entre davantage d'explications. Le nouveau score Tobit, plus honnête vis-à-vis des ruptures de stock, rend la preuve d'un changement d'élasticité plus lente. J'ai choisi de geler le code plutôt que de continuer à régler.
- **Détection plus lente** : délai médian de 24 jours contre 9, à cause des seuils de preuve plus stricts qui contrôlent les fausses découvertes.
- **Pics périodiques** : 8/60 seulement, et **0/30 pour les pics mensuels à date irrégulière** du kiosque. Les pics tombent en rupture de stock, et la correction pour comparaisons multiples (plusieurs centaines de variantes) exige beaucoup de preuves. Seuil de prix : 9/60.
- Sur l'environnement secret, **le gain de compréhension ne se traduit pas encore par un gain de profit significatif**.
- Coût : environ 11 s de calcul par année simulée, contre environ 4 s pour la v1.
- Tous les mondes sont des simulations que j'ai écrites. Les familles des environnements de développement sont exprimables dans la grammaire, donc « inconnu » signifie : jamais décrit à l'agent, et non : hors de tout langage. Le kiosque teste justement des mécanismes hors grammaire.

## Reproduire
```
npm test                                   # 31 tests (inférence, découverte, Tobit/ADF, absence de faux positifs…)
node bench/discovery.js --seeds 101-130 --envs calme,boulangerie,glacier,marche,fleuriste,kiosque --out bench/test.json
node bench/report.js bench/test.json       # ≈ 30 min sur 4 cœurs
npm run build                              # page autonome dist/cortex.html (choix du commerce, vérité cachée révélable)
```

## Structure
```
src/core/   CERVEAU GÉNÉRIQUE v3 : gmodel (modèle par mesure), gdiscovery (grammaire), decide (décision par simulation), brain (la boucle), run
src/bodies/ corps déclarés : commerce, restaurant, usine, abonnement (les deux derniers écrits après le gel)
src/        (v2) model (NIG pondéré, termes, score Tobit/ADF) · discovery (grammaire, a priori hiérarchique, narration)
            agent (la boucle) · world (mécanismes cachés) · envs (commerces + environnement tenu secret) · econ · policies · runner
src_v1/     CORTEX v1 gelé (copie exacte du commit fusionné 25ad9f7), référence du banc d'essai
bench/      discovery.js (banc parallèle) · report.js (analyse) · résultats DEV/TEST · bench.js (banc v1)
test/       24 tests
web/        interface ; scripts/build.js l'assemble avec le moteur réel
```
