# Multi-corpus RAG Evaluation

Dataset: 500 questions
Run: 2026-09-19T19-54-08-102Z
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
- jinaConcurrency: 1

## Routing

- Exact match: 89.9%
- Precision: 0.929
- Recall: 0.938
- F1: 0.931
- Ambiguous ? []: 70.0%
- Out-of-scope ? []: 91.4%

## Error analysis

- routing: 58
- retrieval: 0
- reranking: 0
- generation: 0
- abstention: 0
- none: 442

