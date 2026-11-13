# Protocole pré-enregistré — CORTEX v2 « découverte de l'inconnu »

Ce document est **figé dans git avant la première exécution** de l'évaluation finale. Le hash du commit qui le contient fait foi. Tout ce qui est réglé l'a été sur les **graines de développement 1 à 10**. L'évaluation finale utilise des **graines jamais vues, 101 à 130**, et un **environnement tenu secret** (`kiosque`) jamais exécuté pendant le développement.

## Ce qui est figé
- Le code de l'agent (`src/`), la référence v1 gelée (`src_v1/`, copie exacte du commit fusionné `25ad9f7`), les environnements (`src/envs.js`), le banc d'essai (`bench/discovery.js`) et l'analyse (`bench/report.js`).
- Aucun réglage après l'exécution sur les graines 101 à 130. Si un bogue impose une correction, les deux résultats, avant et après, seront publiés.

## Environnements de test
`calme` (contrôle des fausses découvertes), `boulangerie`, `glacier`, `marche`, `fleuriste`, et `kiosque` (tenu secret). Les mécanismes du kiosque diffèrent de ceux de la grammaire : déclin logistique en S, seuil de prix sigmoïde, pics mensuels à date irrégulière (±1 jour), saisonnalité de phase aléatoire.

30 graines × 6 environnements × 7 politiques = 1 260 années simulées. L'agent ne sait jamais dans quel environnement il se trouve. Il n'y a aucune intervention humaine : les revues sont tranchées par la règle automatique.

## Mesures (définies à l'avance)
1. **Compréhension (critère principal)** : part des changements cachés pour lesquels l'agent a admis, à un moment de l'année, une croyance de la **famille attendue** (`expect` dans `src/envs.js`), datée à ±14 jours. Les pics périodiques ont une tolérance d'une période. Un déclin logistique est jugé sur τ ∈ [milieu − 3·largeur − 14, milieu + 14]. Les composantes présentes depuis toujours (saison, effet retard) n'exigent pas de date.
2. **Fidélité du modèle du monde (principal)** : erreur RMS entre le log-taux de demande prédit et le vrai, tous les 7 jours à partir du jour 28, sur les 7 jours suivants, pour une grille de prix {2,5 ; 3,5 ; 4,5 ; 5,5} € × marketing {0 ; 50} €.
3. **Fausses découvertes (garde-fou)** : croyances qui ne correspondent à aucun changement réel (ni bonne famille, ni ±14 jours d'un vrai changement). Elles sont reportées en particulier pour le monde calme.
4. **Profit (secondaire)** : profit annuel, en % de l'oracle qui connaît la vérité cachée.

## Hypothèses testées (v2 contre v1 gelée, différences appariées sur les mêmes mondes et les mêmes aléas)
- **H1** : la compréhension de v2 est supérieure (IC95 de la différence > 0).
- **H2** : l'erreur du modèle du monde de v2 est inférieure (IC95 < 0).
- **H3** : les fausses découvertes de v2 dans le monde calme ne dépassent pas celles de v1 de plus de 0,5 par an.
- **H4 (secondaire)** : le profit de v2 est supérieur (IC95 > 0).
- Les mêmes tests sont rapportés **sur le seul environnement tenu secret**.

Les ablations (`v1-infra`, `ferme+detect`, `oubli`) sont rapportées pour attribuer les gains à l'infrastructure, aux détecteurs ou à la grammaire. Elles ne sont pas des tests d'hypothèse.

Commande : `node bench/discovery.js --seeds 101-130 --envs calme,boulangerie,glacier,marche,fleuriste,kiosque --out bench/test.json`, puis `node bench/report.js bench/test.json`.
