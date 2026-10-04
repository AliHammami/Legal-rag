# Notes d'entretien — projet `penal` (RAG juridique multi-corpus)

Document de **révision personnelle** en français, orienté entretiens **AI / GenAI Engineer**. Deux niveaux de lecture :

- **Compréhension** : paragraphes explicatifs pour revoir les mécanismes plusieurs semaines plus tard.
- **Entretien** : formulations courtes en fin de section ou dans la liste de questions, utilisables à l’oral.

**Convention :** tout ce qui est décrit sous **« dans le projet »** a été vérifié dans le dépôt (`src/`, scripts, constantes, rapports d’évaluation). Le reste est du **concept général** utile en entretien, sans prétendre être implémenté ici.

**Dernier alignement du document :** audit du repo `penal` (sources `src/`, `docs/evaluation.md`, `data/evaluation/corpus-validation-report.json`, rapports sous `reports/evaluation/runs/`).

---

## Vue d’ensemble du projet

Le projet **penal** est un RAG sur **six codes juridiques français** : Code pénal, Code civil, Code du travail, Code de commerce, Code monétaire et financier, Code de la consommation. Les textes sont ingérés depuis des PDF Légifrance, découpés en chunks, embeddés et stockés dans **PostgreSQL + pgvector**.

Au dernier rapport de validation corpus (`corpus-validation-report.json`), l’index compte **33 684 chunks** au total. Ordre de grandeur par corpus (chunks indexés) :

| Corpus | Chunks (rapport) |
|--------|------------------|
| Code pénal | 1 367 |
| Code civil | 2 919 |
| Code du travail | 12 177 |
| Code de commerce | 8 334 |
| Code monétaire et financier | 6 645 |
| Code de la consommation | 2 242 |

Les codes « longs » (travail, commerce) dominent le volume ; le routing et le quota multicorpus existent justement pour ne pas noyer une question ciblée dans le bruit d’un gros index.

L’objectif produit est de répondre à une question juridique en s’appuyant sur des **extraits retrouvés** dans ces codes, avec **citations** et, lorsque le routeur ne peut pas cibler un corpus de façon fiable, une **abstention** explicite plutôt qu’une recherche aveugle.

**Réponse courte en entretien :** « C’est un RAG multi-corpus sur six codes : routing LLM, retrieval vectoriel ou hybride, rerank Jina, filtre dynamique du contexte, puis génération avec citations. J’ai aussi une API REST et une CLI qui appellent le même pipeline. »

---

## Architecture et points d’entrée

### Pourquoi séparer interface et pipeline

Le cœur métier vit dans **`answerQuestion()`** (`src/generation/answer-question.ts`). Cette fonction enchaîne recherche + rerank + filtre de contexte + génération. Les interfaces ne dupliquent pas routing, retrieval, reranking ni génération : elles appellent le même orchestrateur.

```text
CLI (pnpm search:answer) ─────┐
                              ├──→ answerQuestion() → pipeline RAG complet
POST /rag/answer (NestJS) ────┘
```

- **CLI :** `scripts/search-answer.ts` — pratique pour le debug et les essais manuels.
- **API RAG :** `POST /rag/answer` — body JSON `{ "question": "..." }` (question trimée, max 10 000 caractères). Le controller (`src/rag/rag.controller.ts`) délègue à `RagService`, qui appelle `answerQuestion()` puis mappe la réponse publique via `toRagAnswerResponse()` : `question`, `answer`, `routing`, `rerankStatus`, `sources` (sans chunks bruts ni timings de profiling).
- **Évaluation :** les scripts E2E et benchmarks réutilisent les mêmes briques avec des options (stratégie de retrieval, override de routing, cache, etc.).

### Distinction avec le chat HTTP « conversations »

Le module **conversations** (`conversations.controller.ts` / `ChatService`) expose un **chat streaming OpenAI sans corpus juridique** : pas de base documentaire, pas de RAG. C’est un produit différent du endpoint **`/rag/answer`**, qui exécute le pipeline juridique complet.

**Réponse courte en entretien :** « J’ai factorisé le RAG dans `answerQuestion()`. La CLI et `POST /rag/answer` passent par là ; le chat SSE reste un LLM nu, sans retrieval sur les codes. »

---

## Pipeline de bout en bout

Voici le déroulé nominal lorsque le routeur ne s’abstient pas :

1. **Routing** — un LLM avec sortie structurée (Zod) renvoie une liste de `corpusIds` pertinents, puis **`validateRoutingResult()`** applique les règles métier (dedup, corpus connus, etc.).
2. **Embedding de la question** — une requête vers le modèle d’embedding OpenAI.
3. **Retrieval** — recherche vectorielle (défaut) ou **hybrid-union** (vector top 50 + BM25 top 50, dédoublonnage par `chunkId`), avec filtrage optionnel sur les corpus routés et quotas multicorpus.
4. **Reranking** — API **Jina** (`jina-reranker-v3.5`) sur le pool retrieval ; **top 5** par défaut ; fallback sur l’ordre vectoriel si Jina échoue de façon éligible.
5. **Dynamic context filtering** — sélection d’un sous-ensemble des chunks rerankés (seuil relatif **0,4**, min **1**, max **5**, règle multicorpus : au moins un chunk par corpus routé si possible).
6. **Génération** — chaîne LCEL : prompt RAG + `ChatOpenAI` + extraction du texte ; le system prompt impose des citations **`[Source N]`**.

Références : README architecture, `docs/evaluation.md` (vue pipeline).

Si le routing décide **`abstain`** (`corpusIds: []`), le pipeline **s’arrête** avant embed/retrieval/gen et renvoie le message fixe **`ROUTING_ABSTENTION_ANSWER`** (`src/generation/constants.ts`).

---

## RAG (Retrieval-Augmented Generation)

### Définition

Le **RAG** consiste à **récupérer** des documents pertinents, à les **injecter dans le prompt** du LLM, puis à **générer** une réponse conditionnée par ce contexte. Le modèle ne « connaît » pas tout le corpus en weights : il lit un petit extrait sélectionné à la volée.

### Pourquoi c’est utile

Pour le droit, on veut **traçabilité** (quels articles supportent la réponse) et **moins d’hallucinations** qu’un LLM seul. Quand les textes changent (mises à jour Légifrance), mettre à jour l’index est plus simple que refaire un fine-tuning.

