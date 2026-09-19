# Multi-corpus RAG Evaluation

Dataset: 500 questions
Run: 2026-09-18T21-05-25-814Z
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
- evaluationConcurrency: 1
- jinaConcurrency: 1

## Routing

- Exact match: 87.5%
- Precision: 0.936
- Recall: 0.925
- F1: 0.926
- Ambiguous ? []: 57.5%
- Out-of-scope ? []: 71.4%

## Retrieval


| Mode | Recall@5 | Recall@10 | Recall@20 | MRR |
| --- | ---: | ---: | ---: | ---: |
| Global baseline | 84.0% | 89.0% | 91.6% | 0.819 |
| Routing + retrieval | 81.9% | 86.2% | 88.5% | 0.799 |

## Reranking


| Mode | Recall@5 | MRR |
| --- | ---: | ---: |
| Vector Top5 | 84.0% | 0.812 |
| Vector + Jina | 90.6% | 0.900 |

- Improved: 91 | Degraded: 28 | Unchanged: 306

## E2E


| Variant | Correctness | Completeness | Groundedness | Abstention | Source rel. | Source cov. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 3.554 | 3.504 | 3.986 | 86.0% | 3.648 | 3.980 |
| routing | 3.480 | 3.442 | 3.990 | 83.8% | 3.610 | 3.978 |

- Jina fallback: 0 / 1000

### Latency (routing variant, ms)

- baseline: avg 3267 | p50 3072 | p95 4850
- routing: avg 4045 | p50 3789 | p95 6251
- routingStage: avg 1296 | p50 1025 | p95 2631
- embedding: avg 225 | p50 206 | p95 345
- retrieval: avg 213 | p50 162 | p95 639
- reranking: avg 419 | p50 467 | p95 582
- generation: avg 1891 | p50 1723 | p95 3323

## Error analysis

- routing: 59
- retrieval: 6
- reranking: 24
- generation: 35
- abstention: 42
- none: 334

