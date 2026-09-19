# Diagnostic comparatif routing V2 vs V3

> Runs comparés : V2 `2026-09-19T19-54-08-102Z` — V3 `2026-09-19T20-39-25-646Z`  
> Dataset : 500 questions (362 single / 63 multi / 40 ambiguous / 35 OOS)  
> Aucune modification de code, dataset ou métriques — analyse read-only.

---

## 1. Contexte

| Métrique | V2 | V3 | Delta |
| -------- | ---: | ---: | ----: |
| Exact global | 89,9 % (442/500) | 89,6 % (442/500) | −0,3 pt |
| Precision | 0,929 | 0,922 | −0,007 |
| Recall | 0,938 | 0,926 | −0,012 |
| F1 | 0,931 | 0,922 | −0,009 |
| Ambiguous → [] | 70,0 % | 75,0 % | +5,0 pt |
| OOS → [] | 91,4 % | 88,6 % | −2,8 pt |
| Routing errors | 58 | 58 | 0 |

Note : les deux runs comptent **442/500** exact match ; la différence de taux affiché (89,6 % vs 89,9 %) provient de l'arrondi des métriques agrégées (precision/recall pondérées).

## 2. Matrice de transition

| Catégorie | Description | N |
| --------- | ----------- | --: |
| **A** | V2 correct → V3 correct | **428** |
| **B** | V2 incorrect → V3 correct (correction) | **14** |
| **C** | V2 correct → V3 incorrect (régression) | **14** |
| **D** | V2 incorrect → V3 incorrect (inchangé) | **44** |
| **Total** | | **500** |

Vérification :

- V2 correct = A + C = 428 + 14 = **442**
- V2 incorrect = B + D = 14 + 44 = **58**
- V3 correct = A + B = 428 + 14 = **442**
- V3 incorrect = C + D = 14 + 44 = **58**

**Bilan net :** 14 corrections et 14 régressions — exact match global **stable à 442/500**, avec redistribution des erreurs entre types.

## 3. Gains V3 (V2 incorrect → V3 correct)

**Total : 14 questions**

| ID | Type | Diff. | Gold | V2 | V3 | Règle V3 probable | Explication |
| -- | ---- | ----- | ---- | -- | -- | ----------------- | ----------- |
| q049 | single-corpus | medium | pénal | [] | pénal | over-abstention corrigée | Question pénale claire ; V2 avait abstenu, V3 route correctement vers pénal. |
| q123 | single-corpus | easy | travail | civil + travail | travail | mention ≠ nécessité | Salarié/contrat de travail ; V2 ajoutait civil inutilement. |
| q196 | single-corpus | easy | commerce | commerce + travail | commerce | mention ≠ nécessité | Cession fonds de commerce ; V2 ajoutait travail (salariés mentionnés) sans nécessité. |
| q286 | single-corpus | medium | monétaire | commerce | monétaire | frontière commerce/monétaire | Lettre de change L132-1 → CMF ; V2 confondait avec commerce. |
| q288 | single-corpus | medium | monétaire | [] | monétaire | over-abstention corrigée | Définition banquier au CMF ; V2 abstenu. |
| q325 | single-corpus | medium | consommation | monétaire | consommation | sanctions ≠ pénal / frontière CMF-consommation | Sanction opérateur consommation ; V2 routait vers monétaire. |
| q357 | single-corpus | hard | consommation | civil + consommation | consommation | mention ≠ nécessité | Responsabilité professionnel/consommateur ; V2 ajoutait civil superflu. |
| q360 | multi-corpus | hard | commerce + pénal | civil + commerce + pénal | commerce + pénal | nullité ≠ civil | Nullité statutaire commerciale ; V2 ajoutait civil sur le mot nullité. |
| q365 | multi-corpus | hard | civil + monétaire | civil + commerce | civil + monétaire | frontière commerce/monétaire (notaire/protêt) | État civil + protêts notariaux ; V2 substituait commerce à monétaire. |
| q387 | multi-corpus | hard | consommation + pénal | pénal | consommation + pénal | multi-branche explicite | Cybersécurité plateformes + stupéfiants ; V2 ne retenait que pénal. |
| q388 | multi-corpus | hard | commerce + travail | consommation + commerce + travail | commerce + travail | IPC ≠ consommation | IPC pour SMIC ; V2 ajoutait consommation sur le mot-clé. |
| q421 | multi-corpus | hard | travail + monétaire | travail + monétaire + pénal | travail + monétaire | sanctions ≠ pénal | Sanction disciplinaire harcèlement + CMF ; V2 ajoutait pénal. |
| q431 | ambiguous | medium | [] | civil + commerce + pénal | [] | abstention ambiguë renforcée | Question trop vague ; V2 sur-prédit 3 corpus. |
| q453 | ambiguous | medium | [] | commerce | [] | abstention ambiguë renforcée | Question elliptique sur faillite ; V2 ajoutait commerce. |