### Dans le projet

L’orchestration centrale est **`answerQuestion()`** : elle délègue d’abord à **`searchAndRerankQuestion()`** (`src/reranking/search-and-rerank-question.ts`), qui regroupe routing (si activé), embedding, retrieval selon **`resolveRetrievalStrategy(process.env)`**, puis rerank Jina. Ensuite viennent **`dynamicContextFilter()`**, **`buildRagContext()`**, et **`RagGenerationService.generateAnswer()`**.

### Limites / alternatives

- **Fine-tuning** sur les codes : coûteux à maintenir, sources moins explicites.
- **Contexte géant** (« tout le Code civil dans le prompt ») : impossible à l’échelle (~33k chunks), coût tokens et bruit.
- **Agent avec outil search** : plus flexible mais plus lent, moins déterministe, plus difficile à évaluer étape par étape — **non choisi** en production dans ce repo.

**Réponse courte en entretien :** « Plutôt que d’envoyer tout le corpus, on retrieve un petit nombre de passages, on les rerank et on filtre, puis le LLM répond avec citations. C’est adapté au juridique où la source compte. »

---

## Grounding, hallucinations et abstention

### Grounding

**Grounder** une réponse, c’est s’assurer qu’elle est **supportée par le contexte fourni** au modèle, pas seulement qu’elle « sonne vrai ».

Dans le projet, le **system prompt de génération** demande de répondre **uniquement** à partir du contexte et d’utiliser **`[Source N]`**. L’évaluation E2E inclut un score **groundedness** (0–4) jugé par un LLM sur le **contexte retrieval effectivement passé au générateur**, distinct de la **correctness** (justesse par rapport à la question / référence).

**Distinction importante :** une réponse peut être **grounded** (collée au contexte) mais **incorrecte** si le mauvais article a été retrouvé ; inversement, une réponse correcte en droit mais non présente dans le contexte serait **non grounded**.

### Abstention

L’**abstention** est le choix de **ne pas répondre** lorsque le système n’a pas assez de confiance ou que la question est hors périmètre.

Dans le projet, le **routeur** peut renvoyer **`corpusIds: []`**. La décision métier devient **`abstain`** : **aucune** recherche vectorielle ni génération ; l’utilisateur reçoit **`ROUTING_ABSTENTION_ANSWER`**.

Cela diffère du mode **`global_fallback`** utilisé en **évaluation** : on force un routing « vide » côté eval mais on lance quand même la recherche sur **tous** les corpora pour mesurer le retrieval sans bon routing. En prod, **`abstain`** coupe le pipeline.

Le jeu d’éval multicorpus inclut des questions **ambiguous** et **out-of-scope** ; un smoke dédié existe (`pnpm smoke:abstention`).

**Réponse courte en entretien :** « Groundedness, c’est : est-ce que la réponse est accrochée au contexte qu’on a injecté ? Correctness, c’est : est-ce que ça répond bien à la question ? L’abstention routing, c’est : si aucun corpus n’est identifié, on ne cherche pas et on renvoie un message fixe. »

---

## Chunking

### Définition

Le **chunking** découpe les articles juridiques en **morceaux indexables** (chunks), chacun embeddé et retrouvable séparément.

### Pourquoi

Certains articles sont très longs (travail, commerce). Des chunks bornés améliorent la granularité du retrieval, le scoring du reranker et le coût en tokens à la génération.

### Fonctionnement (dans le projet)

- Script / logique : `src/chunking/chunk-corpus.ts`, regroupement `group-chunks.ts`.
- Tailles : **`TARGET_SIZE = 1500`** caractères (objectif), **`MAX_SIZE = 2000`** (plafond).
- Stratégie : découpe par **unités légales**, puis **phrases**, puis **hard split** si le max est dépassé.
- **Pas d’overlap explicite** entre chunks : on concatène des unités jusqu’à la taille cible.

### Limites / alternatives

- Chunking par **tokens** (tiktoken) : utilisé en **analyse** d’évaluation, pas forcément identique au chunker prod basé caractères.
- **Fenêtre glissante avec overlap** : peut améliorer le recall sur les frontières de phrases ; **non utilisé** ici pour simplicité et taille d’index.

**Exemple :** un long article du Code du travail peut produire plusieurs chunks avec le même numéro d’article mais des `chunkIndex` différents ; la citation en génération pointe vers la source correspondante.

**Réponse courte en entretien :** « On vise ~1500 caractères, max 2000, sans overlap. Les gros articles sont splittés pour que le retrieval remonte le bon passage, pas tout l’article d’un coup. »

---

## Embeddings

### Définition

Un **embedding** est une **représentation numérique** d’un texte sous forme de **vecteur** dans un espace de haute dimension. Des textes **sémantiquement proches** ont des vecteurs **proches** (similarité cosinus ou distance).

Un modèle d’embedding **ne génère pas** une réponse en langage naturel : il **transforme** du texte en vecteur pour permettre la **recherche par similarité**.

### Pourquoi c’est utile

En RAG, on embed la **question** et on compare aux vecteurs des **chunks** pour retrouver des passages pertinents **même si les mots diffèrent** (paraphrase, synonymes).

### Dans le projet

- Modèle : **`text-embedding-3-large`**, **3072** dimensions (`src/embeddings/constants.ts`).
- LangChain : **`OpenAIEmbeddings`** via `createOpenAIEmbeddings()`.
- Stockage : colonne **`vector(3072)`** pgvector ; requêtes avec opérateur de distance **`<=>`** (distance cosinus dans pgvector). L’important en entretien n’est pas de réciter la formule, mais de garantir **le même modèle et la même dimension** pour l’index et la requête, et de trier par **proximité** de façon cohérente.

### Limites

La similarité sémantique peut **rater** les références **lexicales exactes** (numéro d’article « 1240 », formules précises). D’où l’intérêt du **BM25** et du mode **hybrid-union** en benchmark.

**Exemple :**

Question : « Quelle est la responsabilité en cas de dommage causé à autrui ? »

La recherche vectorielle peut retrouver un passage sur la **responsabilité civile** sans les mêmes mots. BM25 peut être plus fort si la question contient **« article 1240 »**. L’hybride combine les deux signaux.

**Réponse courte en entretien :** « L’embedding place question et chunks dans le même espace vectoriel pour la similarité sémantique. Ce n’est pas un LLM génératif ; en prod j’utilise text-embedding-3-large en 3072 dims dans pgvector. »

