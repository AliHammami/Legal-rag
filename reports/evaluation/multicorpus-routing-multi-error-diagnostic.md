# Diagnostic des erreurs multi-corpus

> Run analysé : `2026-09-19T19-54-08-102Z` — dataset nettoyé (63 multi, 76,2 % exact).  
> Méthode : lecture question-first (`question → dimensions → corpus`), articles gold et contenu réel des articles. Aucune modification du router, du prompt ni du dataset.

---

## 1. Contexte

| Métrique | Valeur |
| -------- | -----: |
| Exact global | 89,9 % (442/500) |
| Exact multi | **76,2 %** (48/63) |
| Erreurs multi | **15** |

Répartition des 15 erreurs par pattern technique :

| Pattern | N | IDs |
| ------- | --: | --- |
| Over-prediction | 7 | q360, q363, q382, q388, q399, q408, q421 |
| Swap | 4 | q354, q361, q365, q410 |
| Under-prediction | 4 | q369, q387, q412, q413 |

---

## 2. Méthodologie

Pour chaque question :

1. Lire la formulation et identifier les **dimensions juridiques** sans regarder le gold.
2. Lire le **contenu des articles gold** (pas seulement le corpus).
3. Comparer à la **prédiction du run** (`report.json`).
4. Classifier : UNDERPREDICTION / OVERPREDICTION / SWAP + cause racine.
5. Attribuer une **catégorie principale** : true router error, gold/dataset, formulation, ambiguïté, frontière de corpus.

Règle centrale : une erreur de métrique n'est une **vraie erreur router** que si le gold est défendable depuis la question seule.

---

## 3. Analyse détaillée des 15 erreurs

### q354

**Question :** Quelles sanctions sont encourues en cas d'altération d'actes d'état civil et quelles obligations ont les notaires et huissiers concernant la tenue et la transmission des protêts?

**Gold :** civil + monétaire  
**Prediction :** commerce + pénal

**Articles gold :**
- civil **52** — altération/faux actes d'état civil ; renvoie aux peines du code pénal
- monétaire **L131-64** — obligation des notaires/huissiers de copie et remise des protêts au greffe

**Articles associés aux corpus prédits :** aucun alignement — commerce et pénal ne correspondent ni à l'état civil ni aux protêts CMF.

**Classification :** **SWAP** (déroute complète)

