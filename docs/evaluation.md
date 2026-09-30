# Stratégie d'évaluation RAG - projet `penal` (V1)

Ce document décrit **comment** le pipeline RAG juridique multi-corpus a été évalué, **pourquoi** chaque type de test a été choisi, et **pourquoi** un E2E complet (500 questions) n'a pas été relancé à chaque modification.

Pour le schéma du dataset (500 questions, `goldArticlés`, types), voir aussi [`evaluation-multicorpus.md`](./evaluation-multicorpus.md).

---

## 1. Pipeline évalué (État V1)

```text
Question
   |
   v
Routing (LLM) --> ABSTAIN ? --> réponse d'abstention (sans embed / retrieval / Jina / gen)
   |
   v
Retrieval (vector et/ou BM25 -> Union)
   |
   v
Jina reranker (top 5)
   |
   v
Dynamic context filter (seuil relatif + min 1 chunk / corpus routé si multicorpus)
   |
   v
Génération (RAG + citations)
   |
   v
(évaluations) Judge + source judge
```

### Modèles et paramètres (runs principaux)

| Composant | Valeur |
|-----------|--------|
| Routing | `gpt-5.6-luna` |
| Embeddings | `text-embedding-3-large` |
| Reranker | `jina-reranker-v3.5` |
| Génération | `gpt-5.6-luna` |
| Judge E2E | `gpt-5.6-terra` |
| `rerankTopK` | 5 |
| Seuil filter relatif | 0,40 |
| Retrieval vector (historique prod validé) | `retrievalTopK = 30` |
| Hybrid Union (benchmark / prod configurable) | vector **50** + BM25 **50**, union + dedup `chunkId` |

### Stratégie de retrieval configurable

Variable d'environnement :

```env
RETRIEVAL_STRATEGY=vector          # défaut du code si la variable est absente (vector topK=30)
RETRIEVAL_STRATEGY=hybrid-union    # activation explicite : vector@50 + BM25@50 -> union -> Jina
```

**Default du code vs configuration du projet**

| Aspect | Détail |
|--------|--------|
| **Default / fallback du code** | `RETRIEVAL_STRATEGY=vector` (`DEFAULT_RETRIEVAL_STRATEGY` dans `retrieval-strategy.ts`). Sans variable d'environnement, le pipeline reste en retrieval vectoriel (`retrievalTopK=30`). |
| **Configuration actuellement utilisée** | `RETRIEVAL_STRATEGY=hybrid-union` dans le `.env` de travail du projet (Union activée explicitement). |
| **Rôle de `vector`** | Stratégie de **comparaison** et **repli** ; historique de validation (top30, E2E jalons). |

`hybrid-union` **n'est pas le défaut intrinsèque du code** : la V1 s'appuie sur des preuves pour les deux modes, avec hybrid validé par la chaîne ciblée (section 4) tout en laissant `vector` comme fallback code.

BM25 runtime : index **en mémoire par `corpusId`**, chargé une fois depuis Prisma (`legalCodeChunk`), pas de lecture disque par requête.

---

## 2. Métriques utilisées

| Niveau | Métriques | Rôle |
|--------|-----------|------|
| **Routing** | exact match, precision, recall, F1 ; abstention ambigu/OOS | Qualité du routage corpus |
| **Retrieval** | gold article recall @K, full gold coverage, corpus coverage | Le bon article est-il dans le pool candidat ? |
| **Rerank / filter** | gold recall après Jina, après filter ; chunks finaux | Perte entre pool large et contexte final |
| **Génération** | correctness, completeness, groundedness (judge) | Qualité de la réponse |
| **Sources** | source relevance, source coverage (source judge) | Citations vs contexte |
| **Abstention** | abstention correct | Pas de pipeline downstream si abstention |
| **Régression ciblée** | deltas judge par question ; compteur améliorations / dégradations | Non-régression sur changement isolé |

Les judges LLM sont des **proxies** : utiles pour comparer des variantes, pas une vérité juridique.