---

## Recherche vectorielle

### Définition

La **recherche vectorielle** retourne les **K chunks** dont les embeddings sont les plus proches de l’embedding de la requête.

### Dans le projet

- Implémentation SQL / Prisma : `searchSimilarChunks` et variantes avec **quota multicorpus** (éviter qu’un seul code monopolise le top-K global quand plusieurs corpus sont routés).
- **`DEFAULT_RETRIEVAL_TOP_K = 30`** en stratégie **vector** (défaut code : `DEFAULT_RETRIEVAL_STRATEGY = 'vector'`, env **`RETRIEVAL_STRATEGY`** pour activer **`hybrid-union`**).

### Retrieval vs routing

- **Routing** : décide **dans quels codes** chercher (filtrage de corpus).
- **Retrieval** : dans ce périmètre, **quels chunks** remontent par similarité (ou BM25).

On peut avoir un bon routing et un mauvais retrieval (gold absent du top-K), ou l’inverse en eval avec `global_fallback`.

**Réponse courte en entretien :** « Le routeur choisit les corpus ; le retrieval choisit les chunks. En défaut j’ai top-K 30 en vectoriel pur, avec filtre sur les corpus routés. »

---

## BM25 et retrieval hybride

### Définition BM25

**BM25** est un score **lexical** : il favorise les documents qui partagent des **termes** avec la requête (fréquence, rareté). Il excelle sur les **correspondances exactes** et le jargon, moins sur la paraphrase pure.

### Dans le projet

- Module : `src/retrieval/bm25/` ; index **en mémoire** par `corpusId`, chargé depuis Prisma.
- BM25 n’est utilisé que dans **`hybrid-union`**, et seulement si **`corpusIds.length > 0`** (pas de BM25 « global » sans routing explicite dans ce chemin).
- **Union** : top **50** vector + top **50** BM25 (`HYBRID_UNION_*_TOP_K`), fusion par **`dedupeUnionChunks`** (ordre : vector puis BM25, premier gagnant par `chunkId`).
- Exécution **séquentielle** dans le code (pas de `RunnableParallel` LangChain).

### Pourquoi combiner vector + BM25

Benchmark offline (cohorte **61 questions**, rapport `retrieval-hybrid-benchmark-2026-09-22`) : BM25 seul ~**73,1 %** recall@50, **union** ~**81,7 %** ; **RRF** testé ~**77,4 %** — la stratégie retenue en prod pour l’hybride est **`hybrid-union`**, pas RRF par défaut.

### Vector vs BM25 (résumé)

| Signal | Force | Faiblesse typique |
|--------|--------|-------------------|
| Vector | Paraphrase, sens | Numéros d’articles, tokens rares |
| BM25 | Lexique exact, refs | Synonymes, questions vagues |

**Réponse courte en entretien :** « Par défaut je suis en vector top 30. Si j’active hybrid-union via env, je prends 50 vector + 50 BM25, je déduplique, puis je rerank. Les benchmarks offline ont montré que l’union bat RRF sur notre cohorte. »

---

## Top-K, recall et precision

### Top-K

**Top-K** est le nombre de **candidats** qu’on garde à une étape : par ex. **30** chunks après retrieval vectoriel, **5** après rerank Jina, **≤ 5** après filtre dynamique pour le LLM.

Augmenter K au retrieval **augmente le recall** (plus de chances d’inclure le gold) mais **coût** (embed/search, rerank, bruit).

### Recall vs precision

- **Recall** : parmi ce qui **devrait** être trouvé, **quelle fraction** l’est ?
- **Precision** : parmi ce qu’on **a retourné**, **quelle fraction** est pertinente ?

En entretien, on confond souvent **top-K** (paramètre pipeline) et **recall@K** (métrique d’éval).

### Recall@K (dans le projet)

**`recallAtKGoldArticles`** (`metrics.ts`) mesure, pour une question avec plusieurs **gold articles** `(corpusId, articleNumber)`, la **fraction** des golds présents dans le **top-K** retrieval (pas seulement un match binaire mono-gold).

**Exemple :** recall@20 excellent mais réponse finale fausse → le gold est **dans le pool** mais mal **ordonné** après rerank, **filtré** hors contexte, ou la **génération** ignore le bon passage.

**Réponse courte en entretien :** « Top-K c’est combien je garde à chaque étape. Recall@K c’est une métrique : est-ce que mes articles de référence sont dans le top-K ? Un bon recall@20 ne garantit pas une bonne réponse si le rerank ou le filtre ne laisse pas le bon chunk en tête. »

---

## Reranking

### Définition

Le **reranking** re-score les paires **(question, passage)** avec un modèle plus lourd (souvent **cross-encoder**), pour **réordonner** les candidats retrieval. Le retrieval maximise le rappel sur un grand pool ; le reranker améliore **l’ordre** en tête.

### Retrieval vs reranking

| Étape | Rôle | Dans le projet |
|-------|------|----------------|
| Retrieval | Élargir le pool (recall) | Vector K=30 ou union 50+50 |
| Reranking | Ordonner finement | Jina top **5** |

### Dans le projet

- Service : **`rerankChunks()`** via **`jina-reranker-v3.5`**.
- **`DEFAULT_RERANK_TOP_K = 5`**.
- **Fallback** : si Jina échoue (erreur éligible), on conserve l’**ordre vectoriel** tronqué au top-K rerank ; la réponse API expose **`rerankStatus: 'fallback'`**.
- Éval : limiteur de concurrence / cooldown Jina (`jina-concurrency-limit.ts`).

### Limites

Un reranker peut **dégrader** l’ordre si le modèle surpondère des passages lexicalement proches mais juridiquement hors sujet — d’où l’intérêt des benchmarks et du fallback.

**Réponse courte en entretien :** « Je retrieve large, je rerank petit : Jina ne voit que le pool retrieval et ne renvoie que 5 passages. Recall@20 dit si le gold est quelque part dans le pool ; le reranker décide ce qui arrive en premier avant mon filtre à 5 chunks max. »

---

## Routing multi-corpus

### Définition

Le **routing** choisit **quel(s) corpus** interroger avant la recherche. Sans routing, une question sur le Code du travail pourrait être noyée dans des hits du Code civil.

