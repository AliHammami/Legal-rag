# Diagnostic des 46 erreurs routing — V3.1

> Run : `2026-09-19T21-05-15-572Z`  
> Exact : **92,7 %** (464/500) — Precision 0,942 — Recall 0,941 — F1 0,941  
> Audit read-only — aucune modification de code.

---

## Vérification version V3.1

Le code actuel contient bien les marqueurs V3.1 :
- Règle **Sanction civile** et sanctions délit corpus source
- **Anti-abstention prématurée** (domaines spécialisés)
- Descriptions consommation enrichies (signes qualité/origine)
- Few-shots : sanction civile, délit consommation, nationalité+commerce, signes qualité, chèque peines
- Tests V3.1 dans `router-prompt.spec.ts`

**Conclusion :** la run est analysable comme résultat V3.1 (+3,1 pt vs V3, −2 erreurs vs V3).

## Résumé

46 erreurs analysées.

- **A — Prompt/règle : 25**
- **B — Corpus description : 7**
- **C — Ambiguïté légitime : 3**
- **D — Dataset discutable : 7**
- **E — Structurelle : 4**
- **F — Autre : 0**

Répartition par type de question : single 23, multi 8, ambiguous 10, OOS 5.

## Patterns principaux

1. **Sur-prédiction ambiguous/OOS (15/46)** — 10 ambiguous + 4 OOS→civil + 1 OOS→pénal (q473) : le router choisit un corpus au lieu de `[]`.
2. **Abstention sur articles pénal cités (5/46)** — q011, q040, q045, q047, q049 : numéro d'article sans nom de code → abstention persistante malgré V3.1.
3. **Manipulation/prix → commerce au lieu pénal (2/46)** — q046, q053.
4. **Frontière monétaire ↔ commerce (3/46)** — q238, q239, q280.
5. **Frontière monétaire ↔ consommation (3/46)** — q248, q308, q327 (+ q249 formulation).
6. **Mot « salarié » → sur-prédiction travail (2/46)** — q196 (swap), q217 (over-pred), q419 (multi).
7. **Gold/formulation discutable (6/46)** — q245, q249, q361, q369, q382, q408.
8. **Multi under-pred implicite (2/46)** — q412, q413 (zone grise).
9. **V3.1 gains confirmés** — plus d'abstentions consommation L43x (q318–q333 corrigées), q098/q329/q354/q410/q421 absents des erreurs.

## Tableau des 46 erreurs