**Analyse :** Deux branches explicites (— altération actes d'état civil — + — protêts — / notaires). Le gold civil+monétaire est cohérent. Le router a probablement associà — notaires — à une actività commerciale et — sanctions/peines — au seul code pénal, en manquant la branche CMF (protêts) et la branche civil (état civil).

**Pourquoi le router a probablement fait cette erreur :** confusion notaires à commerce ; focus sur — sanctions — à pénal ; absence de lien explicite — monétaire/financier — dans la question pour les protêts.

**Dimension manquante/ajoutée identifiable dans la question ?** Les dimensions gold **YES** (deux — et — explicites). Prédiction **NO**.

**Décision router raisonnable ?** **NO**

**Catégorie principale :** True router error

---

### q360

**Question :** Quelles conditions doit contenir le contrat constitutif ou les statuts pour éviter la nullité, et comment cela s'articule-t-il avec la responsabilité pénale d'une personne morale en cas de récidive ?

**Gold :** commerce + pénal  
**Prediction :** civil + commerce + pénal

**Articles gold :**
- commerce **L125-8** — mention privilège/nantissement dans statuts fonds de commerce, nullité
- pénal **132-15** — récidive contravention 5e classe personne morale (amende x10)

**Classification :** **OVERPREDICTION** (+ civil)

**Analyse :** Les deux dimensions sont nommées (statuts/nullité commerce + responsabilité pénale récidive). L'article L125-8 est dans le code du commerce, pas le civil. Le civil ajouté par le router vient probablement du mot — nullité — (concept civiliste général).

**Dimension ajoutée identifiable ?** Civil **NO** (nullité ici = commerce L125-8).

**Décision router raisonnable ?** **NO** — sur-prédiction.

**Catégorie principale :** True router error (corpus boundary : nullité à civil)

---

### q361

**Question :** Comment est organisée la formation des salariés appelés à exercer des responsabilités syndicales et quelle est la responsabilité des membres des organes de direction des associations impliquées ?

**Gold :** travail + monétaire  
**Prediction :** civil + travail

**Articles gold :**
- travail **L2145-2** — formation des responsables syndicaux
- monétaire **L213-19** — responsabilité dirigeants associations ; **renvoie** aux art. L225-251+ du **code du commerce**

**Classification :** **SWAP** (monétaire à civil)

**Analyse :** Branche 1 = travail explicite. Branche 2 = responsabilité organes d'**associations** — le gold CMF est un renvoi vers le droit des sociétés (commerce). La question ne mentionne ni CMF ni commerce ni civil. Le router choisit civil (responsabilité des dirigeants = droit civil des personnes morales ?) au lieu de CMF.

**Dimension monétaire identifiable ?** **PARTIALLY** — — associations — + émission d'obligations évoquée dans L213-19 n'est pas dans la question.

**Décision router raisonnable ?** **DEBATABLE** — travail correct ; second corpus difficile ; civil vs CMF tous deux implicites.

**Catégorie principale :** Corpus boundary issue + gold partially article-dependent

---

### q363

**Question :** Quelles dérégations spécifiques s'appliquent aux SICAV par rapport aux dispositions générales du **Code de commerce**, et comment la juridiction peut-elle gérer les dommages et intérêts lors d'un ajournement du prononcé de la peine ?

**Gold :** monétaire + pénal  
**Prediction :** civil + commerce + monétaire + pénal

**Articles gold :**
- monétaire **L214-7-2** — dérégations SICAV (texte : — par dérégation— code de commerce —)
- pénal **132-70-2** — dommages-intérêts lors d'ajournement du prononcé

**Classification :** **OVERPREDICTION** (+ civil + commerce)

**Analyse :** La question cite explicitement le **Code de commerce** pour les SICAV ; le gold est pourtant **monétaire** (L214-7-2 est au CMF). Le router ajoute commerce parce que la question le nomme — comportement **textuellement cohérent**. Le pénal (ajournement) est explicite. Civil ajouté sans base claire.

**Dimension commerce identifiable ?** **YES** dans la question — **NO** dans le gold.

**Décision router raisonnable ?** **DEBATABLE** — sur-prédiction commerce/civil ; conflit question vs gold.

**Catégorie principale :** Question formulation issue (question pointe commerce, gold = CMF)

---

### q365

**Question :** Quels sont les recours possibles en cas d'altération d'un acte de l'état civil et quelle est l'obligation des notaires concernant la remise des protêts dans ce contexte ?

**Gold :** civil + monétaire  
**Prediction :** civil + commerce

**Articles gold :**
- civil **52** — altération actes état civil
- monétaire **L131-64** — remise des protêts par les notaires

**Classification :** **SWAP** (monétaire à commerce)

**Analyse :** Même famille que q354 (état civil + protêts). Le router garde civil mais substitue commerce à monétaire — vraisemblablement — notaires — + greffe tribunal à registre commerce.

**Dimension monétaire identifiable ?** **PARTIALLY** — — protêts — suggère CMF/chèque pour un juriste, pas pour un routeur lexical.

**Décision router raisonnable ?** **NO** pour le swap ; civil correct.

**Catégorie principale :** True router error (+ corpus boundary notaires/greffe)

---

### q369

**Question :** Dans quelle mesure un consommateur peut-il être certain que le numéro de téléphone fourni pour l'exécution d'un contrat ou le traitement d'une réclamation ne lui sera pas facturé en plus ?

**Gold :** consommation + commerce  
**Prediction :** consommation

**Articles gold :**
- consommation **L121-16** — numéro non surtaxà pour exécution contrat / réclamation
- commerce **L125-19** — dissolution GIE en cas de redressement judiciaire d'un membre (**sans lien** avec numéros téléphoniques)

**Classification :** **UNDERPREDICTION**

**Analyse :** Une seule dimension identifiable : **consommation** (consommateur, contrat, réclamation, numéro surtaxé). L125-19 commerce est un article miroir/GIE sans ancrage dans la question ; la referenceAnswer elle-même dit qu'il — n'influe pas directement —.

**Dimension commerce identifiable ?** **NO**

**Décision router raisonnable ?** **YES** — prédiction consommation seule est correcte pour le routing.

**Catégorie principale :** Gold/dataset issue (faux négatif de métrique)

---

### q382

**Question :** Comment l'article 2427 du **code civil** distribue-t-il les droits de colloque, en lien avec le prêt viager défini à l'article L. 315-1 du **code de la consommation**, et quelles sont les compétences de l'autorité saisis des amendes selon l'article L171-3 du **code monétaire et financier** ?

**Gold :** civil + monétaire  
**Prediction :** civil + consommation + monétaire

**Articles gold :**
- civil **2427** — colloque créancier hypothécaire
- monétaire **L171-3** — autorité compétente pour amendes (renvoie consommation L. ...)

**Classification :** **OVERPREDICTION** (+ consommation)

**Analyse :** La question **cite nommément trois codes** dont consommation (L315-1 prêt viager). Le gold n'inclut **pas** consommation — seulement civil + monétaire. Le router lit la question littéralement et ajoute consommation. C'est une erreur de métrique mais un comportement **textuellement défendable**.

**Dimension consommation identifiable ?** **YES** (explicitement citée)

**Décision router raisonnable ?** **DEBATABLE** — router suit la question ; gold l'ignore.

**Catégorie principale :** Question formulation issue / gold asymmetry

---

### q387

**Question :** Quels contrôles et audits sont exigés des fournisseurs de plateformes en ligne dépassant certains seuils, notamment en matière de cybersécurité, et quelles sanctions pénales sont applicables en cas de cession illicite de stupéfiants, au regard des articles correspondants ?

**Gold :** consommation + pénal  
**Prediction :** pénal

**Articles gold :**
- consommation **L111-7-3** — audits cybersécurité plateformes en ligne
- pénal **222-39** — cession illicite de stupéfiants

**Classification :** **UNDERPREDICTION** (consommation manquante)

**Analyse :** Deux branches explicites dans la question (— contrôles/audits cybersécurité plateformes — + — sanctions pénales stupéfiants —). Le router ne retient que pénal — probablement parce que la seconde branche est plus — forte — juridiquement ou par longueur.

**Dimension consommation identifiable ?** **YES**

**Décision router raisonnable ?** **NO** — vraie erreur router.

**Catégorie principale :** True router error

---

### q388

**Question :** Expliquez comment les dispositions du **code du commerce** relatives aux annonces de réduction de prix interagissent avec les règles du **code du travail** sur le relèvement du SMIC en fonction de l'**indice national des prix à la consommation**—

**Gold :** commerce + travail  
**Prediction :** consommation + commerce + travail

**Articles gold :**
- commerce **L310-7** — annonces réduction de prix
- travail **L3231-5** — relèvement SMIC selon IPC

**Classification :** **OVERPREDICTION** (+ consommation)

**Analyse :** Commerce et travail explicitement cités. Le router ajoute consommation à cause des mots — prix à la consommation — dans l'indice IPC — piège lexical (indice économique à code de la consommation).

**Dimension consommation identifiable ?** **NO** (IPC à code consommation)

**Décision router raisonnable ?** **NO**

**Catégorie principale :** True router error / Corpus boundary issue (mot-clà consommation)

---

### q399

**Question :** Selon les articles D223-9 du code de la consommation et L141-28 du code du commerce, dans quelles conditions un professionnel peut-il téléphoner pour de la prospection commerciale et la **consultation préalable du comità social et économique** ?

**Gold :** consommation + commerce  
**Prediction :** consommation + commerce + travail

**Articles gold :**
- consommation **D223-9** — prospection téléphonique (horaires)
- commerce **L141-28** — consultation CSE sur vente fonds de commerce

**Classification :** **OVERPREDICTION** (+ travail)

**Analyse :** Consommation et commerce cités dans la question. Le CSE est mentionné explicitement ; L141-28 est au **commerce** (consultation CSE dans contexte vente fonds). Le router ajoute **travail** car CSE = concept du code du travail — mais le gold traite le CSE via l'article commerce.

**Dimension travail identifiable ?** **PARTIALLY** (CSE nommé, gold = commerce)

**Décision router raisonnable ?** **DEBATABLE**

**Catégorie principale :** Ambiguous legal interpretation (CSE traverse commerce/travail)

---

### q408

**Question :** Comment les dispositions du **code du travail** s'appliquent-elles au plan d'épargne retraite d'entreprise collectif, et quelles sont les sanctions pénales spécifiques applicables lorsque la négligence d'un conducteur cause une incapacité ?

**Gold :** monétaire + pénal  
**Prediction :** travail + monétaire + pénal

**Articles gold :**
- monétaire **L224-13** — PER collectif ; renvoie plan épargne entreprise du **code du travail**
- pénal **222-20-1** — négligence conducteur, incapacità à 3 mois

**Classification :** **OVERPREDICTION** (+ travail)

**Analyse :** La question nomme explicitement le **code du travail** pour le PER ; le gold est CMF (L224-13 qui renvoie travail). Le router ajoute travail — cohérent avec la formulation. Pénal explicite (sanctions pénales conducteur).

**Dimension travail identifiable ?** **YES** (dans la question)

**Décision router raisonnable ?** **DEBATABLE** — router suit la question ; gold = CMF+pénal sans travail direct.

**Catégorie principale :** Question formulation issue

---

### q410

**Question :** Quels sont les critères d'exclusion pour l'acquisition ou la réintégration de la nationalité française **en matière pénale**, et quelles sanctions sont prévues pour la fourniture de **fausses informations commerciales** ?

**Gold :** civil + commerce  
**Prediction :** civil + pénal

**Articles gold :**
- civil **21-27** — exclusion nationalité pour condamnations (libellé — matière pénale — dans question mais article **civil**)
- commerce **L123-5** — fausses infos immatriculation RCS (sanctions pénales inscrites au commerce)

**Classification :** **SWAP** (commerce à pénal)

**Analyse :** Deux branches explicites. La première dit — en matière pénale — mais le gold est **civil** (21-27). Le router substitue pénal à commerce pour la 2e branche ou confond les deux — — fausses informations commerciales — devrait pointer commerce (immatriculation), pas code pénal général.

**Dimension commerce identifiable ?** **YES** (— informations commerciales —, immatriculation implicite)

**Décision router raisonnable ?** **NO** pour le swap commerce→pénal ; piège — matière pénale — en tête.

**Catégorie principale :** True router error (+ question formulation piège — matière pénale —)

---

### q412

**Question :** Quelles sont les obligations relatives à l'avis de défaut de paiement d'un chèque et comment ont-elles été adaptées pour différentes **juridictions territoriales françaises** ?

**Gold :** civil + monétaire  
**Prediction :** monétaire

**Articles gold :**
- monétaire **L131-49** — avis défaut paiement chèque, protêt
- civil **33** — adaptations terminologiques et sanctions outre-mer (Nouvelle-Calédonie, collectivités)

**Classification :** **UNDERPREDICTION** (civil manquant)

**Analyse :** Chèque à CMF explicite (première branche). — Juridictions territoriales françaises — / adaptations outre-mer à art. 33 civil (deuxième branche). Signal civil **présent mais implicite** — pas de mention — code civil —.

**Dimension civil identifiable ?** **PARTIALLY**

**Décision router raisonnable ?** **DEBATABLE** — CMF seul est une réponse partielle défendable ; gold exige civil.

**Catégorie principale :** Ambiguous legal interpretation

---

### q413

**Question :** Comment prouver des actes d'état civil en l'absence ou la perte des registres officiels, et comment l'**application immédiate des lois nouvelles** affecte-t-elle la validité de ces actes ?

**Gold :** civil + pénal  
**Prediction :** civil

**Articles gold :**
- civil **46** — preuve par titres/témoins si registres perdus
- pénal **112-4** — application immédiate loi nouvelle sans affecter validité actes antérieurs

**Classification :** **UNDERPREDICTION** (pénal manquant)

**Analyse :** Branche 1 = état civil explicite. Branche 2 = — application immédiate des lois nouvelles — — formulation **g?n?rique** ; l'article gold est au **code pénal** (principe général d'application de la loi pénale dans le temps, applicable au-delà du pénal). Un juriste peut inf?rer pénal ; un routeur lexical voit surtout — validité actes état civil — à civil seul.

