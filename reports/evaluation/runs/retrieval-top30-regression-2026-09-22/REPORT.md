# Mini E2E regression retrievalTopK=30

## Cohorte (30 questions)

| questionId | categorie | rationale |
|------------|-----------|-----------|
| q334 | topk30_gain | Gold recupere uniquement en rangs 21-30 dans le smoke topK=30. |
| q367 | topk30_gain | Gold recupere uniquement en rangs 21-30 dans le smoke topK=30. |
| q378 | topk30_gain | Gold recupere uniquement en rangs 21-30 dans le smoke topK=30. |
| q352 | multi_corpus_retrieval_loss | Multicorpus avec perte gold localisee retrieval (audit context-loss). |
| q360 | multi_corpus_retrieval_loss | Multicorpus avec perte gold localisee retrieval (audit context-loss). |
| q361 | multi_corpus_retrieval_loss | Multicorpus avec perte gold localisee retrieval (audit context-loss). |
| q400 | multi_corpus_rerank_loss | Multicorpus avec perte gold localisee reranking (audit context-loss). |
| q362 | multi_corpus_filter_loss | Multicorpus avec perte gold localisee filter (audit context-loss). |
| q004 | monocorpus_baseline_good | Monocorpus avec correctness/groundedness >= 4 sur E2E500 routing @20. |
| q005 | monocorpus_baseline_good | Monocorpus avec correctness/groundedness >= 4 sur E2E500 routing @20. |
| q008 | monocorpus_baseline_good | Monocorpus avec correctness/groundedness >= 4 sur E2E500 routing @20. |
| q009 | monocorpus_baseline_good | Monocorpus avec correctness/groundedness >= 4 sur E2E500 routing @20. |
| q426 | abstention_ambiguous | Question ambigue � abstention attendue. |
| q427 | abstention_ambiguous | Question ambigue � abstention attendue. |
| q466 | abstention_out_of_scope | Question hors perimetre � abstention attendue. |
| q467 | abstention_out_of_scope | Question hors perimetre � abstention attendue. |
| q011 | abstention_router_empty | Router V3.1 retourne predictedCorpusIds=[] (run routing 2026-09-19). |
| q006 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q010 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q012 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q013 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q014 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q015 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q016 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q017 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q018 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q019 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q020 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q021 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |
| q022 | normal_baseline | Monocorpus stable sur E2E500 routing @20 (correctness/completeness >= 3). |

## Configuration

```json
{
  "retrievalTopK": 30,
  "rerankTopK": 5,
  "relativeScoreThreshold": 0.4,
  "routingModel": "gpt-5.6-luna",
  "liveRouting": true
}
```

- Routing: **live V3.1** (production)
- Seule variable vs prod actuelle: `retrievalTopK=30`

## Appels API

```json
{
  "embedding": 21,
  "reranking": 26,
  "generation": 26,
  "judge": 60,
  "routing": 30
}
```

## Metriques agregees

| Metrique | Valeur |
|----------|-------:|
| Gold recall retrieval @30 | 88.6% |
| Gold recall final context | 85.7% |
| Full gold coverage context | 83.3% |
| Corpus coverage multicorpus @30 | 78.6% |
| Correctness | 3.73 |
| Completeness | 3.70 |
| Groundedness | 3.97 |
| Source relevance | 3.50 |
| Source coverage | 3.97 |
| Abstention correct | 96.7% |

## Comparaison historique

- Baseline judge: bras routing E2E500 @20 (e2e.json) par questionId.
- Smoke top30: e2e-cache q334/q367/q378 pour reproductibilite gains 21-30.
- Embeddings: cache depth-benchmark quand disponible (sinon 1 appel/question).

## Verification topK30 (q334, q367, q378)

| questionId | gold | rank@30 | Jina | final | correctness | completeness | groundedness | smoke completeness |
|------------|------|--------:|-----:|:-----:|------------:|-------------:|-------------:|-------------------:|
| q334 | code-de-la-consommation:L511-1 | 21 | 4 | true | 2.0 | 2.0 | 4.0 | 2.0 |
| q367 | code-du-commerce:L124-3 | 27 | 2 | true | 4.0 | 4.0 | 4.0 | 4.0 |
| q378 | code-penal:221-6 | 26 | 2 | true | 4.0 | 4.0 | 4.0 | 4.0 |

## Regressions detectees

Aucune regression **nouvelle** vs baseline E2E @20.

Notes:

- **q466** (OOS): abstention deja incorrecte sur le bras routing E2E500 @20 (`abstentionCorrect=false`) — comportement identique, non imputable a topK=30.
- **q360**: variation judge groundedness 4->3 sans chute correctness — non classee regression.

## Decision

**NO_REGRESSION**

Gains topK30 reproduits (q334, q367, q378); cohorte 30 sans regression significative.

**Prochaine etape:** `retrievalTopK=30` applique en production (`DEFAULT_RETRIEVAL_TOP_K`).
