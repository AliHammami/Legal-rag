# Audit forensic � Reranking + Dynamic Filter multicorpus

**Date :** 2026-09-21  
**Cohorte :** smoke quota `multicorpus-quota-smoke-2026-09-20T23-05-17-065Z` (41 questions, 2 corpus rout?s)  
**Contraintes respect?es :** aucune modification production ; aucun nouvel appel OpenAI/Jina.

---

## Pipeline actuel (noms r?els)

```
answerQuestion()
  ?? searchAndRerankQuestion()
       ?? resolveRoutingFromRouterResult() / resolveRoutingForRetrieval()
       ?? searchQuestion()                    ? 20 candidats (quota 10/corpus si n>1)
       ?? rerankChunks()
            ?? JinaRerankerService.rerank({ topN: rerankTopK })  ? top 5
  ?? dynamicContextFilter(reranked, { relativeScoreThreshold: 0.4 })
  ?? buildRagContext(contextChunks)
  ?? generationService.generateAnswer()      [non ex?cut?e dans le smoke]
```

### Reranking Jina

- **Fichier :** `src/reranking/rerank-chunks.ts` ? `rerankChunks()`
- **Param?tres prod :** `DEFAULT_RERANK_TOP_K = 5`, mod?le `jina-reranker-v3.5`
- **Entr?e :** les 20 candidats retrieval ; **sortie :** 5 chunks tri?s par `rerankScore` Jina
- **Fallback :** si erreur Jina ?ligible ? `candidates.slice(0, rerankTopK)` (`search-and-rerank-question.ts`)

### Dynamic relative filter

- **Fichier :** `src/generation/dynamic-context-filter.ts` ? `dynamicContextFilter()`
- **Formule exacte :**

```text
bestScore = rerankScore du chunk rank-0 (premier apr?s Jina)
relativeScore = score / bestScore   (si bestScore <= 0 ? garde-fou MIN_CONTEXT_CHUNKS)

Conserver chunk index 0 : toujours
Conserver chunk index > 0 : si relativeScore >= threshold (d?faut 0.4)

MIN_CONTEXT_CHUNKS = 1
MAX_CONTEXT_CHUNKS = 5
```

- **Appel :** `answer-question.ts` et `smoke-multicorpus-quota-pipeline.ts` avec `relativeScoreThreshold: 0.4`

### Contexte final

- **Fichier :** `src/generation/build-rag-context.ts` ? `buildRagContext()`
- Concat?ne les chunks filtr?s en blocs `[Source N � code � Article X � chunk Y]`

---

## A. R?sum?

```text
41 questions analys?es (4 exclues : q382, q399, q409, q413 � routing ? 2 corpus)

Retrieval (quota) : 41/41 = 100 % � les 2 corpus rout?s pr?sents
Rerank (top-5)    : 32/41 =  78 % � les 2 corpus rout?s pr?sents
Filter (0.4)      :  9/41 =  22 % � les 2 corpus rout?s pr?sents
```

### O? se produisent les pertes

| ?tape | Perte cumulative (corpus) | M?canisme |
|-------|---------------------------|-----------|
| Rerank | **9 questions** (B) | 20 candidats avec 2 corpus ? Jina top-5 ne contient qu�1 corpus |
| Filter | **23 questions** (C) | Top-5 avec 2 corpus ? seuil 0.4 ne conserve qu�1 corpus |
| Aucune perte | **9 questions** (A) | 2 corpus survivent retrieval ? rerank ? filter |

```text
41 retrieval OK
 ??  9 perdus au rerank (B)     ? 32 arrivent au filter avec 2 corpus
 ?? 32 avec rerank OK
      ?? 23 perdus au filter (C) ? 9 arrivent avec 2 corpus (A)
      ??  9 passent tout (A)
```

**Point cl? :** sur cette cohorte post-quota, le **filter 0.4 est le goulot principal** (23/32 pertes apr?s rerank r?ussi), pas le reranker (9/41).

### Classification corpus (quota smoke)

| Classe | D?finition | N |
|--------|------------|---|
| **A** | 2 corpus retrieval ? rerank ? filter | 9 |
| **B** | 2 corpus retrieval, 1 corpus rerank | 9 |
| **C** | 2 corpus retrieval + rerank, 1 corpus filter | 23 |
| **D** | 2 corpus filter (g?n?ration non analys?e) | 0 |

---

## Limites des donn?es (important)

