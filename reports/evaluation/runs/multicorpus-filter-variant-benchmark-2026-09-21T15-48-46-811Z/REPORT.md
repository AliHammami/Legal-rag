# Benchmark filter multicorpus - 3 variantes

## Cohorte

```text
15 questions:
q353, q365, q372, q377, q380, q396, q410, q361, q374, q375, q378, q362, q363, q371, q352
```

| questionId | selection | class routed |
|------------|-----------|--------------|
| q353 | mandatory: class C, gold civil art.10 dropped at filter 0.4 | C |
| q365 | class C with gold article lost at filter 0.4 | C |
| q372 | class C with gold article lost at filter 0.4 | C |
| q377 | class C with gold article lost at filter 0.4 | C |
| q380 | class C with gold article lost at filter 0.4 | C |
| q396 | class C with gold article lost at filter 0.4 | C |
| q410 | class C with gold article lost at filter 0.4 | C |
| q361 | class B (second corpus lost at rerank) | B |
| q374 | class B (second corpus lost at rerank) | B |
| q375 | class B (second corpus lost at rerank) | B |
| q378 | class B (second corpus lost at rerank) | B |
| q362 | class A (all stages pass at 0.4) | A |
| q363 | class A (all stages pass at 0.4) | A |
| q371 | class A (all stages pass at 0.4) | A |
| q352 | fill: representative multicorpus cohort | C |

Audit source (Jina scores reused, no re-rerank): `reports/evaluation/runs/multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z/audit.json`
Generation model: `gpt-5.6-luna`
Judge model: `gpt-5.6-terra`

## Resultats globaux

| metric | A: 0.40 | B: 0.25 | C: min1/corpus |
|--------|---------|---------|----------------|
| correctness | 2.27 | 3.13 | 2.93 |
| completeness | 2.13 | 3.00 | 2.87 |
| groundedness | 4.00 | 4.00 | 3.87 |
| abstention correct (%) | 53.33 | 86.67 | 93.33 |
| source relevance | 2.33 | 3.13 | 3.33 |
| source coverage | 4.00 | 4.00 | 4.00 |
| avg chunks/context | 1.73 | 3.00 | 2.27 |
| avg gold articles in context | 1.00 | 1.53 | 1.33 |
| avg routed corpus coverage (/2) | 1.20 | 1.60 | 1.73 |

## Cas individuels notables

### C potentially improves (completeness)

- **q353** / C: min1/corpus+0.40
- Chunks: 2 | corpora: code-civil, code-du-travail
- Judge: correctness=4, completeness=4, groundedness=4
- Source judge: relevance=4, coverage=4
- Gold in context: code-civil:10, code-du-travail:L1237-3

### B potentially improves (source coverage)

- **q353** / B: 0.25
- Chunks: 2 | corpora: code-du-travail
- Judge: correctness=2, completeness=2, groundedness=4
- Source judge: relevance=2, coverage=4
- Gold in context: code-du-travail:L1237-3

### A sufficient (class A)

- **q362** / A: 0.40
- Chunks: 3 | corpora: code-du-travail, code-penal
- Judge: correctness=2, completeness=2, groundedness=4
- Source judge: relevance=2, coverage=4
- Gold in context: code-du-travail:L2145-8

### C adds noise risk (more chunks, lower groundedness)

- **q353** / C: min1/corpus+0.40
- Chunks: 2 | corpora: code-civil, code-du-travail
- Judge: correctness=4, completeness=4, groundedness=4
- Source judge: relevance=4, coverage=4
- Gold in context: code-civil:10, code-du-travail:L1237-3

### Rerank-limited (class B)

- **q361** / A: 0.40
- Chunks: 1 | corpora: code-du-travail
- Judge: correctness=2, completeness=2, groundedness=4
- Source judge: relevance=3, coverage=4
- Gold in context: code-du-travail:L2145-2

## Decision

Based on judge scores (not corpus count alone):

| Critere | A: 0.40 | B: 0.25 | C: min1/corpus |
|---------|---------|---------|----------------|
| correctness + completeness + groundedness | **8.40** | **10.13** | 9.67 |
| source coverage | 4.00 | 4.00 | 4.00 |
| avg chunks | 1.73 | 3.00 | 2.27 |
| per-question wins (sum judge /15) | 0 | 3 | 2 (10 ties) |

### Lectures cles

1. **B (0.25) gagne en moyenne** sur correctness/completeness (+0.86 pt vs C, +1.73 vs A), avec groundedness parfaite (4.0) et le meme source coverage (4.0). Cout: +1.27 chunk/question vs A.

2. **B ne corrige pas le cas multicorpus typique (q353).** Civil art.10 a rel=0.15 au rerank: sous 0.25, B n'ajoute qu'un 2e chunk travail (L1224-2). Judge: correctness=2, completeness=2. **C restaure civil art.10** -> judge **4/4/4** avec les 2 gold articles.

3. **C est le meilleur compromis diversite/bruit** pour le probleme filter multicorpus: +0.54 chunk vs A, -0.73 vs B, gold articles 1.33 vs 1.00 (A). Groundedness legerement inferieure (3.87 vs 4.0).

4. **Cas B (rerank):** q361, q374, q375, q378 -- aucune variante filter ne restaure le 2e corpus (probleme amont).

5. **Cas A:** q362, q363, q371 -- A deja suffisant; B/C n'ameliorent pas ou ajoutent du bruit marginal.

### Recommandation experimentale

**Pas de modification production immediate.** Resultats mixtes: B gagne l'agregat, C gagne les echecs filter multicorpus typiques.

**Prochaine etape minimale:** PR filter conditionnel multicorpus:

```text
si corpusIds.length > 1 :
  appliquer min-1-chunk/corpus @ threshold 0.40
sinon :
  filter standard @ 0.40
```

Valider sur 30-40 questions multicorpus avant E2E 500. Alternative si simplicite preferee: threshold 0.25 (gain agregat mais ne garantit pas la diversite corpus).

See `results.json` for full judge explanations per question.