**Dimension pénal identifiable ?** **PARTIALLY** — formulation transversale, pas — code pénal — ni infraction.

**Décision router raisonnable ?** **DEBATABLE** — under-prediction pénal compréhensible ; gold défendable pour expert.

**Catégorie principale :** Ambiguous legal interpretation (true router error partiel pour métrique stricte)

---

### q421

**Question :** Quelles sont les sanctions applicables en cas de faits de harcèlement sexuel au travail et les dispositions prévues en matière de contrôles et confiscations d'**argent liquide** en cas d'infraction ?

**Gold :** travail + monétaire  
**Prediction :** travail + monétaire + pénal

**Articles gold :**
- travail **L1153-6** — sanction **disciplinaire** harcèlement sexuel (pas pénal)
- monétaire **L152-4** — contrôles et sanctions argent liquide

**Classification :** **OVERPREDICTION** (+ pénal)

**Analyse :** Travail et CMF explicites. Le router ajoute pénal car — sanctions — + — infraction — + harcèlement — alors que le gold travail = disciplinaire interne, pas code pénal.

**Dimension pénal identifiable ?** **NO** (harcèlement au travail à automatiquement pénal dans cette question)

**Décision router raisonnable ?** **NO** — piège sémantique sanctions/infraction.

**Catégorie principale :** True router error / Corpus boundary (sanctions à pénal)

