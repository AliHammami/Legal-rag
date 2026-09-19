# Validation finale du dataset multi-corpus

> Verification independante effectuee le 2026-09-19 sur `data/evaluation/legal-multicorpus.questions.json` apres nettoyage documente dans `multicorpus-routing-gold-cleanup.md`. Aucune modification du dataset ni du code.

## 1. Resume structurel

### Comptages verifies

| Metrique | Attendu (post-nettoyage) | Mesure | Statut |
| -------- | ------------------------: | -----: | ------ |
| Total questions | 500 | **500** | OK |
| Single-corpus | 362 | **362** | OK |
| Multi-corpus | 63 | **63** | OK |
| Ambiguous | 40 | **40** | OK |
| Out-of-scope | 35 | **35** | OK |
| GoldArticles (total) | 563* | **492** | Ecart documente |

\* Le chiffre « 563 » du brief ne correspond pas au fichier reel. Le rapport de nettoyage documente **504 -> 492** (-12). Decomposition mesuree :

- Single-corpus : **365** goldArticles (362 questions ; q022, q334 et q348 ont chacune 2 gold)
- Multi-corpus : **127** goldArticles (62 questions x 2 gold + q353 x 3 gold)
- Ambiguous / OOS : **0**
- **Total = 492**

Le validateur officiel (`pnpm validate:evaluation:multicorpus`) confirme **Valid: yes**, **Distribution issues: 0**.

### Controles structurels

| Controle | Resultat |
| -------- | -------- |
| IDs uniques | OK (500 IDs, 0 doublon) |
| Schema (champs requis) | OK |
| corpusIds valides | OK |
| articleNumbers non vides | OK |
| goldArticles existent dans l'index corpus | OK (`pnpm validate`) |
| goldCorpusIds coherents avec goldArticles | OK |
| Single = exactement 1 corpus | OK |
| Multi = au moins 2 corpus distincts | OK |
| Ambiguous / OOS sans gold | OK |
| sourceArticles incluent goldArticles | OK |
| Doublons goldArticles intra-question | OK (aucun) |

**Resultat `pnpm validate:evaluation:multicorpus` :** Valid: yes — 500 questions, 0 issue.

---

## 2. Validation des 12 questions modifiees

Pour chaque question : le **texte de la question** n'a pas ete altere lors du nettoyage (seuls gold, type et referenceAnswer ont change). Verification par relecture ciblee + coherence avec le rapport de nettoyage.

| ID | Question inchangee | Corpus conserve justifie | Gold coherent | ReferenceAnswer coherente | Verdict |
| -- | ------------------ | ------------------------ | ------------- | ------------------------- | ------- |
| q351 | Oui | Oui — refeere / vie privee -> civil (art. 9) | Oui — civil seul, consommation retiree | Oui — ne cite plus L112-8 ni consommation | **PASS** |
| q357 | Oui | Oui — exoneration contrat a distance -> consommation | Oui — L221-15 seul, penal retire | Oui — ne cite plus 132-12 | **PASS** |
| q358 | Oui | Oui — prescription contrat de travail -> travail | Oui — L1471-1 seul, commerce retire | Oui — ne cite plus L124-12 ni commerce | **PASS** |
| q370 | Oui | Oui — declaration preretraite -> travail | Oui — L1221-18 seul, consommation retiree | Oui — ne cite plus L121-16 | **PASS** |
| q405 | Oui | Oui — referent mission -> commerce | Oui — L210-12 seul, penal retire | Oui — ne cite plus 222-19-1 ni penal | **PASS** |
| q359 | Oui | Oui — structures GIE commercants + recours -> commerce (L124-15) | Oui — commerce seul, CMF retire | Oui — ne cite plus L163-9 / cheque | **PASS** |
| q368 | Oui | Oui — changement de nom -> civil (61-3-1) | Oui — civil seul, penal retire | Oui — ne cite plus 132-40 / sursis | **PASS** |
| q389 | Oui | Oui — ventes encheres biens neufs -> commerce (L321-1) | Oui — commerce seul, CMF retire | Oui — ne cite plus L313-6 | **PASS** |
| q390 | Oui | Oui — organisation ventes encheres / notaires -> commerce | Oui — L321-2 seul, penal retire | Oui — ne cite plus R321-10 | **PASS** |
| q391 | Oui | Oui — agents controle securite travail -> travail | Oui — L4311-6 seul, CMF retire | Oui — ne cite plus L315-8-1 CMF | **PASS** |
| q393 | Oui | Oui — agents infractions CMF -> monetaire (L317-1) | Oui — CMF seul, penal retire | Oui — ne cite plus R624-2 | **PASS** |
| q404 | Oui | Oui — societe a mission / greffier -> commerce | Oui — L210-10 seul, CMF retire | Oui — ne cite plus L224-3 PER | **PASS** |

