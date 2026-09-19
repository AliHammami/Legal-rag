# Multi-corpus RAG Evaluation

Dataset: 5 questions
Run: 2026-09-18T20-43-55-921Z
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
- evaluationConcurrency: 5
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
| baseline | 1.800 | 1.600 | 4.000 | 40.0% | 2.600 | 4.000 |
| routing | 2.000 | 2.000 | 4.000 | 40.0% | 2.600 | 4.000 |

- Jina fallback: 0 / 10

### Latency (routing variant, ms)

- baseline: avg 6733 | p50 7054 | p95 7439
- routing: avg 3236 | p50 3316 | p95 3830
- routingStage: avg 827 | p50 841 | p95 946
- embedding: avg 259 | p50 262 | p95 275
- retrieval: avg 62 | p50 57 | p95 86
- reranking: avg 404 | p50 273 | p95 650
- generation: avg 1683 | p50 1710 | p95 2377

## Error analysis

- routing: 0
- retrieval: 1
- reranking: 2
- generation: 0
- abstention: 0
- none: 2

