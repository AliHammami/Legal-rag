# Notes d'entretien — projet `penal` (RAG juridique multi-corpus)

Document de **révision personnelle** (français). Tout ce qui est marqué **« dans le projet »** est vérifiable dans le repo ; le reste est **concept à connaître**.

---

## RAG

### Concept

Retrieval-Augmented Generation : récupérer des documents pertinents, les injecter dans le prompt, puis générer une réponse **conditionnée** par ce contexte.

### Comment c'est utilisé dans ce projet

- Orchestration : `src/generation/answer-question.ts` → `searchAndRerankQuestion()` puis filter → `buildRagContext()` → `RagGenerationService.generateAnswer()`.
- CLI : `scripts/search-answer.ts`.

### Pourquoi ce choix

Le droit exige traçabilité et réduction des hallucinations ; un pipeline RAG avec citations `[Source N]` force le modèle à s'appuyer sur des extraits stockés.

### Alternatives

Fine-tuning du modèle sur les codes ; cache de Q/R ; agents avec outils de recherche. Le fine-tuning coûte cher à maintenir quand les textes changent ; le RAG garde les sources explicites.

### Questions d'entretien possibles

**Q : Pourquoi RAG plutôt qu'un long contexte avec tout le Code pénal ?**  
**R :** Six codes, ~33k chunks — impossible et coûteux en contexte. On retrieve un petit sous-ensemble pertinent, on rerank, on filtre (max 5 chunks en prod filter).

---

## Pipeline du projet (résumé)

```text
Question → Routing (LLM structured) → [abstain → stop]
→ Embed → Retrieval (vector | hybrid-union) → Jina rerank (top 5)
→ Dynamic context filter → buildRagContext → Generation (LCEL chain)
```

Référence : README, `docs/evaluation.md` §1.

---

## Grounding / hallucinations / abstention

### Grounding (dans le projet)

- Prompt génération : répondre **uniquement** à partir du contexte, citations `[Source N]`.
- Judge E2E : score **groundedness** 0–4 vs **contexte fourni** (`parse-e2e-judge-response.ts`).

### Abstention (dans le projet)

- Router peut renvoyer `corpusIds: []` → décision **`abstain`** → pas d'embed/retrieval/gen ; réponse fixe `ROUTING_ABSTENTION_ANSWER`.
- Distinct de **`global_fallback`** (eval : recherche tous corpora).
- Dataset : 40 ambiguous + 35 out-of-scope ; smoke 43 questions (`pnpm smoke:abstention`).

### Questions d'entretien

**Q : Différence groundedness vs correctness au judge ?**  
**R :** Correctness = justesse vs question/référence ; groundedness = support par le **contexte retrieval**, pas par la référence seule.

---

## Chunking

### Concept

Découper les articles en morceaux indexables.

### Dans le projet

- `src/chunking/chunk-corpus.ts`, constantes `TARGET_SIZE = 1500`, `MAX_SIZE = 2000` **caractères**.
- Découpe par unités légales, puis phrases, puis hard split si nécessaire (`group-chunks.ts`).
- **Pas d'overlap explicite** entre chunks : concaténation d'unités jusqu'à la taille cible.

### Pourquoi

Articles très longs (travail, commerce) ; chunks bornés pour embeddings et reranker.

### Alternatives

Chunking par tokens (tiktoken utilisé en **analyse** eval, pas forcément identique au chunker prod) ; overlap sliding window (non utilisé ici).

### Questions d'entretien

**Q : Impact d'un chunk trop grand ?**  
**R :** Bruit au rerank, coût tokens gen ; d'où max 2000 chars et filter final max 5 chunks.

---

## Embeddings

### Concept

Vecteurs denses pour similarité sémantique.

### Dans le projet

- Modèle : **`text-embedding-3-large`**, **3072** dimensions (`src/embeddings/constants.ts`).
- LangChain : `createOpenAIEmbeddings()` ; stockage pgvector `vector(3072)`.
- Une embedding par question au retrieval (`searchQuestion`, `retrieveHybridUnionCandidates`).

### Limites

Synonymes OK ; références exactes d'articles / lexique juridique précis parfois ratés → motivation **hybrid-union** (BM25).

### Questions d'entretien

**Q : Cosine vs distance dans pgvector ?**  
**R :** Le SQL utilise `<=>` (distance) ; on ordonne par proximité — l'important est cohérence embed/query même modèle/dim.

---

## Vector retrieval

### Dans le projet

