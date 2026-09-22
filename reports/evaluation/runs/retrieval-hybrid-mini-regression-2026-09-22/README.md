# Mini regression hybrid Union vs Vector topK=30

## Pipelines

- **A (Vector)** : routing replay ? vector retrieval topK=30 ? Jina top5 ? dynamic filter 0.40 ? generation ? judge
- **B (Union)** : routing replay ? hybrid Union (Vector@50+BM25@50) ? Jina top5 ? dynamic filter 0.40 ? generation ? judge

## Selection (30 questions � voir selection.json)

## Parametres

```json
{
  "retrievalTopKVector": 30,
  "hybridUnion": "Vector@50+BM25@50 union (benchmark)",
  "rerankTopK": 5,
  "relativeScoreThreshold": 0.4,
  "minOnePerRoutedCorpus": true
}
```

## Decision

**HYBRID_NON_REGRESSION_PASS**

Union maintient ou ameliore correctness/completeness sans regression majeure.

Integrer Union hybrid retrieval en evaluation/staging puis smoke prod restreint avant merge production.
