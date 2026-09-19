# Multi-corpus RAG Evaluation

Dataset: 5 questions
Run: 2026-09-18T20-11-45-395Z
Evaluator: 1.0.0

## Model configuration

- Embedding: text-embedding-3-large
- Reranker: jina-reranker-v3.5
- Generation: gpt-5.6-luna
- Routing: gpt-5.6-luna
- Judge: gpt-5.6-terra
- retrievalTopK: 20
- rerankTopK: 5
- relativeScoreThreshold: 0.4

## Routing

- Exact match: 100.0%
- Precision: 1.000
- Recall: 1.000
- F1: 1.000
- Ambiguous ? []: 0.0%
- Out-of-scope ? []: 0.0%

## Retrieval


| Mode | Recall@5 | Recall@10 | Recall@20 | MRR |
| --- | ---: | ---: | ---: | ---: |
| Global baseline | 60.0% | 60.0% | 80.0% | 0.518 |
| Routing + retrieval | 60.0% | 60.0% | 80.0% | 0.518 |

## Reranking


| Mode | Recall@5 | MRR |
| --- | ---: | ---: |
| Vector Top5 | 60.0% | 0.500 |
| Vector + Jina | 60.0% | 0.350 |

- Improved: 1 | Degraded: 2 | Unchanged: 2

## E2E


| Variant | Correctness | Completeness | Groundedness | Abstention | Source rel. | Source cov. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 1.800 | 1.800 | 4.000 | 40.0% | 2.600 | 3.800 |
| routing | 1.600 | 1.800 | 4.000 | 40.0% | 3.000 | 4.000 |

### Latency (routing variant, ms)

- baseline: avg 4107 | p50 4003 | p95 5037
- routing: avg 3271 | p50 3400 | p95 3650
- routingStage: avg 871 | p50 887 | p95 898
- embedding: avg 257 | p50 229 | p95 423
- retrieval: avg 58 | p50 38 | p95 121
- reranking: avg 379 | p50 267 | p95 560
- generation: avg 1705 | p50 1576 | p95 2233

## Error analysis

- routing: 0
- retrieval: 1
- reranking: 2
- generation: 0
- abstention: 0
- none: 2