### Fonctionnement (dans le projet)

- **`routeQuestion()`** : chaîne LCEL **`ROUTER_CHAT_PROMPT.pipe(structuredModel)`**.
- Sortie LLM validée par **`RoutingLlmResponseSchema`** (Zod) : **`{ corpusIds: [...] }`** avec enum des **`ALL_CORPUS_IDS`**.
- Puis **`validateRoutingResult()`** (hors Runnable) : dedup, corpus registry, messages d’erreur domaine — le schéma LLM n’inclut pas de champ **`reason`** volontairement.

### Multi-corpus

Une question peut cibler **plusieurs codes** (ex. consommation + civil). Le retrieval applique des **quotas** pour limiter la domination d’un corpus ; le **filtre dynamique** impose **au moins un chunk par corpus routé** lorsque c’est possible (benchmark multicorpus : variante avec cette règle ~**78 %** des questions avec tous les corpora gold présents vs ~**22 %** sans, sur le jeu replay 41 Q — résultat historique de benchmark, pas une garantie runtime).

### Structured output routing

**`withStructuredOutput(RoutingLlmResponseSchema)`** — pas de parsing JSON manuel ni `response_format` ad hoc dans le métier.

**Réponse courte en entretien :** « Le routeur est un LLM avec sortie structurée Zod : liste de corpusIds. Ensuite du TypeScript métier valide et normalise. Si la liste est vide, abstention et pas de search. »

---

## Dynamic context filtering

### Définition

Après rerank, on n’envoie pas systématiquement les **5** premiers chunks au LLM : on **filtre** selon la **qualité relative** des scores reranker pour réduire bruit et tokens.

### Fonctionnement (dans le projet)

- **`dynamicContextFilter()`** : score **relatif** = score du chunk / **meilleur** score rerank.
- Seuil par défaut **`DEFAULT_RELATIVE_SCORE_THRESHOLD = 0.4`** : on garde les chunks ≥ 40 % du best score.
- Bornes : **`MIN_CONTEXT_CHUNKS = 1`**, **`MAX_CONTEXT_CHUNKS = 5`**.
- On garde toujours le **premier** chunk reranké (rang 0).
- Règle **multicorpus** : si plusieurs corpus routés, **au moins un chunk par corpus** après filtrage (si disponible dans le top rerank capé).

### Seuil relatif vs absolu

Les scores Jina **varient** selon les requêtes ; normaliser par le **meilleur score** stabilise la sélection entre questions courtes et longues.

**Réponse courte en entretien :** « Après Jina top 5, je filtre : relatif au max score, seuil 0,4, max 5 chunks pour la génération. En multicorpus je force au moins un passage par code routé pour ne pas perdre une branche juridique. »

---

## Génération

### Définition

La **génération** produit la réponse en langage naturel à partir du **contexte RAG** assemblé (`buildRagContext()` : en-têtes sources + textes).

### Dans le projet

- Chaîne : **`createRagGenerationChain()`** = **`RAG_GENERATION_CHAT_PROMPT.pipe(chatModel).pipe(RunnableLambda extracteur)`**.
- Modèle par défaut : **`gpt-5.6-luna`** (`DEFAULT_RAG_GENERATION_MODEL`, surchargeable via env).
- Citations **`[Source N]`** imposées dans le system prompt (`build-rag-messages.ts`).
- **Pas de streaming** sur la réponse RAG HTTP : **`invoke`** completion complète (le chat conversations utilise **`.stream()`**).

### Pourquoi ne pas envoyer 20 chunks au LLM ?

Coût tokens, **bruit**, risque que le modèle mélange des passages ; le pipeline rerank (5) puis filtre (~5 max) vise un contexte **dense** et **groundable**.

**Réponse courte en entretien :** « La génération est une chaîne LCEL classique : prompt avec contexte numéroté, modèle chat, extraction du texte. Le prompt force les citations pour lier la réponse aux sources retrieval. »

---

## Évaluation

### Dataset

- Fichier : **`data/evaluation/legal-multicorpus.questions.json`** — **500** questions (`docs/evaluation-multicorpus.md`).
- Chaque question a des **`goldArticles`** : paires **`(corpusId, articleNumber)`** et des types (single-corpus, multi-corpus, ambiguous, out-of-scope).

### Métriques (implémentées)

- **Routing :** precision / recall / F1 sur les corpus prédits vs gold ; **exact match** lorsque l’**ensemble** des `corpusIds` prédits est **identique** à l’ensemble gold (pas seulement un chevauchement partiel).
- **Retrieval :** **`recallAtKGoldArticles`** (fraction des gold articles trouvés dans le top-K, y compris questions multi-gold), **MRR** (Mean Reciprocal Rank : pénalise un gold bien présent mais très bas dans le ranking), **coverage** (`metrics.ts`).
- **E2E judge :** correctness, completeness, groundedness, abstentionCorrect ; **source judge :** sourceRelevance, sourceCoverage.

Les judges utilisent **structured output Zod** ; ce sont des **proxies** pour comparer des variantes, pas une vérité juridique (`docs/evaluation.md`).

### Stratégie d’éval

Pas un E2E **500** à chaque patch : **benchmarks ciblés**, **cache** de résultats intermédiaires, **smokes** (ex. abstention). Mesurer une modif : même cohorte, même cache routing si pertinent, métriques **par étape** avant E2E complet.

### Diagnostiquer une régression

| Symptôme observé | Piste prioritaire |
|------------------|-------------------|
| Mauvais corpus | Eval routing |
| Gold absent du pool retrieval | recall@K, hybrid, top-K |
| Gold dans le pool mais pas en contexte gen | rerank + dynamic filter |
| Contexte OK, réponse fausse | prompt génération, judge correctness |
| Réponse plausible mais non fondée | judge groundedness |

**Réponse courte en entretien :** « J’ai 500 Q multicorpus avec gold articles. Je découple routing, retrieval, rerank+filter et E2E. Les judges LLM servent à comparer des configs, pas à trancher le droit. »

---

## LangChain, LCEL, Runnable

### LangChain vs LCEL

**LangChain** est la bibliothèque d’abstractions (modèles, prompts, runnables). **LCEL** (LangChain Expression Language) compose des étapes avec **`.pipe()`** : chaque maillon est un **Runnable** (`invoke`, `stream`, etc.).