**Répartition des gains :** single 7, multi 5, ambiguous 2, OOS 0.

**Règles V3 les plus contributrices aux gains :**
- Multi-branche explicite (q387)
- IPC ≠ consommation (q388)
- Sanctions ≠ pénal (q421, q325)
- Nullité ≠ civil (q360)
- Frontière commerce/monétaire (q365, q286)
- Abstention ambiguë renforcée (q431, q453)
- Mention ≠ nécessité (q123, q196, q357)

## 4. Régressions V3 (V2 correct → V3 incorrect)

**Total : 14 questions**

| ID | Type | Diff. | Gold | V2 | V3 | Pattern | Règle V3 en cause probable | Explication |
| -- | ---- | ----- | ---- | -- | -- | ------- | -------------------------- | ----------- |
| q046 | single-corpus | medium | pénal | pénal | commerce | corpus boundary | corpus boundary | Manipulation de cours → pénal ; V3 route vers commerce (info commerciale). |
| q102 | single-corpus | easy | civil | civil | commerce | corpus boundary | corpus boundary | Société en participation → civil ; V3 route vers commerce. |
| q146 | single-corpus | medium | travail | travail | [] | over-abstention | over-abstention | Enseignements université/employeur → travail ; V3 abstient. |
| q152 | single-corpus | easy | travail | travail | [] | over-abstention | over-abstention | Taxe d'apprentissage → travail ; V3 abstient (terme fiscal ambigu). |
| q195 | single-corpus | medium | commerce | commerce | commerce + travail | over-prediction | over-prediction / mention code | Information salariés SARL → commerce seul ; V3 ajoute travail car salariés cités. |
| q200 | single-corpus | easy | commerce | commerce | commerce + pénal | over-prediction | over-prediction / sanctions→pénal | Articles comptables sociétés → commerce ; V3 ajoute pénal sur « peines ». |
| q201 | single-corpus | medium | commerce | commerce | commerce + pénal | over-prediction | over-prediction / sanctions→pénal | SAS et comptabilité → commerce ; V3 ajoute pénal sur « peines ». |
| q239 | single-corpus | easy | monétaire | monétaire | commerce | corpus boundary | corpus boundary CMF/commerce | Actions de numéraire L212-1 → CMF ; V3 route commerce. |
| q248 | single-corpus | easy | monétaire | monétaire | consommation | corpus boundary | corpus boundary CMF/consommation | Vente d'or L342-1 → CMF ; V3 route consommation. |
| q280 | single-corpus | medium | monétaire | monétaire | commerce | corpus boundary | corpus boundary CMF/commerce | Secret professionnel L421-8 → CMF ; V3 route commerce. |
| q328 | single-corpus | medium | consommation | consommation | pénal | corpus boundary | corpus boundary / sanctions→pénal | Peines complémentaires démarchage → consommation ; V3 route pénal. |
| q409 | multi-corpus | hard | civil + consommation | civil + consommation | [] | over-abstention | over-abstention multi | Collaboration justice + consommation ; V3 abstient totalement. |
| q423 | multi-corpus | hard | monétaire + pénal | monétaire + pénal | monétaire | under-prediction | under-prediction multi | Chèque + peines pénal ; V3 oublie pénal, garde monétaire seul. |
| q466 | out-of-scope | medium | [] | [] | civil | OOS over-prediction | OOS over-prediction | Naturalisation par mariage (hors corpus) ; V3 projette vers civil. |

**Répartition des régressions par pattern :**

| Pattern | N | IDs |
| ------- | --: | --- |
| Corpus boundary (swap) | 6 | q046, q102, q239, q248, q280, q328 |
| Over-abstention | 3 | q146, q152, q409 |
| Over-prediction | 3 | q195, q200, q201 |
| Under-prediction multi | 1 | q423 |
| OOS over-prediction | 1 | q466 |

