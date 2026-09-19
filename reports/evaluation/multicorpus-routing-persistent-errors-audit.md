# Audit des 44 erreurs persistantes V2/V3

> Runs : V2 `2026-09-19T19-54-08-102Z` — V3 `2026-09-19T20-39-25-646Z`  
> Ensemble : questions incorrectes dans **les deux** versions (catégorie D de la comparaison)  
> Audit read-only — aucune modification code, prompt, dataset ou benchmark.

---

## 1. Contexte

Sur 500 questions, V2 et V3 obtiennent chacun **442 exact match** (58 erreurs). 
La comparaison V2/V3 montre **14 corrections** et **14 régressions** — bilan net nul. 
Les **44 erreurs persistantes** (V2 incorrect ∩ V3 incorrect) constituent le plancher commun des deux prompts.

| Métrique | Valeur |
| -------- | -----: |
| Erreurs persistantes | **44/500** (8,8 %) |
| Prédiction identique V2=V3 | **36/44** |
| Prédiction différente mais toujours fausse | **8/44** |
| Single-corpus | 21 |
| Multi-corpus | 10 |
| Ambiguous | 10 |
| Out-of-scope | 3 |

**IDs :** q045, q047, q048, q098, q121, q223, q238, q245, q249, q259, q304, q308, q309, q318, q319, q326, q327, q329, q330, q331, q333, q354, q361, q363, q369, q382, q399, q408, q410, q412, q413, q436, q438, q443, q446, q452, q454, q455, q456, q459, q460, q469, q480, q492

## 2. Méthodologie

Pour chaque question :
1. Lecture question-first (sans supposer le gold correct).
2. Comparaison gold / V2 / V3 depuis `routing.json`.
3. Consultation des `goldArticles` pour valider la déductibilité — **sans** inférer le corpus depuis l'article seul.
4. Classification : déductibilité gold, raisonnabilité prédiction, catégorie principale, corrigeabilité prompt, signal architectural.

Question centrale : *« Un routeur ne voyant que la question pouvait-il raisonnablement identifier ce corpus ? »*

## 3. Analyse individuelle

### q045

**Type :** single-corpus | **Difficulty :** easy

**Question :** Quelles conditions spécifiques encadrent le prélèvement d'organe sur un donneur vivant mineur selon l'article 726-1 ?

**Gold :** pénal  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** pénal 726-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L'article 726-1 est cité (prélèvement d'organe, mineur) — contenu typiquement pénal. Ni V2 ni V3 ne retiennent un corpus ; abstention excessive sur une question pourtant ancrée par numéro d'article.

### q047

**Type :** single-corpus | **Difficulty :** easy

**Question :** Selon l'article 712-1, par quels moyens la diffusion des décisions judiciaires est-elle assurée, et qui en décide ?

**Gold :** pénal  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** pénal 712-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Article 712-1 cité (diffusion décisions judiciaires). Gold pénal cohérent ; les deux versions abstinent sans justification.

### q048

**Type :** single-corpus | **Difficulty :** medium

**Question :** Comment l'article 713-3 définit-il les discriminations liées à l'état de santé ou au handicap dans le contexte d'embauche ou de licenciement ?

**Gold :** pénal  
**V2 :** travail  
**V3 :** travail  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** pénal 713-3

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | pénal/travail |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Art. 713-3 pénal (discrimination santé/handicap) mais question mentionne embauche/licenciement → travail. Frontière pénal/travail classique ; les deux versions choisissent travail.

### q098

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles sont les limitations quant au cumul d'une sanction civile avec une amende administrative ou pénale pour les mêmes faits selon l'article sur la sanction civile ?

**Gold :** civil  
**V2 :** consommation  
**V3 :** civil, pénal  
**V2/V3 :** erreurs légèrement différentes (OVER/SWAP)

**Articles gold :** civil 1254

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | keyword anchoring |
| Prompt fixability | **HIGH** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Art. 1254 civil (cumul sanctions). V2 route consommation ; V3 civil+pénal. Même erreur de fond : ne pas isoler le corpus civil malgré mention « sanction ».

