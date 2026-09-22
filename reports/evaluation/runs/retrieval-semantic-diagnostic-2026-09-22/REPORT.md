# Diagnostic semantique � golds absents a topK=50

## 1. Resume

- **29** gold articles analyses (absents a @20 et toujours absents a @50, strategie quota multicorpus).
- Cohorte extraite de `retrieval-depth-benchmark-2026-09-22/benchmark.json` (`goldRankDetailsQuota`, `depthBand=absent_at_50`, `absentAt20=true`).
- **API calls = 0** (lecture fichiers locaux + chunks `data/processed/*.chunks.json`).
- Production non modifiee dans cette tache.

## 2. Classification (cause primaire, categories chevauchantes possibles)

| Cause | Nombre | % |
|-------|-------:|--:|
| Query / formulation | 2 | 6.9% |
| Chunk / representation | 1 | 3.4% |
| Semantic competition | 1 | 3.4% |
| Lexical mismatch | 9 | 31.0% |
| Gold intrinsiquement difficile | 2 | 6.9% |
| Chunking / donnees | 0 | 0.0% |
| Indetermine | 14 | 48.3% |

> Les tags secondaires sont dans `diagnostic.json` (`classification.tags`).

## 3. Resultats BM25 (diagnostique offline)

| Methode | Gold retrouves / 29 |
|---------|--------------------:|
| Vector @50 | 0/29 (par definition cohorte) |
| BM25 @50 | 13/29 |
| Union (vector U BM25) @50 | 13/29 |

BM25: index lexical sur tous les chunks des corpus routes par question (meme perimetre que le retrieval quota), top 50 par score.

## 4. Patterns observes

- 1/29 cas: >=2 articles voisins (meme prefixe) dans le vector top10.
- 9/29 cas: tag lexical_mismatch (overlap concurrent > gold).
- 11/29 cas: jaccard question-gold < 0.05.
- 4/29 cas: chunk gold multi-morceau ou > target size.
- BM25 recupere 13 golds supplementaires vs vector @50.

## 5. Cas representatifs

### q002 � code-penal:223-1

- **Question:** Selon l'article 223-1, quels sont les éléments constitutifs de l'infraction punie d'un an d'emprisonnement et de 15 000 euros d'amende ?
- **Gold (extrait):** Le fait d'exposer directement autrui à un risque immédiat de mort ou de blessures de nature à entraîner une
mutilation ou une infirmité permanente par la violation manifestement dé�
- **Top vector @10:** 1. code-penal:223-11 (d=0.329); 2. code-penal:322-3 (d=0.336); 3. code-penal:222-40 (d=0.338); 4. code-penal:432-2 (d=0.339); 5. code-penal:433-16 (d=0.339)
- **Jaccard Q/G:** 0.158 ; tokens communs: 000, 15, amende, an, emprisonnement, euros
- **Voisins top10:** code-penal:223-11
- **BM25 rank gold:** 24
- **Diagnostic:** Indetermine (low)
- **Hypothese:** Signal insuffisant pour conclure.

### q048 � code-penal:713-3

- **Question:** Comment l'article 713-3 définit-il les discriminations liées à l'état de santé ou au handicap dans le contexte d'embauche ou de licenciement ?
- **Gold (extrait):** Les 2° et 3° de l'article 225-3 sont rédigés comme suit :

" 2° Aux discriminations fondées sur l'état de santé ou le handicap, lorsqu'elles consistent en un refus
d'embauche ou un�
- **Top vector @10:** 1. code-du-travail:L1133-3 (d=0.379); 2. code-du-travail:L1132-1 (d=0.412); 3. code-du-travail:L5213-6 (d=0.439); 4. code-du-travail:L1133-2 (d=0.452); 5. code-du-travail:L1133-4 (d=0.453)
- **Jaccard Q/G:** 0.146 ; tokens communs: article, discriminations, embauche, etat, handicap, licenciement, sante
- **Voisins top10:** (aucun)
- **BM25 rank gold:** >50
- **Diagnostic:** Indetermine (low)
- **Hypothese:** Signal insuffisant pour conclure.

### q132 � code-du-travail:L5221-1

- **Question:** Quels textes priment sur les dispositions du titre concerné dans l'article L5221-1 du Code du travail ?
- **Gold (extrait):** Les dispositions du présent titre sont applicables, sous réserve de celles des traités, conventions ou accords
régulièrement ratifiés ou approuvés et publiés, et notamment des trai�
- **Top vector @10:** 1. code-du-travail:L7211-3 (d=0.381); 2. code-du-travail:L7221-2 (d=0.394); 3. code-du-travail:L1225-11 (d=0.406); 4. code-du-travail:L1321-5 (d=0.407); 5. code-du-travail:L3221-1 (d=0.412)
- **Jaccard Q/G:** 0.063 ; tokens communs: dispositions, titre
- **Voisins top10:** (aucun)
- **BM25 rank gold:** >50
- **Diagnostic:** Lexical mismatch (medium)
- **Hypothese:** Les concurrents partagent plus de tokens avec la question que le gold; signal favorable a un futur hybrid lexical+vector.

### q352 � code-du-commerce:L123-8

