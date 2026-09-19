# Multi-corpus RAG Evaluation

Dataset: 5 questions
Run: 2026-09-18T20-42-33-922Z
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
- evaluationConcurrency: 3
- jinaConcurrency: 2

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
| baseline | 2.000 | 1.800 | 4.000 | 40.0% | 2.800 | 4.000 |
| routing | 1.600 | 1.800 | 4.000 | 40.0% | 2.600 | 3.800 |

- Jina fallback: 0 / 10

### Latency (routing variant, ms)

- baseline: avg 4016 | p50 4090 | p95 5292
- routing: avg 3290 | p50 3345 | p95 4042
- routingStage: avg 829 | p50 806 | p95 1056
- embedding: avg 215 | p50 208 | p95 239
- retrieval: avg 84 | p50 72 | p95 141
- reranking: avg 478 | p50 560 | p95 587
- generation: avg 1683 | p50 1869 | p95 2407

## Error analysis

- routing: 0
- retrieval: 1
- reranking: 2
- generation: 0
- abstention: 0
- none: 2