Le smoke quota **ne persiste pas** : liste des chunks retrieval, top-5 Jina, scores, ni hits gold par ?tape.

| M?trique | Disponible (quota) | Proxy disponible |
|----------|-------------------|------------------|
| Corpus coverage par ?tape | ? smoke JSON | � |
| Rerank scores / top-5 quota | ? | Forensic baseline (retrieval **sans** quota) |
| Gold article par ?tape (quota) | ? | Forensic baseline |
| Simulation filter sur scores quota | ? | Forensic rerank top-5 |

**Accord quota ? forensic (corpus) :** retrieval 27/41, rerank 25/41 � le proxy forensic est **imparfait** pour les scores quota.

**Gold article (forensic baseline, 41 q, 82 refs) :** retrieval 48/82 (58,5 %), rerank 46/82 (56,1 %), filter 38/82 (46,3 %).  
? **Non transposable directement** au pipeline quota (retrieval diff?rent).

---

## B. Tableau par question

| question | class | gold corpora | routed | ret | rer | fil | gold art. forensic (ret/rer/fil) |
|----------|-------|--------------|--------|-----|-----|-----|----------------------------------|
| q352 | C | civil+commerce | civil+commerce | 2 | 2 | 1 | 1/1/1 |
| q353 | C | civil+travail | civil+travail | 2 | 2 | 1 | 2/2/1 |
| q360 | C | p?nal+commerce | commerce+p?nal | 2 | 2 | 1 | 0/0/0 |
| q361 | B | mon?t.+travail* | civil+travail* | 2 | 1 | 1 | 1/1/1 |
| q362 | A | p?nal+travail | travail+p?nal | 2 | 2 | 2 | � |
| q363 | A | p?nal+mon?t. | mon?t.+p?nal | 2 | 2 | 2 | � |
| q364 | C | civil+commerce | civil+commerce | 2 | 2 | 1 | � |
| q365 | C | civil+mon?t. | civil+mon?t. | 2 | 2 | 1 | � |
| q367 | C | commerce+conso | conso+commerce | 2 | 2 | 1 | � |
| q371 | A | conso+travail | conso+travail | 2 | 2 | 2 | � |
| q372 | C | conso+mon?t. | conso+mon?t. | 2 | 2 | 1 | � |
| q373 | C | p?nal+conso | conso+p?nal | 2 | 2 | 1 | � |
| q374 | B | commerce+mon?t. | commerce+mon?t. | 2 | 1 | 1 | 1/1/1 |
| q375 | B | p?nal+commerce | commerce+p?nal | 2 | 1 | 1 | 1/1/1 |
| q377 | C | p?nal+travail | travail+p?nal | 2 | 2 | 1 | � |
| q378 | B | p?nal+mon?t. | mon?t.+p?nal | 2 | 1 | 1 | 1/1/1 |
| q379 | C | civil+conso | civil+conso | 2 | 2 | 1 | � |
| q380 | C | civil+commerce | civil+commerce | 2 | 2 | 1 | � |
| q381 | B | civil+travail | civil+travail | 2 | 1 | 1 | 1/1/1 |
| q383 | C | p?nal+civil | civil+p?nal | 2 | 2 | 1 | � |
| q384 | B | conso+commerce | conso+commerce | 2 | 1 | 1 | 1/1/1 |
| q386 | C | conso+mon?t. | conso+mon?t. | 2 | 2 | 1 | � |
| q387 | A | p?nal+conso | conso+p?nal | 2 | 2 | 2 | � |
| q394 | C | civil+conso | civil+conso | 2 | 2 | 1 | � |
| q395 | C | civil+commerce | civil+commerce | 2 | 2 | 1 | � |
| q396 | C | civil+travail | civil+travail | 2 | 2 | 1 | � |
| q397 | C | civil+mon?t. | civil+mon?t. | 2 | 2 | 1 | � |
| q400 | B | conso+travail | conso+travail | 2 | 1 | 1 | 2/2/1 |
| q401 | A | conso+mon?t. | conso+mon?t. | 2 | 2 | 2 | � |
| q402 | A | p?nal+conso | conso+p?nal | 2 | 2 | 2 | � |
| q407 | A | p?nal+travail | travail+p?nal | 2 | 2 | 2 | � |
| q408 | B | p?nal+mon?t.* | travail+p?nal* | 2 | 1 | 1 | 0/0/0 |
| q410 | C | civil+commerce | civil+commerce | 2 | 2 | 1 | � |
| q411 | B | civil+travail | civil+travail | 2 | 1 | 1 | 1/1/1 |
| q414 | A | conso+commerce | conso+commerce | 2 | 2 | 2 | � |
| q416 | C | conso+mon?t. | conso+mon?t. | 2 | 2 | 1 | � |
| q417 | A | p?nal+conso | conso+p?nal | 2 | 2 | 2 | � |
| q420 | C | p?nal+commerce | commerce+p?nal | 2 | 2 | 1 | � |
| q422 | C | p?nal+travail | travail+p?nal | 2 | 2 | 1 | � |
| q423 | C | p?nal+mon?t. | mon?t.+p?nal | 2 | 2 | 1 | � |
| q424 | C | civil+conso | civil+conso | 2 | 2 | 1 | � |

