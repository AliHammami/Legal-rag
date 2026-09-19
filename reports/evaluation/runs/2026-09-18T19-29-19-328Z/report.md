# Multi-corpus RAG Evaluation

Dataset: 5 questions
Run: 2026-09-18T19-29-19-328Z
Evaluator: 1.0.0

## Model configuration

- Embedding: text-embedding-3-large
- Reranker: jina-reranker-v3.5
- Generation: gpt-5.6-luna
- Routing: gpt-5.6-luna
- Judge: gpt-gpt-5.6-terra
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

## Error analysis

- routing: 0
- retrieval: 0
- reranking: 0
- generation: 0
- abstention: 0
- none: 5

