# Multi-corpus RAG Evaluation

Dataset: 500 questions
Run: 2026-09-19T23-21-51-901Z
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
| baseline | 3.522 | 3.492 | 3.984 | 85.2% | 3.628 | 3.972 |
| routing | 3.520 | 3.488 | 3.982 | 84.8% | 3.604 | 3.962 |

- Jina fallback: 0 / 1000

### Latency (routing variant, ms)

- baseline: avg 3890 | p50 3652 | p95 5834
- routing: avg 5168 | p50 4812 | p95 7686
- routingStage: avg 1661 | p50 1324 | p95 3174
- embedding: avg 247 | p50 223 | p95 382
- retrieval: avg 229 | p50 173 | p95 660
- reranking: avg 605 | p50 555 | p95 843
- generation: avg 2425 | p50 2186 | p95 4423

## Error analysis

- routing: 0
- retrieval: 0
- reranking: 0
- generation: 66
- abstention: 43
- none: 391

