# Diagnostic retrieval � preparation prochaine amelioration RAG

## 1. Executive summary

Le retrieval rate certains articles gold surtout parce que le **top20 quota** ramene des **articles voisins du bon corpus** (meme famille L123, 222-x, etc.) ou des passages **juridiquement proches mais incorrects**, plutot que l article gold exact. Sur les traces disponibles (26 questions multicorpus, proxy quota audit), **24/28** pertes localisees sont des **absences retrieval top20 (R0)** ; **2** sont du reranking (R1) et **2** du filter (R2).

Les **36** articles sans trace pipeline (30 single-corpus + 5 multi) restent **indetermines**. On ne peut pas trancher profondeur topK vs embedding sans listes retrieval >20 (deja confirme par retrieval-depth-benchmark).

**Prochaine experience principale:** replay offline topK 30/50 avec cache embeddings deja exporte + persistance des listes (pas de nouveau E2E 500) pour separer profondeur insuffisante vs mauvais ranking vectoriel intrinseque.

## 2. Architecture actuelle

### Embedding query

- Texte embedde: Exact string passed to searchQuestion: validateQuestion(question) => question.trim() � no prefix/suffix, no routing context, no corpus hint in the embedding text.
- Modele: env `OPENAI_EMBEDDING_MODEL` (E2E: text-embedding-3-large)
- Dimensions: 3072

### Recherche SQL (pgvector)

- Table: `legal_code_chunks`
- Distance: cosine (<=> pgvector on legal_code_chunks.embedding)
- Tri: ASC distance (lower = closer)
- Single-corpus: one SQL query, corpus_id filter, LIMIT topK
- Multi-corpus (routing): per-corpus SQL with ceil(topK/n) each, merge dedupe, sort by distance, slice topK

### Champs retournes

- corpusId
- chunkId
- articleNumber
- content
- metadata (PenalCodeChunkMetadata)
- distance

### Chunking (ingestion)

- TARGET_SIZE=1500 chars, MAX_SIZE=2000, decoupe par unites juridiques puis phrases / hard split.
- chunkId: `articleNumber#chunkIndex`

## 3. Donnees observables