\* q361, q408 : gold corpora ? corpus rout?s (probl?me dataset / routing, pas filter).

`ret/rer/fil` = nombre de corpus **rout?s** repr?sent?s ? chaque ?tape (quota).  
Gold article hits = forensic baseline uniquement quand renseign?.

Donn?es machine : `audit.json` (m?me dossier).

---

## C. Audit reranker � B = 9

**IDs :** q361, q374, q375, q378, q381, q384, q400, q408, q411

### Synth?se factuelle

| Pattern | Cas | Interpr?tation |
|---------|-----|----------------|
| Monopole baseline, quota ret=2 mais rer=1 | q375, q378, q384, q408 | Quota am?ne le 2? corpus en retrieval ; Jina remplit quand m?me le top-5 avec le corpus dominant ? **diversit? insuffisante**, pas erreur retrieval |
| Baseline d?j? rer=1, quota confirme | q374 | Gold 2? corpus souvent **absent du retrieval** (ex. mon?t. L133-25-2 manquant) ? rerank ne peut pas le remonter |
| Quota **pire** que baseline au rerank | q381, q400, q411 | Candidats quota diff?rents ? Jina drop le 2? corpus alors qu�il passait en baseline |
| Gold / routing incoh?rent | q361, q408 | Gold hors corpus rout?s � hors p?rim?tre reranker |

### Exemples repr?sentatifs

**q375** � diversit? insuffisante coh?rente  
- Quota : ret=2, rer=1 (commerce only)  
- Forensic baseline : 20/20 chunks commerce ; gold p?nal absent du pool  
- Top-5 Jina (baseline) : 5� commerce, scores 0,29 ? -0,004  
- ? Le 2? corpus n�est pas � mal class? � : il est **noy?** par un corpus sur-repr?sent? dans les candidats rerank.

**q374** � gold 2? corpus jamais r?cup?r?  
- Gold commerce L127-5 : rank retrieval 2, rank Jina 2 (score 0,16 vs 0,55 max)  
- Gold mon?t. L133-25-2 : **absent** retrieval top-20 (baseline et quota ret=2 pour mon?t. mais pas le bon article)  
- ? Perte rerank **secondaire** ; le vrai trou est l�article gold manquant en retrieval.

**q400** � quota d?grade vs baseline  
- Forensic : rer=2, gold 2/2 (conso D314-22 rank 1, travail L1142-1 rank 5, score rel. 0,22)  
- Quota : rer=1 � changement de pool candidats apr?s quota  
- ? Cas o? une **modification reranker / diversification** pourrait aider, mais **filter ? 0,25** aurait aussi conserv? le chunk travail en baseline.

**q381** � quota d?grade vs baseline  
- Forensic rer=2 (civil rank 1 + travail rank 5, score travail n?gatif)  
- Quota rer=1 � travail expuls? du top-5  
- Gold travail L2132-5 : absent partout.

### R?ponses aux questions reranker

1. **Le 2? corpus contient-il un passage pertinent ?** � Souvent oui en retrieval (quota garantit 10 chunks/corpus), mais scores Jina **tr?s inf?rieurs** au corpus dominant.  
2. **Gold chunk pr?sent ?** � Forensic : 7/9 cas B ont ?1 gold en retrieval ; 7/9 en rerank top-5. Pas mesurable sur quota.  
3. **Rang Jina du gold 2? corpus ?** � Quand pr?sent : typiquement rank 2�5 avec `relativeScore` 0,07�0,30.  
4. **?cart de score entre corpus ?** � Fr?quemment 3� ? 10� (ex. q353 : 0,71 vs 0,11 ? rel. 0,15).  
5. **2? corpus syst?matiquement d?savantag? ?** � Oui **m?caniquement** quand la question est plus align?e sur un corpus (comportement attendu du cross-encoder).  
6. **Diversit? vs classement incorrect ?** � Majorit? **diversit? insuffisante** (top-5 mono-corpus) plut?t que mauvais ordre intra-corpus. 3 cas (q381, q400, q411) o? quota aggrave vs baseline.

