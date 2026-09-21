# Audit forensic � pertes de contexte (E2E 500)

## Resume executif

```text
61 erreurs de contexte auditees.

Retrieval : 24 (24 articles gold)
Reranking : 2 (2 articles gold)
Filter : 2 (2 articles gold)
Mapping/ambiguite : 0 (0 articles gold)
Indetermine : 35 (36 articles gold)
```

Cohorte: **61** erreurs categorie **A � contexte insuffisant** (generation forensic), **hors q372** (vraie generation).

- Run E2E: `2026-09-21T16-59-10-310Z`
- Trace pipeline complete (proxy): **26** questions
- Contexte final seul: **35** questions

## 1. Methodologie

- Cohorte importee depuis `generation-forensic-audit-2026-09-21/per-question.json` (forensicCategory A).
- Sources finales: variante **routing** du run E2E (`e2e.json` / e2e-cache) � `corpusId` + `articleNumber`.
- Run E2E 500 **ne persiste pas** retrieval top20, rerank top5 ni chunks filtres.
- Pour **26** questions multicorpus bi-routees: retrieval + rerank depuis `multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json` (proxy offline, meme hyperparametres top20/top5/seuil 0.40).
- Filter **rejoue** localement via `dynamicContextFilter` production (min1/corpus conditionnel si plusieurs corpus routes).
- Classification par article gold manquant: R0 retrieval, R1 rerank, R2 filter, R3 mapping, R4 indetermine.
- **Aucun** appel OpenAI, Jina, embedding ou relance E2E.

### Artefacts E2E 500 inspectes

- Present: `e2e.json`, `report.json`, `e2e-cache/*.json` (sources finales, judge, profiling counts).
- Absent: listes retrieval/rerank/filter par question dans le run E2E 500.
- Proxy: `multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json` (26 questions overlap).

## 2. Resultat global

| Etape | Questions avec au moins un gold perdu ici | Gold articles perdus |
|-------|----------------------------------------:|---------------------:|
| Retrieval | 24 | 24 |
| Reranking | 2 | 2 |
| Filter | 2 | 2 |
| Mapping/ambigu | 0 | 0 |
| Indetermine | 35 | 36 |

### Comptage par raison (articles gold manquants)

| Raison | Count |
|--------|------:|
| R0 retrieval | 24 |
| R1 reranking | 2 |
| R2 filter | 2 |
| R3 mapping | 0 |
| R4 indetermine | 36 |

## 3. Single-corpus (30 cas)

Aucun artefact retrieval/rerank dans le run E2E 500 pour ces IDs. Tous les articles gold manquants sont classes **R4** (localisation pipeline impossible).

| Etape | Questions | Articles gold |
|-------|----------:|--------------:|
| Retrieval | 0 | 0 |
| Reranking | 0 | 0 |
| Filter | 0 | 0 |
| Mapping/ambigu | 0 | 0 |
| Indetermine | 30 | 30 |

## 4. Multicorpus (31 cas)

| Etape | Questions | Articles gold |
|-------|----------:|--------------:|
| Retrieval | 24 | 24 |
| Reranking | 2 | 2 |
| Filter | 2 | 2 |
| Mapping/ambigu | 0 | 0 |
| Indetermine | 5 | 6 |

### Single vs multi (tableau combine)

| Etape | Q single | Gold single | Q multi | Gold multi |
|-------|---------:|------------:|--------:|-----------:|
| Retrieval | 0 | 0 | 24 | 24 |
| Reranking | 0 | 0 | 2 | 2 |
| Filter | 0 | 0 | 2 | 2 |
| Mapping/ambigu | 0 | 0 | 0 | 0 |
| Indetermine | 30 | 30 | 5 | 6 |

Hypothese multicorpus partiels (29 cas couverture gold partielle): pertes retrieval/rerank/filter observables sur le sous-ensemble proxy **26/31** multicorpus.

## 5. Patterns

- **single-corpus-sans-artefacts-pipeline**: 30 questions � zero gold en contexte final, etape amont non mesurable sur E2E 500.
- **multicorpus-gold-absent-retrieval-top20**: articles gold jamais dans le top20 (proxy).
- **multicorpus-gold-perdu-au-rerank-top5**: present en retrieval, absent du top5 Jina (proxy).
- **multicorpus-gold-perdu-au-filter-0.40**: present top5, elimine par seuil relatif 0.40 (replay production min1/corpus).
- **couverture-gold-partielle-sources-finales**: un corpus/article gold present, un autre manquant.
- **meme-corpus-articles-voisins**: contexte du bon corpus mais mauvais numero d article (typique single-corpus).

## 6. Comparaison audits precedents