### q121

**Type :** single-corpus | **Difficulty :** easy

**Question :** Quelles sont les modalités de recrutement à la disposition de l'Agence nationale des services à la personne ?

**Gold :** travail  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** travail L7234-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Recrutement ANSP → travail L7234-1. Institution peu connue ; abstention des deux versions.

### q223

**Type :** single-corpus | **Difficulty :** easy

**Question :** À quel type de personnes physiques ou morales s'applique l'ensemble des contrats mentionnés dans l'article L341-1 ?

**Gold :** commerce  
**V2 :** monétaire  
**V3 :** monétaire  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** commerce L341-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | commerce/monétaire |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Art. L341-1 commerce cité ; router route monétaire (confusion contrats/finance).

### q238

**Type :** single-corpus | **Difficulty :** easy

**Question :** Quelles sont les sanctions prévues pour une personne qui affirme des souscriptions fictives selon l'article L231-10 ?

**Gold :** monétaire  
**V2 :** commerce  
**V3 :** commerce  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** monétaire L231-10

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | commerce/monétaire |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L231-10 CMF (souscriptions fictives) ; router commerce dans V2 et V3.

### q245

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quels types de services le prestataire de services d'investissement doit-il veiller à rendre accessibles conformément à l'article L. 412-13 du code de la consommation ?

**Gold :** monétaire  
**V2 :** consommation  
**V3 :** consommation  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** monétaire L323-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **REASONABLE** |
| Catégorie principale | **GOLD_PROBLEM** |
| Catégorie secondaire | question cites wrong code |
| Prompt fixability | **NONE** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question cite explicitement L412-13 **code consommation** ; gold = monétaire L323-1. Router vers consommation est textuellement défendable — problème dataset/formulation.

### q249

**Type :** single-corpus | **Difficulty :** easy

**Question :** Quels articles régissent la fourniture à distance de services financiers à un consommateur selon l'article L343-1 ?

**Gold :** monétaire  
**V2 :** consommation  
**V3 :** consommation  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** monétaire L343-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **REASONABLE** |
| Catégorie principale | **QUESTION_FORMULATION** |
| Catégorie secondaire | consommateur keyword |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Services financiers à distance + « consommateur » ; gold CMF L343-1. Router consommation est juridiquement défendable.

### q259

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles sont les sanctions pénales pour les membres du directoire ou du conseil de surveillance du fonds de garantie des déposants en cas de violation du secret professionnel ?

**Gold :** monétaire  
**V2 :** monétaire, pénal  
**V3 :** monétaire, pénal  
**V2/V3 :** même erreur (OVERPREDICTION)

**Articles gold :** monétaire L352-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | sanctions pénales keyword |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question demande sanctions pénales ; règles dans CMF L352-1. Gold = monétaire seul ; router ajoute pénal (V2 et V3 identiques).

### q304

**Type :** single-corpus | **Difficulty :** medium

**Question :** Comment les références au code de commerce sont-elles adaptées en Polynésie française et en Nouvelle-Calédonie pour l'application de l'article L. 321-1 selon l'article L352-2 du code de la consommation ?

**Gold :** consommation  
**V2 :** consommation, commerce  
**V3 :** consommation, commerce  
**V2/V3 :** même erreur (OVERPREDICTION)

**Articles gold :** consommation L352-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **QUESTION_FORMULATION** |
| Catégorie secondaire | cite commerce |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question cite adaptations code commerce ; gold consommation L352-2. Router ajoute commerce — cohérent avec la formulation.

### q308

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles informations doivent figurer dans la publicité concernant l'établissement de crédit ou la société de financement pour laquelle l'intermédiaire exerce son activité, selon l'article L322-2 ?

**Gold :** consommation  
**V2 :** monétaire  
**V3 :** monétaire  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** consommation L322-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | CMF/consommation |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L322-2 consommation (publicité crédit) ; « établissement de crédit » attire monétaire.

### q309

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles sont les limites temporelles des opérations de crédit soumises aux dispositions des articles L. 341-1 à L. 341-9 et L. 341-12 à L. 341-18 selon l'article L341-19 ?

