# Prototype P1 (CORTEX v6) — modes cachés continus (A) et acceptation par pari (B)

**Statut** : protocole écrit **avant** le code. Le développement se fait sur les graines 1 à 40 ; le prototype est ensuite gelé (commit identifié), puis exécuté **une fois** sur les graines 1001 à 1300. Le cerveau gelé de CORTEX (`src/core`) n'est pas touché.

## Les deux paris scientifiques
**A — inventer des états cachés sans grille.**
Une dynamique cachée linéaire xₜ₊₁ = A·xₜ + B·sₜ, si A a des valeurs propres réelles, se diagonalise : chaque mode i est zᵢ,ₜ = λᵢ·zᵢ,ₜ₋₁ + (1−λᵢ)·Σⱼ wᵢⱼ·sⱼ,ₜ₋₁. Son effet sur une mesure est linéaire en les sources filtrées Fⱼ(λᵢ). Pour un λ fixé, le modèle est une régression conjuguée, d'inférence exacte. L'identification se réduit donc à une recherche continue de λ par mode, avec la signature w en sortie (quelles sources, quels signes). C'est apparenté aux bases orthonormales en identification de systèmes. La v5 n'avait que λ ∈ {0,9 ; 0,97} et des paires de sources fixées.

**B — ne croire qu'après un pari gagné.**
Chaque mode candidat est proposé sur les données passées, puis **figé** (λ, w). Il ouvre ensuite un processus d'e-valeur sur les jours suivants :
- numérateur : la prévision avec le mode, ses coefficients appris de façon prévisible ;
- dénominateur : la vraisemblance **maximisée** du modèle sans le mode, sur les mêmes jours. C'est l'inférence universelle de Wasserman, Ramdas et Balakrishnan (2020).

Ce rapport est dominé par une martingale positive sous l'hypothèse nulle. Par l'inégalité de Ville, l'accepter dès qu'il dépasse 1/αᵢ, avec Σαᵢ ≤ α, borne à α la probabilité d'**au moins une** fausse acceptation dans un monde, à tout instant. Cette garantie suppose que le modèle nul est bien spécifié ; c'est ce que les mondes placebo vérifient.

