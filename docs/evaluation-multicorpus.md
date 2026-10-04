# Dataset d'évaluation multi-corpus

## Objectif

Le fichier `data/evaluation/legal-multicorpus.questions.json` est un **dataset partagé** de 500 questions permettant d'évaluer, à partir des mêmes entrées :

- le routing LLM ;
- le retrieval vectoriel ;
- le reranking Jina ;
- le pipeline E2E (génération + judge) ;
- l'abstention sur les questions hors périmètre.

## Répartition cible

| Type | Nombre |
|------|-------:|
| `single-corpus` | 350 |
| `multi-corpus` | 75 |
| `ambiguous` | 40 |
| `out-of-scope` | 35 |
| **Total** | **500** |

Difficult? cible : 30 % `easy`, 50 % `medium`, 20 % `hard`.

## Schéma

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

Chaque `goldArticles` entry associe explicitement un `corpusId` ? un `articleNumber`. Les métriques retrieval/reranking comparent toujours le couple `(corpusId, articleNumber)`, jamais le numéro d'article seul.

## Définitions

### `goldCorpusIds`

Corpus **réellement nécessaires** pour répondre correctement.

- mono-corpus : exactement 1 ID ;
- multi-corpus : au moins 2 IDs ;
- ambigu / hors périmètre : `[]`.

### `goldArticles`

Articles **strictement nécessaires** ? la réponse, avec corpus explicite. Chaque ID doit exister dans `data/processed/<corpus>.articles.json`, y compris les suffixes de désambiguïsation (`@p123`, `@o3`, etc.).

Cohérence attendue pour les questions normales :

```text
set(goldCorpusIds) === set(corpusId des goldArticles)
```

## Migration goldArticles

Pour migrer un dataset legacy (`goldArticles: string[]`) :

```bash
# Rapport de réconciliation (sans modification)
pnpm reconcile:evaluation:multicorpus

# Appliquer la migration
pnpm reconcile:evaluation:multicorpus -- --apply
```

Le script signale les cas ambigus (même numéro d'article dans plusieurs corpus) sans choisir silencieusement un corpus.

## Commandes dataset

```bash
# Génère le dataset (OpenAI requis — ne pas relancer si dataset existant)
pnpm generate:evaluation:multicorpus

# Valider structure, répartition, corpus et articles
pnpm validate:evaluation:multicorpus

# Rapport statistique
pnpm report:evaluation:multicorpus
```

## Harness d'évaluation

Architecture : `src/evaluation/multicorpus/`

| Module | Rôle |
|--------|------|
| `routing-evaluator.ts` | `routeQuestion()` seul |
| `retrieval-evaluator.ts` | Global vs routing + retrieval |
| `reranking-evaluator.ts` | Vector Top5 vs Jina Top5 (mêmes candidats Top20) |
| `e2e-evaluator.ts` | Baseline vs routing via `answerQuestion` + judge |
| `error-analyzer.ts` | Classification `FailureStage` |
| `aggregate-results.ts` | Agrégation + breakdowns |
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

### Métriques

**Routing** : exact match (ensemble), precision/recall/F1 corpus-level, taux `[]` pour ambiguous/out-of-scope.

**Retrieval** : Recall@5/10/20, MRR sur couples `(corpusId, articleNumber)`. Recall fractionnaire multi-gold = hits / |goldArticles|. Comparaison global baseline vs routing + retrieval filtr? (fallback global si router retourne `[]`).

**Reranking** : Recall@5 et MRR avant/après Jina sur les mêmes candidats vectoriels Top20.

**E2E** : correctness, completeness, groundedness, abstention ; source relevance/coverage ; latences par étape (avg, p50, p95).

### Reproductibilit?

- Dataset source immuable pendant l'évaluation.
- Résultats bruts : `reports/evaluation/runs/{timestamp}/`
- Snapshots latest : `reports/evaluation/multicorpus-latest.md` et `.json`
- Cache par question dans `{runDir}/{mode}-cache/` ; cl? = hash(questionId + mode + modelConfiguration + evaluatorVersion)
- Relancer `--all` réutilise le cache des modes déjà exécutés (sauf `--force`).
- `--resume <run-id>` reprend un dossier existant sous `reports/evaluation/runs/` (ou un chemin absolu). Les modes non relancés sont rechargés depuis le cache pour le rapport final.
- Progression en console : `[mode] 12/500 q012 (cache)`.

### Prérequis benchmark complet

- PostgreSQL avec embeddings ingérés pour les 6 corpus
- Clés API OpenAI (routing, génération, judge) et Jina (reranker)

## Limites connues

- 4 overrides manuels pour la réconciliation gold (q390, q404, q414, q416).
- q404 : article monétaire assigné pour satisfaire la structure multi-corpus ; la réponse de référence est surtout commerce.
- Le judge E2E hérite du prompt Code pénal ; ? généraliser pour une évaluation juridique multi-corpus plus fine.
- Les benchmarks complets sont coûteux (500 questions — 4 modes).