---

## 3. Principe d'ingénierie

```text
diagnostiquer -> isoler -> tester localement -> valider au niveau réponse -> verifier en pipeline -> integrer
```

**Règle :** plus le changement est **local**, plus l'évaluation peut être **ciblée**.

| Changement | Type d'évaluation adapté |
|------------|---------------------------|
| Seuil / règle du filter | Benchmark filter (scores Jina réutilisés) |
| Quota multicorpus retrieval | Replay offline / smoke multicorpus |
| `retrievalTopK` | Benchmark profondeur @20-50 |
| Lexical vs vector | Benchmark hybrid offline |
| Hybrid + Jina + filter | Smoke rerank-filter (sans gen) puis validation answer-level |
| Intégration prod-like | Mini-régression 30 q + smoke stratégie + smoke manuel |

Ce n'est pas une limitation accidentelle : c'est un choix pour **maîtriser coût et latence API** tout en gardant une couverture proportionnée au risque du changement.

---

## 4. Pourquoi pas un E2E 500 ? chaque modification ?
Section explicite : **nous n'avons pas utilisé 500 questions comme marteau pour chaque patch.**

Le pipeline complet consomme, par question non abstain :

- embedding OpenAI ;
- routing LLM (si live) ;
- Jina reranker ;
- génération ;
- judge + source judge.

Un **E2E sur les 500 questions** peut représenter des milliers d'appels API payants et une latence importante, selon les étapes exécutées, les abstentions, les caches et la concurrence. Relancer 500 questions après chaque ajustement (filter, topK, quota, hybrid) aurait :

- noye le signal d'un changement **local** ;
- multiplie le coût sans garantie de diagnostic plus fin ;
- retarde l'itération.

### Stratégie en 4 niveaux

1. **Tests unitaires** - routing metadata, filter, union/dedup, BM25, cohortes : **0 appel API**.
2. **Replay / cache / offline** - réutiliser embeddings, listes retrieval, scores Jina, `e2e-cache` : **0 ou quasi 0 API**.
3. **Benchmarks ciblés** - 43 abstentions, 41 multicorpus, 61 profondeur, 20 answer-level, 30 mini-régression : **API limitée aux cas concernés**.
4. **E2E 500** - réservé aux **jalons** (baseline routing, E2E post-routing stabilisé, forensic global).

**Tous les changements n'ont pas été validés par un E2E 500 complet** ; les changements tardifs (top30, hybrid) reposent sur des cohortes ciblées + non-régression + smoke prod-like.

### Chaîne de preuve pour Hybrid Union (sans E2E 500 immédiat)

Le dernier changement majeur (retrieval **Hybrid Union**) n'a pas été suivi d'un E2E complet sur 500 questions. La validation s'est appuyée sur une progression explicite, du diagnostic retrieval jusqu'au smoke opérationnel :