**Gold :** consommation  
**V2 :** monétaire  
**V3 :** monétaire  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** consommation L341-19

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | CMF/consommation |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L341-19 consommation (crédit) ; router monétaire sur mot « crédit ».

### q318

**Type :** single-corpus | **Difficulty :** medium

**Question :** Que prévoit l'article L432-1 en ce qui concerne les dispositions relatives au label rouge ?

**Gold :** consommation  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** consommation L432-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention niche |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Label rouge L432-1 consommation ; abstention persistante.

### q319

**Type :** single-corpus | **Difficulty :** medium

**Question :** Comment l'article L431-1 définit-il l'appellation d'origine d'un produit ?

**Gold :** consommation  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** consommation L431-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention niche |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Appellation origine L431-1 consommation ; abstention.

### q326

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quels sont les actes interdits relatifs à la délivrance et à l'utilisation d'un label rouge selon l'article L432-2 ?

**Gold :** consommation  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** consommation L432-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention niche |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Label rouge L432-2 ; niche agricole/consommation, abstention.

### q327

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelle autorité fixe les modalités d'application des articles L. 433-3 à L. 433-7 ?

**Gold :** consommation  
**V2 :** monétaire  
**V3 :** []  
**V2/V3 :** erreurs légèrement différentes (SWAP/ABST)

**Articles gold :** consommation L433-10

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | abstention/CMF confusion |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L433-10 consommation ; V2 monétaire, V3 abstention — instabilité, jamais correct.

### q329

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles sanctions encourent les personnes morales reconnues pénalement responsables du délit de l'article L. 452-1 ?

**Gold :** consommation  
**V2 :** consommation, pénal  
**V3 :** pénal  
**V2/V3 :** erreurs légèrement différentes (SWAP)

**Articles gold :** consommation L452-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | sanctions→pénal |
| Prompt fixability | **HIGH** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Responsabilité pénale PM art. L452-2 **consommation** ; router route pénal (V3) ou consommation+pénal (V2).

### q330

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelle peine est prévue pour la violation de l'interdiction visée à l'article L. 441-1 ?

**Gold :** consommation  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** consommation L454-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L454-1 consommation ; abstention.

### q331

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelle mesure supplémentaire peut le tribunal ordonner en cas de condamnation pour des faits punis entre les articles L. 451-9 à L. 451-12 ?

**Gold :** consommation  
**V2 :** monétaire  
**V3 :** monétaire  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** consommation L451-16

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **CORPUS_BOUNDARY** |
| Catégorie secondaire | CMF/consommation |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L451-16 consommation ; router monétaire.

### q333

**Type :** single-corpus | **Difficulty :** medium

**Question :** Quelles conditions assurent la cessation de plein droit des mesures de suspension ordonnées selon l'article L455-1 ?

**Gold :** consommation  
**V2 :** []  
**V3 :** []  
**V2/V3 :** même erreur (ABSTENTION)

**Articles gold :** consommation L455-1

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-abstention |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** L455-1 consommation ; abstention.

### q354

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Quelles sanctions sont encourues en cas d'altération d'actes d'état civil et quelles obligations ont les notaires et huissiers concernant la tenue et la transmission des protêts?

**Gold :** civil, monétaire  
**V2 :** commerce, pénal  
**V3 :** monétaire, pénal  
**V2/V3 :** erreurs légèrement différentes (SWAP/UNDER)

**Articles gold :** civil 52, monétaire L131-64

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **UNREASONABLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | multi+sanctions→pénal |
| Prompt fixability | **HIGH** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Deux branches explicites (état civil + protêts). V3 améliore partiellement (monétaire) mais garde pénal, oublie civil.

### q361

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Comment est organisée la formation des salariés appelés à exercer des responsabilités syndicales et quelle est la responsabilité des membres des organes de direction des associations impliquées ?

**Gold :** travail, monétaire  
**V2 :** civil, travail  
**V3 :** civil, travail  
**V2/V3 :** même erreur (UNDER)

