# Multi-corpus RAG Evaluation

Dataset: 10 questions
Run: 2026-09-18T21-03-53-152Z
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

## Reranking


| Mode | Recall@5 | MRR |
| --- | ---: | ---: |
| Vector Top5 | 80.0% | 0.540 |
| Vector + Jina | 80.0% | 0.483 |

- Improved: 3 | Degraded: 3 | Unchanged: 4

## Error analysis

- routing: 0
- retrieval: 0
- reranking: 3
- generation: 0
- abstention: 0
- none: 7

