# Benchmark hybrid retrieval (offline)

## Validation

- API calls: 0
- Jina calls: 0
- LLM calls: 0
- Generation calls: 0
- Production behavior modified: NO

## Configuration

- Cohorte: 61 questions (`retrieval-depth-benchmark-2026-09-22`)
- Vector: `per-question.json` quota top50 (reference, pas recalcule)
- BM25: quota multicorpus aligne (`ceil(k/n)` par corpus), chunks `data/processed/`
- Union: dedup chunkId vector50 + bm25top50
- RRF: `RRF(d) = sum 1/(k + rank_i(d))`, k=60, puis top50

## Comparaison @50 (61 questions)

| Variante | Gold recall @50 | Full coverage | Corpus coverage | Golds BM25-only recuperes |
| -------- | --------------: | ------------: | --------------: | ------------------------: |
| VECTOR | 68.8% | 52.5% | 64.5% | � |
| BM25 | 73.1% | 60.7% | 74.2% | � |
| UNION | 81.7% | 72.1% | 80.6% | 12 |
| RRF | 77.4% | 65.6% | 75.8% | 11 |

### Candidats uniques (Union / RRF)

| Variante | mean | median | min | max |
|----------|-----:|-------:|----:|----:|
| Union | 89.4 | 91 | 76 | 99 |
| RRF (pre-truncation pool) | 89.4 | 91 | 76 | 99 |

## 29 golds absents vector @50

| questionId | gold | BM25 | Union | RRF | rank BM25 | rank RRF | BM25-only |
|------------|------|:----:|:-----:|:---:|:---------:|:--------:|:---------:|
| q002 | code-penal:223-1 | true | true | true | 24 | 47 | true |
| q048 | code-penal:713-3 | false | false | false | >50 | >50 | false |
| q102 | code-civil:1871 | false | false | false | >50 | >50 | false |
| q132 | code-du-travail:L5221-1 | false | false | false | >50 | >50 | false |
| q170 | code-du-travail:L2262-1 | true | true | true | 11 | 23 | true |
| q238 | code-monetaire-et-financier:L231-10 | false | false | false | >50 | >50 | false |
| q249 | code-monetaire-et-financier:L343-1 | false | false | false | >50 | >50 | false |
| q352 | code-du-commerce:L123-8 | false | false | false | >50 | >50 | false |
| q360 | code-penal:132-15 | true | true | false | 30 | >50 | true |
| q361 | code-monetaire-et-financier:L213-19 | false | false | false | >50 | >50 | false |
| q374 | code-monetaire-et-financier:L133-25-2 | false | false | false | >50 | >50 | false |
| q375 | code-penal:132-70-3 | true | true | true | 3 | 7 | true |
| q379 | code-de-la-consommation:liminaire | false | false | false | >50 | >50 | false |
| q381 | code-du-travail:L2132-5 | false | false | false | >50 | >50 | false |
| q382 | code-monetaire-et-financier:L171-3 | true | true | true | 17 | 37 | true |
| q383 | code-penal:131-5-1 | false | false | false | >50 | >50 | false |
| q386 | code-monetaire-et-financier:L312-1-1 | true | true | true | 8 | 24 | true |
| q394 | code-de-la-consommation:L771-3 | true | true | true | 5 | 12 | true |
| q395 | code-du-commerce:L135-2 | true | true | true | 3 | 10 | true |
| q397 | code-monetaire-et-financier:L214-163 | true | true | true | 6 | 18 | true |
| q401 | code-monetaire-et-financier:L221-32 | true | true | true | 21 | 37 | true |
| q408 | code-monetaire-et-financier:L224-13 | false | false | false | >50 | >50 | false |
| q409 | code-de-la-consommation:L112-5 | false | false | false | >50 | >50 | false |
| q411 | code-du-travail:L1132-2 | true | true | true | 7 | 19 | true |
| q412 | code-civil:33 | false | false | false | >50 | >50 | false |
| q413 | code-penal:112-4 | false | false | false | >50 | >50 | false |
| q420 | code-penal:131-1 | true | true | true | 26 | 47 | true |
| q422 | code-penal:131-3 | false | false | false | >50 | >50 | false |
| q423 | code-penal:131-4 | false | false | false | >50 | >50 | false |

## Conclusion

Vector @50=68.8% (reference benchmark 68.8%). BM25 @50=73.1%. Union=81.7%. RRF=77.4%. Sur les 29 golds vector-absents: BM25 12/29, Union 12/29, RRF 11/29. BM25 apporte 4 hits gold supplementaires vs vector. Union conserve l integralite des gains BM25 (recall >= BM25 seul). RRF top50 perd des golds vs Union (truncation/classement).

## Prochaine experience

Experimenter Union/RRF avec K candidats >50 avant Jina sur sous-cohorte multicorpus.