---

## 4. Classification globale

Attribution **principale** (une par question) :

| Catégorie | Nombre | IDs |
| --------- | -----: | --- |
| **True router error** | **8** | q354, q360, q365, q387, q388, q410, q413*, q421 |
| **Gold/dataset issue** | **1** | q369 |
| **Question formulation issue** | **3** | q363, q382, q408 |
| **Ambiguous legal interpretation** | **3** | q361, q399, q412 |
| **Corpus boundary issue** | **0** (secondaire sur plusieurs cas) | — |

\* q413 comptà true router error pour métrique stricte (branche 2 explicite) mais d?cision router **debatable**.

**Comptage alternatif (erreurs métrique vs erreurs router réelles) :**

| Type | Comptage |
| ---- | --------: |
| Erreurs métrique (exact match) | 15/15 |
| Vraies erreurs router (gold défendable + router incorrect) | **~8—9** |
| Faux positifs métrique (router raisonnable, gold/discutable) | **~4—5** (q369, q382, q363, q408, partiellement q399) |
| Zone grise | **~3** (q361, q412, q413) |

---

## 5. Patterns observés

### Pattern 1 — corpus secondaire oublià (under-prediction)

| ID | Gold | Pred | B identifiable à |
| -- | ---- | ---- | ---------------- |
| q369 | +commerce | — | **NO** à faux under-pred |
| q387 | +consommation | — | **YES** à vraie erreur |
| q412 | +civil | — | **PARTIALLY** |
| q413 | +pénal | — | **PARTIALLY** |