- **Question:** Quels recours un juge peut-il ordonner en référé pour faire cesser une atteinte à la présomption d'innocence, et quelles sont les obligations d'un commerçant non immatriculé?
- **Gold (extrait):** La personne assujettie à immatriculation qui n'a pas requis cette dernière à l'expiration d'un délai de quinze
jours à compter du commencement de son activité, ne peut se prévaloir�
- **Top vector @10:** 1. code-civil:9-1 (d=0.371); 2. code-du-commerce:L123-3 (d=0.379); 3. code-du-commerce:L470-1 (d=0.408); 4. code-du-commerce:L123-5-1 (d=0.420); 5. code-du-commerce:L442-4 (d=0.430)
- **Jaccard Q/G:** 0.025 ; tokens communs: commercant, obligations
- **Voisins top10:** code-du-commerce:L123-3
- **BM25 rank gold:** 41
- **Diagnostic:** Lexical mismatch (medium)
- **Hypothese:** Les concurrents partagent plus de tokens avec la question que le gold; signal favorable a un futur hybrid lexical+vector.

### q170 � code-du-travail:L2262-1

- **Question:** Qui est tenu de respecter l'application des conventions et accords selon l'article L2262-1 ?
- **Gold (extrait):** Sans préjudice des effets attachés à l'extension ou à l'élargissement, l'application des conventions et accords
est obligatoire pour tous les signataires ou membres des organisatio�
- **Top vector @10:** 1. code-du-travail:L3221-1 (d=0.393); 2. code-du-travail:L3321-1 (d=0.406); 3. code-du-travail:L4111-1 (d=0.409); 4. code-du-travail:L3311-1 (d=0.410); 5. code-du-travail:L3231-1 (d=0.413)
- **Jaccard Q/G:** 0.150 ; tokens communs: accords, application, conventions
- **Voisins top10:** (aucun)
- **BM25 rank gold:** 11
- **Diagnostic:** Query / formulation (medium)
- **Hypothese:** Faible recouvrement lexical question-gold; la formulation peut etre trop conceptuelle ou elliptique pour l embedding seul.

### q386 � code-monetaire-et-financier:L312-1-1

- **Question:** Quelles sont les obligations d'information imposées aux personnes collectant et diffusant des avis en ligne, et comment celles-ci sont-elles complétées par les règles sur la gestion des comptes de dép�
- **Gold (extrait):** I. – Les établissements de crédit sont tenus de mettre à la disposition, sur support papier ou sur un autre support durable, de leur clientèle et du public les conditions générales�
- **Top vector @10:** 1. code-de-la-consommation:L111-7-2 (d=0.312); 2. code-de-la-consommation:D111-10 (d=0.426); 3. code-de-la-consommation:D111-11 (d=0.427); 4. code-de-la-consommation:L121-3 (d=0.443); 5. code-monetaire-et-financier:L522-18 (d=0.477)
- **Jaccard Q/G:** 0.029 ; tokens communs: avis, credit, depot, etablissements, gestion, information, obligations, personnes
- **Voisins top10:** (aucun)
- **BM25 rank gold:** 6
- **Diagnostic:** Query / formulation (medium)
- **Hypothese:** Faible recouvrement lexical question-gold; la formulation peut etre trop conceptuelle ou elliptique pour l embedding seul.

### q238 � code-monetaire-et-financier:L231-10

- **Question:** Quelles sont les sanctions prévues pour une personne qui affirme des souscriptions fictives selon l'article L231-10 ?
- **Gold (extrait):** Est puni d'un emprisonnement de cinq ans et d'une amende de 9 000 euros le fait, pour toute personne :
1. D'affirmer, sincères et véritables des souscriptions qu'elle sait fictives�
- **Top vector @10:** 1. code-du-commerce:L123-38 (d=0.366); 2. code-du-commerce:L123-5 (d=0.374); 3. code-du-commerce:L242-2 (d=0.393); 4. code-du-commerce:R247-3 (d=0.397); 5. code-du-commerce:L241-3 (d=0.403)
- **Jaccard Q/G:** 0.044 ; tokens communs: fictives, personne, souscriptions
- **Voisins top10:** (aucun)
- **BM25 rank gold:** >50
- **Diagnostic:** Gold intrinsiquement difficile (medium)
- **Hypothese:** Peu de proximite lexicale et BM25 eleve absent; l article est pertinent mais peu aligne surface avec la question.

### q381 � code-du-travail:L2132-5

- **Question:** Quels effets produisent, selon les articles 2422 du code civil et L2132-5 du code du travail, les inscriptions hypothécaires en cas de procédures judiciaires, et quelles sont les fonctions des syndica�
- **Gold (extrait):** Les syndicats professionnels peuvent :
1° Créer et administrer des centres d'informations sur les offres et les demandes d'emploi ;
2° Créer, administrer et subventionner des insti�
- **Top vector @10:** 1. code-civil:2422 (d=0.371); 2. code-du-travail:L3253-1 (d=0.399); 3. code-du-travail:L1253-8-2 (d=0.424); 4. code-du-travail:L3253-23 (d=0.432); 5. code-du-travail:L3253-12 (d=0.437)
- **Jaccard Q/G:** 0.035 ; tokens communs: professionnels, syndicats
- **Voisins top10:** (aucun)
- **BM25 rank gold:** >50
- **Diagnostic:** Gold intrinsiquement difficile (medium)
- **Hypothese:** Peu de proximite lexicale et BM25 eleve absent; l article est pertinent mais peu aligne surface avec la question.


## 6. Conclusion

Probleme **principalement lexical + vector gap**: concurrents plus proches en tokens que le gold; BM25 @50 retrouve 13/29 cas absents du vector.

## 7. Prochaine experience (une seule)

**Hybrid retrieval BM25 + vector (union/RRF)** sur la cohorte 61q � BM25 recupere plusieurs golds absents du vector @50.