- `searchSimilarChunks` / quota multicorpus : top-K global ou par corpus (`DEFAULT_RETRIEVAL_TOP_K = 30`).
- Filtre optionnel `corpusIds` post-routing.

---

## Lexical / BM25

### Dans le projet

- `src/retrieval/bm25/` ; index en mémoire par `corpusId`, chargé depuis Prisma.
- Activé dans **hybrid-union** seulement si `corpusIds.length > 0`.
- Union : vector top 50 + BM25 top 50, dedup `chunkId` (`hybrid-union.ts`).

### Pourquoi combiner

Benchmark offline 61 Q : BM25 seul 73.1% recall@50, union 81.7% (`retrieval-hybrid-benchmark-2026-09-22`).

### RunnableParallel ?

**Non utilisé** ; branches séquentielles dans le code. `Promise.all` suffirait pour paralléliser I/O ; pas migré.

---

## Top-K

### Concept

Nombre de candidats retrieval / rerank.

### Dans le projet

- Retrieval : 30 (vector default) ou 50+50 hybrid.
- Rerank : **5** (`DEFAULT_RERANK_TOP_K`).
- Compromis : K large = recall ; K petit au rerank = coût Jina/latence.

### Questions d'entretien

**Q : Pourquoi ne pas envoyer les 20 chunks directement au LLM ?**  
**R :** Bruit, coût, groundedness ; on rerank puis filter (seuil relatif 0.4, max 5). Voir filter benchmark multicorpus (min 1 chunk/corpus).

---

## Reranking

### Concept

Modèle cross-encoder (ici API Jina) re-scoring query–passage.

### Dans le projet

- `jina-reranker-v3.5`, `rerankChunks()` ; fallback slice vector si erreur Jina éligible.
- Concurrency limiter eval : `jina-concurrency-limit.ts`.

### Questions d'entretien

**Q : Reranker si Recall@20 déjà bon ?**  
**R :** Recall@20 mesure présence des golds dans le pool ; le reranker améliore **l'ordre** pour que le bon article soit en tête avant le filter (top 5).

**Q : Que conclure si Recall@20 excellent mais réponse finale fausse ?**  
**R :** Problème probable en **generation** ou **contexte trop pauvre après filter** ; tracer gold recall post-filter et scores judge groundedness vs correctness.

---

## Routing multi-corpus

### Concept

Router la question vers les bons codes.

### Dans le projet

- `routeQuestion()` : LCEL `ROUTER_CHAT_PROMPT.pipe(structuredModel)`.
- Zod : `RoutingLlmResponseSchema` → `{ corpusIds }`.
- Métier : `validateRoutingResult()`.
- Prompt riche avec exemples (`router-prompt.ts`).

### Structured Output

`withStructuredOutput(RoutingLlmResponseSchema)` — pas de `response_format` manuel dans le code métier.

### Multi-corpus

Plusieurs IDs si la question mélange matières ; retrieval quota + filter min 1 chunk/corpus.

### Questions d'entretien

**Q : Pourquoi pas mettre validateRoutingResult dans le Runnable ?**  
**R :** Séparation : LCEL = orchestration LLM ; Zod structured = contrat API ; validation métier = dedup, corpus registry, messages d'erreur domaine.

---

## Dynamic context filtering

### Dans le projet

- `dynamicContextFilter()` : score relatif au meilleur rerank score ; garde chunk 0 ; min 1 ; max 5 ; règle multicorpus min 1/corpus.
- Seuil default **0.4** (`DEFAULT_RELATIVE_SCORE_THRESHOLD`).

### Questions d'entretien

**Q : Pourquoi un seuil relatif et pas absolu ?**  
**R :** Scores Jina varient selon requêtes ; normaliser par le best score stabilise la sélection.

---

## Generation

### Dans le projet

- LCEL : `createRagGenerationChain()` = prompt + ChatOpenAI + `RunnableLambda` extraction.
- Citations imposées dans `RAG_SYSTEM_PROMPT` (`build-rag-messages.ts`).

### Conversation HTTP

- `conversations.controller.ts` : stream OpenAI **sans** RAG (`ChatService` : pas de base documentaire).

---

## Evaluation

### Dataset

- `data/evaluation/legal-multicorpus.questions.json` — **500** questions (`docs/evaluation-multicorpus.md`).
- `goldArticles` : paires `(corpusId, articleNumber)`.

### Métriques (dans le code)

- Routing : P/R/F1, exact match (`corpusPrecisionRecallF1`).
- Retrieval : `recallAtKGoldArticles` (fractional multi-gold), MRR, coverage (`metrics.ts`).
- E2E judge : correctness, completeness, groundedness, abstentionCorrect ; source judge : sourceRelevance, sourceCoverage.