Dans le projet, LCEL est utilisé pour **routing** et **génération RAG** — pas pour tout le pipeline (SQL, Jina, filter TS restent du code classique).

### Runnable vs fonction TypeScript

Un **Runnable** LangChain expose un contrat uniforme (**`invoke`**, config avec **`signal`** pour abort sur certaines étapes). Une fonction TS async fait la même chose localement, sans composabilité `.pipe()` ni intégration prompts/modèles LangChain.

### Briques utilisées (dans le projet)

| Brique | Usage |
|--------|--------|
| **ChatOpenAI** | `createChatOpenAI()` — routing, gen, judges |
| **OpenAIEmbeddings** | Embeddings question / index |
| **ChatPromptTemplate** | RAG, router, judges, génération dataset |
| **withStructuredOutput + Zod** | Routing, judges E2E, génération questions eval |
| **RunnableLambda** | Extraction string post-`AIMessage` (gen RAG) |
| **`.invoke()`** | Chaînes et modèles ; `{ signal }` routing/gen/conversation |
| **`.stream()`** | Chat conversations uniquement |
| **`.batch()`** | Non utilisé |
| **RunnableParallel / Passthrough** | Non utilisés dans `src/` |

### Flux LCEL RAG génération

```text
{ question, context } → RAG_GENERATION_CHAT_PROMPT → ChatOpenAI → extracteur → string
```

### Flux LCEL routing

```text
{ routerSystemPrompt, question } → routingChain.invoke → { corpusIds }
  → validateRoutingResult() (TypeScript métier)
```

**Réponse courte en entretien :** « J’utilise LCEL là où c’est un enchaînement prompt + LLM : routeur et générateur. Le reste — pgvector, BM25, Jina, filtre — reste en TypeScript parce que c’est plus simple à tester et profiler. »

---

## Structured output et Zod

### Définition

Le **structured output** force le LLM à produire un **objet typé** (JSON) correspondant à un schéma, plutôt qu’un texte libre à parser.

### Dans le projet

- **`withStructuredOutput(zodSchema)`** sur les modèles chat (routing, judges, script **`generate:evaluation:multicorpus`**).
- **Pas de retry automatique** si Zod échoue après génération : l’erreur remonte (éviter masquer un mauvais prompt).
- Judges : parsing additionnel (`parseE2EJudgeScoreSnapshot`) pour contraintes métier (ex. explanation non vide).

### Structured output vs JSON.parse manuel

L’ancien chemin type **`invokeStructuredJsonChat`** a été retiré : moins de code spécifique OpenAI dans le domaine, contrat centralisé sur Zod.

### Zod vs types TypeScript

Les types TS **disparaissent à l’exécution** ; **Zod valide at runtime** la sortie LLM, indispensable quand le modèle peut halluciner une clé ou un enum.

**Réponse courte en entretien :** « Pour le routeur je ne parse pas du JSON à la main : LangChain structured output + Zod enum sur les corpusIds. TypeScript seul ne protège pas contre une sortie LLM invalide. »

---

## Tools, tool calling et agents (non implémentés)

### Concepts

- **Tool** : fonction externe décrite par un schéma ; le modèle peut émettre des **`tool_calls`**.
- **Tool calling** : le modèle **demande** l’exécution d’un outil ; l’application **exécute** et renvoie le résultat.
- **Agent** : **boucle** LLM → tools → LLM jusqu’à condition d’arrêt.

### Tool calling vs agent

Tool calling est un **mécanisme** ; l’agent est un **pattern de contrôle** qui l’utilise en boucle avec planification implicite.

### Dans le projet

Pipeline **déterministe** : étapes fixes, **pas** de boucle tool, **pas** d’agents LangChain, **pas** LangGraph dans `src/`. Choix motivé par **coût**, **latence**, **testabilité** et **eval par stage**.

**Workflow déterministe vs agent :** le premier enchaîne des fonctions connues ; le second laisse le modèle décider quels outils appeler et combien de tours faire.

**Architecture hybride (perspective entretien) :** garder retrieval/rerank **déterministes** ; n’« agentifier » que la planification si un besoin futur l’exige.

**Réponse courte en entretien :** « Mon RAG est un workflow figé benchmarké étape par étape. Un agent ajouterait de la non-déterminisme et du coût ; pour l’instant je n’en ai pas besoin pour répondre sur six codes avec eval solide. »

---

## LangGraph

**LangGraph** modélise des workflows **avec branches, cycles et état** (graphe). Ce dépôt **ne l’utilise pas** ; l’orchestration reste **`answerQuestion()`** + services NestJS.

C’est une **piste d’extension** (README « Potential extensions ») si des parcours conditionnels complexes deviennent nécessaires — **pas une compétence claimable sur ce repo aujourd’hui**.

**Distinction :** LangChain fournit briques et LCEL ; LangGraph ajoute une **machine à états** explicite. Ici, l’état est surtout le flux TS + types métier.

---

## Production et ops (mix projet / concepts)

Cette section mélange des **notions générales** (rate limit, retry, idempotence) et ce qui est **réellement codé** dans `penal`. Quand une confusion est possible, les sous-parties indiquent **Concept général** puis **Dans le projet**.

### Vue d’ensemble (implémenté ou non)

| Sujet | Dans le projet ? |
|-------|------------------|
| **Parallélisme eval (workers)** | Oui — pool de workers + `Promise.all` (`evaluateE2EQuestions`, evaluateurs routing/reranking) |
| **Limiter + file Jina (eval)** | Oui — `ConcurrencyLimiter` + retries/cooldown dans `jina-concurrency-limit.ts`, branché sur les **scripts d’évaluation** (`evaluate-multicorpus.ts`, smokes), pas sur `RagService` / `POST /rag/answer` |
| **Cache eval disque** | Oui — `readCachedResult` / `writeCachedResult` (`evaluation/multicorpus/cache.ts`), fichiers JSON par run |
| **Profiling latence pipeline** | Oui — `PipelineProfilingTimings` (`profiling/pipeline-timings.ts`), rempli dans `answerQuestion()` |
| **AbortSignal** | Partiel — routing et génération RAG (`route-question`, `RagGenerationService`) ; chat SSE conversations ; **pas** propagé de `POST /rag/answer` à travers tout `answerQuestion()` |
| **Retry LLM / routing global** | Non — pas de politique de retry générique sur OpenAI routing ou structured output |
| **Retry Jina rate limit (eval)** | Oui — limité au wrapper eval `JinaEvaluationScheduler` (erreurs Jina retryables, plafond de tentatives) |
| **Queue distribuée (Redis, BullMQ, etc.)** | Non |
| **Langfuse / tracing** | Non |
| **Streaming réponse RAG HTTP** | Non (completion entière via `invoke`) |

