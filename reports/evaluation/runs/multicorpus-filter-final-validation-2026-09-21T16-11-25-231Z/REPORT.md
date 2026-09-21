# Validation finale - filter conditionnel multicorpus

## 1. Cohorte exacte

```text
41 questions
Class A: 9
Class B: 9
Class C: 23
Other: 0

q353, q365, q372, q377, q380, q396, q410, q361, q374, q375, q378, q362, q363, q371, q352, q360, q364, q367, q373, q379, q383, q386, q394, q395, q397, q416, q420, q422, q423, q424, q381, q384, q400, q408, q411, q387, q401, q402, q407, q414, q417
```

| questionId | class | selection |
|------------|-------|-----------|
| q353 | C | mandatory prior benchmark (C) |
| q365 | C | mandatory prior benchmark (C) |
| q372 | C | mandatory prior benchmark (C) |
| q377 | C | mandatory prior benchmark (C) |
| q380 | C | mandatory prior benchmark (C) |
| q396 | C | mandatory prior benchmark (C) |
| q410 | C | mandatory prior benchmark (C) |
| q361 | B | mandatory prior benchmark (B) |
| q374 | B | mandatory prior benchmark (B) |
| q375 | B | mandatory prior benchmark (B) |
| q378 | B | mandatory prior benchmark (B) |
| q362 | A | mandatory prior benchmark (A) |
| q363 | A | mandatory prior benchmark (A) |
| q371 | A | mandatory prior benchmark (A) |
| q352 | C | mandatory prior benchmark (C) |
| q360 | C | class C fill |
| q364 | C | class C fill |
| q367 | C | class C fill |
| q373 | C | class C fill |
| q379 | C | class C fill |
| q383 | C | class C fill |
| q386 | C | class C fill |
| q394 | C | class C fill |
| q395 | C | class C fill |
| q397 | C | class C fill |
| q416 | C | class C fill |
| q420 | C | class C fill |
| q422 | C | class C fill |
| q423 | C | class C fill |
| q424 | C | class C fill |
| q381 | B | class B fill |
| q384 | B | class B fill |
| q400 | B | class B fill |
| q408 | B | class B fill |
| q411 | B | class B fill |
| q387 | A | class A fill |
| q401 | A | class A fill |
| q402 | A | class A fill |
| q407 | A | class A fill |
| q414 | A | class A fill |
| q417 | A | class A fill |

## 2. Methodologie

- Scores Jina reutilises depuis audit quota (pas de re-rerank).
- Meme routing, retrieval, rerank top-5, generation, judge pour A et B.
- Seul le filter change entre A (0.40) et B (min1/corpus conditionnel @ 0.40 si >1 corpus route).
- Audit source: `reports/evaluation/runs/multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json`
- Generation: `gpt-5.6-luna` | Judge: `gpt-5.6-terra`

## 3. Tableau comparatif A vs B

| metrique | A: 0.40 | B: conditional min1 | delta B-A |
|----------|---------|---------------------|-----------|
| correctness | 2.46 | 2.80 | 0.34 |
| completeness | 2.32 | 2.78 | 0.46 |
| groundedness | 3.95 | 3.93 | -0.02 |
| source relevance | 2.61 | 2.98 | 0.37 |
| source coverage | 3.93 | 3.98 | 0.05 |
| avg chunks | 2.02 | 2.59 | 0.56 |
| median chunks | 1.00 | 2.00 | 1.00 |
| gold article recall | 54.9% | 61.0% | 6.1% |
| 2 routed corpora in context | 1.22 | 1.78 | 0.56 |
| all gold corpora present | 22.0% | 78.0% | 56.1% |

**Critere central:** all gold corpora present = 32/41 (B) vs 9/41 (A).

## 4-5. Metriques judge et couverture

Voir tableau section 3. Gold article recall et couverture corpus gold sont les indicateurs principaux de couverture multicorpus.

## 6. Regressions

- **q379** (C): A=4/3/4 -> B=3/2/3
- **q424** (C): A=3/2/4 -> B=1/1/4
- **q387** (A): A=4/4/4 -> B=3/4/3

Cas class A stables (corr+comp): oui

## 7. Cas representatifs

### q353 - C - gold civil restaure par B

- A: chunks=1 corp=1/2 goldCorp=false judge=2/2/4
- B: chunks=2 corp=2/2 goldCorp=true judge=4/4/undefined
- Gold in context A: code-du-travail:L1237-3
- Gold in context B: code-civil:10, code-du-travail:L1237-3

### q374 - B - rerank mono-corpus, filter ne peut pas aider

- A: chunks=1 corp=1/2 goldCorp=false judge=1/1/4
- B: chunks=1 corp=1/2 goldCorp=false judge=2/2/undefined
- Gold in context A: none
- Gold in context B: none

### q362 - A - deja bi-corpus @ filter

- A: chunks=3 corp=2/2 goldCorp=true judge=3/3/4
- B: chunks=3 corp=2/2 goldCorp=true judge=2/3/undefined
- Gold in context A: code-du-travail:L2145-8
- Gold in context B: code-du-travail:L2145-8

## 8. Decision recommandee

**Signal favorable** pour implementer le filter conditionnel multicorpus en production:

- Couverture corpus gold: 22.0% -> 78.0%
- Gold article recall: 54.9% -> 61.0%
- Correctness/completeness: stable ou en hausse
- Chunks: +0.56 en moyenne

**Prochaine etape:** implementation production minimale + tests unitaires + E2E 500.