### Recall@K (projet)

Fraction des **gold articles** trouvés dans le top-K (pas uniquement binaire mono-gold).

### Exact Match

Routing : ensemble prédit = ensemble gold.

### Stratégie eval

Pas E2E 500 à chaque patch — benchmarks ciblés, cache, smoke (`docs/evaluation.md`).

### Diagnostiquer une régression

| Symptôme | Piste |
|----------|--------|
| mauvais corpus | routing eval |
| gold absent du pool | retrieval @K, hybrid |
| gold dans pool mais pas en contexte | rerank + filter |
| contexte OK, réponse fausse | generation / judge correctness |
| réponse plausible mais non fondée | groundedness |

---

## LangChain (dans le projet)

| Brique | Usage |
|--------|--------|
| **ChatOpenAI** | `createChatOpenAI()` |
| **OpenAIEmbeddings** | `createOpenAIEmbeddings()` |
| **ChatPromptTemplate** | RAG, router, judges, multicorpus gen |
| **ChatPromptValue** | Sortie intermédiaire après prompt (via `.invoke` ou pipe) |
| **withStructuredOutput + Zod** | Routing, judges, dataset questions |
| **Runnable / LCEL** | `.pipe()` routing + RAG gen |
| **RunnableLambda** | Extraction texte post-`AIMessage` (RAG uniquement) |
| **`.invoke()`** | Chaînes et modèles ; config `{ signal }` pour abort |
| **`.stream()`** | Conversation (`streamChatTextDeltas`), pas RAG HTTP |
| **`.batch()`** | **Non utilisé** en prod/eval harness |
| **RunnableParallel / Passthrough** | **Non utilisés** dans `src/` |

### Flux RAG LCEL

```text
{ question, context } → chain.invoke → string
  = RAG_GENERATION_CHAT_PROMPT.pipe(chatModel).pipe(extractor)
```

### Flux routing LCEL

```text
{ routerSystemPrompt, question } → routingChain.invoke → { corpusIds }
  → validateRoutingResult()
```

---

## Structured Output

### Concept

Forcer le LLM à produire un JSON/objet typé.

### Dans le projet

- LangChain `withStructuredOutput(zodSchema)` ; provider gère la mécanique.
- **Pas** de retry automatique si Zod échoue (sauf erreur remontée).
- Judges : Zod + `parseE2EJudgeScoreSnapshot` (explanation non vide, etc.).

### vs JSON.parse manuel

Ancien chemin supprimé (`invokeStructuredJsonChat`) ; moins de code OpenAI-specific dans le métier.

### Questions d'entretien

**Q : Zod vs types TypeScript ?**  
**R :** TS disparaît à l'exécution ; Zod valide runtime sur la sortie LLM.

**Q : Retry si schema fail ?**  
**R :** Non ajouté — une retry aveugle coûte et masque les bugs prompt ; à réfléchir avec idempotence et plafond.

---

## Tools / Agents (conceptuel — **non implémenté**)

### Tool

Fonction externe décrite par un schema ; le modèle émet `tool_calls`.

### Agent

Boucle LLM → tools → LLM jusqu'à stop.

### vs projet actuel

Pipeline **déterministe** : pas de boucle tool. Choix pour coût, testabilité, eval par étape.

### Architecture hybride (concept)

Garder retrieval/rerank déterministes ; n'agentifier que la planification si besoin futur.

### Questions d'entretien

**Q : Pourquoi ne pas tout transformer en Agent ?**  
**R :** Latence, coût, non-déterminisme, debug difficile ; nos étapes sont connues et benchmarkées séparément.

---

## Production / ops (mixte)

| Sujet | Dans le projet ? |
|-------|------------------|
| **Concurrency eval** | Oui — workers + `Promise.all` (`e2e-evaluator.ts`, etc.) |
| **Jina rate limit** | Oui — `jina-concurrency-limit.ts`, cooldown |
| **Cache eval** | Oui — `readCachedResult` / `writeCachedResult` |
| **Profiling latence** | Oui — `PipelineProfilingTimings` |
| **Abort signal** | Oui — routing + gen + conversation SSE |
| **Retry LLM général** | Non systématique |
| **Langfuse / tracing** | Non |
| **Streaming RAG réponse** | Non (invoke full completion) |

---

## Questions transversales d'entretien (avec réponses orales)

1. **Pourquoi reranker si Recall@20 est déjà bon ?**  
   Parce que Recall mesure la présence dans le pool, pas l'ordre en tête. Le filter ne garde que quelques chunks après rerank top-5.

