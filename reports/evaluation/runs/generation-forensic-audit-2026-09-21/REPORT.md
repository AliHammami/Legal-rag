# Audit forensic - erreurs generation E2E 500

## 1. Run audite

- Run: `2026-09-21T16-59-10-310Z`
- Artefacts: `reports/evaluation/runs/2026-09-21T16-59-10-310Z`
- Variante analysee: **routing** (meme base que `classifyFailureStage` / judge routing).

## 2. Methodologie

- Audit read-only sur `report.json`, `e2e.json` et le dataset multicorpus.
- Aucun appel LLM, embedding, Jina, generation ou judge.
- Le run ne persiste pas les chunks rerankes/scores Jina: diagnostic fonde sur **sources finales** (corpus + article), judge et sourceJudge.
- Regles heuristiques documentees dans `src/evaluation/multicorpus/generation-forensic-audit.ts`.

## 3. Nombre total d erreurs pipeline `generation`

- Pipeline: **62** (report.errors.byStage.generation)
- Auditees ici: **62**

## 4. Classification forensic

```text
62 generation errors
|
|-- A contexte insuffisant : 61
|-- B vraie generation : 1
|-- C citation/source : 0
|-- D abstention/cas limite : 0
+-- E indetermine : 0
```

| categorie | count | % |
|-----------|------:|--:|
| Contexte insuffisant | 61 | 98.4% |
| Vraie generation | 1 | 1.6% |
| Citation/source | 0 | 0.0% |
| Abstention/cas limite | 0 | 0.0% |
| Indetermine | 0 | 0.0% |

## 5. Part de vrais problemes de generation

- **Vraie generation (B):** 1/62 = **1.6%**
- **Encore liees au contexte (A+C+D):** 61/62 = **98.4%**

Question centrale: avec routing/retrieval/rerank/filter deja corriges, combien d erreurs `generation` restent des fautes de gpt-5.6-luna avec contexte suffisant?

=> **1** cas (1.6%).

## 6. Sous-classification B (vraie generation)

| sous-cause | count |
|------------|------:|
| B4 | 1 |

## 7. Repartition (pipeline generation errors)

### Par type de question

| type | count |
|------|------:|
| multi-corpus | 32 |
| single-corpus | 30 |

### Couverture gold dans le contexte final (routing)

| couverture | count |
|------------|------:|
| aucun article gold | 32 |
| partielle | 29 |
| complete | 1 |

Note: 30/30 erreurs **single-corpus** ont **zero** article gold dans les sources finales.

### Par difficulte

| difficulty | count |
|------------|------:|
| easy | 15 |
| hard | 32 |
| medium | 15 |

### Cas B � type de question

| type | count B |
|------|--------:|
| multi-corpus | 1 |

Moyenne chunks contexte (cas B): **2.00**

## 8. Comparaison audits precedents

Sur l ancien run `2026-09-19T23-21-51-901Z`, le diagnostic E2E listait **66** erreurs generation, dont une forte majorite avec **article gold absent** du contexte (ex. q001-q003).
Ici, **A** reste dominant si les articles gold manquent encore dans les sources finales; la baisse 66?62 et la hausse des scores agreges suggerent un gain pipeline, mais la repartition A vs B est recalculee sur ce run uniquement.

## 9. Cas representatifs

### Vraie generation (B)

#### q372 (multi-corpus / hard)

**Question:** En quoi consiste l'interdiction faite aux professionnels d'appliquer des mesures différenciées basées sur le lieu de résidence du consommateur, et quelles sont les responsabilités du prestataire de services de paiement en cas de mauvaise exécution d'une opération ?

**Attendu:** L'article L121-23 du code de la consommation interdit à un professionnel de bloquer ou limiter l'accès d'un consommateur à son interface en ligne, ou de lui appliquer des conditions générales différentes, pour des motifs liés à son lieu de résidence sur le territoire national, sauf consentement explicite ou nécessité légale avec explication claire. Par ailleurs, l'article L133-22 du code monétaire et financier établit que le prestataire de services de paiement du payeur est responsable de la bonne exécution de l'opération jusqu'à réception par le prestataire du bénéficiaire qui est ensuite responsable de l'exécution vis-à-vis du bénéficiaire. En cas d'opération mal exécutée, le prestataire responsable restitue sans tarder le montant au payeur ou crédite immédiatement le compte du bénéficiaire selon le cas.

**Reponse (extrait):** L’interdiction vise à empêcher un professionnel de traiter différemment les consommateurs en raison de la localisation :  - de leur résidence ; - de leur compte de paiement ; - de leur prestataire de services de paiement ; - ou du lieu d’émission de leur instrument de paiement.  Elle concerne notamment l’accès aux services électroniques, l’accès à certains services non électroniques fournis dans l�

