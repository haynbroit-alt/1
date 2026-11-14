# Résultats C2 — juge exporté

Protocole : `PROTOCOLE_C2.md`, écrit avant le code. Module : `juge.js`, gelé au commit `0b8bfeb` avant l'exécution.
Banc : `node research/v6/c2-bench.js --e1 1-60 --e2 9001-9200 --out research/v6/c2-dev.json`, exécuté une seule fois
le 14 novembre 2026. Données brutes : `c2-dev.json`.

| Critère | Seuil fixé d'avance | Mesuré | Verdict |
|---|---|---|---|
| **E1** identité avec `runWorld` (graines 1 à 60 de P2) | diagnostics, familles et log E identiques à 10⁻⁶ près | 60 / 60 mondes identiques | atteint |
| **E2** placebo extérieurs (graines 9001 à 9200, exécution unique) | au plus 10 % de fausses « structure manquante », borne de Wilson ≤ 15 % | 6 / 401 mesures = 1,5 %, borne 3,2 % ; 6 mondes touchés sur 200 | atteint |
| **E3** recevabilité | 100 % des séries dégénérées refusées, avec motif | 4 / 4 refusées avec motif ; le témoin sain est accepté | atteint |

Le critère d'abandon (échec de E1) ne s'applique pas.

## Lecture

- `juge.js` rend exactement le jugement du moteur sur les mondes de P2 : c'est bien un export du juge, pas un
  autre juge.
- Sur des comptages de Poisson sans structure cachée, étrangers à P2, il crie rarement à la structure manquante.
- Il refuse, en disant pourquoi, une série trop courte, une mesure constante, une série à douze jours actifs par an
  et une série sans levier.

## Ce que ce résultat ne dit pas

- E2 n'a éprouvé qu'une famille de mondes placebo (comptages de Poisson, semaine marquée, leviers par blocs). Un
  autre bruit — surdispersion, ruptures, saisonnalité annuelle — n'est pas couvert.
- Aucune donnée réelle n'a été jugée. La puissance du juge sur une formule vraie venue de l'extérieur n'est pas
  mesurée ici : c'est l'objet de la confrontation T2 de l'espace commun.
- Les graines 9001 à 9200 sont consommées : elles ne peuvent plus servir de test.
