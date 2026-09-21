# Benchmark retrieval depth � cohorte A (61 erreurs contexte)

## 1. Executive summary

Avec les seuls artefacts top20 (26 questions), le recall @20 quota est 53.8%. Les profondeurs 21�50 ne sont **pas mesurables** sans replay vectoriel local (cache embeddings).



## 2. Dataset

- Cohorte A (contexte insuffisant): **61** questions
- Single-corpus: **30**
- Multicorpus: **31**
- Benchmarkables quota @20 (artefact): **26**
- Benchmarkables local @50 (cache embeddings + Postgres): **0** (quota) / **0** (global)
- Non benchmarkables (sans top20 ni embedding cache): **35**

Sources:
- `generation-forensic-audit-2026-09-21` (cohorte)
- `multicorpus-rerank-filter-audit-quota-2026-09-21` (retrieval top20 persiste, strategie quota production)
- Routing `2026-09-19T22-46-46-088Z/routing.json` (corpus routes pour replay local)
- Embeddings: fichier cache optionnel (pas de recalcul API dans ce script)

## 3. Results � quota @20 (artefact persiste)

| K | Gold recall | Questions full coverage | Gold absents |
|-:|------------:|------------------------:|-------------:|
| 20 | 53.8% (28/52) | 2/26 | 24 |

## 3b. Results � quota (local replay @50, derive @20/@30/@40/@50)

| K | Gold recall | Questions full coverage | Gold absents |
|-:|------------:|------------------------:|-------------:|
| 20 | 0.0% (0/0) | 0/0 | 0 |
| 30 | 0.0% (0/0) | 0/0 | 0 |
| 40 | 0.0% (0/0) | 0/0 | 0 |
| 50 | 0.0% (0/0) | 0/0 | 0 |

## 3c. Results � global retrieval (local replay)

| K | Gold recall | Questions full coverage | Gold absents |
|-:|------------:|------------------------:|-------------:|
| 20 | 0.0% (0/0) | 0/0 | 0 |
| 30 | 0.0% (0/0) | 0/0 | 0 |
| 40 | 0.0% (0/0) | 0/0 | 0 |
| 50 | 0.0% (0/0) | 0/0 | 0 |

## 4. Marginal gains (quota local)

- non calculable (replay local indisponible)

## 5. Gold depth (articles gold absents @20)

### Artefact top20 seulement

| Categorie | Articles |
|-----------|--------:|
| present @20 | 28 |
| profondeur 21�50 non observee | 24 |
| P20-30 | 0 |
| P30-40 | 0 |
| P40-50 | 0 |
| absent @50 | 0 |

## 6. Single vs multicorpus

Voir `benchmark.json` sections `byQuestionType` pour le detail @20 artefact et replay local.

## 7. Exemples representatifs

### q352

**Question:** q352 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-civil:9-1 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20
- code-du-commerce:L123-8 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20

### q360

**Question:** q360 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-penal:132-15 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20
- code-du-commerce:L125-8 ranks@20/30/40/50=14 / n/a / n/a / n/a bucket=present_at_20

### q361

**Question:** q361 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-monetaire-et-financier:L213-19 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20
- code-du-travail:L2145-2 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20

### q362

**Question:** q362 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-penal:132-60 ranks@20/30/40/50=12 / n/a / n/a / n/a bucket=present_at_20
- code-du-travail:L2145-8 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20

### q367

**Question:** q367 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-du-commerce:L124-3 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20
- code-de-la-consommation:L216-6 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20

### q371

**Question:** q371 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-de-la-consommation:L121-17 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20
- code-du-travail:L1221-19 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20

### q374

**Question:** q374 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-du-commerce:L127-5 ranks@20/30/40/50=2 / n/a / n/a / n/a bucket=present_at_20
- code-monetaire-et-financier:L133-25-2 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20

### q375

**Question:** q375 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-penal:132-70-3 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20
- code-du-commerce:L127-6 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20

### q378

**Question:** q378 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-penal:221-6 ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20
- code-monetaire-et-financier:L133-33 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20

### q379

**Question:** q379 (multi-corpus, quota, quota-audit-top20)

**Gold depth:**
- code-civil:1898 ranks@20/30/40/50=1 / n/a / n/a / n/a bucket=present_at_20
- code-de-la-consommation:liminaire ranks@20/30/40/50=- / n/a / n/a / n/a bucket=not_observed_beyond_20

## 8. Interpretation

- Artefact @20: mesure fidele du pipeline quota production sur le sous-ensemble instrumente.
- Sans replay @50, les articles absents @20 ne peuvent pas etre classes entre 21�50 et P50+.
- Replay local (cache embeddings + Postgres) distingue profondeur insuffisante vs absence vectorielle.

## 9. Recommendation

- Generer `question-embeddings-cache.json` (export one-shot) puis relancer ce benchmark pour trancher profondeur vs embedding.
- Persister retrieval top50 dans les prochains runs E2E/diagnostics pour eviter le replay.

