# CORTEX — une boucle cognitive qui découvre des changements qu'on ne lui a jamais décrits

CORTEX implémente la boucle **Observer → Comprendre → Confronter → (Hypothèses) → Anticiper → Prioriser → Décider → Simuler → Exécuter | Revue → Mesurer → Apprendre → Réviser → Dreaming ↺** sous forme de moteur bayésien exact, déterministe et testé, **sans LLM à l'exécution et sans intervention humaine** dans le banc d'essai.

L'agent dirige un commerce (prix, commande d'un produit périssable, marketing) sans savoir lequel. Il ne voit que ses propres décisions et ses ventes. Quand il est en rupture de stock, il ne voit pas la demande réelle. Les règles cachées changent au cours de l'année.

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
npm test                                   # 24 tests (inférence, découverte, Tobit/ADF, absence de faux positifs…)
node bench/discovery.js --seeds 101-130 --envs calme,boulangerie,glacier,marche,fleuriste,kiosque --out bench/test.json
node bench/report.js bench/test.json       # ≈ 30 min sur 4 cœurs
npm run build                              # page autonome dist/cortex.html (choix du commerce, vérité cachée révélable)
```

## Structure
```
src/        model (NIG pondéré, termes, score Tobit/ADF) · discovery (grammaire, a priori hiérarchique, narration)
            agent (la boucle) · world (mécanismes cachés) · envs (commerces + environnement tenu secret) · econ · policies · runner
src_v1/     CORTEX v1 gelé (copie exacte du commit fusionné 25ad9f7), référence du banc d'essai
bench/      discovery.js (banc parallèle) · report.js (analyse) · résultats DEV/TEST · bench.js (banc v1)
test/       24 tests
web/        interface ; scripts/build.js l'assemble avec le moteur réel
```
