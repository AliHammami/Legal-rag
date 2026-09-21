# Re-smoke enrichi - Reranking + Dynamic Filter multicorpus (quota)

**Run:** `multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z`  
**Donnees:** scores Jina quota reels persistes dans `audit.json` (41 questions, 41 appels Jina + 41 embeddings).

## A. Resume

```text
41 questions (4 exclues: q382, q399, q409, q413)

Routed corpus coverage:
  Retrieval : 41/41 = 100%
  Rerank    : 32/41 =  78%
  Filter    :  9/41 =  22%

Gold corpus coverage (39 questions avec 2 gold corpora):
  Retrieval : 39
  Rerank    : 32
  Filter    :  9

Gold article coverage:
  Retrieval : 57/82 = 69.5%
  Rerank    : 54/82 = 65.9%
  Filter    : 45/82 = 54.9%
```

## B. Classification

### Par corpus routes

```text
A = 9   (2 corpus routes dans le contexte final)
B = 9   (perdu au rerank)
C = 23  (rerank OK, filter perd)
OTHER = 0
```

### Par corpus gold

```text
A = 9
B = 7
C = 23
OTHER = 2   (q361, q408 - gold corpora != corpus routes)
```

## C. Gold article coverage

| etape | Hits | Total | Recall |
|-------|------|-------|--------|
| retrieval | 57 | 82 | 69.5% (57/82) |
| rerank | 54 | 82 | 65.9% (54/82) |
| filter @0.4 | 45 | 82 | 54.9% (45/82) |

## D. Threshold grid (filter standard, offline sur scores quota)

| threshold | 2 routed | 1 routed | 0 routed | gold articles | 2 gold corp | avg chunks | avg/corpus |
|-----------|----------|----------|----------|---------------|-------------|------------|------------|
| 0.20 | 23 | 18 | 0 | 53/82 (64.6%) | 23 | 3.15 | 2.09 |
| 0.25 | 20 | 21 | 0 | 53/82 (64.6%) | 20 | 2.95 | 2.04 |
| 0.30 | 16 | 25 | 0 | 50/82 (61.0%) | 16 | 2.54 | 1.80 |
| 0.35 | 14 | 27 | 0 | 48/82 (58.5%) | 14 | 2.34 | 1.71 |
| 0.40 | 9 | 32 | 0 | 45/82 (54.9%) | 9 | 2.02 | 1.62 |
| 0.45 | 8 | 33 | 0 | 44/82 (53.7%) | 8 | 1.90 | 1.55 |
| 0.50 | 5 | 36 | 0 | 41/82 (50.0%) | 5 | 1.73 | 1.51 |

## E. Min-1-corpus grid (simulation offline)

| threshold | 2 routed | 1 routed | 0 routed | gold articles | 2 gold corp | avg chunks | avg/corpus |
|-----------|----------|----------|----------|---------------|-------------|------------|------------|
| 0.20 | 32 | 9 | 0 | 54/82 (65.9%) | 32 | 3.37 | 1.98 |
| 0.25 | 32 | 9 | 0 | 54/82 (65.9%) | 32 | 3.24 | 1.91 |
| 0.30 | 32 | 9 | 0 | 52/82 (63.4%) | 32 | 2.93 | 1.74 |
| 0.35 | 32 | 9 | 0 | 51/82 (62.2%) | 32 | 2.78 | 1.66 |
| 0.40 | 32 | 9 | 0 | 50/82 (61.0%) | 32 | 2.59 | 1.52 |
| 0.45 | 32 | 9 | 0 | 50/82 (61.0%) | 32 | 2.49 | 1.45 |
| 0.50 | 32 | 9 | 0 | 49/82 (59.8%) | 32 | 2.39 | 1.39 |

## F. Cas representatifs

### Filter trop agressif

**q353** - civil art.10 present au rerank (score 0.108, rel 0.151) mais supprime @0.4; gold civil perdu.

**q352** - commerce L123-3 au rerank (rel 0.236) supprime; seul civil 9-1 conserve.

**q360** - penal 414-7 au rerank (rel 0.019) supprime; commerce domine le top-5.

### Perte au rerank

**q374** - ret=2 mais top-5 100% commerce; gold monetaire absent du pool.

**q375** - ret=2 mais top-5 100% commerce; gold penal absent.

**q400** - ret=2, rer=1 mono-corpus conso; gold travail absent du top-5.

### Quota ameliore vs baseline forensic

Retrieval routed bi-corpus: 41/41 (vs ~27/41 baseline). Gold articles retrieval: 57/82 (vs 48/82 proxy forensic).

### Quota confirme le pattern filter

23 cas C identiques au smoke precedent - le filter 0.4 est le goulot, pas un artefact du proxy.

## G. Conclusion (donnees quota reelles)

1. **Threshold standard interessant :** @0.25 -> 20/41 routed bi-corpus (+11 vs @0.40), gold 53/82 (64.6%, +8 articles), avg 2.95 chunks (+0.93 bruit). @0.30 -> 16/41, gold 61.0%, avg 2.54.

2. **Min 1 chunk / corpus :** @0.40 -> **32/41** routed bi-corpus (+23 vs actuel), gold **50/82 (61.0%)**, avg **2.59 chunks** (+0.57 seulement). Meilleur compromis couverture/bruit observe.

3. **Cas C recuperes :** standard @0.25 recupere 11/23 cas C; min-1-corpus @0.40 recupere **23/23** cas C en couverture routed.

4. **Cout bruit :** @0.40 actuel = 2.02 chunks/q; min-1 @0.40 = 2.59 (+28%); standard @0.25 = 2.95 (+46%).

5. **Cas B (rerank) :** 9 questions - secondaire vs 23 cas C. Le reranker n'est pas la priorite.

6. **Prochaine etape :** smoke generation + judge sur ~15 questions comparant **min-1-corpus @0.40** (prod-like, seuil inchange) vs **standard @0.25**.

## Comparaison smoke precedent

Smoke precedent: `multicorpus-quota-smoke-2026-09-20T23-05-17-065Z`  
Delta filter 2 corpus routed: **+0** (9/41 confirme - memes chiffres, donnees enrichies).