| # | ID | Type | Expected | Predicted | Cat. | Cause |
| -: | -- | ---- | -------- | --------- | ---- | ----- |
| 1 | q011 | single | pénal | [] | A | Abstention malgré article pénal cité (713-1) — anti-abstention insuffisante pour art. numérotés pénal |
| 2 | q040 | single | pénal | [] | A | Abstention malgré art. 722-1 pénal cité |
| 3 | q045 | single | pénal | [] | A | Abstention malgré art. 726-1 pénal cité (prélèvement organe) |
| 4 | q046 | single | pénal | commerce | A | Manipulation artificielle des prix → pénal (727-2), router route commerce (mot « prix ») |
| 5 | q047 | single | pénal | [] | A | Abstention malgré art. 712-1 pénal cité |
| 6 | q048 | single | pénal | travail | C | Discrimination santé/handicap embauche/licenciement : pénal 713-3 vs travail — les deux plausibles |
| 7 | q049 | single | pénal | [] | A | Abstention malgré art. 714-1 pénal cité |
| 8 | q053 | single | pénal | commerce | A | Manipulation prix art. 717-2 pénal → router commerce |
| 9 | q102 | single | civil | commerce | B | Société en participation art. 1871 civil → router commerce (frontière civil/commerce) |
| 10 | q121 | single | travail | [] | E | ANSP L7234-1 trop niche ; abstention compréhensible sans connaissance institutionnelle |
| 11 | q146 | single | travail | [] | E | Formation par apprentissage L6233-1 — domaine travail spécialisé, abstention |
| 12 | q152 | single | travail | [] | E | Taxe d'apprentissage — signal travail faible, abstention |
| 13 | q196 | single | commerce | travail | D | Cession titres + salariés : gold commerce L23-11-1 ; router travail défendable (mention salariés) |
| 14 | q217 | single | commerce | commerce+travail | A | Admin salarié SA : gold commerce L225-21-1 seul ; router ajoute travail (mot « salarié ») |
| 15 | q238 | single | monétaire | commerce | B | L231-10 CMF souscriptions fictives → router commerce |
| 16 | q239 | single | monétaire | commerce | B | L212-1 CMF actions numéraire → router commerce |
| 17 | q243 | single | monétaire | [] | E | Plan épargne retrait L221-20 — signal CMF implicite, abstention |
| 18 | q245 | single | monétaire | consommation | D | Question cite L412-13 code consommation ; gold monétaire L323-1 — incohérence formulation |
| 19 | q248 | single | monétaire | consommation | B | Vente d'or L342-1 CMF → router consommation |
| 20 | q249 | single | monétaire | consommation | D | Services financiers + « consommateur » ; gold CMF L343-1 ; router consommation textuellement cohérent |
| 21 | q280 | single | monétaire | commerce | B | Secret professionnel L464-2 CMF → router commerce |
| 22 | q308 | single | consommation | monétaire | B | Publicité établissement crédit L322-2 consommation → router monétaire (mot « crédit ») |
| 23 | q327 | single | consommation | monétaire | B | L433-10 consommation → router monétaire |
| 24 | q361 | multi- | travail+monétaire | civil+travail | D | Travail explicite ; monétaire L213-19 non déductible de la question (gold article-dependent) |
| 25 | q363 | multi- | monétaire+pénal | civil+monétaire+pénal | A | SICAV+pénal : civil superflu ajouté (over-prediction) |
| 26 | q369 | multi- | consommation+commerce | consommation | D | Consommation seule pertinente ; commerce L125-19 sans lien question (gold discutable) |
| 27 | q382 | multi- | civil+monétaire | civil+consommation+monétaire | D | Question cite L315-1 consommation ; gold exclut consommation |
| 28 | q408 | multi- | monétaire+pénal | travail+pénal | D | Question cite travail pour PER ; gold CMF+pénal sans travail |
| 29 | q412 | multi- | civil+monétaire | monétaire | C | Chèque CMF explicite ; civil art. 33 outre-mer implicite — under-pred partial |
| 30 | q413 | multi- | civil+pénal | civil | C | État civil + application lois nouvelles ; pénal 112-4 transversal non explicite |
| 31 | q419 | multi- | commerce+monétaire | travail+monétaire | A | Contrat appui entreprise (commerce) + sanctions investissement CMF ; router ajoute travail |
| 32 | q436 | ambigu | [] | civil | A | Ambiguë (vice consentement) ; router sur-prédit civil au lieu de [] |
| 33 | q438 | ambigu | [] | civil | A | Ambiguë manquement contractuel → civil |
| 34 | q443 | ambigu | [] | consommation | A | Ambiguë garanties légales → consommation |
| 35 | q446 | ambigu | [] | civil | A | Ambiguë nullité objet → civil |
| 36 | q452 | ambigu | [] | consommation | A | Ambiguë publicité prix → consommation |
| 37 | q454 | ambigu | [] | civil | A | Ambiguë clauses limitatives → civil |
| 38 | q455 | ambigu | [] | commerce | A | Ambiguë rupture relations → commerce |
| 39 | q456 | ambigu | [] | civil | A | Ambiguë réparer préjudice → civil |
| 40 | q459 | ambigu | [] | commerce | A | Ambiguë anticoncurrence → commerce |
| 41 | q460 | ambigu | [] | civil | A | Ambiguë droits propriété → civil |
| 42 | q466 | out-of | [] | civil | A | OOS naturalisation → projection civil |
| 43 | q469 | out-of | [] | civil | A | OOS divorce → projection civil |
| 44 | q473 | out-of | [] | pénal | A | OOS garde à vue (CPP hors corpus) → router pénal ; confondre CPP et code pénal |
| 45 | q480 | out-of | [] | civil | A | OOS adoption → projection civil |
| 46 | q492 | out-of | [] | civil | A | OOS tutelle → projection civil |

## Corrections potentielles

### Haute confiance

**Correction #1**
- Pattern : Abstention article pénal numéroté
- Questions : q011,q040,q045,q047,q049
- Cause : Article X cité en contexte infraction/peine → pénal si numéro d'article pénal typique
- Fichier : `router-prompt.ts`
- Type : Règle : citation art. 7xx pénal sans abstention
- Risque régression : Faible
- Pourquoi sûr : 5 cas homogènes, peu de risque sur ambiguous

**Correction #2**
- Pattern : Manipulation artificielle des prix
- Questions : q046,q053
- Cause : Manipulation/diffusion info sur prix de instruments → pénal pas commerce
- Fichier : `router-prompt.ts`
- Type : Garde-fou anti mot « prix »→commerce
- Risque régression : Faible
- Pourquoi sûr : Pattern marchés financiers pénal

