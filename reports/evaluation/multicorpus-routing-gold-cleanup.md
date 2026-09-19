# Nettoyage du benchmark multi-corpus

> Nettoyage effectué le 2026-09-19 à partir de `reports/evaluation/multicorpus-routing-gold-audit.md`. Aucune modification du router, des prompts, du pipeline retrieval ou E2E.

## 1. Résumé avant / après

| Métrique | Avant | Après |
| -------- | ----: | ----: |
| Total questions | 500 | 500 |
| Single-corpus | 350 | 362 |
| Multi-corpus | 75 | 63 |
| Ambiguous | 40 | 40 |
| Out-of-scope | 35 | 35 |
| GoldArticles (total) | 504 | 492 |
| Questions modifiées | — | 12 |

**GoldArticles supprimés :** 12

## 2. Modifications effectuées

| ID | Avant | Après | Modification | Justification |
| -- | ----- | ----- | ------------ | ------------- |
| q351 | civil + consommation (multi-corpus) | civil (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Une seule dimension (référé/vie privée) ; L112-8 consommation non suggéré par la question (contrairement à q356/q424). |
| q357 | consommation + pénal (multi-corpus) | consommation (single-corpus) | REMOVE_CORPUS_FROM_GOLD → single | Question entièrement consommation ; art. 132-12 pénal (récidive personne morale) sans lien. |
| q358 | commerce + travail (multi-corpus) | travail (single-corpus) | RECLASSIFY_AS_SINGLE | Question entièrement travail ; L124-12 commerce (coopératives) sans lien sémantique. |
| q359 | commerce + monétaire (multi-corpus) | commerce (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Commerce explicite ; recours L163-9 CMF (chèque) non inferrable depuis « recours en cas de non-respect ». |
| q368 | civil + pénal (multi-corpus) | civil (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | État civil explicite ; art. 132-40 pénal (sursis probatoire) ajouté artificiellement. |
| q370 | consommation + travail (multi-corpus) | travail (single-corpus) | RECLASSIFY_AS_SINGLE | Question entièrement travail ; L121-16 consommation (numéro surtaxé) sans rapport. |
| q389 | commerce + monétaire (multi-corpus) | commerce (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Ventes enchères commerce explicite ; L313-6 CMF (fichier incidents) non identifiable depuis la question. |
| q390 | commerce + pénal (multi-corpus) | commerce (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Commerce explicite ; R321-10 pénal = renvoi réglementaire miroir sans ancre dans la question. |
| q391 | travail + monétaire (multi-corpus) | travail (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Agents contrôle sécurité travail explicite ; L315-8-1 CMF (accessibilité monnaie) sans lien textuel. |
| q393 | monétaire + pénal (multi-corpus) | monétaire (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | CMF explicite dans la question ; R624-2 pénal (contravention décence) sans lien avec pouvoirs agents finance. |
| q404 | commerce + monétaire (multi-corpus) | commerce (single-corpus) | REVIEW → RECLASSIFY_AS_SINGLE | Société à mission/greffier = commerce ; L224-3 CMF (PER) ajouté artificiellement (override doc). |
| q405 | commerce + pénal (multi-corpus) | commerce (single-corpus) | REMOVE_CORPUS_FROM_GOLD → single | Question société à mission/commerce ; art. 222-19-1 pénal (accident route) sans aucun lien. |

### Détail des goldArticles retirés

| ID | Corpus retiré | Article retiré |
| -- | ------------- | -------------- |
| q351 | consommation | L112-8 |
| q357 | pénal | 132-12 |
| q358 | commerce | L124-12 |
| q359 | monétaire | L163-9 |
| q368 | pénal | 132-40 |
| q370 | consommation | L121-16 |
| q389 | monétaire | L313-6 |
| q390 | pénal | R321-10 |
| q391 | monétaire | L315-8-1 |
| q393 | pénal | R624-2 |
| q404 | monétaire | L224-3 |
| q405 | pénal | 222-19-1 |

### Réponses de référence ajustées

Les 12 questions modifiées ont eu leur `referenceAnswer` tronquée pour retirer les passages relatifs aux corpus gold supprimés (cohérence post-nettoyage).

## 3. Cas conservés malgré REVIEW_MANUALLY

### q413

- **Corpus concernés :** civil + pénal
- **Pourquoi le gold est conservé :** La question comporte deux branches explicites : preuve des actes d'état civil (art. 46 civil) et « application immédiate des lois nouvelles » (art. 112-4 pénal). Les deux dimensions sont dans le texte.
- **Validité :** Multi-corpus défendable malgré le caractère transversal de 112-4, car la formulation interroge directement l'effet des lois nouvelles sur la validité des actes.

Les 8 autres cas REVIEW_MANUALLY (q351, q359, q368, q389, q390, q391, q393, q404) ont été modifiés — voir section 2.

## 4. Impact sur le benchmark

### Distribution single / multi / ambiguous / OOS

| Type | Avant | Après | Δ |
| ---- | ----: | ----: | --: |
| single-corpus | 350 | 362 | +12 |
| multi-corpus | 75 | 63 | -12 |
| ambiguous | 40 | 40 | 0 |
| out-of-scope | 35 | 35 | 0 |

### Single-corpus par corpus

| Corpus | Avant | Après | Δ |
| ------ | ----: | ----: | --: |
| pénal | 58 | 58 | 0 |
| civil | 58 | 60 | +2 |
| travail | 58 | 61 | +3 |
| commerce | 58 | 63 | +5 |
| monétaire | 59 | 60 | +1 |
| consommation | 59 | 60 | +1 |

### GoldArticles

| Métrique | Avant | Après |
| -------- | ----: | ----: |
| Total goldArticles | 504 | 492 |
| Entrées multi (≥2 corpus) | 75 questions | 63 questions |

### Principales paires multi-corpus (après nettoyage)

| Paire | Avant | Après |
| ----- | ----: | ----: |
| civil + commerce | 6 | 6 |
| civil + consommation | 6 | 5 |
| civil + pénal | 6 | 5 |
| civil + monétaire | 5 | 5 |
| pénal + travail | 5 | 5 |
| commerce + consommation | 5 | 5 |
| consommation + pénal | 5 | 4 |
| monétaire + travail | 5 | 4 |
| monétaire + pénal | 5 | 4 |
| consommation + travail | 5 | 4 |
| consommation + monétaire | 4 | 4 |
| commerce + pénal | 5 | 3 |
| commerce + travail | 4 | 3 |
| civil + travail | 3 | 3 |
| commerce + monétaire | 5 | 2 |

### Quotas de validation mis à jour

Les constantes `MULTICORPUS_DATASET_QUOTAS` et `MULTICORPUS_SINGLE_CORPUS_QUOTAS` ont été ajustées pour refléter la distribution réelle post-nettoyage (362/63/40/35).

Les overrides manuels `q390` et `q404` ont été retirés de `multicorpus-gold-article-overrides.ts` (gold artificiel supprimé du dataset).

## 5. Validation

| Commande | Résultat |
| -------- | -------- |
| `pnpm validate:evaluation:multicorpus` | OK — 500 questions, Valid: yes, Distribution issues: 0 |
| `pnpm test` | OK — 87 fichiers passés, 419 tests passés (13 skipped) |
| `pnpm build` | OK — `nest build` sans erreur |