**Bilan :** 1 vraie under-prediction claire (q387) ; 1 gold discutable (q369) ; 2 partielles (q412, q413).

### Pattern 2 — corpus ajouté par mot-cl?

| ID | Mot-clà | Corpus ajouté | Justifià à |
| -- | ------- | ------------- | ---------- |
| q388 | — prix à la consommation — (IPC) | consommation | **NO** |
| q421 | — sanctions —, — infraction — | pénal | **NO** |
| q360 | — nullité — | civil | **NO** |
| q399 | — comità social et économique — | travail | **DEBATABLE** |

### Pattern 3 — corpus thématiquement proche (swap)

| Paire | IDs | Mécanisme |
| ----- | --- | --------- |
| monétaire à commerce | q354, q365 | notaires, protêts, greffe à commerce |
| commerce à pénal | q410 | — matière pénale — + sanctions |
| monétaire à civil | q361 | responsabilité dirigeants associations |

### Pattern 4 — question multi explicite, router incomplet

**q387** : deux branches nommées, une seule retenue — signal fort pour prompt V3.

### Pattern 5 — gold d?pendant de l'article / conflit question-gold

| ID | Probl?me |
| -- | -------- |
| q369 | commerce gold (L125-19 GIE) invisible dans la question |
| q382 | consommation citée dans Q, absente du gold |
| q363, q408 | code nommà dans Q (commerce/travail), gold = CMF sans ce corpus |