2. **Recall@20 excellent, réponse finale fausse ?**  
   Regarder generation (prompt, contexte tronqué) et judge correctness vs groundedness.

3. **Pourquoi pas 20 chunks au LLM ?**  
   Coût tokens, bruit, risque hallucination ; on filtre à ~5 avec seuil relatif.

4. **Cas où BM25 bat le vectoriel ?**  
   Lexique exact (numéros d'articles, formules), faible paraphrase ; ex. golds BM25-only dans benchmark hybrid.

5. **Pourquoi pas tout en Agent ?**  
   Voir section Agents — contrôle et eval par stage.

6. **Reranker dégrade Recall@5 ?**  
   Possible si mauvais passages remontent ; comparer ordre vector vs Jina sur cohort gold ; fallback Jina existe.

7. **Diagnostiquer latence ?**  
   Utiliser `profiling` dans `answerQuestion` : routingMs, embeddingMs, vectorSearchMs, jinaRerankingMs, generationMs.

8. **Rate limit OpenAI/Jina ?**  
   Réduire concurrency eval ; backoff Jina (`jina-concurrency-limit`) ; pas de retry global LLM routing.

9. **Quand retry ?**  
   Idempotent, erreurs transitoires, plafond — pas implémenté partout ; éviter retry sur structured parse fail sans fix prompt.

10. **Mesurer qu'une modif améliore vraiment ?**  
    Benchmark ciblé (même cohort), même cache routing, métriques stage-specific avant E2E 500.

11. **Hybrid union vs RRF ?**  
    Benchmark : union 81.7% vs RRF 77.4% @50 sur 61 Q — union retenue dans stratégie `hybrid-union` (RRF pas le default code path prod strategy name).

12. **Pourquoi LCEL seulement sur gen + routing ?**  
    Pédagogie et frontière LLM claire ; reste du pipeline = TS + SQL + Jina, pas des Runnables.

13. **validateRoutingResult après chain ?**  
    Le LLM schema n'inclut pas `reason` ; dedup et registry corpus sont métier.

14. **Différence abstain vs global_fallback ?**  
    Abstain = router renvoie [] → stop ; global_fallback = eval force [] mais retrieval tous corpora.

15. **Judge fiable ?**  
    Proxy pour comparer variantes ; pas vérité juridique (`docs/evaluation.md`).

16. **Quota multicorpus ?**  
    Évite qu'un corpus domine le top-K global ; replay 41 Q : recall gold + présence 2 corpus.

17. **Min 1 chunk/corpus au filter ?**  
    Variante B benchmark : 78% questions avec tous gold corpora présents vs 22% sans.

18. **RETRIEVAL_STRATEGY default ?**  
    Code default `vector` ; hybrid activé par env explicite (doc eval : `.env` travail).

19. **API REST RAG ?**  
    Oui — `POST /rag/answer` (JSON, pipeline `answerQuestion()`). Le chat HTTP `conversations` reste sans corpus ; CLI `search:answer` inchangé.

20. **Dimensions embedding 3072 ?**  
    Choix `text-embedding-3-large` config ; table Prisma fixe vector(3072).

21. **Chunk 1500 vs 2000 ?**  
    Target vs max ; dépassement max déclenche splits phrase/hard.

22. **Structured output routing sans reason ?**  
    Prompt + schema strict `{ corpusIds }` ; aligné prod.

23. **RunnableLambda rôle ?**  
    Extraire string AIMessage + erreur vide — pas validation métier routing.

24. **Tests sans API ?**  
    Nombreux tests unitaires filter, union, validate routing, prompt parity.

25. **500 questions générées comment ?**  
    Script `generate:evaluation:multicorpus` avec structured output multicorpus.

26. **Erreur routing API ?**  
    `OpenAIErrorMapper` → `RoutingError`.

27. **Jina fallback ?**  
    Candidats ordre vector slice top-K — `rerankStatus: 'fallback'`.

28. **Citations en gen ?**  
    System prompt impose `[Source N]` lié aux en-têtes contexte.

29. **Zod enum corpus routing ?**  
    `ALL_CORPUS_IDS` dans schema — inconnu rejeté tôt.

30. **Prochaine étape archi ?**  
    Observabilité, éventuellement LangGraph si workflows branchy — **pas dans le repo actuel**.

---

*Dernière alignement doc : audit repo `penal` (sources `src/`, `docs/evaluation.md`, `data/evaluation/corpus-validation-report.json`, reports sous `reports/evaluation/runs/`).*
