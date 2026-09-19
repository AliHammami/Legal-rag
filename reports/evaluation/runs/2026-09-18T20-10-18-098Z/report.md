# Multi-corpus RAG Evaluation

Dataset: 5 questions
Run: 2026-09-18T20-10-18-098Z
Evaluator: 1.0.0

## Model configuration

- Embedding: text-embedding-3-large
- Reranker: jina-reranker-v3.5
- Generation: gpt-5.6-luna
- Routing: gpt-5.6-luna
- Judge: gpt-5.6-luna
- retrievalTopK: 20
- rerankTopK: 5
- relativeScoreThreshold: 0.4

## E2E


| Variant | Correctness | Completeness | Groundedness | Abstention | Source rel. | Source cov. |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| baseline | 1.800 | 1.800 | 4.000 | 40.0% | 2.200 | 2.600 |
| routing | 2.000 | 1.800 | 4.000 | 40.0% | 2.600 | 3.200 |

### Latency (routing variant, ms)

- baseline: avg 4891 | p50 5320 | p95 6841
- routing: avg 3680 | p50 3693 | p95 4706
- routingStage: avg 948 | p50 988 | p95 1042
- embedding: avg 256 | p50 227 | p95 408
- retrieval: avg 63 | p50 68 | p95 84
- reranking: avg 521 | p50 573 | p95 604
- generation: avg 1891 | p50 1771 | p95 2706

## Error analysis

- routing: 0
- retrieval: 0
- reranking: 0
- generation: 3
- abstention: 0
- none: 2

