# Validation generation + judge � hybrid Union vs Vector

## Validation

- OpenAI calls (generation + judge): 120
- Embedding calls: 0
- LLM calls (routing): 0
- Generation calls: 40
- Judge calls: 40
- Source judge calls: 40
- Jina calls: 0
- Production files modified: NO

Modeles: generation `gpt-5.6-luna`, judge `gpt-5.6-terra`.

## Cohorte

20 questions (contexte final Vector != Union), priorite gold Union > BM25-only > diff contexte seul.

## Tableau principal

| Metric | Vector | Union | ? |
| ------ | -----: | ----: | -: |
| correctness | 2.15 | 2.70 | +0.55 |
| completeness | 2.05 | 2.75 | +0.70 |
| groundedness | 3.95 | 3.85 | -0.10 |
| sourceRelevance | 2.50 | 3.20 | +0.70 |
| sourceCoverage | 4.00 | 3.85 | -0.15 |

## Questions avec gold ajoute par Union

- **q170** gold=["code-du-travail:L2262-1"] impact=improves_answer
- **q375** gold=["code-penal:132-70-3"] impact=improves_answer
- **q382** gold=["code-monetaire-et-financier:L171-3"] impact=improves_answer
- **q386** gold=["code-monetaire-et-financier:L312-1-1"] impact=improves_answer
- **q401** gold=["code-monetaire-et-financier:L221-32"] impact=improves_answer
- **q420** gold=["code-penal:131-1"] impact=improves_answer

## Decision

**HYBRID_IMPROVES_ANSWERS**

Union bat Vector en moyenne (correctness 0.55, completeness 0.70).

? mini test de non-regression production
? puis eventuelle integration hybrid