| Source | Contenu | Limite |
|--------|---------|--------|
| E2E 500 | sources finales, judge, profiling | pas de top20/top5 persistes |
| context-loss-forensic | 61 cas A, stages R0-R4 | 26 q avec pipeline proxy |
| quota audit 2026-09-21 | retrieval top20 + rerank top5 | pas meme run E2E, 41 q dont 26 overlap |
| retrieval-depth-benchmark | recall @20 = 53.8% (26 q) | @30+ non calculable sans replay |
| data/processed/*.chunks.json | texte/stats chunking gold | pas de scores vectoriels |

- Questions avec trace retrieval+rerank: **26**
- Articles gold manquants analyses: **64**
- Indetermines (R4): **36**

## 4. Analyse des cas

- **R0 retrieval (top20):** 24 articles � voir patterns concurrents ci-dessous.
- **R1 reranking:** 2 articles � gold present dans retrieval top20 mais absent du top5 Jina.
- **R2 filter:** 2 articles � present top5, elimine par seuil 0.40 (replay min1/corpus).

Patterns concurrents (R0 uniquement):

| Pattern | Count |
|---------|------:|
| A_same_corpus_wrong_article | 9 |
| B_semantically_close_wrong_article | 13 |
| C_similar_vocabulary_chunk | 0 |
| D_other_corpus_dominant | 2 |
| E_generic_or_definition_chunk | 0 |
| F_no_plausible_neighbor | 0 |

Lecture: la majorite des R0 montrent le **bon corpus** avec des **articles alternatifs** (ex. q352: L123-3/L123-5-1 au lieu de L123-8).

## 5. Classification des causes

| Cause | Nombre |
|-------|------:|
| Profondeur topK (non d?montr?e sans top>20) | 0 |
| Mauvais matching s?mantique / mauvais article m?me corpus | 22 |
| Signal chunking (multi-chunk / split) | 0 |
| Comp?tition multicorpus (corpus gold absent top20) | 2 |
| Reranking Jina (gold top20, absent top5) | 2 |
| Dynamic filter (gold top5, supprim?) | 2 |
| Ind?termin? (pas de trace pipeline) | 36 |

## 6. Hypotheses

| Hypothese | Statut |
|-----------|--------|
| H1 Profondeur topK (gold en rang 21-50) | **Non demontree** (pas de top>20) |
| H2 Mauvais matching semantique query/chunk | **Fortement supportee** (22 articles classes, R0 avec voisins meme corpus) |
| H3 Chunking defavorable | **Plausible** (signaux multi-chunk sur subset) |
| H4 Reranking Jina | **Supportee** (2 cas R1) |
| H5 Filter | **Supportee** (2 cas R2, marginal post min1/corpus) |
| H6 Competition multicorpus quota | **Plausible** (2 cas corpus gold absent du top20) |

## 7. Prochaine experience recommandee

**Experience unique:** replay retrieval **topK 30 et 50** (quota + global) sur les **61** questions cohorte A, avec **1 embedding/question deja en cache** + SQL Postgres, sans Jina/generation/judge.

- **Hypothese:** une part des 24 R0 est due a la profondeur top20; le reste confirmera un plafond semantique.
- **Protocole:** utiliser `export:retrieval-depth-embedding-cache-e2e500` (one-shot) puis `audit:retrieval-depth-e2e500`; persister listes completes.
- **Metrique:** gain recall @30/@50 vs @20; buckets P20-30 / P30-40 / P40-50 / P50+ sur les 24 absents @20.
- **Cout:** ~61 embeddings (deja prevu) + SQL local; pas d E2E 500.
- **Positif:** recall @30 >> @20 ? tester retrievalTopK 30 en smoke cible avant prod.
- **Negatif:** recall @50 proche de @20 -> prioriser query/hybrid retrieval ou reranking, pas topK.

## 8. Ce qu on NE doit PAS modifier maintenant

- Routing V3.1 (gele)
- Quota multicorpus 10+10 @20
- Dynamic filter min1/corpus @0.40
- Generation / prompts / modeles

## 9. Exemples representatifs

### q352 � code-du-commerce:L123-8

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Quels recours un juge peut-il ordonner en référé pour faire cesser une atteinte à la présomption d'innocence, et quelles sont les obligations d'un commerçant non immatriculé?�

**Top retrieval:** code-civil:9-1, code-du-commerce:L123-3, code-du-commerce:L470-1, code-du-commerce:L123-5-1, code-du-commerce:L442-4, code-du-commerce:R526-24, code-du-commerce:L526-20, code-du-commerce:L954-5, code-du-commerce:L239-5, code-du-commerce:R152-1

**Alternatives meme corpus:** code-du-commerce:L123-3, code-du-commerce:L470-1, code-du-commerce:L123-5-1, code-du-commerce:L442-4, code-du-commerce:R526-24, code-du-commerce:L526-20, code-du-commerce:L954-5, code-du-commerce:L239-5, code-du-commerce:R152-1, code-du-commerce:R470-1

**Pattern:** A_same_corpus_wrong_article

**Chunking:** n/a

### q360 � code-penal:132-15

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Quelles conditions doit contenir le contrat constitutif ou les statuts pour éviter la nullité, et comment cela s'articule-t-il avec la responsabilité pénale d'une personne morale en cas de récidive ?�

**Top retrieval:** code-penal:314-12, code-penal:717-3, code-penal:422-5, code-penal:414-7, code-penal:313-9, code-penal:450-4, code-penal:222-16-1, code-penal:223-2, code-penal:222-42, code-penal:434-47

**Alternatives meme corpus:** code-penal:314-12, code-penal:717-3, code-penal:422-5, code-penal:414-7, code-penal:313-9, code-penal:450-4, code-penal:222-16-1, code-penal:223-2, code-penal:222-42, code-penal:434-47

**Pattern:** B_semantically_close_wrong_article

**Chunking:** n/a

### q367 � code-du-commerce:L124-3

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** En cas de manquement du professionnel à son obligation de délivrance d'un bien, comment le consommateur peut-il mettre en œuvre la résolution du contrat, et quelles sont les conditions spécifiques à r�

**Top retrieval:** code-de-la-consommation:L216-6, code-de-la-consommation:L217-14, code-de-la-consommation:L224-25-11, code-de-la-consommation:L217-16, code-de-la-consommation:L224-25-22, code-de-la-consommation:annexe-D211-2, code-de-la-consommation:annexe-D211-4, code-de-la-consommation:annexe-D211-3, code-de-la-consommation:L221-15, code-de-la-consommation:L224-25-20

**Alternatives meme corpus:** code-du-commerce:L442-1, code-du-commerce:L441-5, code-du-commerce:L441-7, code-du-commerce:L441-3, code-du-commerce:L124-4-1, code-du-commerce:L124-15, code-du-commerce:L125-16, code-du-commerce:L441-1, code-du-commerce:L441-18

**Pattern:** A_same_corpus_wrong_article

**Chunking:** n/a

### q371 � code-du-travail:L1221-19

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Quels sont les droits et obligations liés au consentement exprès du consommateur pour les paiements supplémentaires dans un contrat de vente ou de prestation de services, et quelles limites de durée d�

**Top retrieval:** code-de-la-consommation:L121-17, code-de-la-consommation:L221-10, code-de-la-consommation:L224-73, code-de-la-consommation:L224-77, code-de-la-consommation:L121-12, code-de-la-consommation:L224-78, code-de-la-consommation:L224-28, code-de-la-consommation:L222-7, code-de-la-consommation:L221-18, code-de-la-consommation:L221-25

**Alternatives meme corpus:** code-du-travail:L1221-22, code-du-travail:L8254-1, code-du-travail:L8222-1, code-du-travail:L1242-10, code-du-travail:L1254-4, code-du-travail:L1221-21, code-du-travail:L1262-4-1, code-du-travail:L7313-5, code-du-travail:L1251-14, code-du-travail:L1221-25

**Pattern:** A_same_corpus_wrong_article

**Chunking:** n/a

### q374 � code-monetaire-et-financier:L133-25-2

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Quels articles du code du commerce et du code monétaire et financier régissent les conditions spécifiques des contrats d'appui au projet d'entreprise et les droits de remboursement dans le cadre des o�

**Top retrieval:** code-du-commerce:R127-1, code-du-commerce:L127-5, code-monetaire-et-financier:L511-4, code-du-commerce:L127-6, code-du-commerce:L127-7, code-monetaire-et-financier:L313-6, code-monetaire-et-financier:L511-6, code-du-commerce:L127-1, code-monetaire-et-financier:L313-10, code-monetaire-et-financier:L317-3

**Alternatives meme corpus:** code-monetaire-et-financier:L511-4, code-monetaire-et-financier:L313-6, code-monetaire-et-financier:L511-6, code-monetaire-et-financier:L313-10, code-monetaire-et-financier:L317-3, code-monetaire-et-financier:R212-8, code-monetaire-et-financier:L744-1, code-monetaire-et-financier:L313-13, code-monetaire-et-financier:L313-31, code-monetaire-et-financier:L547-5

**Pattern:** B_semantically_close_wrong_article

**Chunking:** n/a

### q375 � code-penal:132-70-3

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Comment les responsabilités sont-elles définies respectivement dans le contrat d'appui au projet d'entreprise selon le code du commerce et la compétence de la juridiction relative à la consignation en�

**Top retrieval:** code-du-commerce:L127-6, code-du-commerce:R127-1, code-du-commerce:L127-2, code-du-commerce:L127-5, code-du-commerce:L127-1, code-du-commerce:L680-4, code-du-commerce:L127-4, code-du-commerce:L611-2, code-du-commerce:Annexe 8-9, code-du-commerce:L442-4

**Alternatives meme corpus:** code-penal:314-8, code-penal:727-3, code-penal:717-3, code-penal:445-4, code-penal:450-4, code-penal:324-9, code-penal:215-3, code-penal:321-12, code-penal:222-42, code-penal:313-9

**Pattern:** B_semantically_close_wrong_article

**Chunking:** n/a

### q378 � code-penal:221-6

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Dans quelles conditions la demande de remboursement de monnaie électronique est-elle possible avant terme selon le code monétaire et financier, et quelles sont les sanctions prévues par le code pénal �

**Top retrieval:** code-monetaire-et-financier:L133-33, code-monetaire-et-financier:L133-35, code-monetaire-et-financier:L133-34, code-monetaire-et-financier:L133-31, code-monetaire-et-financier:L315-7, code-monetaire-et-financier:L133-36, code-monetaire-et-financier:L133-29, code-monetaire-et-financier:L133-30, code-monetaire-et-financier:L526-32, code-monetaire-et-financier:R561-14-1-1

**Alternatives meme corpus:** code-penal:442-15, code-penal:R645-9, code-penal:R642-2, code-penal:431-29, code-penal:222-44-1, code-penal:442-4, code-penal:R642-3, code-penal:442-1, code-penal:314-2, code-penal:R642-4

**Pattern:** B_semantically_close_wrong_article

**Chunking:** n/a

### q379 � code-de-la-consommation:liminaire

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Selon l'article 1898 du code civil et le liminaire du code de la consommation, quelle responsabilité le prêteur encourt-il dans un prêt de consommation lorsque l'emprunteur est un consommateur ?�

**Top retrieval:** code-civil:1898, code-de-la-consommation:L312-27, code-de-la-consommation:L313-29, code-de-la-consommation:L341-26-1, code-de-la-consommation:L341-27, code-de-la-consommation:L312-47, code-de-la-consommation:L312-36, code-de-la-consommation:L341-44-1, code-de-la-consommation:L313-16, code-de-la-consommation:L341-1

**Alternatives meme corpus:** code-de-la-consommation:L312-27, code-de-la-consommation:L313-29, code-de-la-consommation:L341-26-1, code-de-la-consommation:L341-27, code-de-la-consommation:L312-47, code-de-la-consommation:L312-36, code-de-la-consommation:L341-44-1, code-de-la-consommation:L313-16, code-de-la-consommation:L341-1, code-de-la-consommation:L341-25

**Pattern:** B_semantically_close_wrong_article

**Chunking:** article-multi-chunk, information-split-across-chunks

### q381 � code-du-travail:L2132-5

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** Quels effets produisent, selon les articles 2422 du code civil et L2132-5 du code du travail, les inscriptions hypothécaires en cas de procédures judiciaires, et quelles sont les fonctions des syndica�

**Top retrieval:** code-civil:2422, code-du-travail:L3253-1, code-du-travail:L1253-8-2, code-du-travail:L3253-23, code-du-travail:L3253-12, code-du-travail:L143-11-9, code-civil:2432, code-du-travail:L3253-16, code-civil:2421, code-civil:2404

**Alternatives meme corpus:** code-du-travail:L3253-1, code-du-travail:L1253-8-2, code-du-travail:L3253-23, code-du-travail:L3253-12, code-du-travail:L143-11-9, code-du-travail:L3253-16, code-du-travail:L3253-8, code-du-travail:L3253-18-7, code-du-travail:L3253-13

**Pattern:** B_semantically_close_wrong_article

**Chunking:** n/a

### q383 � code-penal:131-5-1

**Stage:** R0 | **Cause:** semantic_mismatch

**Question (extrait):** En s’appuyant sur l’article 2429 du code civil et l’article 131-5-1 du code pénal, quelles sont les durées maximales d’inscription d’une hypothèque selon différentes échéances, et quelles alternatives�

**Top retrieval:** code-civil:2429, code-civil:2400, code-penal:132-78-1, code-civil:2432, code-civil:2404, code-civil:2418, code-civil:2422, code-penal:422-3, code-penal:442-11, code-penal:445-3

**Alternatives meme corpus:** code-penal:132-78-1, code-penal:422-3, code-penal:442-11, code-penal:445-3, code-penal:462-3, code-penal:213-1, code-penal:131-4, code-penal:227-3, code-penal:445-4, code-penal:215-1

**Pattern:** A_same_corpus_wrong_article

**Chunking:** n/a