---

## D. Audit filter � C = 23

**IDs :** q352, q353, q360, q364, q365, q367, q372, q373, q377, q379, q380, q383, q386, q394, q395, q396, q397, q410, q416, q420, q422, q423, q424

### M?canisme observ? (forensic proxy, 16 chunks � 2? corpus dropp?s � analys?s)

**Tous** ont `relativeScore < 0,4` � le filter fait exactement ce pour quoi il est con?u.

| question | top-5 rerank (extrait) | max | 2? corpus best | rel. | conserv? @0.4 |
|----------|------------------------|-----|----------------|------|---------------|
| q353 | travail 0,713, civil 0,108 | 0,713 | civil art.10 | **0,15** | non |
| q352 | civil 0,728, commerce 0,165 | 0,728 | commerce L123-3 | **0,23** | non |
| q364 | civil 0,603, commerce 0,122 | 0,603 | commerce L123-7 | **0,20** | non |
| q422 | travail 0,729, p?nal 0,124 | 0,729 | p?nal 434-9 | **0,17** | non |
| q386 | conso 0,664, mon?t. 0,013 | 0,664 | mon?t. L522-18 | **0,02** | non |

**Distribution `filterCount` (quota) :** 21 questions ? 1 chunk, 7 ? 2, 7 ? 3, 3 ? 4, 3 ? 5.  
? Classe C = surtout **1 seul chunk** final (21/23 ont `filterCount=1`).

### Formule appliqu?e (exemple q353)

```text
rank-0 : travail L1237-3, score 0,7128 ? TOUJOURS conserv?
rank-2 : civil art.10, score 0,1079
         relativeScore = 0,1079 / 0,7128 = 0,151 < 0,4 ? SUPPRIM?
? filterCount = 1, corpus filter = {travail}
```

Gold civil art.10 ?tait pourtant **pr?sent** au rerank (forensic).

---

## E. Simulation des thresholds (offline)

### ?? Scores = rerank top-5 **forensic baseline**, pas quota

Impossible de simuler sur les scores quota sans re-jouer Jina (non persist?s).

### Cohorte C quota (23 q � rerank quota = 2 corpus) � proxy forensic

| threshold | 2 corpora | 1 corpus | gold articles (forensic) |
|-----------|-----------|----------|--------------------------|
| 0,20 | 13/23 | 10/23 | 27/46 (58,7 %) |
| 0,25 | 10/23 | 13/23 | 27/46 (58,7 %) |
| 0,30 | 7/23 | 16/23 | 24/46 (52,2 %) |
| 0,35 | 4/23 | 19/23 | 23/46 (50,0 %) |
| **0,40** | **0/23** | **23/23** | **22/46 (47,8 %)** |
| 0,45 | 0/23 | 23/23 | 22/46 (47,8 %) |
| 0,50 | 0/23 | 23/23 | 22/46 (47,8 %) |

? Sur cette cohorte, **0,4 est un cliff** : aucun cas C ne conserve 2 corpus (proxy). Baisser ? **0,25** restaurerait ~10/23 cas en couverture corpus (+ gold +5 refs sur proxy).

### Ensemble 41 q � proxy forensic

| threshold | 2 corpora | 1 corpus | 0 corpus | gold articles |
|-----------|-----------|----------|----------|---------------|
| 0,20 | 17 | 24 | 0 | 45/82 (54,9 %) |
| 0,25 | 13 | 28 | 0 | 44/82 (53,7 %) |
| 0,30 | 9 | 32 | 0 | 40/82 (48,8 %) |
| 0,35 | 6 | 35 | 0 | 39/82 (47,6 %) |
| **0,40** | **2** | **39** | **0** | **38/82 (46,3 %)** |
| 0,45 | 2 | 39 | 0 | 38/82 (46,3 %) |
| 0,50 | 1 | 40 | 0 | 37/82 (45,1 %) |

**Quota r?el @0,4 :** 9/41 corpus (vs 2/41 proxy) � le proxy **sous-estime** l�effet b?n?fique du quota sur les scores rerank.

