# Smoke hybrid rerank + filter

## Validation

- OpenAI calls: 0
- Embedding calls: 0
- LLM calls: 0
- Generation calls: 0
- Judge calls: 0
- Jina calls: 183
- Production files modified: NO

## Tableau principal

| Variante | Retrieval gold recall | Apres Jina | Apres filter | Full coverage | Corpus coverage | Chunks filter (moy.) |
| -------- | --------------------: | ---------: | -----------: | ------------: | --------------: | -------------------: |
| VECTOR | 68.8% | 60.2% | 54.8% | 32.8% | 53.2% | 2.59 |
| UNION | 81.7% | 68.8% | 61.3% | 42.6% | 61.3% | 2.79 |
| RRF | 77.4% | 67.7% | 59.1% | 39.3% | 61.3% | 2.66 |

## Pertes Union (gold vs vector)

- Golds gagnes au retrieval (Union vs Vector): **12**
- Perdus au Jina: **12**
- Perdus au filter (apres Jina): **7**
- Conserves dans le contexte final: **6**

## Pertes RRF (gold vs vector)

- Golds gagnes au retrieval: **11**
- Perdus au Jina: **9**
- Perdus au filter: **8**
- Conserves apres filter: **5**

## BM25-only (Union retrieval)

- Gold articles BM25-only presents en Union retrieval: **12**
- Survivent apres filter Union: **6**

## Echantillon 29 golds vector-absents @50

- q002 code-penal:223-1: vector=false bm25=true union=true | Union jina=false filter=false | RRF jina=false filter=false
- q048 code-penal:713-3: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q102 code-civil:1871: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q132 code-du-travail:L5221-1: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q170 code-du-travail:L2262-1: vector=false bm25=true union=true | Union jina=true filter=true | RRF jina=true filter=true
- q238 code-monetaire-et-financier:L231-10: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q249 code-monetaire-et-financier:L343-1: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q352 code-du-commerce:L123-8: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q360 code-penal:132-15: vector=false bm25=true union=true | Union jina=false filter=false | RRF jina=false filter=false
- q361 code-monetaire-et-financier:L213-19: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q374 code-monetaire-et-financier:L133-25-2: vector=false bm25=false union=false | Union jina=false filter=false | RRF jina=false filter=false
- q375 code-penal:132-70-3: vector=false bm25=true union=true | Union jina=true filter=true | RRF jina=true filter=true

## Decision

**NEED_GENERATION_VALIDATION**

Union ameliore le recall gold apres filter vs vector; validation generation/judge requise avant prod.
