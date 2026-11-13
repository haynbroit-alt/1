# Protocole pré-enregistré n° 3 — CORTEX v4 face à des activités entièrement inconnues

**Question :** CORTEX peut-il découvrir par lui-même des règles que personne ne lui a apprises ?

**Ordre des opérations (vérifiable dans git) :**
1. **Commit A**, celui qui contient ce fichier : le cerveau `src/core/` est **gelé**, identique à `8d9e611`. Aucune des activités d'évaluation n'existe.
2. **Commit B** : écriture de trois activités nouvelles, sans aucune modification de `src/core/`. On le vérifie avec `git diff A B -- src/core`, qui doit être vide.
3. Exécution unique sur les **graines 301 à 330**, jamais utilisées auparavant, puis publication de tous les résultats.

Les résultats de développement de la version gelée (activités connues et variantes de contrôle, graines 1 à 4) sont archivés à part. Ils ne servent plus à rien régler.

## Ce que le cerveau reçoit d'une activité
Une déclaration et rien d'autre :
- ses leviers (plage, nature continue, discrète ou capacité) ;
- ses informations du matin ;
- ses mesures et les variables qui peuvent les influencer ;
- sa comptabilité (action, mesures → €).

Aucune variable dérivée, aucune mémoire, aucune interaction et aucune stratégie ne sont déclarées : toutes doivent être construites par le cerveau lui-même.

## Classement des mécanismes cachés (fixé dans le commit B, avant toute exécution)
Pour chaque mécanisme caché d'une nouvelle activité, le commit B indique à l'avance l'une de ces trois classes :
- **représentable** : il existe dans le langage du cerveau une explication équivalente (par exemple une mémoire exponentielle d'un levier ou une interaction entre deux variables déclarées) ;
- **approximable** : seule une approximation existe (par exemple une mémoire de constante de temps différente) ;
- **hors de portée** : rien dans son langage ne peut le représenter (par exemple une mémoire lente d'une *mesure*, ou un stock caché qu'aucune mesure n'observe directement).

## Politiques comparées
Oracle (optimum jour par jour avec la vraie dynamique ; ce n'est **pas** une borne supérieure quand l'activité a un état) · Habitude (règle fixe simple déclarée par l'activité) · **v3 gelée** · **v4** · v4 myope (sans planification) · v4 sans variables construites.

## Mesures
1. **Découverte** : pour chaque mécanisme caché, l'agent a-t-il admis une croyance de la famille attendue, sur la bonne mesure, à la bonne date (±14 jours) quand le mécanisme est daté ? Résultats rapportés par classe de représentabilité.
2. **Prévision hors échantillon** : erreur RMS du log de chaque mesure, prédite 7 jours à l'avance.
3. **Décision** : profit annuel, en % de l'oracle et en différence appariée.
4. **Fausses découvertes** : croyances qui ne correspondent à aucun mécanisme réel, dont les « mémoires » et « interactions ».
5. Temps de calcul.

## Hypothèses (différences appariées sur les mêmes mondes et les mêmes aléas, IC95)
- **H1** : sur les nouvelles activités, le profit de v4 dépasse celui de la v3 (IC95 > 0).
- **H2** : le profit de v4 dépasse celui de l'habitude (IC95 > 0).
- **H3** : les variables construites améliorent la prévision hors échantillon : erreur de v4 < erreur de v4 sans variables construites (IC95 < 0).
- **H4** : la planification améliore la décision : profit de v4 > profit de v4 myope (IC95 > 0).
- **H5** : parmi les mécanismes **représentables**, v4 en découvre au moins 50 %.
- **H6 (garde-fou)** : au plus 2 fausses découvertes par an et par activité.
- Les mécanismes « approximables » et « hors de portée » sont rapportés sans seuil de succès : ils mesurent les limites.

Commande : `node bench/transfer.js --seeds 301-330 --bodies ferme,hotel,atelier --policies oracle,habit,v3-gele,v4,v4-myope,v4-sansmemoire --out bench/v4-test.json`