### Estimation quota si seul le filter change

- **Plancher :** 9 cas A restent OK.  
- **Gain potentiel (C) :** ~10�13 cas ? threshold 0,25�0,20 (extrapolation cohorte C) ? **~19�22/41** couverture 2 corpus (vs 9 actuellement).  
- **Incertitude ?lev?e** sans scores quota r?els.

---

## F. Comparaison baseline vs quota (sans re-benchmark)

| M?trique | Baseline forensic | Quota smoke |
|----------|-------------------|-------------|
| 2 corpus @ retrieval | 27/41 (65,9 %) | **41/41 (100 %)** |
| 2 corpus @ rerank | ~25/41* | 32/41 (78 %) |
| 2 corpus @ filter 0.4 | 2/41 (proxy sim) | 9/41 (22 %) |

\* accord partiel quota/forensic.

**14 questions** : baseline retrieval mono-corpus ? quota retrieval bi-corpus.  
- 5 restent B (rer=1) : q361, q375, q378, q384, q408  
- 9 passent rerank avec 2 corpus : 5� A + 4� C  

? Le quota **r?sout le retrieval** mais expose rerank/filter : les candidats du 2? corpus arrivent en rerank avec des scores Jina faibles ? massacr?s par le filter 0.4.

---

## G. Conclusions

### 1. Le reranker est-il le prochain probl?me ?

**Non en priorit?.** 23/41 pertes sont au **filter** (classe C) vs 9/41 au rerank (B).  
Le reranker pose surtout un probl?me de **diversit? top-5** (mono-corpus) dans 9 cas, souvent coh?rent avec la pertinence asym?trique des questions bicorpores.

### 2. Le filter 0.4 est-il trop agressif ?

**Oui, sur cette cohorte multicorpus.**  
- 23 cas ont les 2 corpus au rerank mais 1 seul au filter.  
- Proxy : tous les chunks 2? corpus dropp?s ont `relativeScore < 0,4`, souvent 0,15�0,30 alors que le gold y est parfois pr?sent (ex. q353 civil art.10).  
- Le seuil 0.4 a ?t? calibr? pour la **pr?cision** mono-contexte, pas la **couverture** multicorpus.

### 3. Modification minimale la moins risqu?e ?

**Baisser `relativeScoreThreshold` (ex. 0,25�0,30)**, ideally **conditionnel multicorpus** (seuil plus bas quand `corpusIds.length > 1`) :
- Ne touche pas routing, retrieval quota, ni Jina  
- R?versible, testable offline si scores persist?s  
- Risque : plus de chunks bruit en contexte ? surveiller pr?cision g?n?ration

Alternative plus cibl?e : **conserver au moins 1 chunk par corpus rout?** avant le filter relatif (diversit? minimale) � un peu plus invasive mais borne la perte multicorpus.

### 4. Reranker, filter, les deux, ou aucun ?

| Composant | Action |
|-----------|--------|
| Filter | **Oui** � premier levier, impact ~23 cas |
| Reranker | **Secondaire** � 9 cas ; diversification top-5 (MMR par corpus) si filter seul insuffisant |
| Retrieval quota | **Non** � valid? 100 % |
| Routing V3.1 | **Non** � gel? |

### 5. Exp?rience minimale suivante

1. **Re-smoke enrichi** (41 q, ~41 appels Jina) : persister `candidates`, `rerankTop5` + scores, `filteredContext`, gold hits par ?tape ? simulation filter exacte sur scores quota.  
2. **Offline grid** : thresholds 0,20�0,50 + variante � min 1 chunk / corpus rout? � sur ces scores.  
3. **M?triques** : corpus coverage **et** gold article coverage @ filter ; pas seulement corpus.  
4. **Validation g?n?ration** : sous-ensemble ~15 q (A+B+C) avec g?n?ration + judge � hors E2E 500.  
5. **D?cision** : si 0,25�0,30 restaure ?15/23 cas C sans chute judge ? PR filter-only ; sinon tester diversification rerank top-5.

---

## Fichiers produits

- `reports/evaluation/runs/multicorpus-rerank-filter-audit-2026-09-20/audit.json` � donn?es structur?es  
- `reports/evaluation/runs/multicorpus-rerank-filter-audit-2026-09-20/REPORT.md` � ce rapport  
- Script read-only : `scripts/audit-multicorpus-rerank-filter.ts`