### Rate limiting

**Concept général**

Un **rate limit** borne une **quantité d’utilisation** sur une **période donnée**. Ce n’est pas qu’un « nombre max de requêtes par minute » : selon le provider, les quotas peuvent porter sur les **requêtes par minute (RPM)**, les **tokens par minute (TPM)**, la **concurrence côté serveur**, ou d’autres plafonds documentés. Un dépassement se traduit souvent par une erreur **HTTP 429** ou un code métier équivalent.

**Rate limit ≠ concurrency limit.** Un provider peut autoriser **100 requêtes par minute** sans accepter **100 requêtes simultanées**. À l’inverse, si vous limitez vous-même à **3 appels parallèles**, vous pouvez quand même **dépasser** un quota de 100/minute en enchaînant suffisamment de vagues de 3 appels. Les deux leviers se **complètent** ; ils ne se remplacent pas.

**Dans le projet**

- Les appels **OpenAI** (routing, embedding, génération, judges) et **Jina** (rerank) sont soumis aux quotas des APIs ; le code prod **n’implémente pas** un rate limiter client universel.
- L’harness d’**évaluation** réagit aux erreurs Jina de type rate limit via **`JinaEvaluationScheduler`** : cooldown partagé, espacement minimum entre appels, **retries** limités sur erreurs jugées retryables (`isRetryableJinaRateLimitError`), avec délais distincts selon le code API (ex. limite token vs limite concurrence Jina).

**Réponse courte en entretien :** « Le rate limit, c’est un quota dans le temps — requêtes ou tokens selon le provider. Ce n’est pas la concurrence : je peux respecter 3 appels simultanés et quand même taper le RPM, ou l’inverse. En eval Jina j’ai un scheduler avec cooldown et retries ciblés, pas un retry global sur tout le RAG. »

### Concurrency limiting

**Concept général**

Un **concurrency limit** borne le nombre d’**opérations exécutées en parallèle** à un instant donné. Ce mécanisme ne sert pas uniquement à « rester sous le rate limit ». Il peut aussi :

- respecter une **limite de concurrence imposée** par l’API ;
- **éviter de saturer** un service externe ;
- **protéger** CPU, mémoire, pool de connexions DB ou autres ressources locales ;
- **maîtriser la latence** sous charge (trop de requêtes ouvertes = contention) ;
- **réduire** les erreurs de surcharge (timeouts, 429, refus connexion).

**Dans le projet**

- **Éval E2E / routing / reranking :** paramètre **`concurrency`** — plusieurs workers async consomment la file de questions, chacun appelle le pipeline ou une étape (`e2e-evaluator.ts`, `routing-evaluator.ts`, `reranking-evaluator.ts`).
- **Jina en eval :** la classe **`ConcurrencyLimiter`** (`jina-concurrency-limit.ts`) garantit qu’au plus **N** appels `rerank` Jina sont actifs ; les appels supplémentaires **attendent** (file en mémoire dans le process, voir ci-dessous).
- **Prod (`answerQuestion`, CLI, `POST /rag/answer`) :** un appel utilisateur = un pipeline ; pas de limiter Jina dédié au niveau Nest — la charge parallèle dépend du déploiement (nombre de requêtes HTTP concurrentes).

**Réponse courte en entretien :** « Je limite la concurrence pour ne pas ouvrir 500 reranks Jina d’un coup en eval : limiter à N simultanés, le reste attend. C’est distinct du RPM : c’est du contrôle de parallélisme local et de protection API. »

### Queue vs concurrency limiter

**Concept général**

Une **queue** (file d’attente) **stocke des tâches** qui ne sont pas encore traitées ou qui attendent un créneau. Un **concurrency limiter** **décide combien** de tâches peuvent **s’exécuter en même temps**. Les deux se **combinent** souvent : la file peut contenir **100 tâches**, tandis que le limiter n’en autorise que **3** à la fois.

Exemple côté service AI : **100 questions** doivent être évaluées avec rerank Jina. Les 100 jobs peuvent être **en attente** ; seulement **3 appels Jina** partent **simultanément** ; au fur et à mesure qu’un appel se termine, la suivante dans la file est prise.

Une **queue persistante ou distribuée** (survit au crash, partagée entre machines) n’est **pas** la même chose qu’une **attente en mémoire** dans un seul process Node : ici, `ConcurrencyLimiter` utilise un tableau **`queue`** interne — suffisant pour un script d’eval, **sans** Redis ni BullMQ.

**Dans le projet**

- **`ConcurrencyLimiter`** : `acquire` / `release`, compteur `active`, callbacks en attente dans `queue` — pattern file + plafond de parallélisme **in-process**.
- **Eval E2E :** les workers tirent les questions ; chaque worker peut bloquer sur Jina via le limiter partagé quand le script wrappe le reranker avec **`createJinaEvaluationRerankerService`**.

**Réponse courte en entretien :** « La queue, c’est « qui attend » ; le limiter, c’est « combien en même temps ». En eval Jina j’ai les deux en mémoire : beaucoup de questions, mais seulement N reranks actifs. »

### Retry et idempotence

**Concept général**

Un **retry** relance une opération après échec. On le réserve en général aux erreurs **transitoires** : coupure réseau, timeout, **429** temporaire, indisponibilité courte. On **ne retry pas** aveuglément une erreur **déterministe** : validation métier, schéma Zod invalide, 400 « bad request », question mal formée — sans changement, la retry **échouera encore** et **coûtera** (latence, argent API).

Même pour les erreurs transitoires, il faut un **nombre max de tentatives** et souvent un **backoff** (attente croissante entre essais) pour laisser le provider se remettre et éviter un **thundering herd**.

L’**idempotence** signifie qu’**répéter** l’opération **ne produit pas plusieurs effets métier différents**. Relancer une **recherche vectorielle** ou un **embedding** est en pratique **peu risqué** (même entrée → même résultat attendu). Relancer aveuglément un **paiement** ou une **écriture non clé** peut **doubler** un effet de bord. D’où la règle : retry agressif seulement si l’opération est **idempotente** ou **dédoublonnée** (clé idempotente, upsert, etc.).

