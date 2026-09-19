# Multi-corpus RAG Evaluation

Dataset: 500 questions
Run: 2026-09-19T21-55-15-773Z
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

- Exact match: 92.5%
- Precision: 0.942
- Recall: 0.944
- F1: 0.941
- Ambiguous ? []: 70.0%
- Out-of-scope ? []: 85.7%

## Error analysis

- routing: 49
- retrieval: 0
- reranking: 0
- generation: 0
- abstention: 0
- none: 451