1. **Diagnostic lexical offline** (`retrieval-semantic-diagnostic-2026-09-22`) — identification d'un manque du retrieval vectoriel sur certains golds (dont écart lexical).
2. **Benchmark retrieval offline** (`retrieval-hybrid-benchmark-2026-09-22`) — comparaison Vector / BM25 / Union / RRF sur les **61 questions** diagnostiques (93 golds).
3. **Validation Jina + filtre** (`retrieval-hybrid-rerank-filter-smoke-2026-09-22`) — vérification que le gain de retrieval ne disparaît pas entièrement après reranking et filtrage.
4. **Validation answer-level (20 questions)** (`retrieval-hybrid-generation-validation-2026-09-22`) — vérification que les différences de contexte améliorent les réponses, pas seulement le recall documentaire.
5. **Mini-régression déterministe (30 questions)** (`retrieval-hybrid-mini-regression-2026-09-22`) — comparaison contrôlée Vector vs Hybrid sur une cohorte représentative.
6. **Smoke production-like (30 questions)** (`retrieval-strategy-smoke-2026-09-22`) — pipeline réellement configuré (retrieval, Jina, filtre, génération, judge).
7. **Smoke manuel final (5 questions)** — vérification opérationnelle avec `RETRIEVAL_STRATEGY=hybrid-union` (routing, abstention, multicorpus, citations/grounding, absence d'erreur technique).

> Le choix de ne pas relancer immédiatement un E2E complet sur 500 questions n'est donc pas une absence de validation : la modification Hybrid a été validée progressivement à plusieurs niveaux, du diagnostic retrieval jusqu'au smoke production-like et manuel. Le benchmark 500 reste l'outil de validation globale, mais il n'est pas nécessaire après chaque modification lorsque des évaluations ciblées permettent d'isoler et de mesurer précisément l'effet du changement.

---

## 5. Phases d'évaluation (chronologie logique)

### 5.1 Routing V3.1 - gel du routage

**Run :** `reports/evaluation/runs/2026-09-19T22-46-46-088Z/` (500 questions, mode routing).

Résultats (artefact `report.md`) :

| Métrique | Valeur |
|----------|--------|
| Exact match | **93,6 %** |
| Precision | 0,953 |
| Recall | 0,951 |
| F1 | 0,950 |
| Ambiguous -> `[]` | 87,5 % |
| Out-of-scope -> `[]` | 88,6 % |

**Pourquoi ne pas rouvrir le routing ensuite ?**  
Le routage est une **dépendance amont** coûteuse à retuner. Une fois V3.1 stabilisé (~94 % exact), les travaux suivants ont **rejoué** les décisions de routing (`routing.json`, `routingResultOverride`) plutôt que de relancer 500 appels routing à chaque fois.

Comparaisons V2/V3 : `reports/evaluation/multicorpus-routing-v2-v3-comparison.md`.

---

### 5.2 Abstention - arrêt du pipeline si le router abstient

**Problème :** confondre abstention, routage vide explicite et fallback global ; continuer embed/retrieval/gen après un abstain.

**Trois décisions de routing** (`resolve-routing-for-retrieval.ts`, `format-routing-metadata.ts`) :

| Décision | Origine | Comportement downstream |
|----------|---------|-------------------------|
| **`routed`** | Router LLM -> `corpusIds` non vide | Retrieval limite aux corpus routés |
| **`abstain`** | Router LLM -> `corpusIds: []` | **Aucun** embed / retrieval / Jina / génération |
| **`global_fallback`** | Override eval avec `corpusIds: []` explicite | Recherche **tous corpus** (pas une abstention utilisateur) |

Le fix V1 cible **`abstain`** (sortie router vide), distinct du **`global_fallback`** (recherche globale intentionnelle).

**Comportement cible pour `abstain` :**

- aucun embedding ;
- aucun retrieval ;
- aucun reranking ;
- aucune génération.

**Validation :** smoke cible **43 questions** - `reports/evaluation/runs/abstention-smoke-2026-09-20T22-19-35-413Z/` (`smoke-abstention.json`)

| Indicateur | Valeur |
|------------|--------|
| Questions | 43 |
| Routing cache `[]` | 36 |
| Pass pipeline skipped | **36/36** |
| 7 restants | routing cache **non vide** (erreurs de routing, pas échec du mécanisme d'abstention) |

**Pourquoi pas E2E 500 ?** La modification touche **uniquement** le branchement abstention ; un smoke sur les 43 cas concernés + tests unitaires suffit à prouver l'arrêt du pipeline.

Script : `pnpm smoke:abstention`

---

### 5.3 Multicorpus - monopole global et quota par corpus

**Problème observé :** avec un top-K **global**, un corpus peut **monopoliser** les slots quand plusieurs corpus sont routés -> perte du second corpus (audit forensic).

**Piste quota :** `computePerCorpusQuota(globalTopK, n)` - recherche par corpus puis fusion (`corpus-quota-retrieval.ts`).

**Replay offline (41 questions, 2 corpus routés)** - `retrieval-quota-replay-2026-09-20T22-39-18-339Z/` :

| Stratégie | Gold recall @K | Les 2 corpus présents |
|-----------|---------------:|----------------------:|
| Baseline global top-20 | 58,5 % | 65,9 % |
| **Quota 10/corpus -> 20** | **69,5 %** | **100 %** |
| Quota 15/corpus -> 30 | 73,2 % | 100 % |

**Choix quota 10 :** compromis **couverture multicorpus / coût** ; le quota 15/30 gagne ~3,7 pts de recall gold mais augmente le pool. Alignement sur la logique prod (quota dérivé du topK global).

**Règle filter (multicorpus) :** lorsqu'une question est explicitement routée vers plusieurs corpus, **préserver au moins un chunk de chacun des corpus routés** après le filtrage dynamique (variante B du benchmark filter).

**Smoke pipeline multicorpus (41 q, top-20)** - `multicorpus-quota-smoke-2026-09-20T23-05-17-065Z/` : retrieval **100 %** des 2 corpus ; chute après Jina/filter -> motivation **min 1 corpus** au filter.

**Validation filter min1/corpus (41 questions)** - `multicorpus-filter-final-validation-2026-09-21T16-11-25-231Z/` :

| Métrique | A: seuil 0,40 seul | B: min1/corpus @ 0,40 |
|----------|-------------------:|----------------------:|
| All gold corpora présent | 9/41 (22 %) | **32/41 (78 %)** |
| Gold gold article recall | 54,9 % | **61,0 %** |

Jina **réutilisé** depuis l'audit quota : seul le filter change -> benchmark filter, pas E2E 500.

Scripts : `pnpm benchmark:multicorpus-filter-variants`, `pnpm benchmark:multicorpus-filter-final-validation`

**Forensic contexte E2E 500** - `context-loss-forensic-audit-2026-09-21/` : 61 erreurs catégorie A ; pertes localisées retrieval (24), rerank (2), filter (2) ; 35 indéterminées faute de traces retrieval dans le run E2E (proxy audit quota pour 26 q).

---

### 5.4 Profondeur retrieval (`retrievalTopK`)

**Cohorte :** 61 questions / **93** gold articles (alignée forensic context-loss).

**Run :** `retrieval-depth-benchmark-2026-09-22/` (quota multicorpus prod, embeddings en cache).

| topK | Gold gold article recall (quota) |
|-----:|----------------------------:|
| 20 | **55,9 %** |
| 30 | **61,3 %** |
| 40 | **63,4 %** |
| 50 | **68,8 %** |

**29 golds** restent absents même @50 -> diagnostic sémantique (section 5.5).

**Décision top-30 (vector) :** +5,4 pts vs @20 avec coût maîtrisé ; retenu pour prod vector **avant** hybrid. Validations :

- Smoke 61 q @30 : `retrieval-top30-smoke-2026-09-22/`
- Mini-régression 30 q live routing : `retrieval-top30-regression-2026-09-22/` -> **`NO_REGRESSION`**

Scripts : `pnpm benchmark:retrieval-depth-2026-09-22`, `pnpm smoke:retrieval-top30-2026-09-22`, `pnpm régression:retrieval-top30-2026-09-22`

---

### 5.5 Diagnostic sémantique (29 golds absents @50)

**Run :** `retrieval-semantic-diagnostic-2026-09-22/` - **0 appel API**.

| Cause primaire | Part |
|----------------|-----:|
| Indeterminate | 48,3 % |
| Lexical mismatch | 31,0 % |
| Query / formulation | 6,9 % |
| Gold intrinsiquement difficile | 6,9 % |
| Chunk / représentation, semantic competition | rest? |
| Chunking / donnees (primaire) | **0 %** |

BM25 @50 sur les 29 : **13/29** retrouvés.

**Conclusion :** le chunking n'etait **pas** le facteur dominant ; **ecart vector vs correspondance lexicale** -> motivation BM25 / Union.

Script : `pnpm diagnostic:retrieval-semantic-2026-09-22`

---

### 5.6 Benchmark hybrid offline (61 q / 93 golds)

**Run :** `retrieval-hybrid-benchmark-2026-09-22/` - **0 API**.

| Variante | Gold recall @50 | Full coverage | Corpus coverage |
| -------- | --------------: | ------------: | --------------: |
| Vector | 68,8 % | 52,5 % | 64,5 % |
| BM25 | 73,1 % | 60,7 % | 74,2 % |
| **Union** | **81,7 %** | **72,1 %** | **80,6 %** |
| RRF | 77,4 % | 65,6 % | 75,8 % |

**Pourquoi Union plutôt que RRF ?**

- Objectif : **augmenter le rappel candidat avant Jina** en combinant signaux complémentaires (dense + lexical).
- Union **garde tous les hits** des deux listes (dedup `chunkId`) ; le benchmark montre une **complémentarité forte** du lexical (BM25 seul > vector seul ; Union > RRF sur recall @50).
- RRF fusionne par rang et **élimine** des candidats BM25-only utiles ? @50 ; non retenu pour V1.

Script : `pnpm benchmark:retrieval-hybrid-2026-09-22`

---

### 5.7 Smoke Jina + filter (sans génération)

**Run :** `retrieval-hybrid-rerank-filter-smoke-2026-09-22/` - Jina réel sur cache candidats.

| Variante | Retrieval | Apres Jina | Apres filter |
|----------|----------:|-----------:|-------------:|
| Vector | 68,8 % | 60,2 % | 54,8 % |
| Union | 81,7 % | 68,8 % | 61,3 % |
| RRF | 77,4 % | 67,7 % | 59,1 % |

**Enseignement :** l'Union apporte des golds au retrieval, mais **Jina puis le filter en éliminent une partie** -> validation **answer-level** nécessaire (`NEED_GENERATION_VALIDATION` dans le REPORT).

Script : `pnpm smoke:retrieval-hybrid-rerank-filter-2026-09-22`

---

### 5.8 Validation génération (20 questions)

**Run :** `retrieval-hybrid-generation-validation-2026-09-22/`

Cohorte : **20 questions** ou le **contexte final Vector != Union**.

| Métrique | Vector | Union | Delta |
|----------|-------:|------:|------:|
| Correctness | 2,15 | 2,70 | +0,55 |
| Completeness | 2,05 | 2,75 | +0,70 |
| Groundedness | 3,95 | 3,85 | -0,10 |

Les **6 questions** ou Union ajoutait un gold : **6/6** `improves_answer`.

**Pourquoi cette étape ?** Un meilleur retrieval **ne garantit pas** une meilleure réponse ; verifier que le gain survive rerank/filter.

Décision : **`HYBRID_IMPROVES_ANSWERS`**

Script : `pnpm validate:retrieval-hybrid-generation-2026-09-22`

---

### 5.9 Mini-régression (30 questions)

**Run :** `retrieval-hybrid-mini-regression-2026-09-22/` (`summary.json`)

| Métrique | Vector | Union | Delta |
|----------|-------:|------:|------:|
| Correctness | 2,13 | 2,47 | +0,33 |
| Completeness | 2,13 | 2,53 | +0,40 |
| Groundedness | 3,87 | 3,87 | 0 |
| Final gold recall | 50,0 % | 59,1 % | +9,1 pts |

Pairwise : **9** améliorations, **3** dégradations, **18** équivalentes.

Décision : **`HYBRID_NON_REGRESSION_PASS`**

Script : `pnpm validate:retrieval-hybrid-mini-regression-2026-09-22`

---

### 5.10 Smoke prod-like (`RETRIEVAL_STRATEGY`)

**Run :** `retrieval-strategy-smoke-2026-09-22/` - hybrid **live** (code prod) vs vector (cache top30-smoke), **30 questions**.

| Métrique | Vector | Hybrid Union | Delta |
|----------|-------:|-------------:|------:|
| Correctness | 2,13 | 2,53 | +0,40 |
| Completeness | 2,13 | 2,57 | +0,43 |

Pairwise : **10** améliorations, **3** dégradations, **17** équivalentes.

Décision : **`HYBRID_NON_REGRESSION_PASS`**

Intégration : BM25 index? en mémoire ; cold start Prisma ; **aucun** changement routing / Jina / filter / prompts dans ce run (`productionModified: NO` dans les metadonnees API du smoke).

Script : `pnpm smoke:retrieval-strategy-comparison-2026-09-22`

---

### 5.11 E2E 500 (jalons)

**Run principal :** `2026-09-21T16-59-10-310Z/` (`retrievalTopK: 20`, filter 0,40).

| Variante E2E | Correctness | Completeness | Groundedness | Abstention correct |
|--------------|------------:|-------------:|-------------:|-------------------:|
| baseline | 3,534 | 3,510 | 3,980 | 85,8 % |
| routing | 3,622 | 3,602 | 3,974 | **92,0 %** |

Autres runs sous `reports/evaluation/runs/2026-09-*`. **Forensic génération :** `generation-forensic-audit-2026-09-21/`.

Scripts : `pnpm evaluate:multicorpus`, `pnpm evaluate:e2e`

---

### 5.12 Smoke manuel final (5 questions)

Session via `pnpm search:answer` avec `RETRIEVAL_STRATEGY=hybrid-union` (**non persistée** comme run JSON) :

1. Mono-corpus (222-1) - pipeline OK ; 222-1 absent du contexte final (Jina).
2. BM25-sensitive (223-1) - réponse honnété article absent du contexte.
3. Multicorpus (q352) - routing civil + commerce.
4. Multi-articles (L511-1 / L511-6) - L511-6 manquant signale.
5. Ambiguë (responsabilite) - **abstention** correcte.

Conclusion session : **`READY_TO_CLOSE_RAG`** (5/5 technique ; limites Jina connues).

---

## 6. Limites

- Cohortes ciblées ne remplacent pas un E2E 500 après **chaque** changement.
- Judges LLM : biais, bruit, comparaison relative seulement.
- Recall gold = proxy (article présent != bonne réponse).
- Smoke manuel 5 q : pas de validation statistique.
- **Coût API** a réduit la fréquence des E2E complets (choix explicite).
- Trafic réel et questions hors dataset : risques residuels.
- Hybrid-union : pool ~90 candidats, chargé Jina + cold start BM25.

---

## 7. État validé fin V1 RAG

| Composant | Statut |
|-----------|--------|
| Routing V3.1 | Stabilisé (~93,6 % exact / 500) |
| Abstention | Pipeline stoppé si router abstient (36/36 smoke) |
| Retrieval | Quota multicorpus + optional **Hybrid Union** |
| Jina | Conserve (top 5) |
| Dynamic filter | 0,40 + min 1/corpus si multicorpus routés |
| Génération + citations | Prompts non retouches en phase eval hybrid |
| Config | Default code : `vector` ; projet : `.env` avec `hybrid-union` (voir section 1) |
| Tests / build | 536 passés, 13 skipped (dernière passé connue) |
| Hybrid Union | Validé par la chaîne ciblée (section 4) ; **HYBRID_NON_REGRESSION_PASS** |

> La V1 du pipeline RAG est **suffisamment validée** pour l'étape suivante du projet, **sans** prétention de perfection juridique.

**Exécution courante du projet :** `RETRIEVAL_STRATEGY=hybrid-union` dans le `.env` de travail (stratégie testée et validée). **Default / fallback du code :** `vector` (`DEFAULT_RETRIEVAL_STRATEGY`), disponible pour comparaison ou repli.

---

## 8. Inventaire des artefacts

Sous `reports/evaluation/runs/` (runs vérifiés dans le dépôt) :

| Dossier | Objectif | Cohorte | API | Résultat clé |
|---------|----------|--------:|-----|--------------|
| `2026-09-19T22-46-46-088Z` | Routing V3.1 | 500 | Routing | Exact **93,6 %** |
| `2026-09-19T23-21-51-901Z` | E2E référence pre-fix abstention | 500 | E2E | Reference |
| `2026-09-21T16-59-10-310Z` | E2E 500 principal | 500 | Complet | Correctness ~3,62 |
| `abstention-smoke-2026-09-20T22-19-35-413Z` | Fix abstention | 43 | Replay | **36/36** |
| `retrieval-quota-replay-2026-09-20T22-39-18-339Z` | Global vs quota | 41 | 0 | 100 % 2 corpus @ quota 10 |
| `multicorpus-quota-smoke-2026-09-20T23-05-17-065Z` | Quota E2E retrieval | 41 | Embed+Jina | Perte au filter |
| `multicorpus-rerank-filter-audit-quota-2026-09-21T15-22-47-287Z` | Scores Jina reutilisables | 45 | Embed+Jina | Proxy filter |
| `multicorpus-filter-final-validation-2026-09-21T16-11-25-231Z` | Filter min1 | 41 | Gen+judge | **78 %** corpora gold |
| `context-loss-forensic-audit-2026-09-21` | Forensic pertes | 61 | 0 | Par étape |
| `generation-forensic-audit-2026-09-21` | Typologie échecs | subset | 0 | Alimente audits |
| `retrieval-depth-benchmark-2026-09-22` | topK | 61 | 0* | **61,3 %** @30 |
| `retrieval-top30-smoke-2026-09-22` | Smoke top30 | 61 | Gen+Jina | Validation |
| `retrieval-top30-regression-2026-09-22` | Non-régression top30 | 30 | Routing live | **NO_REGRESSION** |
| `retrieval-semantic-diagnostic-2026-09-22` | 29 golds | 29 | 0 | BM25 13/29 |
| `retrieval-hybrid-benchmark-2026-09-22` | Hybrid offline | 61 | 0 | Union **81,7 %** |
| `retrieval-hybrid-rerank-filter-smoke-2026-09-22` | Jina+filter | 61 | Jina | Union filter **61,3 %** |
| `retrieval-hybrid-generation-validation-2026-09-22` | Answer-level | 20 | Gen+judge | **HYBRID_IMPROVES_ANSWERS** |
| `retrieval-hybrid-mini-regression-2026-09-22` | Non-régression | 30 | Mix | **HYBRID_NON_REGRESSION_PASS** |
| `retrieval-strategy-smoke-2026-09-22` | Prod strategy | 30 | Hybrid live | **HYBRID_NON_REGRESSION_PASS** |

\*Embeddings depuis cache quand disponible.

---

## 9. Scripts pnpm

| Script | Usage |
|--------|--------|
| `pnpm evaluate:multicorpus` | évaluation multi-modes |
| `pnpm smoke:abstention` | Smoke abstention |
| `pnpm benchmark:retrieval-depth-2026-09-22` | Profondeur topK |
| `pnpm benchmark:retrieval-hybrid-2026-09-22` | Hybrid offline |
| `pnpm smoke:retrieval-hybrid-rerank-filter-2026-09-22` | Jina+filter |
| `pnpm validate:retrieval-hybrid-generation-2026-09-22` | Answer-level |
| `pnpm validate:retrieval-hybrid-mini-regression-2026-09-22` | Mini-régression |
| `pnpm smoke:retrieval-strategy-comparison-2026-09-22` | Vector vs hybrid prod-like |
| `pnpm search:answer -- "..."` | Smoke manuel |

---

## 10. Références

- Dataset : [`evaluation-multicorpus.md`](./evaluation-multicorpus.md)
- Blueprint : [`rag-blueprint.md`](./rag-blueprint.md)
- Dernier résumé E2E : `reports/evaluation/multicorpus-latest.md`