**Articles gold :** monétaire L213-19, travail L2145-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **GOLD_PROBLEM** |
| Catégorie secondaire | second corpus article-dependent |
| Prompt fixability | **NONE** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Travail explicite ; monétaire L213-19 (dirigeants associations) non déductible sans l'article gold.

### q363

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Quelles dérogations spécifiques s'appliquent aux SICAV par rapport aux dispositions générales du Code de commerce, et comment la juridiction peut-elle gérer les dommages et intérêts lors d'un ajournement du prononcé de la peine ?

**Gold :** monétaire, pénal  
**V2 :** civil, commerce, monétaire, pénal  
**V3 :** civil, monétaire, pénal  
**V2/V3 :** erreurs légèrement différentes (OVERPREDICTION)

**Articles gold :** pénal 132-70-2, monétaire L214-7-2

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | over-pred civil |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** SICAV (monétaire)+ajournement (pénal). Civil superflu persistant en V2/V3 (V3 retire commerce).

### q369

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Dans quelle mesure un consommateur peut-il être certain que le numéro de téléphone fourni pour l'exécution d'un contrat ou le traitement d'une réclamation ne lui sera pas facturé en plus ?

**Gold :** consommation, commerce  
**V2 :** consommation  
**V3 :** consommation  
**V2/V3 :** même erreur (UNDER)

**Articles gold :** consommation L121-16, commerce L125-19

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **REASONABLE** |
| Catégorie principale | **GOLD_PROBLEM** |
| Catégorie secondaire | commerce mirror article |
| Prompt fixability | **NONE** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Consommation L121-16 seul pertinent ; commerce L125-19 sans ancrage question. Router consommation = correct.

### q382

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Comment l'article 2427 du code civil distribue-t-il les droits de colloque du créancier hypothécaire entre principal, intérêts et arrérages, en lien avec le prêt viager défini à l'article L. 315-1 du code de la consommation, et quelles sont les compétences de l'autorité saisis des amendes selon l'article L171-3 du code monétaire et financier ?

**Gold :** civil, monétaire  
**V2 :** civil, consommation, monétaire  
**V3 :** civil, consommation, monétaire  
**V2/V3 :** même erreur (OVERPREDICTION)

**Articles gold :** civil 2427, monétaire L171-3

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **REASONABLE** |
| Catégorie principale | **QUESTION_FORMULATION** |
| Catégorie secondaire | cite consommation |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question cite L315-1 consommation ; gold civil+monétaire. Router ajoute consommation — défendable textuellement.

### q399

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Selon les articles D223-9 du code de la consommation et L141-28 du code du commerce, dans quelles conditions un professionnel peut-il téléphoner pour de la prospection commerciale, en particulier en ce qui concerne les horaires, jours autorisés, et la consultation préalable du comité social et économique ?

**Gold :** consommation, commerce  
**V2 :** consommation, commerce, travail  
**V3 :** consommation, travail  
**V2/V3 :** erreurs légèrement différentes (SWAP)

**Articles gold :** consommation D223-9, commerce L141-28

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **AMBIGUOUS_LEGAL_INTERPRETATION** |
| Catégorie secondaire | CSE commerce/travail |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Prospection (consommation)+CSE. CSE traité via commerce L141-28 ; V2/V3 ajoutent/perdent commerce vs travail.

### q408

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Comment les dispositions du code du travail s'appliquent-elles au plan d'épargne retraite d'entreprise collectif, et quelles sont les sanctions pénales spécifiques applicables lorsque la négligence d'un conducteur de véhicule terrestre à moteur cause une incapacité de travail inférieure ou égale à trois mois ?

**Gold :** monétaire, pénal  
**V2 :** travail, monétaire, pénal  
**V3 :** travail, pénal  
**V2/V3 :** erreurs légèrement différentes (SWAP)

**Articles gold :** pénal 222-20-1, monétaire L224-13

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **QUESTION_FORMULATION** |
| Catégorie secondaire | cite travail |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question cite travail pour PER ; gold CMF L224-13+pénal. Router inclut travail.