**Contexte (sources):** code-de-la-consommation:L121-23, code-monetaire-et-financier:L133-22

**Gold manquants:** none

**Judge (completeness):** La réponse décrit correctement l’interdiction de discrimination liée notamment à la résidence, au compte ou au prestataire de paiement, ainsi que ses conditions et exceptions. Elle restitue fidèlement le régime de responsabilité prévu au II de l’article L133-22 pour les opérations initiées par le bénéficiaire ou via celui-ci. Toutefois, elle ne couvre pas pleinement le régime général attendu de mauvaise exécution, notamment la répartition de responsabilité jusqu’à réception des fonds et les conséquences de restitution/crédit du montant. Toutes les affirmations importantes sont étayées par les extraits de contexte fournis.

**Diagnostic:** B / B4 � Tous les articles et corpus gold sont presents dans le contexte final; l echec judge est imputable a la generation.

### Contexte insuffisant (A)

#### q001 (single-corpus / easy)

**Question:** Quelle est la peine encourue pour avoir soumis une personne à des tortures selon l'article 222-1 du Code pénal ?

**Attendu:** Quinze ans de réclusion criminelle.

**Reponse (extrait):** Les sources fournies ne précisent pas la peine de base prévue par l’article 222-1 du Code pénal.  Elles indiquent seulement que cette peine peut être aggravée lorsque l’infraction est notamment commise dans certaines circonstances :  - **20 ans de réclusion criminelle** dans les cas prévus par l’article 222-3 [Sources 2 et 4] ; - **30 ans de réclusion criminelle** dans les cas prévus par les artic�

**Contexte (sources):** code-penal:222-4, code-penal:222-3, code-penal:222-5, code-penal:222-3, code-penal:222-6

**Gold manquants:** code-penal:222-1

**Judge (correctness, completeness):** La réponse ne donne pas la peine de base demandée, qui est de quinze ans de réclusion criminelle, et conclut à tort qu’elle est indéterminable. Elle est néanmoins fidèlement fondée sur le contexte fourni : celui-ci ne contient que les peines aggravées des articles 222-3 à 222-6 et ne reproduit pas l’article 222-1 ni sa peine de base. L’abstention est incorrecte car une réponse était attendue.

**Diagnostic:** A � Aucun article gold present dans le contexte final (sources citees).

#### q002 (single-corpus / easy)

**Question:** Selon l'article 223-1, quels sont les éléments constitutifs de l'infraction punie d'un an d'emprisonnement et de 15 000 euros d'amende ?

**Attendu:** Exposer directement autrui à un risque immédiat de mort ou de blessures entraînant mutilation ou infirmité permanente par la violation manifestement délibérée d'une obligation particulière de prudence ou de sécurité imposée par la loi ou le règlement.

