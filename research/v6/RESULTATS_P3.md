# Prototype P3 — 400 mondes (200 forme, 200 compris), graines 5001–5400

## Confirmation des formes sur C selon le plan d’expériences

| | Passif (blocs aléatoires) | Habitude (leviers fixes) | **Actif (D-optimal, budget égal)** |
|---|---:|---:|---:|
| Formules de GALILÉE confirmées (D1, 44 formules) | 23 % | 0 % | **84 %** |
| Plafond : la vraie forme jugée sur C (D4) | 13 % (200) | 0 % | plan pour la formule de GALILÉE : 89 % · plan pour la vraie forme : 69 % (200) |

D1 apparié (actif − passif) : 61 ± 15 points.

## Fausses confirmations (D2)

| | Passif | Actif |
|---|---:|---:|
| Formules apprises sur écarts mélangés | 0/2 | 1/2 |
| Formules forcées, mondes compris | — | 0/2 |
| Formules non constantes injectées, mondes compris | — | 4/400 |

Formules constantes (non testables, donc jamais confirmées) : 198 sur écarts mélangés, 199 dans les mondes compris.

Budget du plan actif (D3) : |u₀| moyen max 0.50 (≤ 0,5) · part u₁ max 0.23 (≤ 0,3)

Formules jugées (D1) : carre → `sin(u0)^6·u0^6` P✗ A✓ · interaction → `0.02718·u1 / u0` P✓ A✓ · interaction → `sin(3·u1)·u0` P✗ A✓ · carre → `(u0 + 3/4)·(u0 − 0.5976) / 4` P✗ A✗ · carre → `u0^2 / 4 − 0.1011` P✗ A✓ · carre → `0.8505 − cos(u0)` P✓ A✓ · interaction → `u0·u1 / 4` P✗ A✓ · carre → `u0^2 / 4 − 0.0955` P✗ A✓ · carre → `0.2282·u0^2 − 0.1172` P✓ A✓ · interaction → `−2·u0·(cos(u1) − 3/4) / 3` P✗ A✓ · interaction → `−(0.2623 − u1)·u0 / 4` P✓ A✓ · carre → `−0.01068 / u0` P✗ A✗ · carre → `cos(3 − u0) + 0.828` P✓ A✓ · interaction → `sin(u1)·u0 / 4` P✗ A✓

## Verdicts (critères de PROTOCOLE_P3.md)

- D1 actif ≥ 50 % et > passif : 84 %, différence 61 ± 15 ✅
- D2 fausses confirmations ≤ 10 % (borne ≤ 15 %) : 1 % (borne 3 %, 404 formules) ✅
- D3 budget : ✅
- Abandon (D2 échoue) : non

Temps moyen par monde : 39.3 s

## Notes d'exécution

- Exécution unique du 14 novembre 2026, prototype gelé `f3778b4`, sans modification du code.
- Les 400 graines ont été passées par paquets de dix, quatre à la fois (`research/v6/p3-tranches/`), puis assemblées
  dans `p3-test.json`. Chaque graine est déterministe : le découpage ne change aucun résultat.
- Une première tentative en trois tranches a été interrompue avant d'écrire le moindre fichier (limite de durée de
  la machine) ; aucun résultat n'en a été lu.

## Lecture factuelle (rédigée après l'exécution unique)

**Ce qui est démontré.**
- Les trois critères sont atteints. Sous le plan d'expériences actif, 84 % des formules de GALILÉE gagnent leur pari
  (37 sur 44), contre 23 % sous le plan passif, à budget égal : différence appariée de 61 ± 15 points.
- La cause supposée dans P2 est confirmée : sous le plan passif, la **vraie** forme elle-même ne gagne son pari que
  dans 13 % des mondes ; sans variation des leviers (habitude), jamais.
- La garantie tient sous plan adaptatif : 4 formules fausses confirmées sur 400 injectées, chacune jugée sous un plan
  construit pour la confirmer (1 %, borne haute 3 %).

**Ce qui limite la portée.**
- Seuls 44 mondes « forme » sur 200 arrivent jusqu'au pari : dans les autres, la sonde ne signale rien ou GALILÉE
  ne rend qu'une constante. Le plan actif résout la confirmation, pas la détection.
- Sur les écarts mélangés, une seule paire de formules non constantes a pu être jugée (1 confirmée sur 2 sous plan
  actif) : trop peu pour conclure sur ce cas.
- Les mondes n'ont ni prix ni comptabilité : le résultat porte sur la confirmation d'une loi, pas sur un gain.
- Coût : 39 s de calcul par monde.
