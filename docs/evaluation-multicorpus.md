# Dataset d'?valuation multi-corpus

## Objectif

Le fichier `data/evaluation/legal-multicorpus.questions.json` est un **dataset partag?** de 500 questions permettant d'?valuer, ? partir des m?mes entr?es :

- le routing LLM ;
- le retrieval vectoriel ;
- le reranking Jina ;
- le pipeline E2E (g?n?ration + judge) ;
- l'abstention sur les questions hors p?rim?tre.

## R?partition cible

| Type | Nombre |
|------|-------:|
| `single-corpus` | 350 |
| `multi-corpus` | 75 |
| `ambiguous` | 40 |
| `out-of-scope` | 35 |
| **Total** | **500** |

Difficult? cible : 30 % `easy`, 50 % `medium`, 20 % `hard`.

## Sch?ma

```ts
type GoldArticle = {
  corpusId: string;
  articleNumber: string;
};

type LegalMulticorpusEvaluationQuestion = {
  id: string;
  question: string;
  goldCorpusIds: string[];
  goldArticles: GoldArticle[];
  referenceAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType:
    | 'single-corpus'
    | 'multi-corpus'
    | 'ambiguous'
    | 'out-of-scope';
  sourceArticles?: GoldArticle[];
};
```

Chaque `goldArticles` entry associe explicitement un `corpusId` ? un `articleNumber`. Les m?triques retrieval/reranking comparent toujours le couple `(corpusId, articleNumber)`, jamais le num?ro d'article seul.

## D?finitions

### `goldCorpusIds`

Corpus **r?ellement n?cessaires** pour r?pondre correctement.

- mono-corpus : exactement 1 ID ;
- multi-corpus : au moins 2 IDs ;
- ambigu / hors p?rim?tre : `[]`.

### `goldArticles`

Articles **strictement n?cessaires** ? la r?ponse, avec corpus explicite. Chaque ID doit exister dans `data/processed/<corpus>.articles.json`, y compris les suffixes de d?sambigu?sation (`@p123`, `@o3`, etc.).

Coh?rence attendue pour les questions normales :

```text
set(goldCorpusIds) === set(corpusId des goldArticles)
```

## Migration goldArticles

Pour migrer un dataset legacy (`goldArticles: string[]`) :

```bash
# Rapport de r?conciliation (sans modification)
pnpm reconcile:evaluation:multicorpus

# Appliquer la migration
pnpm reconcile:evaluation:multicorpus -- --apply
```

Le script signale les cas ambigus (m?me num?ro d'article dans plusieurs corpus) sans choisir silencieusement un corpus.

## Commandes dataset

```bash
# G?n?rer le dataset (OpenAI requis � ne pas relancer si dataset existant)
pnpm generate:evaluation:multicorpus

# Valider structure, r?partition, corpus et articles
pnpm validate:evaluation:multicorpus

# Rapport statistique
pnpm report:evaluation:multicorpus
```

## Harness d'?valuation

Architecture : `src/evaluation/multicorpus/`

| Module | R?le |
|--------|------|
| `routing-evaluator.ts` | `routeQuestion()` seul |
| `retrieval-evaluator.ts` | Global vs routing + retrieval |
| `reranking-evaluator.ts` | Vector Top5 vs Jina Top5 (m?mes candidats Top20) |
| `e2e-evaluator.ts` | Baseline vs routing via `answerQuestion` + judge |
| `error-analyzer.ts` | Classification `FailureStage` |
| `aggregate-results.ts` | Agr?gation + breakdowns |
| `write-evaluation-report.ts` | Rapport Markdown + JSON |

Orchestrateur : `scripts/evaluate-multicorpus.ts`

```bash
pnpm evaluate:multicorpus --routing
pnpm evaluate:multicorpus --retrieval
pnpm evaluate:multicorpus --reranking
pnpm evaluate:multicorpus --e2e
pnpm evaluate:multicorpus --all

# Options utiles
pnpm evaluate:multicorpus --all --limit 20 --concurrency 5
pnpm evaluate:multicorpus --routing --question-id q351 --force
pnpm evaluate:multicorpus --reranking --resume 2026-09-18T21-05-25-814Z
pnpm evaluate:multicorpus --e2e --resume 2026-09-18T21-05-25-814Z --concurrency 1 --jina-concurrency 1
```

### M?triques

**Routing** : exact match (ensemble), precision/recall/F1 corpus-level, taux `[]` pour ambiguous/out-of-scope.

**Retrieval** : Recall@5/10/20, MRR sur couples `(corpusId, articleNumber)`. Recall fractionnaire multi-gold = hits / |goldArticles|. Comparaison global baseline vs routing + retrieval filtr? (fallback global si router retourne `[]`).

**Reranking** : Recall@5 et MRR avant/apr?s Jina sur les m?mes candidats vectoriels Top20.

**E2E** : correctness, completeness, groundedness, abstention ; source relevance/coverage ; latences par ?tape (avg, p50, p95).

### Reproductibilit?

- Dataset source immuable pendant l'?valuation.
- R?sultats bruts : `reports/evaluation/runs/{timestamp}/`
- Snapshots latest : `reports/evaluation/multicorpus-latest.md` et `.json`
- Cache par question dans `{runDir}/{mode}-cache/` ; cl? = hash(questionId + mode + modelConfiguration + evaluatorVersion)
- Relancer `--all` r?utilise le cache des modes d?j? ex?cut?s (sauf `--force`).
- `--resume <run-id>` reprend un dossier existant sous `reports/evaluation/runs/` (ou un chemin absolu). Les modes non relanc?s sont recharg?s depuis le cache pour le rapport final.
- Progression en console : `[mode] 12/500 q012 (cache)`.

### Pr?requis benchmark complet

- PostgreSQL avec embeddings ing?r?s pour les 6 corpus
- Cl?s API OpenAI (routing, g?n?ration, judge) et Jina (reranker)

## Limites connues

- 4 overrides manuels pour la r?conciliation gold (q390, q404, q414, q416).
- q404 : article mon?taire assign? pour satisfaire la structure multi-corpus ; la r?ponse de r?f?rence est surtout commerce.
- Le judge E2E h?rite du prompt Code p?nal ; ? g?n?raliser pour une ?valuation juridique multi-corpus plus fine.
- Les benchmarks complets sont co?teux (500 questions � 4 modes).
