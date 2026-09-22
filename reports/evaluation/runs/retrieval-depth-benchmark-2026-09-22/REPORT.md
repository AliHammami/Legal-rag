# Benchmark retrieval depth @20/@30/@40/@50

## 1. Cohorte

- **61** questions (context-loss forensic A, diagnostic 2026-09-21)
- **93** articles gold (total attendus)

## 2. Methode

- 1 embedding / question (cache persiste dans `embedding-cache.json`)
- Retrieval read-only Postgres pgvector (`embedding <=>`)
- Variante **global**: topK sur union des corpus routes
- Variante **quota**: `computePerCorpusQuota` + merge production (`corpus-quota-retrieval.ts`)
- Profondeurs: 20, 30, 40, 50

## 3. Confirmations

- Aucun Jina / rerank / filter / generation / judge LLM
- Appels embedding API cette execution: **0**

## 4. Resultats � variante quota (production multicorpus)

| Metrique | @20 | @30 | @40 | @50 |
|----------|----:|----:|----:|----:|
| Gold article recall | 55.9% | 61.3% | 63.4% | 68.8% |
| Full gold coverage (questions) | 22/61 | 25/61 | 27/61 | 32/61 |
| Corpus coverage (multi) | 56.5% | 60.9% | 63.0% | 68.5% |

## 5. Resultats � variante global

| Metrique | @20 | @30 | @40 | @50 |
|----------|----:|----:|----:|----:|
| Gold article recall | 55.9% | 59.1% | 61.3% | 63.4% |

## 6. Gains marginaux (quota)

| Bande | Nouveaux gold |
|-------|-------------:|
| @21-30 | 5 |
| @31-40 | 2 |
| @41-50 | 5 |

| Transition recall | Delta |
|-------------------|------:|
| 20 -> 30 | +5.4 pts |
| 30 -> 40 | +2.2 pts |
| 40 -> 50 | +5.4 pts |

## 7. Gold absents @20 (quota, cohorte complete)

- Total articles gold absents @20: **41**
- Recuperes 21-30: **12** (dont bandes ci-dessus)
- Toujours absents @50: **29**

## 8. Cas meme corpus (voisins locaux)

### q352 � gold code-du-commerce:L123-8

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | R131-22 | 0.4896 |  |
| 22 | L152-7 | 0.4905 |  |
| 23 | R134-9 | 0.4926 |  |
| 24 | L141-15 | 0.4935 |  |
| 25 | L924-3 | 0.4947 |  |

### q367 � gold code-du-commerce:L124-3

Rang gold dans quota @50: 37

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 7 | L125-16 | 0.4890 |  |
| 8 | L441-1 | 0.4898 |  |
| 9 | L442-1 | 0.4945 |  |
| 10 | L441-18 | 0.4955 |  |
| 11 | L225-102-2 | 0.4976 |  |
| 12 | L124-3 | 0.4990 | yes |
| 13 | R627-1 | 0.4990 |  |
| 14 | L470-1 | 0.5027 |  |
| 15 | L124-1 | 0.5031 |  |
| 16 | L442-7 | 0.5059 |  |
| 17 | L124-11 | 0.5091 |  |

### q371 � gold code-du-travail:L1221-19

Rang gold dans quota @50: 48

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 18 | L8232-1 | 0.5480 |  |
| 19 | L1242-8-1 | 0.5480 |  |
| 20 | R8241-2 | 0.5492 |  |
| 21 | L1251-58-2 | 0.5492 |  |
| 22 | L7332-1 | 0.5496 |  |
| 23 | L1221-19 | 0.5503 | yes |
| 24 | L1531-2 | 0.5520 |  |
| 25 | L1234-1 | 0.5521 |  |

### q383 � gold code-penal:131-5-1

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | 131-36-1 | 0.5106 |  |
| 22 | 223-15-4 | 0.5107 |  |
| 23 | 322-17 | 0.5116 |  |
| 24 | 433-22 | 0.5144 |  |
| 25 | 311-14 | 0.5170 |  |

### q386 � gold code-monetaire-et-financier:L312-1-1

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | L312-1-1-B | 0.5236 |  |
| 22 | L533-15 | 0.5242 |  |
| 23 | L522-19 | 0.5247 |  |
| 24 | L522-11-3 | 0.5250 |  |
| 25 | L317-3 | 0.5255 |  |

### q394 � gold code-de-la-consommation:L771-3

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | L714-1 | 0.5629 |  |
| 22 | R742-27 | 0.5632 |  |
| 23 | R312-35 | 0.5634 |  |
| 24 | L771-2 | 0.5636 |  |
| 25 | L743-1 | 0.5641 |  |

### q397 � gold code-monetaire-et-financier:L214-163

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | L214-35 | 0.4868 |  |
| 22 | L214-92-1 | 0.4897 |  |
| 23 | L214-162-18 | 0.4909 |  |
| 24 | L533-22 | 0.4946 |  |
| 25 | L214-169 | 0.4949 |  |

### q401 � gold code-monetaire-et-financier:L221-32

Rang gold dans quota @50: absent

| rank | article | distance | gold |
|-----:|---------|---------:|:----:|
| 21 | D221-110 | 0.4471 |  |
| 22 | R519-9 | 0.4505 |  |
| 23 | R741-2-1-0 | 0.4538 |  |
| 24 | L341-3 | 0.4544 |  |
| 25 | D341-4 | 0.4545 |  |

## 9. Conclusion

**Categorie:** `DEPTH_IS_MATERIAL`

Une proportion notable des gold absents @20 apparait entre 21 et 50 avec gain de recall mesurable.

## 10. Prochaine experience recommandee

- Smoke cible **retrievalTopK=30** (quota inchange) sur sous-ensemble 61 + persistance top50; pas de prod sans smoke.