### q410

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Quels sont les critères d'exclusion pour l'acquisition ou la réintégration de la nationalité française en matière pénale, et quelles sanctions sont prévues pour la fourniture de fausses informations commerciales ?

**Gold :** civil, commerce  
**V2 :** civil, pénal  
**V3 :** civil, pénal  
**V2/V3 :** même erreur (SWAP)

**Articles gold :** civil 21-27, commerce L123-5

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **CLEAR** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **TRUE_ROUTER_ERROR** |
| Catégorie secondaire | sanctions→pénal swap |
| Prompt fixability | **HIGH** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Nationalité (civil)+fausses infos commerciales (commerce). V2/V3 substituent pénal à commerce.

### q412

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Quelles sont les obligations relatives à l'avis de défaut de paiement d'un chèque et comment ont-elles été adaptées pour différentes juridictions territoriales françaises ?

**Gold :** civil, monétaire  
**V2 :** monétaire  
**V3 :** monétaire  
**V2/V3 :** même erreur (UNDER)

**Articles gold :** civil 33, monétaire L131-49

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **AMBIGUOUS_LEGAL_INTERPRETATION** |
| Catégorie secondaire | under-pred civil |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Chèque → monétaire explicite ; civil art. 33 (outre-mer) implicite.

### q413

**Type :** multi-corpus | **Difficulty :** hard

**Question :** Comment prouver des actes d'état civil en l'absence ou la perte des registres officiels, et comment l'application immédiate des lois nouvelles affecte-t-elle la validité de ces actes ?

**Gold :** civil, pénal  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (UNDER)

**Articles gold :** pénal 112-4, civil 46

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **PARTIALLY_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **AMBIGUOUS_LEGAL_INTERPRETATION** |
| Catégorie secondaire | under-pred pénal |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** État civil + application lois nouvelles ; pénal 112-4 transversal, non explicite.

### q436

**Type :** ambiguous | **Difficulty :** medium

**Question :** Un contrat peut-il ?tre annul? pour vice du consentement ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Question générique (vice consentement) ; gold []. Router civil — erreur identique V2/V3.

### q438

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quels sont les effets d un manquement contractuel ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Manquement contractuel vague ; gold [].

### q443

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quelles garanties l?gales s appliquent au bien achet? ?

