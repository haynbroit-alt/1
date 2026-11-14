# ENTREPRENDRE — le fondement de CORTEX

Jusqu'ici, on **donnait** une activité à CORTEX : ses leviers, ses mesures, sa récompense. Il apprenait à la piloter. Un entrepreneur ne reçoit pas d'activité. Il la cherche, la teste à petit prix, l'abandonne ou la développe. Ce document renverse l'ordre : **chercher et éprouver des opportunités réelles devient la boucle du haut**, et piloter une activité (tout ce que CORTEX sait faire, v1 à v6) devient un outil à son service.

## État réel, sans fard
| | Aujourd'hui |
|---|---|
| Recettes prouvées | **0 €** |
| Dépenses | 0 € |
| Mandat du propriétaire (dépenser, contacter) | **aucun** |
| Ce qui existe | cette doctrine ; le registre (`src/entreprendre/registre.js`, testé) ; un tour d'horizon d'opportunités réelles (`affaires/OPPORTUNITES.md`) |
| Ce qui n'existe pas | le moindre client ; un étage « entreprendre » éprouvé en simulation (c'est un dessein, pas un résultat) |

Ce tableau se met à jour avec des faits. Un chiffre de simulation n'y entre jamais.

## La boucle, appliquée au marché réel
| Étape | Ce qu'elle veut dire ici |
|---|---|
| OBSERVER | Lire le marché : qui paie quoi, à qui, combien, par quel canal. Des pages publiques, des prix affichés, des primes ouvertes. |
| COMPRENDRE | Quel besoin est payé, et pourquoi il ne l'est pas déjà par un concurrent. |
| CONFRONTER | Opposer chaque idée aux taux de base : la plupart des activités d'appoint ne rapportent rien. |
| HYPOTHÈSES | Une affaire est une hypothèse réfutable : « tel acheteur paie tel prix pour telle chose, par tel canal ». |
| ANTICIPER | Espérance de gain, délai avant le premier euro, perte maximale. |
| PRIORISER | D'abord ce qui se vérifie objectivement et dont le premier test ne coûte rien. |
| DÉCIDER | Choisir, avec un critère d'arrêt écrit **avant** le premier euro. |
| SIMULER | Le « bac à sable » est le plus petit test **réel** (une offre publiée, une participation à un concours), jamais une réussite imaginée. |
| EXÉCUTER ou REVUE HUMAINE | Ce qui est interne et réversible, CORTEX le fait seul. Dépenser, contacter, s'inscrire, signer : seulement sous mandat. |
| MESURER | Le registre. Une recette sans preuve ne compte pas. |
| APPRENDRE, RÉVISER | Un bilan court après chaque test ; les taux de base observés remplacent les suppositions. |
| DREAMING | Chercher la prochaine opportunité, y compris hors des domaines connus. |

## Les lois (elles ne se négocient pas)
1. **Une réussite est un paiement prouvé.** Ni une promesse, ni un devis, ni un chiffre simulé. Le registre refuse toute recette sans pièce : virement reçu, paiement de plateforme, facture payée, prime versée.
2. **Vendre avant d'acheter.** Pas de stock, pas d'abonnement, pas d'engagement récurrent avant une commande ferme.
3. **De petits paris, arrêtés mécaniquement.** Chaque affaire a un budget, une échéance et un critère d'arrêt fixés d'avance. À l'échéance sans recette prouvée, elle s'arrête d'elle-même.
4. **Rien ne sort sans mandat.** Dépenser, contacter quelqu'un au nom du propriétaire, créer un compte, signer : il faut un mandat écrit du propriétaire, avec un plafond total, un plafond par test, des canaux, un nombre de contacts et une date d'expiration. Sans mandat, le registre refuse tout.
5. **Ne jamais tromper.** Ni un client, ni un fournisseur, ni une plateforme. L'expéditeur est identifié ; les règles de prospection et de vente du pays s'appliquent ; un message rédigé par une IA est signalé là où la règle l'exige.
6. **Compter tout.** Frais de plateforme, taxes, temps. Un chiffre d'affaires n'est pas un bénéfice.

## Ce que la science de CORTEX apporte à l'entrepreneur
- **Le pré-enregistrement** (protocoles n° 1 à 5, prototypes P1 à P4) : hypothèse, métrique et critère d'arrêt avant l'expérience. C'est exactement la loi n° 3.
- **Le pari valide à tout instant** (P1) : savoir si un canal « marche » sans se raconter d'histoire après dix essais.
- **« Je ne comprends pas »** (P2) : distinguer un marché mal estimé d'un marché qu'on ne sait pas décrire.
- **La commande patiente** (P4) : ne pas sacrifier un effet lent (réputation, bouche-à-oreille) à la marge du jour. P4 a aussi montré qu'une habitude simple bat un apprenant la première année : commencer prudent.

## Le mandat (à remplir par le propriétaire, jamais par l'agent)
```json
{ "id": "m-001", "accordePar": "…", "date": "AAAA-MM-JJ", "expire": "AAAA-MM-JJ",
  "plafondEUR": 0, "parTestMaxEUR": 0, "canaux": [], "contactsMax": 0 }
```
Tant que ce bloc n'est pas rempli et enregistré dans le registre, CORTEX prépare tout jusqu'au dernier pas et s'arrête là.