**Reponse (extrait):** Le contexte ne contient pas le texte de l’**article 223-1 du Code pénal**. Il n’est donc pas possible d’identifier, à partir des seules sources fournies, les éléments constitutifs de l’infraction concernée.  Les sources indiquent seulement plusieurs infractions différentes punies d’un an d’emprisonnement et de 15 000 euros d’amende, notamment l’usurpation d’identité (**article 226-4-1 du Code péna�

**Contexte (sources):** code-penal:225-16-2, code-penal:226-22-2, code-penal:226-4-1, code-penal:322-3, code-penal:725-6

**Gold manquants:** code-penal:223-1

**Judge (correctness, completeness):** La réponse ne fournit aucun des éléments constitutifs demandés par l'article 223-1 et ne répond donc pas à la question, alors qu'une réponse était attendue. En revanche, son constat selon lequel le texte de l'article 223-1 ne figure pas dans le contexte est exact, et les exemples d'autres infractions citées sont bien présents dans les sources fournies.

**Diagnostic:** A � Aucun article gold present dans le contexte final (sources citees).

#### q003 (single-corpus / easy)

**Question:** Quelles sont les différences de peine prévues par l'article 224-1 du Code pénal en fonction de la durée de la séquestration ?

**Attendu:** La réclusion criminelle est de vingt ans si la personne est séquestrée, sauf si elle est libérée volontairement avant sept jours, auquel cas la peine est de cinq ans d'emprisonnement et 75 000 euros d'amende.

**Reponse (extrait):** Le contexte fourni ne reproduit pas le contenu de l’article 224-1 du Code pénal. Il ne permet donc pas de déterminer les différences de peine selon la durée de la séquestration.  Il indique seulement que l’article 224-3 prévoit, lorsque l’infraction concerne plusieurs personnes, une peine de trente ans de réclusion criminelle, ramenée à dix ans d’emprisonnement en cas de libération volontaire dans�

**Contexte (sources):** code-penal:224-3

**Gold manquants:** code-penal:224-1

**Judge (correctness, completeness):** La réponse ne fournit pas les peines prévues par l'article 224-1 selon la durée de la séquestration, alors que la réponse attendue distingue la peine de vingt ans de réclusion criminelle et le cas de libération volontaire avant sept jours (cinq ans d'emprisonnement et 75 000 euros d'amende). Elle est néanmoins fidèlement fondée sur le seul contexte fourni, qui ne contient que l'article 224-3 et renvoie sans reproduire le délai de l'article 224-1.

**Diagnostic:** A � Aucun article gold present dans le contexte final (sources citees).

#### q007 (single-corpus / easy)

**Question:** Comment définit-on la discrimination en droit pénal selon l'article 225-1 ?

**Attendu:** La discrimination est toute distinction opérée entre les personnes physiques ou morales fondée sur des critères tels que l'origine, le sexe, la situation de famille, la grossesse, l'apparence physique, la vulnérabilité économique, le patronyme, le lieu de résidence, l'état de santé, le handicap, les caractéristiques génétiques, les mœurs, l'orientation sexuelle, l'identité de genre, l'âge, les opinions politiques, les activités syndicales, la qualité de lanceur d'alerte, la capacité à s'exprimer dans une langue autre que le français, ou l'appartenance réelle ou supposée à une ethnie, une nation, une race ou une religion déterminée.

**Reponse (extrait):** Le contexte fourni ne contient pas le texte de l’article 225-1 du Code pénal. Il indique seulement que l’article 225-2 réprime certaines discriminations « définies aux articles 225-1 à 225-1-2 » [Source 1].  Il n’est donc pas possible de définir précisément la discrimination au sens de l’article 225-1 à partir des seules sources disponibles.�

**Contexte (sources):** code-penal:225-2

**Gold manquants:** code-penal:225-1

**Judge (correctness, completeness):** La réponse ne fournit pas la définition demandée de la discrimination au sens de l'article 225-1, alors que la question appelle une réponse de fond. Elle est toutefois correctement fondée sur le contexte fourni : celui-ci ne reproduit pas l'article 225-1 et mentionne seulement que l'article 225-2 vise des discriminations définies aux articles 225-1 à 225-1-2.

**Diagnostic:** A � Aucun article gold present dans le contexte final (sources citees).

#### q011 (single-corpus / medium)

**Question:** Quelles sont les peines accessoires encourues par les personnes physiques coupables des infractions prévues dans ce sous-titre et quelles sont leurs durées maximales ?

**Attendu:** Les peines accessoires sont : interdiction des droits civiques, civils et de famille (max 15 ans), interdiction d'exercer une fonction publique ou professionnelle liée à l'infraction (max 10 ans), interdiction de séjour (max 15 ans), confiscation de biens, et interdiction d'exercer une profession commerciale ou industrielle. Ces interdictions peuvent être cumulées.

**Reponse (extrait):** Le contexte disponible ne permet pas de répondre à cette question. La question est ambiguë, hors du périmètre des codes juridiques disponibles, ou aucun corpus pertinent n'a pu être identifié de manière fiable. Aucune recherche juridique n'a été effectuée.�

**Contexte (sources):** none

**Gold manquants:** code-penal:213-1

**Judge (correctness, completeness):** La réponse ne fournit aucune des peines accessoires ni leurs durées maximales, alors que la question appelle une réponse juridique précise et qu'une réponse était attendue. Elle abstient à tort. Son constat selon lequel le contexte vide ne permet pas de fonder une réponse est toutefois entièrement supporté par le contexte effectivement fourni.

**Diagnostic:** A � Aucun article gold present dans le contexte final (sources citees). Corpus gold absent(s): code-penal.

## 10. Conclusion

- Sur **62** erreurs pipeline `generation`, **1** (1.6%) sont des **vraies erreurs de generation** avec couverture gold complete dans le contexte final (variant routing).
- **61** (98.4%) restent expliquees par un **contexte insuffisant** (article/corpus gold absent ou extrait juge insuffisant).
- Les cas **C/D/E** sont minoritaires dans cette heuristique.

## 11. Prochaine etape recommandee

- Prioriser encore le **contexte** (retrieval/rerank/filter) sur les cas A avant d optimiser la generation.
- Ne pas relancer un E2E 500 complet pour cette analyse; cibler replays offline ou smoke sur les IDs B les plus frequents.