**Gold :** []  
**V2 :** civil, consommation  
**V3 :** consommation  
**V2/V3 :** erreurs légèrement différentes (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Garanties légales bien ; gold []. V2 civil+consommation, V3 consommation.

### q446

**Type :** ambiguous | **Difficulty :** medium

**Question :** Un acte peut-il ?tre nul pour ill?galit? de l objet ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Nullité objet ; gold [].

### q452

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quelles sont les r?gles de publicit? des prix ?

**Gold :** []  
**V2 :** consommation  
**V3 :** consommation  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Publicité prix ; gold [].

### q454

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quelle est la r?gle applicable aux clauses limitatives de responsabilit? ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Clauses limitatives ; gold [].

### q455

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quels sont les droits en cas de rupture brutale de relations ?tablies ?

**Gold :** []  
**V2 :** commerce  
**V3 :** commerce  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Rupture relations établies ; gold [].

### q456

**Type :** ambiguous | **Difficulty :** medium

**Question :** Une personne peut-elle ?tre tenue de r?parer un pr?judice ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Réparer préjudice ; gold [].

### q459

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quelle est la sanction applicable ? une pratique anticoncurrentielle ?

**Gold :** []  
**V2 :** commerce  
**V3 :** commerce  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Anticoncurrence ; gold [].

### q460

**Type :** ambiguous | **Difficulty :** medium

**Question :** Quels sont les droits attach?s ? la propri?t? ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | ambiguous over-pred |
| Prompt fixability | **LOW** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Droits propriété ; gold [].

### q469

**Type :** out-of-scope | **Difficulty :** medium

**Question :** Quelles sont les conditions d ouverture d une proc?dure de divorce ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | OOS→civil projection |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Divorce = OOS dataset ; router civil V2/V3.

### q480

**Type :** out-of-scope | **Difficulty :** hard

**Question :** Quelles sont les conditions de l adoption pl?ni?re ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | OOS→civil projection |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Adoption OOS ; router civil.

### q492

**Type :** out-of-scope | **Difficulty :** hard

**Question :** Quelles sont les conditions de la tutelle d un majeur prot?g? ?

**Gold :** []  
**V2 :** civil  
**V3 :** civil  
**V2/V3 :** même erreur (OVER)

| Critère | Valeur |
| ------- | ------ |
| Gold déductible | **NOT_IDENTIFIABLE** |
| Prédiction raisonnable | **PLAUSIBLE** |
| Catégorie principale | **PROMPT_LIMITATION** |
| Catégorie secondaire | OOS→civil projection |
| Prompt fixability | **MEDIUM** |
| Signal architectural | NO_ARCHITECTURAL_SIGNAL |

**Analyse :** Tutelle OOS ; router civil.

## 4. Classification globale

### Par catégorie principale

| Catégorie | Nombre | % |
| --------- | -----: | --: |
| TRUE_ROUTER_ERROR | 14 | 31.8 % |
| GOLD_PROBLEM | 3 | 6.8 % |
| QUESTION_FORMULATION | 4 | 9.1 % |
| CORPUS_BOUNDARY | 6 | 13.6 % |
| AMBIGUOUS_LEGAL_INTERPRETATION | 3 | 6.8 % |
| PROMPT_LIMITATION | 14 | 31.8 % |
| **Total** | **44** | **100 %** |

### Par déductibilité du gold

| Gold identifiable ? | Nombre |
| ------------------- | -----: |
| CLEAR | 16 |
| PARTIALLY_IDENTIFIABLE | 13 |
| NOT_IDENTIFIABLE | 15 |
| **Total** | **44** |

### Par type d'erreur technique

| Type | N |
| ---- | --: |
| OVER | 13 |
| SWAP | 12 |
| ABSTENTION | 8 |
| OVERPREDICTION | 4 |
| UNDER | 4 |
| OVER/SWAP | 1 |
| SWAP/ABST | 1 |
| SWAP/UNDER | 1 |

## 5. Patterns récurrents

| Pattern | IDs (subset) | Description |
| ------- | ------------ | ----------- |
| A — corpus secondaire invisible | q361, q369, q412, q413 | Second corpus gold non déductible ou discutable depuis la question seule. |
| B — frontière CMF / commerce | q223, q238 | Swap monétaire↔commerce sur contrats/finance. |
| C — frontière CMF / consommation | q245, q249, q308, q309, q331 | Crédit, consommateur, établissement crédit → confusion. |
| D — pénal / travail | q048 | Discrimination embauche → travail vs pénal 713-3. |
| E — civil / commerce | — | Peu présent dans les persistantes. |
| F — abstention excessive | q045, q047, q121, q318, q319, q326, q330, q333 | 8 cas : router abstient alors que gold identifiable (souvent consommation niche ou article cité). |
| G — keyword anchoring | q098, q259, q329, q354, q410 | Sanctions, pénal, crédit, consommateur attirent mauvais corpus. |
| H — multi under-prediction explicite | q354, q410 | Branches explicites mais corpus manquant (civil, commerce) — cas HIGH fixability. |

**Observations :**
- **13/44** sont ambiguous (10) ou OOS (3) : le router sur-prédit systématiquement un corpus au lieu de `[]`.
- **8/44** sont des abstentions persistantes sur single-corpus (surtout consommation de niche).
- **10/44** multi-corpus : 3 gold discutables (q361, q369, q382), 7 vrais problèmes router ou frontière.

## 6. Corrigeabilité par prompt

| Prompt fixability | Nombre | % |
| ----------------- | -----: | --: |
| HIGH | 4 | 9.1 % |
| MEDIUM | 17 | 38.6 % |
| LOW | 20 | 45.5 % |
| NONE | 3 | 6.8 % |
| **Total** | **44** | **100 %** |

**HIGH (4) :** q098, q329, q354, q410 — règles ciblées sanctions/nullité/multi-branche.

**MEDIUM (17) :** abstentions consommation, frontières CMF, OOS, pénal/travail.

**LOW (20) :** ambiguous (10), formulation (4), multi implicites (3), niche (3).

**NONE (3) :** q245, q361, q369 — gold ou prédiction router défendable.

## 7. Signal architectural

| Signal | Nombre |
| ------ | -----: |
| NO_ARCHITECTURAL_SIGNAL | **44** |
| POTENTIAL_ARCHITECTURAL_SIGNAL | **0** |

Aucun cas ne suggère qu'une seconde passe, une classification intermédiaire ou un retrieval préalable serait **indispensable**. 
Les erreurs persistantes relèvent de frontières lexicales, abstention/sur-prédiction, gold discutable ou questions volontairement ambiguës.

## 8. Conclusions

### 1. Vraies erreurs router

**14/44 (31,8 %)** — catégorie TRUE_ROUTER_ERROR. 
Dont **~10** avec gold CLEAR ou PARTIALLY clairement défendable (abstentions consommation, swaps, multi q354/q410/q329).

### 2. Problèmes gold/dataset

**7/44 (15,9 %)** — GOLD_PROBLEM (3) + QUESTION_FORMULATION (4). 
Le router produit souvent une réponse textuellement ou juridiquement défendable (q245, q249, q369, q382, q304, q408).

### 3. Frontières juridiques difficiles

**9/44 (20,5 %)** — CORPUS_BOUNDARY (6) + AMBIGUOUS_LEGAL_INTERPRETATION (3). 
Confusions CMF/consommation/commerce, pénal/travail, CSE commerce/travail.

### 4. Corrigeables par prompt V3.1

**~21/44 (47,7 %)** — fixability HIGH (4) + MEDIUM (17). 
Mais **~20/44 LOW/NONE** ne justifieraient pas des règles agressives.

### 5. Pattern suffisant pour V3.1 ?

**Oui, mais ciblé et modeste.** Les 4 cas HIGH + abstentions consommation (8) + swaps CMF/consommation (5) forment un plan V3.1 cohérent. 
En revanche, la comparaison V2/V3 a montré **14 gains = 14 régressions** : tout V3.1 global risque de reproduire ce trade-off.

### 6. Signal architectural ?

**Non.** 0/44 cas POTENTIAL_ARCHITECTURAL_SIGNAL. Le single-pass reste adapté ; le plancher à 44 erreurs est structurellement lié au dataset (13 ambiguous/OOS) et aux frontières, pas à l'architecture.

## 9. Recommandation

**V3.1 justifié en mode chirurgical**, pas en refonte :
1. Corriger les **4 HIGH** (q098, q329, q354, q410) sans durcir l'abstention globale.
2. Traiter les **8 abstentions consommation** (articles L43x/L45x cités) — risque faible de régression.
3. **Ne pas** tenter de corriger les 10 ambiguous + 3 OOS par prompt sans revoir le dataset — ce sont 13/44 (29,5 %) structurellement difficiles.
4. **Nettoyer le gold** pour q245, q369, q361 avant d'optimiser le prompt.
5. Accepter un plancher **~35–40 erreurs** (~93 % exact) sans architecture V4.

**Avertissement :** si V3.1 applique les leçons de V3 (garde-fous globaux), on peut raisonnablement prévoir un schéma **X corrections + X régressions** similaire — pas une montée linéaire du score.

---

## Annexe — Prédictions différentes mais toujours fausses (8)

| ID | V2 | V3 |
| -- | -- | -- |
| q098 | consommation | civil, pénal |
| q327 | monétaire | [] |
| q329 | consommation, pénal | pénal |
| q354 | commerce, pénal | monétaire, pénal |
| q363 | civil, commerce, monétaire, pénal | civil, monétaire, pénal |
| q399 | consommation, commerce, travail | consommation, travail |
| q408 | travail, monétaire, pénal | travail, pénal |
| q443 | civil, consommation | consommation |