- `multicorpus-rerank-filter-audit-2026-09-20/` et quota 2026-09-21: dominante **rerank** (classe B) puis **filter** (classe C) avant min1/corpus.
- `multicorpus-filter-final-validation-2026-09-21T16-11-25-231Z/`: min1/corpus ameliore la couverture corpus au filter pour le cohort proxy; les pertes restantes sur les 61 erreurs E2E incluent surtout l **indetermine** faute de traces single-corpus.
- min1/corpus ne resout pas les articles gold absents du top5 Jina ni absents du top20 retrieval.

## 7. Metriques offline

- Scope: Sous-ensemble 26 questions (proxy quota audit) + rappel final sur les 61 depuis sources E2E
- gold article recall @20 retrieval (proxy 26 q): **53.8%**
- gold article recall @5 rerank: **50.0%**
- gold article recall final context (proxy): **46.2%**
- corpus coverage retrieval / rerank / final (proxy): **53.8%** / **50.0%** / **82.7%**
- Rappel article gold contexte final (61 questions E2E): 29/93 = 0.312.

## 8. Exemples representatifs

### q352

**Question:** Quels recours un juge peut-il ordonner en référé pour faire cesser une atteinte à la présomption d'innocence, et quelles sont les obligations d'un commerçant non immatriculé?

**Gold:** code-civil:9-1, code-du-commerce:L123-8

**Routed:** code-civil, code-du-commerce

**Retrieval (top5):** code-civil:9-1@r1, code-du-commerce:L123-3@r2, code-du-commerce:L470-1@r3, code-du-commerce:L123-5-1@r4, code-du-commerce:L442-4@r5

**Reranking (top5):** code-civil:9-1@r1, code-du-commerce:L123-3@r2, code-civil:16-2@r3, code-du-commerce:L442-4@r4, code-du-commerce:R526-24@r5

**Contexte final:** code-civil:9-1, code-du-commerce:L123-3

**Pertes:** code-du-commerce:L123-8?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q360

**Question:** Quelles conditions doit contenir le contrat constitutif ou les statuts pour éviter la nullité, et comment cela s'articule-t-il avec la responsabilité pénale d'une personne morale en cas de récidive ?

**Gold:** code-penal:132-15, code-du-commerce:L125-8

**Routed:** code-du-commerce, code-penal

**Retrieval (top5):** code-penal:314-12@r1, code-penal:717-3@r2, code-penal:422-5@r3, code-penal:414-7@r4, code-penal:313-9@r5

**Reranking (top5):** code-du-commerce:L125-8@r1, code-du-commerce:L227-20-1@r2, code-du-commerce:L210-6@r3, code-penal:414-7@r4, code-du-commerce:L210-8@r5

**Contexte final:** code-du-commerce:L125-8, code-penal:414-7

**Pertes:** code-penal:132-15?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q361

**Question:** Comment est organisée la formation des salariés appelés à exercer des responsabilités syndicales et quelle est la responsabilité des membres des organes de direction des associations impliquées ?

**Gold:** code-monetaire-et-financier:L213-19, code-du-travail:L2145-2

**Routed:** code-civil, code-du-travail

**Retrieval (top5):** code-du-travail:L2145-2@r1, code-du-travail:L2315-17@r2, code-du-travail:R7343-72@r3, code-du-travail:L2315-18@r4, code-du-travail:L2145-1@r5

**Reranking (top5):** code-du-travail:L2145-2@r1, code-du-travail:L6122-4@r2, code-du-travail:L2145-1@r3, code-du-travail:L2145-5@r4, code-du-travail:L2315-17@r5

**Contexte final:** code-du-travail:L2145-2

**Pertes:** code-monetaire-et-financier:L213-19?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q362

**Question:** Quelles limites réglementaires encadrent les congés pour formation des salariés exerçant des responsabilités syndicales, et dans quelles conditions la juridiction peut-elle ajourner le prononcé d'une peine ?

**Gold:** code-penal:132-60, code-du-travail:L2145-8

**Routed:** code-du-travail, code-penal

**Retrieval (top5):** code-du-travail:L2145-8@r1, code-du-travail:L2145-11@r2, code-du-travail:L2145-1@r3, code-du-travail:L2145-5@r4, code-du-travail:R3142-44@r5

**Reranking (top5):** code-du-travail:L2145-8@r1, code-du-travail:L2145-1@r2, code-penal:132-70-1@r3, code-penal:132-60@r4, code-penal:132-65@r5

**Contexte final:** code-du-travail:L2145-8, code-du-travail:L2145-1, code-penal:132-70-1

**Pertes:** code-penal:132-60?R2

**Cause primaire:** Filter (quota-audit-proxy-replay)

### q367

**Question:** En cas de manquement du professionnel à son obligation de délivrance d'un bien, comment le consommateur peut-il mettre en œuvre la résolution du contrat, et quelles sont les conditions spécifiques à respecter selon le Code de la consommation ? En outre, quel cadre juridique régit la forme et le fonctionnement des sociétés coopératives de commerçants de détail, notamment en matière de responsabilité et de constitution ?

