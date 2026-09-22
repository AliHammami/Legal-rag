# Smoke retrievalTopK=30

## Configuration effective

```json
{
  "retrievalTopK": 30,
  "rerankTopK": 5,
  "relativeScoreThreshold": 0.4,
  "routingModel": "gpt-5.6-luna"
}
```

## Confirmations

- Cohorte: 61 questions (benchmark retrieval-depth 2026-09-22)
- Routing: replay identique au benchmark profondeur (0 appel LLM routing)
- Seule variable pipeline vs prod: retrievalTopK 20 -> 30
- Pas d E2E 500
- Embeddings: cache reutilise (0 appels embedding)
- Jina rerank: 61 appels
- Generation: 61 appels
- Judge routing: 122 appels

## Comparaison @20 reference vs smoke @30

| Metrique | E2E @20 (ref cohorte) | Smoke @30 | Delta |
|----------|----------------------:|----------:|------:|
| Gold recall retrieval | 55.9% | 63.4% | 7.5% |
| Gold dans final context | n/a ref | 54.8% | - |
| Full gold coverage context | n/a ref | 32.8% | - |
| Correctness | 1.20 | 2.48 | 1.28 |
| Completeness | 1.11 | 2.44 | 1.33 |
| Groundedness | 3.84 | 3.93 | 0.10 |
| Source relevance | 1.84 | 2.77 | 0.93 |
| Source coverage | 3.16 | 3.95 | 0.79 |
| Abstention correct | 49.2% | 77.0% | - |
| Latence moyenne (ms) | 6102 | 5244 | -858 |

## Gains marginaux retrieval (smoke @30)

| Nouveaux gold | @21-30 | dont top5 Jina | dont contexte final |
|---------------|-------:|---------------:|--------------------:|
| Articles | 3 | 3 | 3 |

## Analyse gold 21-30 (extrait)

- q334 code-de-la-consommation:L511-1 rank30=21 jina=4 final=true deltaCompleteness=0.00
- q367 code-du-commerce:L124-3 rank30=27 jina=2 final=true deltaCompleteness=2.00
- q378 code-penal:221-6 rank30=26 jina=2 final=true deltaCompleteness=2.00

## Conclusion

**TOPK_30_JUSTIFIED**

Des gold 21-30 atteignent le contexte final avec gain judge mesurable sans chute groundedness.

**Prochaine etape:** Valider en changement production retrievalTopK=30 puis mini E2E de regression (hors ce smoke).
