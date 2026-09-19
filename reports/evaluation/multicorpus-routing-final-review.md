# Revue finale q353 / q364

> Revue effectuee le 2026-09-19. Methode : `question -> dimensions -> corpus` (sans raisonnement circulaire depuis goldArticles).

---

## q353

### Question (inchangee)

ÿ Quelles sont les obligations imposees a une personne en ce qui concerne son concours a la justice, et dans quelles conditions un nouvel employeur est-il solidairement responsable du dommage cause par la rupture abusive d'un contrat de travail? ÿ

### Dimensions identifiables dans la formulation

1. **Concours a la justice** ÿ obligations d'une personne vis-a-vis de la justice.
2. **Solidarite du nouvel employeur** en cas de rupture abusive d'un contrat de travail.

Deux sous-questions explicites jointes par ÿ et ÿ, chacune ancrant un regime juridique distinct.

### Golds avant

| Corpus | Article | Decision |
| ------ | ------- | -------- |
| code-civil | 10 | KEEP |
| code-du-travail | L1237-3 | KEEP |
| code-monetaire-et-financier | L131-62 | REMOVE |

### Analyse de chaque gold

| Corpus | Article | Contenu (resume) | Identifiable depuis la question ? | Decision |
| ------ | ------- | ---------------- | --------------------------------- | -------- |
| **civil** | 10 | Obligation de concours a la justice (astreinte / amende civile) | **Oui** ÿ ÿ concours a la justice ÿ est la premiere branche explicite | **KEEP** |
| **travail** | L1237-3 | Solidarite du nouvel employeur en cas de rupture abusive | **Oui** ÿ ÿ nouvel employeur ÿ, ÿ rupture abusive ÿ, ÿ contrat de travail ÿ | **KEEP** |
| **monetaire** | L131-62 | Mentions obligatoires sur les protets de cheque (refus de paiement) | **Non** ÿ aucune mention de cheque, paiement, protet ou finance dans la question | **REMOVE** |

Le gold CMF est une relique du generateur initial : l'article L131-62 traite de formalites sur les protets, sans lien semantique avec le concours a la justice ou la solidarite employeur.

### Decision finale

- **Retirer** `code-monetaire-et-financier` / L131-62 du gold.
- **Conserver** la question en **multi-corpus** (civil + travail).
- **Tronquer** la `referenceAnswer` pour supprimer le paragraphe L131-62.

### Justification

Apres suppression, les deux corpus gold correspondent exactement aux deux dimensions explicites de la question. Aucun troisieme corpus artificiel.

---

## q364

### Question (inchangee)

ÿ Dans le cadre d'une activite commerciale, comment l'immatriculation au registre du commerce influence-t-elle le respect de la presomption d'innocence lorsqu'une personne est publiquement presentee comme coupable avant toute condamnation ? ÿ

### Dimensions identifiables dans la formulation

1. **Presomption d'innocence / atteinte publique** ÿ ÿ respect de la presomption d'innocence ÿ, ÿ publiquement presentee comme coupable avant toute condamnation ÿ.
2. **Immatriculation au registre du commerce** ÿ ÿ activite commerciale ÿ, ÿ immatriculation au registre du commerce ÿ.

Contrairement a une simple juxtaposition de deux questions independantes (pattern q352), q364 pose **une seule interrogation integrative** : l'influence de l'immatriculation sur le respect de la presomption d'innocence dans un contexte commercial.

### Golds avant / apres

| Corpus | Article | Decision |
| ------ | ------- | -------- |
| code-civil | 9-1 | KEEP |
| code-du-commerce | L123-8 | KEEP |

(Aucune modification du dataset pour q364.)

### Analyse de chaque gold

| Corpus | Article | Contenu (resume) | Identifiable depuis la question ? | Decision |
| ------ | ------- | ---------------- | --------------------------------- | -------- |
| **civil** | 9-1 | Mesures en refere (rectification, communiqu?) pour faire cesser une atteinte a la presomption d'innocence | **Oui** ÿ presomption d'innocence et presentation publique comme coupable | **KEEP** |
| **commerce** | L123-8 | Non-immatriculation : pas de qualite de commercant vis-a-vis des tiers, mais responsabilites subsistant | **Oui** ÿ immatriculation registre du commerce, activite commerciale | **KEEP** |

### Decision finale (option A)

- **Conserver** les deux corpus gold et le statut **multi-corpus**.
- Le lien juridique entre les articles dans la `referenceAnswer` est un peu tendu, mais **les deux dimensions sont bien presentes dans la formulation** ; un routeur raisonnable doit identifier civil ET commerce.
- Pas de reclassification single (option B ecartee : les deux themes sont nommes).
- Pas de cas `KEEP_HARD` necessaire : les deux corpus sont explicitement suggeres par le texte.

### Justification

q364 est un multi **integratif** (interaction immatriculation / presomption d'innocence), distinct des juxtapositions artificielles type q351 pre-nettoyage. Le benchmark routing strict peut la conserver.

---

## Impact

| Metrique | Avant revue | Apres revue | Delta |
| -------- | ----------: | ----------: | ----: |
| Total questions | 500 | 500 | 0 |
| Single-corpus | 362 | 362 | 0 |
| Multi-corpus | 63 | 63 | 0 |
| Ambiguous | 40 | 40 | 0 |
| Out-of-scope | 35 | 35 | 0 |
| GoldArticles (total) | 492 | **491** | -1 |

**Modification dataset :** q353 uniquement (retrait L131-62 / CMF). q364 inchangee.

---

## Verdict

### `DATASET_READY_FOR_STRICT_ROUTING_BENCHMARK`

Les deux cas problematiques signales par la validation finale sont resolus :

- **q353** : gold aligne sur les 2 dimensions explicites (civil + travail).
- **q364** : multi conserve, les 2 corpus sont identifiables depuis la question.

Aucune question multi restante ne comporte de corpus gold manifestement non deducible (hors cas implicites deja documentes : q361, q369, q382, q412).

---

## Validation technique

| Commande | Resultat |
| -------- | -------- |
| `pnpm validate:evaluation:multicorpus` | **OK** — Valid: yes, Distribution issues: 0 |
| `pnpm test` | **OK** — 419 tests passes (13 skipped) |
| `pnpm build` | **OK** — `nest build` sans erreur |

Benchmark routing **non relance**.