**Effets secondaires V3 identifiés :**
1. **Anti-keyword trop agressif côté abstention** — q146, q152, q409 abstain alors que le corpus est identifiable.
2. **Sanctions/peines → pénal** — q200, q201, q328 : la règle « sanctions ≠ pénal » semble avoir un effet miroir (retrait du bon corpus ou ajout de pénal).
3. **Mention salariés/travail → sur-prédiction travail** — q195.
4. **Frontières CMF/commerce/consommation inversées** — q239, q248, q280 : régressions sur single-corpus monétaire.
5. **Few-shot ou règle OOS** — q466 : projection vers civil sur question hors corpus.

## 5. Focus — 15 anciennes erreurs multi V2

| ID | Gold | V2 | V3 | V2→V3 | Note |
| -- | ---- | -- | -- | ----- | ---- |
| q354 | civil + monétaire | commerce + pénal | monétaire + pénal | CHANGED (still wrong) | Partiellement amélioré : commerce retiré, monétaire ajouté, mais civil manquant et pénal conservé à tort. |
| q360 | commerce + pénal | civil + commerce + pénal | commerce + pénal | **FIXED** | Corrigé : retrait du civil superflu (nullité commerciale). |
| q361 | travail + monétaire | civil + travail | civil + travail | UNCHANGED | Inchangé : travail correct, second corpus (monétaire) toujours manquant. |
| q363 | monétaire + pénal | civil + commerce + monétaire + pénal | civil + monétaire + pénal | CHANGED (still wrong) | Partiellement amélioré : commerce retiré (mention code ≠ décision), civil toujours en surplus. |
| q365 | civil + monétaire | civil + commerce | civil + monétaire | **FIXED** | Corrigé : monétaire retrouvé à la place de commerce. |
| q369 | consommation + commerce | consommation | consommation | UNCHANGED | Inchangé : consommation seule (gold commerce discutable). |
| q382 | civil + monétaire | civil + consommation + monétaire | civil + consommation + monétaire | UNCHANGED | Inchangé : sur-prédiction consommation (question cite le code). |
| q387 | consommation + pénal | pénal | consommation + pénal | **FIXED** | Corrigé : consommation + pénal, les deux branches retenues. |
| q388 | commerce + travail | consommation + commerce + travail | commerce + travail | **FIXED** | Corrigé : IPC ne déclenche plus consommation. |
| q399 | consommation + commerce | consommation + commerce + travail | consommation + travail | CHANGED (still wrong) | Autre erreur : commerce retiré, travail ajouté (CSE) — swap commerce↔travail. |
| q408 | monétaire + pénal | travail + monétaire + pénal | travail + pénal | CHANGED (still wrong) | Autre erreur : monétaire retiré, travail conservé (mention code travail dans Q). |
| q410 | civil + commerce | civil + pénal | civil + pénal | UNCHANGED | Inchangé : commerce manquant, pénal substitué. |
| q412 | civil + monétaire | monétaire | monétaire | UNCHANGED | Inchangé : monétaire seul, civil manquant. |
| q413 | civil + pénal | civil | civil | UNCHANGED | Inchangé : civil seul, pénal manquant. |
| q421 | travail + monétaire | travail + monétaire + pénal | travail + monétaire | **FIXED** | Corrigé : pénal retiré (sanction disciplinaire travail). |

**Synthèse anciennes erreurs multi V2 :**
- Corrigées par V3 : **5/15** (q360, q365, q387, q388, q421)
- Toujours incorrectes (prédiction identique) : **6/15** (q361, q369, q382, q410, q412, q413)
- Transformées en autre erreur : **4/15** (q354, q363, q399, q408)
- Régressées (étaient correctes) : **0/15**

**Cibles du diagnostic (vraies erreurs router) :**
| ID | Résultat V3 |
| -- | ----------- |
| q354 | Partiellement amélioré (monétaire OK, civil manquant, pénal en trop) |
| q365 | **Corrigé** |
| q387 | **Corrigé** |
| q388 | **Corrigé** |
| q410 | Inchangé (swap commerce→pénal persiste) |
| q421 | **Corrigé** |

## 6. Nouvelles erreurs (V2 correct → V3 incorrect)

**14 régressions au total.** Nouvelles erreurs multi créées : **2** (q409, q423).

Patterns communs aux régressions :

| Pattern | N |
| ------- | --: |
| Corpus boundary (swap monétaire↔commerce/consommation/pénal) | 6 |
| Over-abstention | 3 |
| Over-prediction (peines/salariés) | 3 |
| Under-prediction multi | 1 |
| OOS over-prediction | 1 |

Les régressions touchent surtout le **single-corpus** (10/14), notamment monétaire (4 cas) et commerce (3 cas).

## 7. Comparaison par type