---

## 6. Conclusions

1. **Sur 15 erreurs métrique, ~8—9 sont de vraies erreurs router** oà le gold est défendable depuis la question (q354, q360, q365, q387, q388, q410, q421, plus q413 en strict).

2. **~4—5 erreurs ne devraient pas pénaliser le router** en évaluation qualitative : q369 (gold commerce), q382/q363/q408 (question cite un code que le gold exclut), q399 (CSE ambigu).

3. **~3 cas zone grise** (q361, q412, q413) oà le second corpus est implicite ou transversal.

4. **Le nettoyage du dataset a fonctionn?** : plus de golds manifestement artificiels dans ces 15 (contrairement aux 18 under-pred V2 pr?-nettoyage). Les erreurs restantes sont mixtes router + formulation + frontières lexicales.

5. **Exact multi 76,2 % sur-estime légèrement les faiblesses router** ; exact multi — router-only défendable — serait plut?t **~85—87 %** (48+4 à 5 à 52—53/63).

---

## 7. Implications pour le routing V3

1. **Les erreurs restantes semblent-elles principalement liées au prompt ?**  
   **Oui, en majorit?.** Under-prediction sur questions à deux — et — explicites (q387), pièges lexicaux (IPC/consommation, sanctions/pénal), et swaps notaires/commerce suggèrent des règles prompt plus qu'un changement d'architecture.

2. **Nécessitent-elles une modification architecturale ?**  
   **Non**, d'apr?s ces 15 cas. Aucun ne requiert une seconde passe, un score de confiance ou un fallback pour être résolu — ce sont des probl?mes de lecture de dimensions et de désambiguisation lexicale.

3. **Combien de vraies erreurs router ?**  
   **~8—9 / 15** (53—60 % des erreurs métrique).

4. **Quels types d'erreurs un prompt V3 devrait cibler ?**  
   - Forcer l'extraction de **chaque branche** apr?s — et — / — ainsi que —.  
   - Règle anti-homonyme : — indice des prix à la consommation — à code consommation.  
   - Règle : — sanctions disciplinaires travail — à code pénal automatique.  
   - Notaires/protêts/chèque à CMF, pas commerce.  
   - Ne pas ajouter un corpus **nommà dans la question** si l'article visà est dans un autre code (SICAV à CMF malgrà mention commerce) — ou corriger le gold.

5. **Un changement architectural est-il justifià par ces 15 cas ?**  
   **Non.** Les patterns ne montrent pas d'échec syst?mique qu'une seconde passe résoudrait mieux qu'un prompt affinà + gold/question align?s (q369, q382, q363, q408).

---

## Validation technique

| Commande | Résultat |
| -------- | -------- |
| `pnpm test` | OK — 419 tests passés |
| `pnpm build` | OK |

Aucun code modifià — rapport seul.