## Mondes synthétiques (vérité connue)
- 365 jours ; 3 mesures en log, bruit 0,15 ; effets de jour de semaine ; 2 leviers (un continu, un binaire), changés par blocs de 5 à 40 jours (excitation persistante, politique exogène) ;
- **placebo** : aucun mode ;
- **modes** : 1 ou 2 modes, τ tiré log-uniforme dans [3, 120] jours, 1 ou 2 sources (mesures ou leviers, rétroaction comprise), une mesure cible, force (écart-type de l'effet) tirée dans [0,05 ; 0,25] ;
- **placebo mal spécifié** : aucun mode, mais une rupture de niveau et un changement de volatilité, que le modèle nul ne représente pas. Il est rapporté sans hypothèse.

Répartition des 300 graines de test : 100 placebo, 150 modes, 50 placebo mal spécifiés (graine mod 6 : 0–1 placebo, 2–4 modes, 5 mal spécifié).

## Méthodes comparées
- **P1** : λ continu (48 valeurs de τ, log-espacées, de 1,5 à 250 j) et acceptation par pari, α = 0,10.
- **Grille v5** : même moteur, mais τ ∈ {3,3 ; 10 ; 33} seulement.
- **Facteur de Bayes naïf** (à la manière de v4/v5) : acceptation dès que log BF > 5 sur les données passées, sans pari. Rapporté pour comparaison.

## Hypothèses et critères (fixés d'avance)
Un mode retrouvé : bonne cible, |log(τ̂/τ)| < log 1,5, source dominante de la signature parmi les vraies sources. Un mode « fort » : force réalisée ≥ 0,10.

| | Critère | Seuil |
|---|---|---|
| **B1** | placebo bien spécifié : part des mondes avec au moins 1 acceptation | ≤ 0,10, et borne haute de Wilson à 95 % ≤ 0,15 |
| **B2** | mondes à modes : acceptations sur une mesure sans aucun vrai mode, par monde | ≤ 0,10 |
| **A1** | modes forts retrouvés (P1) | ≥ 60 % |
| **A2** | modes forts lents (τ ∈ [30, 120]) retrouvés | ≥ 50 % **et** supérieur à la grille v5 (différence appariée, IC95 > 0) |
| A3 | précision de τ : médiane de |log(τ̂/τ)| des modes forts retrouvés | rapportée |
| B3 | placebo mal spécifié : part des mondes avec au moins 1 acceptation | rapportée, sans seuil (la garantie ne s'y applique pas) |

**Critère d'abandon** : si B1 échoue, ou si A1 < 40 %, l'architecture A + B est rejetée sous cette forme, et je le publie.

## Journal de développement (graines 1 à 100 seulement ; hypothèses et seuils inchangés)
1. **Générateur** : le calibrage de la force des modes explosait quand un mode se nourrit de sa propre mesure (graine 8, force réalisée nulle). Il est maintenant amorti.
2. **Pari, première version (`ui`, conservée dans le code)** : candidat figé puis inférence universelle. Elle s'est révélée **structurellement aveugle aux effets lents** : le dénominateur réajuste la constante sur la seule fenêtre de test, qui absorbe un mode lent. Elle a été remplacée par un **facteur de Bayes invariant** :
   - a priori de Haar à droite sur la nuisance (constante, jours, leviers) et sur σ ;
   - mélange uniforme sur les modèles ;
   - histoire entière.

   C'est un e-processus sous H0 quand les variables explicatives sont exogènes (Pérez-Ortiz, Lardy, de Heide et Grünwald, *Ann. Statist.* 2024). **Limite formelle** : la garantie ne couvre pas un mode qui se nourrit de la mesure testée elle-même, ni les chaînes de rétroaction. B1 et B2 la vérifient empiriquement.
3. **Concepts parcimonieux** : chaque modèle candidat utilise 1 ou 2 sources (et non les 5). Les signatures diffuses rendaient la source dominante arbitraire.
4. **Existence et description séparées** : le pari certifie l'existence d'un mode sur une mesure. τ et la signature sont ré-estimés sur toute l'année, par ajustements alternés s'il y a deux modes.
5. **Second test** : la famille du premier mode (ses sources filtrées à τ̂/1,5, τ̂ et τ̂·1,5) entre en nuisance libre. Le second test « découvrait » sinon l'erreur d'estimation du premier.
6. **Échelle des sources filtrées** : division par √((1+λ)/(1−λ)), une constante déterministe. Sans cela, l'a priori rétrécissait les modes lents. Diagnostic : **52 modes forts sur 52 détectés**, mais τ des modes lents sous-estimé de moitié. Effet de la correction : modes forts lents retrouvés **de 28 % à 64 %**.
7. **Rang de la nuisance** : un levier qui n'a pas encore bougé est colinéaire à la constante. Sa colonne est retirée, comme le ferait la limite impropre, et les alternatives fondées sur lui parient neutre. Le pari ne commence qu'au jour 60, fixé d'avance. Ce défaut causait 3 fausses acceptations sur 33 placebos (τ = 1,5, levier, jours 48 à 62).

| Résultat de développement (100 mondes) | P1 | Grille v5 | Facteur de Bayes naïf |
|---|---:|---:|---:|
| Placebos avec au moins 1 acceptation | 1/33 | 0/33 | 15/33 |
| Modes forts retrouvés | 69 % | 35 % | 71 % |
| Modes forts lents retrouvés | 64 % | 24 % | 68 % |
| Fausses acceptations par monde à modes | 0,04 | 0,06 | 0,45 |

La variante `ui` n'est pas exécutée en test : elle a été rejetée en développement.

**Commande de test (exécution unique)** : `node research/v6/run.js --seeds 1001-1300 --methods p1,grille,bayes --out research/v6/test.json`, en 4 tranches parallèles, puis `node research/v6/report.js research/v6/test.json --md research/v6/RESULTATS_P1.md`.
