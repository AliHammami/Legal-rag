# Dataset d'?valuation multi-corpus

## Objectif

Le fichier `data/evaluation/legal-multicorpus.questions.json` est un **dataset partag?** de 500 questions permettant d'?valuer, ? partir des m?mes entr?es :

- le routing LLM ;
- le retrieval vectoriel ;
- le reranking Jina ;
- la g?n?ration ;
- l'abstention sur les questions hors p?rim?tre.

## R?partition cible

| Type | Nombre |
|------|-------:|
| `single-corpus` | 350 |
| `multi-corpus` | 75 |
| `ambiguous` | 40 |
| `out-of-scope` | 35 |
| **Total** | **500** |

R?partition mono-corpus indicative :

- `code-penal` : 58
- `code-civil` : 58
- `code-du-travail` : 58
- `code-du-commerce` : 58
- `code-monetaire-et-financier` : 59
- `code-de-la-consommation` : 59

Difficult? cible : 30 % `easy`, 50 % `medium`, 20 % `hard`.

## Sch?ma

```ts
type LegalMulticorpusEvaluationQuestion = {
  id: string;
  question: string;
  goldCorpusIds: string[];
  goldArticles: string[];
  referenceAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType:
    | 'single-corpus'
    | 'multi-corpus'
    | 'ambiguous'
    | 'out-of-scope';
  sourceArticles?: string[];
};
```

## D?finitions

### `goldCorpusIds`

Corpus **r?ellement n?cessaires** pour r?pondre correctement.

- mono-corpus : exactement 1 ID ;
- multi-corpus : au moins 2 IDs ;
- ambigu / hors p?rim?tre : `[]`.

### `goldArticles`

Articles **strictement n?cessaires** ? la r?ponse. Chaque ID doit exister dans les fichiers `data/processed/<corpus>.articles.json`, y compris les suffixes de d?sambigu?sation (`@p123`, `@o3`, etc.).

### `referenceAnswer`

R?ponse de r?f?rence d?riv?e des textes r?els. Pour les questions hors p?rim?tre, elle d?crit une abstention appropri?e sans inventer de r?gle juridique.

## Construction

Workflow :

```text
data/processed/*.articles.json
        ?
s?lection d'articles diversifi?s
        ?
g?n?ration candidate (LLM)
        ?
validation contre les articles r?els
        ?
d?duplication
        ?
legal-multicorpus.questions.json
```

Les questions ambigu?s et hors p?rim?tre sont d?finies manuellement dans `src/evaluation/multicorpus-seed-questions.ts`.

## Commandes

```bash
# G?n?rer le dataset (OpenAI requis)
pnpm generate:evaluation:multicorpus

# Valider structure, r?partition, corpus et articles
pnpm validate:evaluation:multicorpus

# Rapport statistique
pnpm report:evaluation:multicorpus
```

## Limites connues

- Les questions mono/multi-corpus sont g?n?r?es ? partir d'extraits d'articles ; la couverture th?matique d?pend de la s?lection automatique.
- La difficult? est finalis?e par une heuristique globale pour respecter les quotas exacts.
- Le dataset ne remplace pas une ?valuation humaine sur les questions fronti?res.
- Les benchmarks routing / retrieval / E2E complets ne sont pas inclus dans cette ?tape.