**Correction #3**
- Pattern : Ambiguous → abstention renforcée
- Questions : q436–q460 (10)
- Cause : Questions génériques sans code/article → []
- Fichier : `router-prompt.ts`
- Type : Renforcer règle ambigu #5
- Risque régression : Moyen
- Pourquoi sûr : Peut aider q409-like mais risque under-pred legit

**Correction #4**
- Pattern : OOS procédure pénale ≠ code pénal
- Questions : q473
- Cause : Garde à vue / procédure → OOS (CPP absent)
- Fichier : `router-prompt.ts`
- Type : Préciser hors corpus : procédure pénale
- Risque régression : Faible
- Pourquoi sûr : 1 cas, référenceAnswer explicite

**Correction #5**
- Pattern : OOS → pas de projection civil
- Questions : q466,q469,q480,q492
- Cause : Famille/naturalisation/divorce hors périmètre ou trop vague
- Fichier : `router-prompt.ts`
- Type : Renforcer règle OOS #6
- Risque régression : Moyen
- Pourquoi sûr : 4 cas ; risque si questions civil légitimes

**Correction #6**
- Pattern : Over-pred civil sur SICAV multi
- Questions : q363
- Cause : Retirer civil sur questions SICAV+ pénal
- Fichier : `router-prompt.ts`
- Type : Préciser SICAV → monétaire seul (+ pénal si branche)
- Risque régression : Faible
- Pourquoi sûr : 1 cas

### Confiance moyenne

**Correction #1**
- Pattern : CMF ↔ commerce
- Questions : q238,q239,q280
- Cause : Instruments financiers, actions numéraire, secret pro CMF
- Fichier : `corpus-descriptions.ts`
- Type : Affiner frontière CMF/commerce
- Risque régression : Moyen
- Pourquoi sûr : 3 cas, risque swaps inverse

**Correction #2**
- Pattern : CMF ↔ consommation
- Questions : q248,q308,q327
- Cause : Crédit/consommateur/or → distinguer CMF vs consommation
- Fichier : `corpus-descriptions.ts + prompt`
- Type : Règle contextuelle crédit bancaire vs conso
- Risque régression : Moyen
- Pourquoi sûr : Régression q249-like

**Correction #3**
- Pattern : Salarié ≠ travail automatique
- Questions : q217,q419
- Cause : Salarié dans contexte droit des sociétés → commerce
- Fichier : `router-prompt.ts`
- Type : Mention salarié dans SA/commerce
- Risque régression : Moyen
- Pourquoi sûr : q196, q408

**Correction #4**
- Pattern : Pénal vs travail discrimination
- Questions : q048
- Cause : Art. 713-3 pénal malgré embauche
- Fichier : `router-prompt.ts`
- Type : Discrimination pénale prioritaire si art. pénal
- Risque régression : Moyen
- Pourquoi sûr : 1 cas

**Correction #5**
- Pattern : Multi q419 commerce+monétaire
- Questions : q419
- Cause : Contrat appui + sanctions investissement étranger
- Fichier : `router-prompt.ts + example`
- Type : Few-shot commerce+monétaire investissement
- Risque régression : Faible
- Pourquoi sûr : 1 cas nouveau

### À ne pas toucher pour l'instant

- **q245, q249, q382, q408** — incohérences question/gold ; corriger le prompt aggraverait les métriques ou créerait régressions.
- **q361, q369** — gold discutable (second corpus invisible ou mirror article).
- **q412, q413** — under-pred implicite ; risque over-pred civil/pénal.
- **q121, q146, q152, q243** — abstentions niche ; règles générales trop larges.
- **10 ambiguous** — structurellement conçues pour `[]` ; toute règle « si X → civil » les empire.
- **Refonte architecture** — 0 signal sur les 46 restants.

## Conclusion

- **Erreurs corrigeables par prompt/règle (A) : 25** — dont ~15 sur-prédiction ambigu/OOS et ~7 abstention/manipulation prix.
- **Probablement ambigu (C) : 3**
- **Probablement lié au dataset (D) : 7**
- **Structurel / niche (E) : 4**
- **Frontière corpus (B) : 7** — corrigeables via descriptions, risque moyen.
- **Corrections chirurgicales recommandées : 4–6** (abstention art. pénal, manipulation prix, renforcement ambigu/OOS ciblé, CMF/commerce, OOS CPP).
- **Plancher réaliste post-corrections : ~38–42 erreurs (~92–94 %)** si corrections chirurgicales ; les 10 ambiguous + 5 OOS limitent le plafond sans revoir le dataset.
- **V3.1 a fonctionné** : 58→46 erreurs vs V3 ; consommation niche et HIGH fixes validés. Reste surtout ambigu/OOS + abstention pénal + frontières CMF.