**Bilan : 12/12 PASS.** Aucune troncature de `referenceAnswer` n'a supprime d'information pertinente pour le corpus conserve ; seuls les passages relatifs aux corpus retires ont ete enleves.

---

## 3. Validation de q413

**Question :** « Comment prouver des actes d'etat civil en l'absence ou la perte des registres officiels, et comment l'application immediate des lois nouvelles affecte-t-elle la validite de ces actes ? »

**Gold :** civil (46) + penal (112-4) — `multi-corpus` OK

**Dimensions identifiables dans la formulation :**

1. **Preuve des actes d'etat civil** en l'absence/perte des registres -> **code civil** (art. 46).
2. **Application immediate des lois nouvelles** et effet sur la validite des actes -> **code penal** (art. 112-4, principe d'application dans le temps).

Les deux branches sont explicitement posees dans la question (« et comment l'application immediate… »). Aucun troisieme corpus gold. Les deux goldArticles sont ancres dans le texte, pas dans une information cachee de l'article seul.

**Verdict q413 :** conservee a bon escient en multi — **PASS**.

---

## 4. Validation des 63 multi restantes

Audit question-first (formulation -> dimensions -> corpus), sans raisonnement circulaire depuis les goldArticles.

### Statistiques de classification

| Classification | Nombre | % |
| -------------- | -----: | --: |
| VALID_MULTI | 57 | 90,5 % |
| VALID_MULTI_BUT_IMPLICIT | 4 | 6,3 % |
| QUESTIONABLE | 2 | 3,2 % |
| INVALID | 0 | 0 % |

### Questions problematiques

| ID | Classification | Probleme |
| -- | -------------- | -------- |
| **q353** | QUESTIONABLE | **2 dimensions explicites** (concours a la justice -> civil ; solidarite employeur -> travail) mais **3 corpus gold** incluant **monetaire L131-62** (protest cheque) **non inferrable** depuis la question. Relique non corrigee du nettoyage. |
| **q364** | QUESTIONABLE | Juxtaposition artificielle presomption d'innocence (civil) + immatriculation commercant (commerce) ; lien thematique faible dans une seule phrase. |

### VALID_MULTI_BUT_IMPLICIT (acceptables avec prudence)

| ID | Note |
| -- | ---- |
| q361 | Travail explicite ; CMF (L213-19) via responsabilite dirigeants associations — implicite |
| q369 | Consommation explicite (L121-16) ; commerce (L125-19) = norme miroir GIE peu identifiable |
| q382 | Gold = civil + monetaire ; la question **mentionne** aussi la consommation (L315-1) mais **absente du gold** — pas de gold artificiel, asymetrie mineure |
| q412 | Cheque -> CMF explicite ; art. 33 civil (adaptation outre-mer) secondaire, non nomme |

### Echantillon VALID_MULTI (non exhaustif)

q352, q354-q356, q360, q362-q363, q365-q367, q371-q388, q392, q394-q411, q413-q425 : deux dimensions explicites ou codes/articles cites directement — routing multi testable.

---

## 5. Controle des single (362)

Controle cible (pas d'audit juridique exhaustif) :

- **362/362** respectent la regle « 1 corpus, au moins 1 gold ».
- Scan heuristique : questions mentionnant **2 codes ou plus** dans le libelle mais classees single -> **0 anomalie manifeste** (q306 mentionne le code du travail comme *objet* d'une regle de renvoi en consommation L351-2 — single consommation defendable).
- Les **12 questions reclassifiees** (section 2) : corpus gold aligne avec la dimension unique identifiable.

**Anomalies evidentes detectees : 0** (hors reserves mineures pre-existantes hors scope multi).

---

## 6. Controle ambiguous / OOS

| Type | N | goldArticles | goldCorpusIds | Anomalies |
| ---- | --: | ------------ | ------------- | --------- |
| ambiguous | 40 | tous vides | tous vides | **0** |
| out-of-scope | 35 | tous vides | tous vides | **0** |

Relecture echantillon : questions hors perimetre juridique codifie (OOS) ou trop vagues / multi-interpretation (ambiguous) — coherent avec la classification. Aucun gold cache.

---

## 7. Analyse des dimensions (63 multi)

| Pattern | Nombre | Interpretation |
| ------- | -----: | -------------- |
| 2 dimensions **explicites** dans la formulation | **57** | Benchmark routing par dimensions directement applicable |
| Au moins 2 dimensions dont **au moins 1 implicite** | **4** | Testable ; plafond de recall attendu plus bas |
| **2e corpus / dimension difficile** a identifier | **2** | q353 (CMF), q364 (commerce faiblement lie) |
| QUESTIONABLE | **2** | Voir section 4 |
| INVALID | **0** | — |

**Pertinence pour un routing par dimensions :**

- **~57/63 (90 %)** des multi restantes sont adaptees a un benchmark routing multi explicite.
- **~4/63 (6 %)** restent utilisables en « hard » (implicit).
- **~2/63 (3 %)** devraient etre revues avant d'etre comptees dans la metrique stricte (q353 prioritaire).

Le nettoyage a retire les cas les plus graves (12 reclassifications) ; il reste **q353** comme principal reliquat non traite.

---

## 8. Verdict final

### `DATASET_NEEDS_REVIEW`

**Motif :** le dataset est structurellement valide et largement coherent semantiquement, mais **2 questions multi** meritent une revue avant un benchmark routing strict :

| ID | Priorite | Raison |
| -- | -------- | ------ |
| **q353** | **Haute** | 3 corpus gold pour 2 dimensions ; CMF (L131-62) non deductible de la question — meme pattern que les 12 cas corriges |
| **q364** | Moyenne | Juxtaposition civil/commerce faiblement connectee ; routing multi ambigu |

**Recommandation :** le benchmark routing **peut etre relance** en l'etat pour une **mesure exploratoire**, avec exclusion ou marquage `hard` de q353 et q364 dans l'analyse des resultats. Pour une **metrique stricte multi-corpus**, corriger q353 (retirer CMF ou reecrire) avant comparaison V1/V2.

---

## 9. Verifications techniques

| Commande | Resultat |
| -------- | -------- |
| `pnpm validate:evaluation:multicorpus` | **OK** — Valid: yes, Distribution issues: 0 |
| `pnpm test` | **OK** — 87 fichiers, 419 tests passes (13 skipped) |
| `pnpm build` | **OK** — `nest build` sans erreur |

**Benchmark routing non relance** (conformement aux consignes).

---

## Fichiers touches par cette verification

| Fichier | Modifie |
| ------- | ------- |
| `reports/evaluation/multicorpus-routing-dataset-validation.md` | **Cree** (seul fichier de cette verification) |
| `data/evaluation/legal-multicorpus.questions.json` | **Non modifie** |
| Router / prompts / pipeline / types / quotas / overrides / production | **Non modifies** |
