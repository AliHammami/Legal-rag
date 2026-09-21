# Multi-corpus RAG Evaluation

Dataset: 500 questions
Run: 2026-09-21T16-59-10-310Z
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

## E2E


| Variant | Correctness | Completeness | Groundedness | Abstention | Source rel. | Source cov. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 3.534 | 3.510 | 3.980 | 85.8% | 3.620 | 3.966 |
| routing | 3.622 | 3.602 | 3.974 | 92.0% | 3.494 | 3.850 |

- Jina fallback: 0 / 1000

### Latency (routing variant, ms)

- baseline: avg 3978 | p50 3686 | p95 6463
- routing: avg 4556 | p50 4403 | p95 7782
- routingStage: avg 1688 | p50 1433 | p95 3175
- embedding: avg 215 | p50 218 | p95 398
- retrieval: avg 139 | p50 107 | p95 308
- reranking: avg 473 | p50 539 | p95 630
- generation: avg 2042 | p50 1937 | p95 4342

## Error analysis

- routing: 0
- retrieval: 0
- reranking: 0
- generation: 62
- abstention: 9
- none: 429