**Gold:** code-du-commerce:L124-3, code-de-la-consommation:L216-6

**Routed:** code-de-la-consommation, code-du-commerce

**Retrieval (top5):** code-de-la-consommation:L216-6@r1, code-de-la-consommation:L217-14@r2, code-de-la-consommation:L224-25-11@r3, code-de-la-consommation:L217-16@r4, code-de-la-consommation:L224-25-22@r5

**Reranking (top5):** code-de-la-consommation:L216-6@r1, code-du-commerce:L124-15@r2, code-de-la-consommation:L224-25-22@r3, code-de-la-consommation:L217-16@r4, code-de-la-consommation:L224-25-11@r5

**Contexte final:** code-de-la-consommation:L216-6, code-du-commerce:L124-15

**Pertes:** code-du-commerce:L124-3?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q371

**Question:** Quels sont les droits et obligations liés au consentement exprès du consommateur pour les paiements supplémentaires dans un contrat de vente ou de prestation de services, et quelles limites de durée de période d'essai s'appliquent pour un contrat de travail à durée indéterminée ?

**Gold:** code-de-la-consommation:L121-17, code-du-travail:L1221-19

**Routed:** code-de-la-consommation, code-du-travail

**Retrieval (top5):** code-de-la-consommation:L121-17@r1, code-de-la-consommation:L221-10@r2, code-de-la-consommation:L224-73@r3, code-de-la-consommation:L224-77@r4, code-de-la-consommation:L121-12@r5

**Reranking (top5):** code-de-la-consommation:L121-17@r1, code-du-travail:L1242-10@r2, code-du-travail:L1221-22@r3, code-du-travail:L7313-5@r4, code-de-la-consommation:L221-10@r5

**Contexte final:** code-de-la-consommation:L121-17, code-du-travail:L1242-10, code-du-travail:L1221-22

**Pertes:** code-du-travail:L1221-19?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q374

**Question:** Quels articles du code du commerce et du code monétaire et financier régissent les conditions spécifiques des contrats d'appui au projet d'entreprise et les droits de remboursement dans le cadre des opérations de paiement ?

**Gold:** code-du-commerce:L127-5, code-monetaire-et-financier:L133-25-2

**Routed:** code-du-commerce, code-monetaire-et-financier

**Retrieval (top5):** code-du-commerce:R127-1@r1, code-du-commerce:L127-5@r2, code-monetaire-et-financier:L511-4@r3, code-du-commerce:L127-6@r4, code-du-commerce:L127-7@r5

**Reranking (top5):** code-du-commerce:R127-1@r1, code-du-commerce:L127-5@r2, code-du-commerce:L127-2@r3, code-du-commerce:L127-7@r4, code-du-commerce:R127-3@r5

**Contexte final:** code-du-commerce:R127-1

**Pertes:** code-du-commerce:L127-5?R2; code-monetaire-et-financier:L133-25-2?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

### q375

**Question:** Comment les responsabilités sont-elles définies respectivement dans le contrat d'appui au projet d'entreprise selon le code du commerce et la compétence de la juridiction relative à la consignation en cas d'ajournement de prononcé selon le code pénal ?

**Gold:** code-penal:132-70-3, code-du-commerce:L127-6

**Routed:** code-du-commerce, code-penal

**Retrieval (top5):** code-du-commerce:L127-6@r1, code-du-commerce:R127-1@r2, code-du-commerce:L127-2@r3, code-du-commerce:L127-5@r4, code-du-commerce:L127-1@r5

**Reranking (top5):** code-du-commerce:L127-6@r1, code-du-commerce:R127-1@r2, code-du-commerce:L127-2@r3, code-du-commerce:L127-1@r4, code-du-commerce:L127-4@r5

**Contexte final:** code-du-commerce:L127-6, code-du-commerce:R127-1

**Pertes:** code-penal:132-70-3?R0

**Cause primaire:** Retrieval (quota-audit-proxy-replay)

## 9. Conclusion

Le principal goulot **sur les traces disponibles** est le **retrieval**: **24/28** articles gold manquants localises (proxy 26 q) sont absents du top20 avant rerank/filter.

- Reranking (R1): **2** articles gold.
- Filter replay production min1/corpus @ 0.40 (R2): **2** articles gold.
- **30** questions single-corpus + **5** multicorpus hors proxy: **36** articles en **R4** (non calculable sur E2E 500 seul).

- Sur le sous-ensemble mesurable, retrieval (+ rerank marginale) domine; le filter n explique que **2** pertes apres min1/corpus.

- Prochain benchmark recommande (sans modifier la production): E2E ou replay **avec persistance retrieval top20 + rerank top5** pour les **30 single-corpus**; conserver le cohort multicorpus proxy pour comparer rerank vs retrieval.