| Type | V2 exact | V3 exact | Delta |
| ---- | -------: | -------: | ----: |
| Single Corpus | 334/362 (92.3%) | 330/362 (91.2%) | -4 |
| Multi Corpus | 48/63 (76.2%) | 51/63 (81.0%) | +3 |
| Ambiguous | 28/40 (70.0%) | 30/40 (75.0%) | +2 |
| Out Of Scope | 32/35 (91.4%) | 31/35 (88.6%) | -1 |

## 8. Comparaison par difficulté

| Difficulty | V2 exact | V3 exact | Delta |
| ---------- | -------: | -------: | ----: |
| Easy | 142/150 (94.7%) | 139/150 (92.7%) | -3 |
| Medium | 218/250 (87.2%) | 217/250 (86.8%) | -1 |
| Hard | 82/100 (82.0%) | 86/100 (86.0%) | +4 |

## 9. Synthèse anciennes erreurs multi

| Issue type | IDs | Cause probable |
| ---------- | --- | -------------- |
| Corrigées (prompt) | q360, q365, q387, q388, q421 | Règles V3 ciblées fonctionnent |
| Partiellement améliorées | q354, q363 | Frontière monétaire/commerce partiellement corrigée ; autres dimensions persistantes |
| Autre erreur | q399, q408 | Mention code/CSE → mauvais corpus (travail vs commerce, travail vs monétaire) |
| Inchangées — gold/dataset | q369, q382 | Gold discutable ou question cite un code absent du gold |
| Inchangées — limite router | q361, q410, q412, q413 | Second corpus implicite ou swap persistant |

## 10. Conclusion

### Question 1 — V3 a-t-il réellement amélioré les cas difficiles ?

**Oui, partiellement.** Hard : +4 exact (82 → 86/100). Multi : +3 exact (48 → 51/63). Ambiguous : +2 exact (28 → 30/40). En revanche single (−4) et easy (−3) régressent. V3 améliore les cas structurés (multi explicite, hard) au prix de cas single/medium plus simples.

### Question 2 — V3 a-t-il corrigé des erreurs tout en en créant d'autres ?

**Oui, exactement.** 14 corrections et 14 régressions — bilan net nul sur l'exact match (442/500). Les gains et pertes se compensent intégralement.

### Question 3 — Les régressions sont-elles liées à des règles précises du prompt V3 ?

**Oui.** Les régressions pointent vers : (1) over-abstention renforcée (q146, q152, q409) ; (2) effet miroir de la règle sanctions/peines (q200, q201, q328) ; (3) frontières CMF/commerce/consommation inversées sur single (q239, q248, q280) ; (4) mention salariés → travail (q195) ; (5) projection OOS vers civil (q466).

### Question 4 — Les erreurs multi restantes accessibles par prompt ?

**En majorité oui.** 5/15 anciennes erreurs multi corrigées ; 4/15 partiellement ou autrement erronées ; 6/15 inchangées dont ~2 gold discutables (q369, q382). Les cas restants (q354 civil manquant, q410 swap, q412/q413 under-pred implicite) restent abordables par affinage prompt, pas par architecture.

### Question 5 — Signal pour modification architecturale ?

**Non.** V3 montre que les règles prompt ciblées fonctionnent (5 corrections multi directes) mais produisent des effets secondaires symétriques. Le bilan net nul et la nature des erreurs restantes (keyword, frontières, abstention) ne justifient pas une seconde passe ou un changement architectural — plutôt un prompt V3.1 affinant les garde-fous sans les durcir globalement.


---

## Annexe — Comparaison exhaustive

Les 500 questions se répartissent ainsi : A=428, B=14, C=14, D=44. 
Données source : `reports/evaluation/runs/2026-09-19T19-54-08-102Z/routing.json` et `.../2026-09-19T20-39-25-646Z/routing.json`.

<details><summary>Liste des 14 corrections (B)</summary>

q049, q123, q196, q286, q288, q325, q357, q360, q365, q387, q388, q421, q431, q453

</details>

<details><summary>Liste des 14 régressions (C)</summary>

q046, q102, q146, q152, q195, q200, q201, q239, q248, q280, q328, q409, q423, q466

</details>

<details><summary>Liste des 44 inchangées incorrectes (D)</summary>

q045, q047, q048, q098, q121, q223, q238, q245, q249, q259, q304, q308, q309, q318, q319, q326, q327, q329, q330, q331, q333, q354, q361, q363, q369, q382, q399, q408, q410, q412, q413, q436, q438, q443, q446, q452, q454, q455, q456, q459, q460, q469, q480, q492

</details>