**Dans le projet**

- **Pas de retry global** sur le routing LLM ni sur les échecs de **structured output** Zod — une retry sans corriger le prompt masquerait un bug.
- **Jina (eval uniquement) :** `JinaEvaluationScheduler.runRerank` retry les erreurs **retryables** rate limit Jina, avec **`maxRetries`**, délais (`retryBaseDelayMs`, cooldowns token/concurrence) — voir `evaluation-config.ts` pour les defaults.
- **Prod rerank :** en cas d’échec Jina éligible, **`rerankChunks`** bascule sur un **fallback** (ordre vectoriel tronqué) plutôt qu’une boucle de retry utilisateur.
- **OpenAI :** mapping 429 côté `OpenAIErrorMapper` ; pas de couche retry automatique généralisée sur tout le pipeline.

**Réponse courte en entretien :** « Je retry surtout le transitoire, avec plafond et backoff — en eval Jina sur les 429 retryables. Je ne retry pas un parse Zod routing : c’est déterministe. Et je pense idempotence : relancer une search, OK ; relancer n’importe quelle écriture métier sans garde-fou, non. »

### Profiling et latence du pipeline RAG

**Concept général**

Mesurer seulement **`totalMs`** ou **`answerPipelineTotalMs`** ne suffit pas pour optimiser : un RAG lent peut l’être parce que le **routeur** appelle le LLM, parce que **Jina** rerank, parce que la **recherche pgvector** est coûteuse, ou parce que la **génération** est longue. Sans décomposition, on **optimise au mauvais endroit**.

**Dans le projet**

`answerQuestion()` accepte ou crée un objet **`PipelineProfilingTimings`** rempli le long du chemin :

- **`routingMs`** — appel routeur LLM ;
- **`embeddingMs`** — embedding de la question ;
- **`vectorSearchMs`** — recherche vectorielle (et chemin hybrid si activé) ;
- **`jinaRerankingMs`** — rerank API Jina ;
- **`contextFilteringMs`**, **`contextBuilderMs`** — filtre dynamique et assemblage contexte ;
- **`generationMs`** — LLM de réponse ;
- **`answerPipelineTotalMs`** — total bout en bout.

Des helpers **`formatPerformanceReport`** / **`formatAnswerPerformanceReport`** formatent ces champs pour la CLI debug. L’eval E2E instancie aussi un profiling par question.

**Raisonnement entretien :** si le RAG devient lent, **ne pas supposer** que « c’est le LLM ». Mesurer **chaque étape**, identifier le **vrai bottleneck**, puis optimiser (K retrieval, hybrid, concurrence eval, modèle, etc.).

**Réponse courte en entretien :** « J’ai des timings par stage dans `PipelineProfilingTimings`. Si la latence explose, je regarde routing vs embed vs vector vs Jina vs gen avant de toucher au prompt ou au modèle. »

### Cache d’évaluation

**Concept général**

Pendant les **benchmarks**, un **cache** évite de **refaire** des appels coûteux (LLM, Jina, pipeline complet) quand on relance une eval avec la **même question**, le **même mode** et la **même configuration modèle**. Cela **accélère** les itérations, rend certaines **comparaisons plus stables** (même résultat intermédiaire rejoué), et permet de **recalculer une étape** sans tout repayer si le cache est organisé par mode (routing, reranking, e2e).

**Dans le projet**

- Clé : **`buildMulticorpusCacheKey`** (hash SHA-256 de `questionId`, mode, `modelConfiguration`, version evaluateur).
- Stockage : fichiers **`{runDir}/{mode}-cache/{cacheKey}.json`** via **`readCachedResult`** / **`writeCachedResult`**.
- Utilisé par les evaluateurs **routing**, **reranking**, **e2e** ; contournable avec **`force`** pour forcer le recalcul.
- C’est un cache **local disque** pour les runs d’eval, **pas** un cache Redis partagé en prod API.

**Réponse courte en entretien :** « En eval je cache les résultats par question et config sur disque pour ne pas rappeler OpenAI/Jina à chaque rerun de benchmark — utile quand je compare deux variantes et que je veux figer une étape. »

### AbortSignal et annulation

**Concept général**

Si le **client** abandonne une requête longue (fermeture onglet, timeout HTTP, `AbortController`), continuer **inutilement** routing, embedding, Jina et génération **consomme** CPU, slots et **budget API**. Propager un **`AbortSignal`** jusqu’aux appels LLM permet d’**arrêter tôt**.

**Dans le projet**

- **Routing** : `routeQuestion(..., { signal })` transmis à **`invoke`** LangChain.
- **Génération RAG** : `RagGenerationService.generateAnswer` accepte **`signal`** (tests unitaires vérifient le forward).
- **Conversations SSE** : streaming chat avec annulation côté client.
- **`POST /rag/answer`** : **ne propage pas** encore l’annulation client à travers **`answerQuestion()`** — une requête lancée va au bout du pipeline côté serveur tant qu’elle n’est pas interrompue autrement.

**Réponse courte en entretien :** « J’ai AbortSignal sur routing et gen quand l’API l’expose, mais le endpoint RAG HTTP ne coupe pas encore tout le pipeline — c’est un gap si le client part au bout de deux secondes. »

---

## Distinctions utiles en entretien (synthèse)

- **Grounding vs hallucination :** grounding = ancrage au **contexte fourni** ; hallucination = contenu **non supporté** par les sources (ou inventé).
- **Abstain vs global_fallback :** abstain prod = stop ; global_fallback eval = retrieval tous corpora malgré routing vide.
- **Offset pagination vs cursor :** concept API classique ; **non central** dans ce repo RAG (mention si question générale : offset fragile sur données qui changent ; cursor plus stable).
- **LangChain vs LangGraph :** briques + LCEL vs graphe d’état — seul le premier est réellement utilisé ici.

---

## Questions d’entretien (réponses développées)

1. **Pourquoi RAG plutôt qu’un long contexte avec tout le Code pénal ?**
   Six codes et ~33k chunks rendent impossible l’envoi intégral. On retrieve un sous-ensemble pertinent, on rerank et on filtre (max 5 chunks en contexte gen), ce qui contrôle coût et bruit tout en gardant des sources citables.

2. **Pourquoi reranker si Recall@20 est déjà bon ?**
   Recall@20 indique que le gold est **quelque part** dans le pool retrieval, pas qu’il est **en tête**. Le filtre dynamique et la génération ne voient que le top rerank (5) puis ≤5 chunks : l’ordre Jina est décisif.

3. **Recall@20 excellent, réponse finale fausse — où chercher ?**
   Vérifier rerank (gold mal ordonné), filtre (gold éliminé par seuil 0,4), puis génération (prompt, judge **correctness** vs **groundedness**). Tracer aussi le recall gold **après** filtre en eval ciblée.

4. **Pourquoi ne pas envoyer les 20 chunks directement au LLM ?**
   Bruit, coût tokens, groundedness plus difficile. On rerank à 5, filtre relativement, plafond 5 — compromis validé par benchmarks multicorpus et smokes hybrid+filter.

5. **Cas où BM25 bat le vectoriel ?**
   Questions avec **lexique exact** : numéros d’articles, formules, tokens rares partagés. Le diagnostic sémantique 61 Q montre des golds **BM25-only** absents du vector@50 ; d’où hybrid-union.

6. **Pourquoi ne pas tout transformer en Agent ?**
   Latence, coût, non-déterminisme, debug et eval par étape difficiles. Nos étapes sont connues et benchmarkées séparément ; un agent n’apporte pas de gain prouvé sur ce périmètre.

7. **Le reranker dégrade Recall@5 — que faire ?**
   Comparer ordre vector vs Jina sur une cohort gold ; vérifier passages lexicalement trompeurs ; le **fallback** Jina existe (`rerankStatus: 'fallback'`). Ajuster top retrieval ou hybrid si le gold n’entre pas dans le pool.

8. **Diagnostiquer la latence ?**
   Utiliser **`profiling`** retourné par `answerQuestion()` : routingMs, embeddingMs, vectorSearchMs, jinaRerankingMs, generationMs, total.

9. **Rate limit OpenAI / Jina ?**
   Distinguer quota temporel (RPM/TPM) et parallélisme. En eval : workers + `ConcurrencyLimiter` Jina, scheduler avec cooldown/retries sur erreurs retryables ; pas de rate limiter universel en prod API. Pas de retry global sur routing structured output.

10. **Quand implémenter un retry ?**
    Opérations **idempotentes**, erreurs **transitoires**, **plafond** de tentatives — pas de retry aveugle sur échec Zod sans corriger le prompt.

11. **Mesurer qu’une modif améliore vraiment ?**
    Benchmark **ciblé** (même cohort), cache routing identique si comparaison équitable, métriques **stage-specific** avant E2E 500.

12. **Hybrid union vs RRF ?**
    Sur 61 Q historiques : union ~81,7 % vs RRF ~77,4 % recall@50 ; stratégie code **`hybrid-union`**. RRF reste une alternative conceptuelle, pas le default prod.

13. **Pourquoi LCEL seulement sur gen + routing ?**
    Frontière claire « appel LLM + prompt » ; le reste (SQL, BM25, Jina, filter) est plus simple en TS pur, testable sans stack Runnable.

14. **Pourquoi `validateRoutingResult` après la chain ?**
    Le schéma LLM ne couvre pas toute la logique métier (dedup, registry, erreurs domaine). Séparation : LCEL = contrat API modèle ; TS = règles produit.

15. **Différence abstain vs global_fallback ?**
    **Abstain** : `corpusIds: []` → pas de search en prod. **Global_fallback** (eval) : routing vide forcé mais retrieval sur **tous** les corpora pour isoler la qualité retrieval.

16. **Le judge E2E est-il fiable ?**
    Fiable pour **comparer des variantes** à config fixe ; pas une référence juridique. Documenté dans `docs/evaluation.md`.

17. **Quota multicorpus au retrieval ?**
    Évite qu’un corpus domine le top-K global quand plusieurs codes sont pertinents ; replay 41 Q : impact sur recall gold et présence des deux corpora.

18. **Min 1 chunk/corpus au filter ?**
    Règle pour questions multi-codes : ne pas envoyer au LLM un contexte entièrement civil alors que le travail était routé. Benchmark historique variante B ~78 % vs ~22 %.

19. **API REST RAG ?**
    Oui — **`POST /rag/answer`**, JSON `{ question }`, même **`answerQuestion()`** que la CLI. Réponse allégée (sources, routing, rerankStatus). Chat **`conversations`** sans corpus.

20. **Pourquoi 3072 dimensions ?**
    Choix **`text-embedding-3-large`** ; schéma Prisma **`vector(3072)`** aligné. Changer de modèle/dim implique ré-embed.

21. **Chunk 1500 vs 2000 ?**
    1500 = cible de regroupement ; 2000 = max avant split phrase/hard. Dépassements déclenchent une découpe plus agressive.

22. **Structured output routing sans `reason` ?**
    Prod veut uniquement **`corpusIds`** stricts ; éviter champs LLM non utilisés qui divergent du prompt.

23. **Rôle de `RunnableLambda` en gen ?**
    Extraire le **texte** de l’`AIMessage` et erreur si vide — pas de validation routing.

24. **Tests sans API ?**
    Nombreux tests unitaires : filter, union hybrid, validate routing, parité prompts, mappers HTTP RAG.

25. **Comment les 500 questions eval ont été générées ?**
    Script **`generate:evaluation:multicorpus`** avec structured output multicorpus et validation dataset.

26. **Erreur routing côté API ?**
    **`OpenAIErrorMapper`** → exceptions HTTP via **`mapPipelineErrorToHttpException`** (ex. **`RoutingError`**).

27. **Fallback Jina ?**
    Ordre **vector** tronqué au rerank top-K ; **`rerankStatus: 'fallback'`** exposé CLI/API.

28. **Citations en génération ?**
    System prompt impose **`[Source N]`** aligné sur les en-têtes **`Source N`** du contexte RAG.

29. **Zod enum corpus routing ?**
    **`ALL_CORPUS_IDS`** dans le schema : un id inconnu est rejeté tôt plutôt qu’en SQL.

30. **Prochaine étape architecture ?**
    Observabilité (ex. Langfuse), éventuellement **LangGraph** si workflows branchy — **hors repo actuel** ; streaming RAG possible extension README.

---

*Fin du document de révision.*
