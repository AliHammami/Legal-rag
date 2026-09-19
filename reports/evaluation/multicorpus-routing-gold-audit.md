# Audit des 75 questions multi-corpus

> Audit réalisé le 2026-09-19. Méthode : évaluation question-first (sans raisonnement circulaire depuis goldArticles). Aucune modification du dataset, du router ni du pipeline.

## 1. Résumé

### Classifications globales (75 questions)

| Classification | Nombre | % |
| --- | ---: | ---: |
| VALID_MULTI | 57 | 76.0% |
| VALID_MULTI_BUT_PARTLY_IMPLICIT | 4 | 5.3% |
| QUESTIONABLE_MULTI | 11 | 14.7% |
| INVALID_MULTI | 3 | 4.0% |
| UNCERTAIN | 0 | 0.0% |

### Classifications par corpus gold (151 entrées corpus ; q353 est la seule question tri-corpus)

| Classification corpus | Nombre | % |
| --- | ---: | ---: |
| EXPLICITLY_IDENTIFIABLE | 133 | 88.1% |
| IMPLICITLY_IDENTIFIABLE | 4 | 2.6% |
| LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | 6 | 4.0% |
| QUESTIONABLE_GOLD | 5 | 3.3% |
| INVALID_GOLD | 3 | 2.0% |

**Lecture rapide :** 61 questions (81.3%) sont exploitables pour mesurer le routing multi-corpus. 14 questions (18.7%) comportent au moins un gold corpus difficile ou impossible à déduire depuis la formulation.

## 2. Tableau complet

| ID | Question | Gold corpora | Dimensions identifiables | Classification par corpus | Classification globale | Justification |
| -- | -------- | ------------ | ------------------------ | ------------------------- | ---------------------- | ------------- |
| q351 | Quelles mesures peuvent être ordonnées par un juge en référé pour empêcher une atteinte à la vie privée, et sous quelles conditions ces mesures sont-elles applicables? | civil (9); consommation (L112-8) | 1. Mesures référé atteinte vie privée | civil: EXPLICITLY_IDENTIFIABLE; consommation: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | QUESTIONABLE_MULTI | Une seule dimension (référé/vie privée, clairement civil). L112-8 (accessibilité téléphonique consommateurs) n est pas suggéré par la question. |
| q352 | Quels recours un juge peut-il ordonner en référé pour faire cesser une atteinte à la présomption d'innocence, et quelles sont les obligations d'un commerçant non immatriculé? | civil (9-1); commerce (L123-8) | 1. Référé présomption innocence; 2. Obligations commerçant non immatriculé | civil: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux sous-questions explicites. |
| q353 | Quelles sont les obligations imposées à une personne en ce qui concerne son concours à la justice, et dans quelles conditions un nouvel employeur est-il solidairement responsable du dommage causé par la rupture abusive d'un contrat de travail? | travail (L1237-3); monétaire (L131-62); civil (10) | 1. Concours à la justice; 2. Solidarité nouvel employeur rupture abusive | civil: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE; monétaire: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | VALID_MULTI_BUT_PARTLY_IMPLICIT | Deux dimensions explicites + CMF (protêt chèque) sans lien textuel. |
| q354 | Quelles sanctions sont encourues en cas d'altération d'actes d'état civil et quelles obligations ont les notaires et huissiers concernant la tenue et la transmission des protêts? | civil (52); monétaire (L131-64) | 1. Sanctions altération état civil; 2. Obligations notaires protêts | civil: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux thèmes distincts et nommés. |
| q355 | Quelles sanctions peuvent être prononcées à la place de l'emprisonnement pour un délit, et quelles sont les conséquences en cas de célébration d'un mariage avant mainlevée en cas d'opposition? | pénal (131-6); civil (68) | 1. Sanctions substitutives délit; 2. Conséquences célébration mariage malgré opposition | pénal: EXPLICITLY_IDENTIFIABLE; civil: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q356 | Dans quelle mesure les mesures d'empêchement d'atteinte à l'intimité de la vie privée prévues par le Code civil peuvent-elles être combinées avec les obligations d'accessibilité des services téléphoniques imposées aux entreprises par le Code de la consommation pour garantir la protection des droits des personnes handicapées dans le cadre d'une réclamation ? | civil (9); consommation (L112-8) | 1. Mesures empêchement atteinte vie privée (civil); 2. Obligations accessibilité téléphonique consommation | civil: EXPLICITLY_IDENTIFIABLE; consommation: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Question longue mais deux branches nommées (Code civil + Code consommation). |
| q357 | Dans quelles hypothèses le professionnel peut-il s'exonérer de sa responsabilité à l'égard du consommateur dans l'exécution d'un contrat conclu à distance, et quelle est la nature de cette responsabilité ? | pénal (132-12); consommation (L221-15) | 1. Exonération responsabilité professionnel contrat distance | consommation: EXPLICITLY_IDENTIFIABLE; pénal: QUESTIONABLE_GOLD | QUESTIONABLE_MULTI | Consommation explicite ; art. 132-12 (récidive personne morale) sans rapport avec exonération consommation. |
| q358 | Quelles sont les conditions de prescription applicables aux actions portant sur l'exécution et la rupture du contrat de travail, et quelles exceptions sont prévues à ces règles ? | commerce (L124-12); travail (L1471-1) | 1. Prescription contrat de travail | travail: EXPLICITLY_IDENTIFIABLE; commerce: INVALID_GOLD | INVALID_MULTI | Question entièrement travail ; L124-12 (coopératives) sans lien sémantique. |
| q359 | Quelles structures juridiques un groupement de commerçants détaillants doit-il adopter selon le Code du commerce, et quel recours est prévu en cas de non-respect ? | commerce (L124-15); monétaire (L163-9) | 1. Structures juridiques groupement commerçants; 2. Recours non-respect | commerce: EXPLICITLY_IDENTIFIABLE; monétaire: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | QUESTIONABLE_MULTI | Commerce explicite ; recours L163-9 (chèque) non inferrable. |
| q360 | Quelles conditions doit contenir le contrat constitutif ou les statuts pour éviter la nullité, et comment cela s'articule-t-il avec la responsabilité pénale d'une personne morale en cas de récidive ? | pénal (132-15); commerce (L125-8) | 1. Nullité contrat/statuts fonds commerce; 2. Responsabilité pénale récidive personne morale | commerce: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q361 | Comment est organisée la formation des salariés appelés à exercer des responsabilités syndicales et quelle est la responsabilité des membres des organes de direction des associations impliquées ? | monétaire (L213-19); travail (L2145-2) | 1. Formation responsabilités syndicales; 2. Responsabilité organes direction associations | travail: EXPLICITLY_IDENTIFIABLE; monétaire: IMPLICITLY_IDENTIFIABLE | VALID_MULTI_BUT_PARTLY_IMPLICIT | Travail explicite ; CMF via responsabilité dirigeants associations émettrices obligations. |
| q362 | Quelles limites réglementaires encadrent les congés pour formation des salariés exerçant des responsabilités syndicales, et dans quelles conditions la juridiction peut-elle ajourner le prononcé d'une peine ? | pénal (132-60); travail (L2145-8) | 1. Congés formation syndicale; 2. Ajournement prononcé peine | travail: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q363 | Quelles dérogations spécifiques s'appliquent aux SICAV par rapport aux dispositions générales du Code de commerce, et comment la juridiction peut-elle gérer les dommages et intérêts lors d'un ajournement du prononcé de la peine ? | pénal (132-70-2); monétaire (L214-7-2) | 1. Dérogations SICAV; 2. Dommages-intérêts ajournement peine | monétaire: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q364 | Dans le cadre d'une activité commerciale, comment l'immatriculation au registre du commerce influence-t-elle le respect de la présomption d'innocence lorsqu'une personne est publiquement présentée comme coupable avant toute condamnation ? | civil (9-1); commerce (L123-8) | 1. Présomption innocence + immatriculation (lien artificiel) | civil: EXPLICITLY_IDENTIFIABLE; commerce: IMPLICITLY_IDENTIFIABLE | QUESTIONABLE_MULTI | Juxtaposition artificielle de deux thèmes faiblement connectés. |
| q365 | Quels sont les recours possibles en cas d'altération d'un acte de l'état civil et quelle est l'obligation des notaires concernant la remise des protêts dans ce contexte ? | civil (52); monétaire (L131-64) | 1. Recours altération acte état civil; 2. Obligation notaires protêts | civil: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites (comme q354). |
| q366 | Dans le cadre d'une opposition au mariage, si l'officier d'état civil célèbre malgré tout le mariage, quelles sont les peines encourues, et quelles autres peines privatives ou restrictives de liberté peuvent être prononcées en cas de délit connexe impliquant un permis de conduire ? | pénal (131-6); civil (68) | 1. Peines célébration mariage sans mainlevée; 2. Peines substitutives délit permis conduire | civil: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q367 | En cas de manquement du professionnel à son obligation de délivrance d'un bien, comment le consommateur peut-il mettre en œuvre la résolution du contrat, et quelles sont les conditions spécifiques à respecter selon le Code de la consommation ? En outre, quel cadre juridique régit la forme et le fonctionnement des sociétés coopératives de commerçants de détail, notamment en matière de responsabilité et de constitution ? | commerce (L124-3); consommation (L216-6) | 1. Résolution contrat consommation; 2. Sociétés coopératives commerçants détail | consommation: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux branches explicites dans question longue. |
| q368 | Quels sont les mécanismes et les conditions légales pour demander et consentir à un changement de nom en France pour une personne majeure et ses enfants, en intégrant les rôles de l'officier d'état civil et du procureur de la République? | pénal (132-40); civil (61-3-1) | 1. Changement de nom état civil | civil: EXPLICITLY_IDENTIFIABLE; pénal: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | QUESTIONABLE_MULTI | Civil explicite (procureur mentionné mais cadre état civil) ; 132-40 (sursis probatoire) sans lien. |
| q369 | Dans quelle mesure un consommateur peut-il être certain que le numéro de téléphone fourni pour l'exécution d'un contrat ou le traitement d'une réclamation ne lui sera pas facturé en plus ? | consommation (L121-16); commerce (L125-19) | 1. Numéro téléphone non surtaxé consommateur | consommation: EXPLICITLY_IDENTIFIABLE; commerce: IMPLICITLY_IDENTIFIABLE | VALID_MULTI_BUT_PARTLY_IMPLICIT | Consommation explicite ; commerce = norme miroir GIE (L125-19) peu identifiable. |
| q370 | Quels sont les impératifs légaux pour un employeur concernant la déclaration relative aux salariés partis en préretraite ou mis à la retraite, et quelles pénalités risque-t-il en cas de défaut de déclaration ? | consommation (L121-16); travail (L1221-18) | 1. Déclaration salariés préretraite/retraite | travail: EXPLICITLY_IDENTIFIABLE; consommation: INVALID_GOLD | INVALID_MULTI | Travail seul ; L121-16 (numéro surtaxé) sans rapport. |
| q371 | Quels sont les droits et obligations liés au consentement exprès du consommateur pour les paiements supplémentaires dans un contrat de vente ou de prestation de services, et quelles limites de durée de période d'essai s'appliquent pour un contrat de travail à durée indéterminée ? | consommation (L121-17); travail (L1221-19) | 1. Consentement paiements supplémentaires consommation; 2. Période essai CDI | consommation: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q372 | En quoi consiste l'interdiction faite aux professionnels d'appliquer des mesures différenciées basées sur le lieu de résidence du consommateur, et quelles sont les responsabilités du prestataire de services de paiement en cas de mauvaise exécution d'une opération ? | consommation (L121-23); monétaire (L133-22) | 1. Géoblocage consommation; 2. Responsabilité prestataire paiement | consommation: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q373 | Quelles sont les conséquences juridiques pour un fournisseur de coffre-fort numérique en cas de non-respect de ses obligations, notamment en lien avec les sanctions et interdictions prononcées à l'encontre d'un condamné dans un contexte pénal ? | pénal (132-45-1); consommation (L122-22) | 1. Sanctions coffre-fort numérique consommation; 2. Sanctions contexte pénal | consommation: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions dans la question. |
| q374 | Quels articles du code du commerce et du code monétaire et financier régissent les conditions spécifiques des contrats d'appui au projet d'entreprise et les droits de remboursement dans le cadre des opérations de paiement ? | commerce (L127-5); monétaire (L133-25-2) | 1. Contrat appui projet entreprise; 2. Droits remboursement paiement | commerce: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite explicitement les deux codes. |
| q375 | Comment les responsabilités sont-elles définies respectivement dans le contrat d'appui au projet d'entreprise selon le code du commerce et la compétence de la juridiction relative à la consignation en cas d'ajournement de prononcé selon le code pénal ? | pénal (132-70-3); commerce (L127-6) | 1. Responsabilité contrat appui; 2. Consignation ajournement peine | commerce: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q376 | Quels sont les cadres légaux définissant le télétravail et les modalités spécifiques applicables aux instruments de paiement pour faibles montants selon le code du travail et le code monétaire et financier ? | travail (L1222-9); monétaire (L133-28) | 1. Télétravail; 2. Instruments paiement faibles montants | travail: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q377 | Quelles obligations spécifiques l'employeur doit-il respecter envers un salarié en télétravail selon le code du travail, et comment la réhabilitation d'une personne condamnée est-elle acquise selon le code pénal ? | pénal (133-13); travail (L1222-10) | 1. Obligations employeur télétravail; 2. Réhabilitation pénale | travail: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q378 | Dans quelles conditions la demande de remboursement de monnaie électronique est-elle possible avant terme selon le code monétaire et financier, et quelles sont les sanctions prévues par le code pénal en cas d'homicide involontaire ? | pénal (221-6); monétaire (L133-33) | 1. Remboursement monnaie électronique; 2. Sanctions homicide involontaire | monétaire: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q379 | Selon l'article 1898 du code civil et le liminaire du code de la consommation, quelle responsabilité le prêteur encourt-il dans un prêt de consommation lorsque l'emprunteur est un consommateur ? | civil (1898); consommation (liminaire) | 1. Responsabilité prêt consommation (civil); 2. Définition consommateur | civil: EXPLICITLY_IDENTIFIABLE; consommation: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite explicitement art. 1898 civil et liminaire consommation. |
| q380 | Comment les articles 2307 du code civil et L123-11-3 du code du commerce régissent-ils les limites légales concernant la protection de la caution physique et les conditions d'agrément pour l'activité de domiciliation ? | civil (2307); commerce (L123-11-3) | 1. Protection caution physique; 2. Agrément domiciliation | civil: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite explicitement les deux articles/codes. |
| q381 | Quels effets produisent, selon les articles 2422 du code civil et L2132-5 du code du travail, les inscriptions hypothécaires en cas de procédures judiciaires, et quelles sont les fonctions des syndicats professionnels ? | civil (2422); travail (L2132-5) | 1. Inscriptions hypothécaires procédures; 2. Fonctions syndicats professionnels | civil: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q382 | Comment l'article 2427 du code civil distribue-t-il les droits de colloque du créancier hypothécaire entre principal, intérêts et arrérages, en lien avec le prêt viager défini à l'article L. 315-1 du code de la consommation, et quelles sont les compétences de l'autorité saisis des amendes selon l'article L171-3 du code monétaire et financier ? | civil (2427); monétaire (L171-3) | 1. Colloque hypothèque civil; 2. Prêt viager consommation (mentionné mais absent du gold); 3. Amendes CMF | civil: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Question cite trois codes mais gold = civil + monétaire seulement ; les deux golds sont identifiables depuis le texte. |
| q383 | En s’appuyant sur l’article 2429 du code civil et l’article 131-5-1 du code pénal, quelles sont les durées maximales d’inscription d’une hypothèque selon différentes échéances, et quelles alternatives à l’emprisonnement peuvent être prescrites pour un délit puni d’emprisonnement ? | pénal (131-5-1); civil (2429) | 1. Durée inscription hypothèque; 2. Alternatives emprisonnement délit | civil: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite les deux codes/articles. |
| q384 | Quels sont les renseignements que le producteur doit fournir au vendeur professionnel et le vendeur au consommateur concernant les mises à jour logicielles des biens comportant des éléments numériques, et comment cela s'articule-t-il avec les obligations liées aux rapports publics des sociétés d'exploitation des ressources mentionnées dans le code du commerce ? | consommation (L111-6); commerce (L232-6-2) | 1. Mises à jour logicielles consommation; 2. Rapports publics sociétés commerce | consommation: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q385 | Comment les obligations d'information des fournisseurs de place de marché en ligne sur les conditions d'utilisation et le classement des contenus interagissent-elles avec les restrictions du code du travail concernant l'emploi des salariés dans les exploitations commerciales les jours fériés ? | consommation (L111-7); travail (L3134-4) | 1. Information places de marché en ligne; 2. Travail jours fériés commerce | consommation: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q386 | Quelles sont les obligations d'information imposées aux personnes collectant et diffusant des avis en ligne, et comment celles-ci sont-elles complétées par les règles sur la gestion des comptes de dépôt des clients dans les établissements de crédit ? | consommation (L111-7-2); monétaire (L312-1-1) | 1. Avis en ligne consommation; 2. Comptes dépôt établissements crédit | consommation: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q387 | Quels contrôles et audits sont exigés des fournisseurs de plateformes en ligne dépassant certains seuils, notamment en matière de cybersécurité, et quelles sanctions pénales sont applicables en cas de cession illicite de stupéfiants, au regard des articles correspondants ? | pénal (222-39); consommation (L111-7-3) | 1. Audits cybersécurité plateformes; 2. Sanctions stupéfiants | consommation: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicitement dans la question. |
| q388 | Expliquez comment les dispositions du code du commerce relatives aux annonces de réduction de prix interagissent avec les règles du code du travail sur le relèvement du salaire minimum de croissance en fonction de l'indice national des prix à la consommation, en précisant notamment les modalités appliquées dans ce contexte. | commerce (L310-7); travail (L3231-5) | 1. Annonces réduction prix commerce; 2. Relèvement SMIC travail | commerce: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q389 | Quelles conditions doivent être respectées pour pouvoir considérer qu'une vente volontaire de meubles aux enchères publiques porte sur des biens neufs en gros, et comment doit être indiquée la nature neuve d'un bien lors de la publicité ? | monétaire (L313-6); commerce (L321-1) | 1. Ventes enchères biens neufs en gros | commerce: EXPLICITLY_IDENTIFIABLE; monétaire: QUESTIONABLE_GOLD | QUESTIONABLE_MULTI | Commerce explicite ; L313-6 renvoie au fichier incidents consommation, pas au CMF substantiel. |
| q390 | Qui peut organiser et réaliser les ventes volontaires de meubles aux enchères publiques selon la réglementation, et dans quelles conditions spécifiques les notaires sont-ils habilités à exercer cette activité ? | commerce (L321-2); pénal (R321-10) | 1. Organisation ventes enchères / notaires | commerce: EXPLICITLY_IDENTIFIABLE; pénal: QUESTIONABLE_GOLD | QUESTIONABLE_MULTI | Commerce explicite ; R321-10 = renvoi réglementaire miroir (override doc). |
| q391 | Quels agents sont compétents pour rechercher et constater les infractions relatives à la sécurité et aux équipements de travail, et selon quelles règles peuvent-ils exercer leurs pouvoirs ? | monétaire (L315-8-1); travail (L4311-6) | 1. Agents contrôle sécurité travail | travail: EXPLICITLY_IDENTIFIABLE; monétaire: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | QUESTIONABLE_MULTI | Travail explicite ; L315-8-1 (accessibilité monnaie) lien indirect via consommation. |
| q392 | Quels sont les rôles et missions principaux des services de prévention et de santé au travail, et quelles sont les peines encourues pour des violences volontaires n'ayant entraîné aucune incapacité totale de travail ? | travail (L4622-2); pénal (R624-1) | 1. Missions SPST travail; 2. Violences sans ITT | travail: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q393 | Quels agents sont habilités à rechercher et constater les infractions prévues dans certains articles du code monétaire et financier, et quelles sont les modalités d'accès à ces locaux et documents professionnels ? | monétaire (L317-1); pénal (R624-2) | 1. Agents infractions CMF | monétaire: EXPLICITLY_IDENTIFIABLE; pénal: QUESTIONABLE_GOLD | QUESTIONABLE_MULTI | CMF explicite ; R624-2 (contravention décence) sans lien avec pouvoirs agents finance. |
| q394 | Quels sont les types de créances privilégiées sur la généralité des meubles selon l'article 2331 du Code civil et quelles modifications spécifiques s'appliquent pour le Code de la consommation concernant les références aux codes de travail et action sociale ? | civil (2331); consommation (L771-3) | 1. Privilèges meubles civil; 2. Modifications références consommation | civil: EXPLICITLY_IDENTIFIABLE; consommation: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q395 | Comment les créances privilégiées sur certains meubles sont-elles définies dans le Code civil et quelles sont les restrictions relatives aux contrats des vendeurs à domicile indépendants selon le Code du commerce ? | civil (2332); commerce (L135-2) | 1. Privilèges certains meubles; 2. Vendeurs domicile indépendants commerce | civil: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q396 | Quelle est la hiérarchie d'exercice des privilèges généraux selon le Code civil, et comment s'applique la preuve en cas de discrimination selon le Code du travail ? | civil (2332-2); travail (L1134-1) | 1. Hiérarchie privilèges généraux; 2. Preuve discrimination travail | civil: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q397 | Comment s'exercent les privilèges spéciaux du bailleur d'immeuble, du conservateur et du vendeur de meuble selon le Code civil, et quelles sont les conditions générales applicables aux fonds communs de placement d'entreprise selon le Code monétaire et financier ? | civil (2332-3); monétaire (L214-163) | 1. Privilèges spéciaux bailleur/conservateur/vendeur; 2. FCPE monétaire | civil: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q398 | Quelles sont les créances privilégiées spécifiques sur la généralité des immeubles selon l'article 2377 du Code civil, et quelles sanctions sont prévues par le Code pénal pour des violences entraînant une incapacité totale de travail supérieure à huit jours ? | pénal (222-11); civil (2377) | 1. Privilèges immeubles civil; 2. Violences ITT >8j pénal | civil: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q399 | Selon les articles D223-9 du code de la consommation et L141-28 du code du commerce, dans quelles conditions un professionnel peut-il téléphoner pour de la prospection commerciale, en particulier en ce qui concerne les horaires, jours autorisés, et la consultation préalable du comité social et économique ? | consommation (D223-9); commerce (L141-28) | 1. Prospection téléphonique consommation; 2. Consultation CSE vente fonds commerce | consommation: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite les deux articles/codes. |
| q400 | En combinant les articles D314-22 du code de la consommation et L1142-1 du code du travail, quelles sont les restrictions légales concernant les critères de sélection à l'emploi et les profils des personnels impliqués dans l'octroi ou le conseil en matière de contrats de crédit ? | consommation (D314-22); travail (L1142-1) | 1. Compétence personnels crédit consommation; 2. Critères sélection emploi travail | consommation: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q401 | En utilisant les articles D314-23 du code de la consommation et L221-32 du code monétaire et financier, quelles sont les conditions requises pour la compétence professionnelle des personnels de prêts et quelles règles spécifiques s'appliquent aux retraits sur un plan d'épargne en actions ? | consommation (D314-23); monétaire (L221-32) | 1. Compétence prêteurs consommation; 2. Retraits plan épargne actions | consommation: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Cite les deux codes. |
| q402 | D'après les articles D314-25 du code de la consommation et 222-14-5 du code pénal, quelles obligations de formation et quelles sanctions spécifiques s'appliquent respectivement aux prêteurs et aux auteurs de violences commises contre des agents publics ? | pénal (222-14-5); consommation (D314-25) | 1. Formation continue prêteurs; 2. Violences agents publics | consommation: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q403 | En croisant les articles L151-9 du code du commerce et L1142-4 du code du travail, comment le droit encadre-t-il la divulgation du secret des affaires par les salariés dans le cadre de l'exercice de leurs fonctions et l'intervention de mesures spécifiques favorisant l'égalité professionnelle entre femmes et hommes ? | travail (L1142-4); commerce (L151-9) | 1. Secret affaires salariés commerce; 2. Mesures égalité professionnelle travail | commerce: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q404 | Quelles sont les conditions cumulatives exigées pour qu'une société puisse faire publiquement état de sa qualité de société à mission et comment s'articule la déclaration auprès du greffier ? | commerce (L210-10); monétaire (L224-3) | 1. Société à mission / greffier | commerce: EXPLICITLY_IDENTIFIABLE; monétaire: QUESTIONABLE_GOLD | QUESTIONABLE_MULTI | Commerce explicite ; L224-3 (PER) sans lien (override doc q404). |
| q405 | Dans quelles conditions une petite société peut-elle substituer un référent de mission au comité de mission, et que prévoit la loi à propos du contrat de travail de ce référent ? | pénal (222-19-1); commerce (L210-12) | 1. Référent mission petite société | commerce: EXPLICITLY_IDENTIFIABLE; pénal: INVALID_GOLD | INVALID_MULTI | Commerce/travail implicite ; 222-19-1 (accident route) sans aucun lien. |
| q406 | Quels sont les engagements de l'employeur concernant la réduction des écarts de rémunération entre les femmes et les hommes, et comment les droits individuels dans les plans d'épargne retraite peuvent-ils être transférés ? | travail (L1142-7); monétaire (L224-6) | 1. Écarts rémunération femmes-hommes; 2. Transfert droits PER | travail: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q407 | Quelles obligations de publication incombent à l'employeur dans les entreprises d'au moins cinquante salariés concernant les écarts de rémunération, et quelles sont les sanctions pénales prévues en cas de violation délibérée des règles de sécurité entraînant une incapacité de travail ? | pénal (222-20); travail (L1142-8) | 1. Publication indicateurs égalité; 2. Négligence sécurité peines | travail: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q408 | Comment les dispositions du code du travail s'appliquent-elles au plan d'épargne retraite d'entreprise collectif, et quelles sont les sanctions pénales spécifiques applicables lorsque la négligence d'un conducteur de véhicule terrestre à moteur cause une incapacité de travail inférieure ou égale à trois mois ? | pénal (222-20-1); monétaire (L224-13) | 1. PER collectif / code travail; 2. Négligence conducteur peines | monétaire: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites (travail mentionné via PER). |
| q409 | Dans quelles conditions une personne est-elle tenue de collaborer avec la justice pour manifester la vérité, et quelles sont les conséquences en cas de refus sans motif légitime, en tenant compte des protections offertes aux consommateurs par la législation ? | civil (10); consommation (L112-5) | 1. Concours à la justice; 2. Protections consommateurs | civil: EXPLICITLY_IDENTIFIABLE; consommation: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicitement dans la question. |
| q410 | Quels sont les critères d'exclusion pour l'acquisition ou la réintégration de la nationalité française en matière pénale, et quelles sanctions sont prévues pour la fourniture de fausses informations commerciales ? | civil (21-27); commerce (L123-5) | 1. Critères exclusion nationalité; 2. Sanctions fausses infos immatriculation | civil: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q411 | Quelles sont les autorités compétentes pour l'enregistrement des déclarations de nationalité selon leur lieu et motif, et comment les droits des salariés sont-ils protégés dans l'exercice du droit de grève ? | civil (26-1); travail (L1132-2) | 1. Enregistrement déclarations nationalité; 2. Protection droit grève | civil: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q412 | Quelles sont les obligations relatives à l'avis de défaut de paiement d'un chèque et comment ont-elles été adaptées pour différentes juridictions territoriales françaises ? | civil (33); monétaire (L131-49) | 1. Avis défaut paiement chèque + adaptations territoriales | monétaire: EXPLICITLY_IDENTIFIABLE; civil: IMPLICITLY_IDENTIFIABLE | VALID_MULTI_BUT_PARTLY_IMPLICIT | Chèque → CMF explicite ; art. 33 civil (adaptation outre-mer) secondaire, non nommé. |
| q413 | Comment prouver des actes d'état civil en l'absence ou la perte des registres officiels, et comment l'application immédiate des lois nouvelles affecte-t-elle la validité de ces actes ? | pénal (112-4); civil (46) | 1. Preuve actes état civil registres perdus | civil: EXPLICITLY_IDENTIFIABLE; pénal: LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE | QUESTIONABLE_MULTI | État civil explicite ; 112-4 (application loi nouvelle) cadre transversal non suggéré. |
| q414 | Quelle est la sanction administrative prévue pour le manquement aux obligations d'information précontractuelle selon le code de la consommation, et comment est-elle complétée par le code du commerce en cas d'indications inexactes données pour l'immatriculation ? | consommation (L131-1); commerce (L123-38) | 1. Sanctions info précontractuelle consommation; 2. Indications inexactes immatriculation commerce | consommation: EXPLICITLY_IDENTIFIABLE; commerce: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q415 | Quelles sont les sanctions prévues par le code de la consommation et le code du travail en cas de manquement aux obligations d'information liées au contrat et en matière d'égalité professionnelle ? | travail (L1146-1); consommation (L131-1-1) | 1. Sanctions info contrat consommation; 2. Sanctions égalité professionnelle travail | consommation: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q416 | Dans le cas d'un manquement à l'information sur la disponibilité des pièces détachées, quelles sanctions sont prévues par le code de la consommation et quelles responsabilités sont imposées aux banquiers selon le code monétaire et financier ? | consommation (L131-2); monétaire (L131-70) | 1. Sanctions pièces détachées consommation; 2. Responsabilités banquiers chèques | consommation: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites (override doc mais lien défendable). |
| q417 | Quelles sanctions administratives le code de la consommation prévoit-il pour le manquement à la disponibilité des pièces détachées, et comment le code pénal atténue-t-il la responsabilité pénale en cas de troubles psychiques au moment des faits ? | pénal (122-1); consommation (L131-3) | 1. Sanctions admin pièces détachées; 2. Troubles psychiques responsabilité pénale | consommation: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q418 | Quels sont les effets juridiques de l'absence de mention expresse dans le contrat ou les statuts concernant les privilèges ou nantissements selon le code du commerce, et quelle sanction disciplinaire le code du travail prévoit-il pour un salarié auteur de harcèlement moral ? | travail (L1152-5); commerce (L125-8) | 1. Nullité mention privilèges statuts; 2. Sanction harcèlement moral travail | commerce: EXPLICITLY_IDENTIFIABLE; travail: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q419 | Quelles sont les conditions de forme et de durée du contrat d'appui au projet d'entreprise et quelles sanctions le ministre chargé de l'économie peut-il appliquer en cas d'investissement réalisé sans autorisation préalable ? | commerce (L127-2); monétaire (L151-3-2) | 1. Contrat appui forme/durée; 2. Sanctions investissement sans autorisation | commerce: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q420 | Comment le Conseil national des greffiers des tribunaux de commerce contribue-t-il à la lutte contre les fraudes et quelles sont les peines criminelles encourues par les personnes physiques ? | pénal (131-1); commerce (L128-1) | 1. Fichier interdits gérer greffiers; 2. Peines criminelles personnes physiques | commerce: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q421 | Quelles sont les sanctions applicables en cas de faits de harcèlement sexuel au travail et les dispositions prévues en matière de contrôles et confiscations d'argent liquide en cas d'infraction ? | travail (L1153-6); monétaire (L152-4) | 1. Sanctions harcèlement sexuel travail; 2. Contrôles argent liquide CMF | travail: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicites. |
| q422 | Quelles sont les peines applicables au titre du droit pénal et du droit du travail en cas d'atteinte à l'exercice régulier des fonctions de médiateur ? | pénal (131-3); travail (L1155-1) | 1. Atteinte fonctions médiateur travail/pénal | travail: EXPLICITLY_IDENTIFIABLE; pénal: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Question cite les deux codes. |
| q423 | Quelles sont les peines maximum d'emprisonnement prévues en cas de refus de paiement d'un chèque et quelle sanction pécuniaire est applicable en droit monétaire et financier ? | pénal (131-4); monétaire (L163-1) | 1. Peines emprisonnement refus chèque; 2. Sanction pécuniaire CMF chèque | pénal: EXPLICITLY_IDENTIFIABLE; monétaire: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicitement nommées. |
| q424 | Comment la loi protège-t-elle simultanément la vie privée d'un individu face à une entreprise gérant un service téléphonique destiné à la consommation ? | civil (9); consommation (L112-8) | 1. Protection vie privée individu; 2. Service téléphonique consommation entreprise | civil: EXPLICITLY_IDENTIFIABLE; consommation: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions dans la formulation (similaire q356 mais plus explicite). |
| q425 | Dans quelles conditions un commerçant non immatriculé peut-il être tenu responsable des obligations commerciales envers des tiers et comment cela se combine-t-il avec le droit au respect de la présomption d'innocence en cas d'atteinte publique à sa réputation ? | civil (9-1); commerce (L123-8) | 1. Responsabilité commerçant non immatriculé; 2. Présomption innocence atteinte réputation | commerce: EXPLICITLY_IDENTIFIABLE; civil: EXPLICITLY_IDENTIFIABLE | VALID_MULTI | Deux dimensions explicitement connectées. |

## 3. Analyse par paire de corpus

| Paire | Questions | VALID_MULTI | Partiellement implicite | Questionable/Invalid |
| ----- | --------: | ----------: | ------------------------: | -------------------: |
| civil + consommation | 6 | 5 | 0 | 1 |
| civil + commerce | 6 | 5 | 0 | 1 |
| civil + pénal | 6 | 4 | 0 | 2 |
| consommation + pénal | 5 | 4 | 0 | 1 |
| commerce + monétaire | 5 | 2 | 0 | 3 |
| commerce + pénal | 5 | 3 | 0 | 2 |
| monétaire + travail | 5 | 3 | 1 | 1 |
| pénal + travail | 5 | 5 | 0 | 0 |
| monétaire + pénal | 5 | 4 | 0 | 1 |
| commerce + consommation | 5 | 4 | 1 | 0 |
| consommation + travail | 5 | 4 | 0 | 1 |
| civil + monétaire | 4 | 3 | 1 | 0 |
| commerce + travail | 4 | 3 | 0 | 1 |
| consommation + monétaire | 4 | 4 | 0 | 0 |
| civil + travail | 3 | 3 | 0 | 0 |
| civil + monétaire + travail | 1 | 0 | 1 | 0 |
| civil + consommation + monétaire | 1 | 1 | 0 | 0 |

### Paires les plus problématiques

- **civil + consommation (6 questions)** : q351 est le cas emblématique (1 dimension visible, consommation gold non déductible) ; q356 et q424 sont valides car la question nomme explicitement les deux branches ; q367, q379, q409 sont valides (deux dimensions explicites).
- **civil + pénal (6 questions)** : q368, q413 posent problème (second corpus pénal = renvoi transversal ou sursis sans lien) ; les autres (q355, q366, q383, q398) sont valides.
- **commerce + monétaire (6 questions)** : q359, q389, q404 posent problème (CMF ajouté via renvoi, override doc, ou lien indirect) ; q374, q419, q416 sont valides.
- **commerce + pénal (6 questions)** : q390 (renvoi miroir R321-10, override doc) et q357 (132-12 sans lien) sont questionable ; q360, q375, q420, q418 sont valides.
- **travail + monétaire (5 questions)** : q391 (L315-8-1 accessibilité monnaie) et q353 (protêt chèque) posent problème ; q376, q406, q421 sont valides.
- **consommation + pénal (5 questions)** : q357 questionable ; q373, q387, q402, q417 valides (deux dimensions explicites).

## 4. Analyse des dimensions

| Pattern | Nombre | Exemples |
| ------- | -----: | -------- |
| Une seule dimension identifiable malgré ≥2 gold corpora | 16 | q351, q358, q368, q370, q389, q390, q405 |
| Deux dimensions explicitement visibles | 56 | q352, q356, q371–q425 (majorité q371+) |
| Plusieurs dimensions dont au moins une implicite | 3 | q353, q361, q369, q412 |
| Au moins un corpus gold dépendant de l'article/renvoi, non de la question | 14 | q351, q353, q357, q358, q359, q368, q370, q389, q390, q391, q393, q404, q405, q413 |

**Observation structurelle :** les questions q351–q370 (génération initiale) contiennent davantage de golds « artificiels » (juxtaposition d'articles de codes différents sans double dimension dans le texte). À partir de q371, le pattern « … et … » avec deux sous-questions explicites domine (~55 questions), ce qui rend le routing beaucoup plus testable.

## 5. Cas critiques

Les 18 cas listés ci-dessous correspondent aux under-predictions V2 documentées ; l'audit montre que **~10/18 relèvent surtout du benchmark**, **~5/18 d'un mix router + benchmark**, **~3/18 sont des échecs router légitimes** sur des multi valides.

### q351

**Question :** Quelles mesures peuvent être ordonnées par un juge en référé pour empêcher une atteinte à la vie privée, et sous quelles conditions ces mesures sont-elles applicables?

**Gold articles :**
- **civil** (9) → `EXPLICITLY_IDENTIFIABLE` : Chacun a droit au respect de sa vie privée. Les juges peuvent, sans préjudice de la réparation du dommage subi, prescrire toutes mesures, telles que séquestre, saisie et autres, propres à empêcher ou …
- **consommation** (L112-8) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : Les entreprises dont le chiffre d'affaires est supérieur à un seuil défini par décret rendent le numéro de téléphone destiné à recueillir l'appel d'un consommateur en vue d'obtenir la bonne exécution …

1. **Ce que la question permet de déduire :** Mesures référé atteinte vie privée (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Mesures référé atteinte vie privée.
3. **Corpus gold :** civil = EXPLICITLY_IDENTIFIABLE ; consommation = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Une seule dimension (référé/vie privée, clairement civil). L112-8 (accessibilité téléphonique consommateurs) n est pas suggéré par la question.

### q353

**Question :** Quelles sont les obligations imposées à une personne en ce qui concerne son concours à la justice, et dans quelles conditions un nouvel employeur est-il solidairement responsable du dommage causé par la rupture abusive d'un contrat de travail?

**Gold articles :**
- **travail** (L1237-3) → `EXPLICITLY_IDENTIFIABLE` : Lorsqu'un salarié ayant rompu abusivement un contrat de travail conclut un nouveau contrat de travail, le nouvel employeur est solidairement responsable du dommage causé à l'employeur précédent dans l…
- **monétaire** (L131-62) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : L'acte de protêt contient la transcription littérale du chèque et des endossements, ainsi que la sommation de payer le montant du chèque. Il énonce la présence ou l'absence de celui qui doit payer, le…
- **civil** (10) → `EXPLICITLY_IDENTIFIABLE` : Chacun est tenu d'apporter son concours à la justice en vue de la manifestation de la vérité.  Celui qui, sans motif légitime, se soustrait à cette obligation lorsqu'il en a été légalement requis, peu…

1. **Ce que la question permet de déduire :** Concours à la justice ; Solidarité nouvel employeur rupture abusive (2 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Concours à la justice ; 2. Solidarité nouvel employeur rupture abusive.
3. **Corpus gold :** civil = EXPLICITLY_IDENTIFIABLE ; travail = EXPLICITLY_IDENTIFIABLE ; monétaire = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Mix : gold partiellement implicite + router. Deux dimensions explicites + CMF (protêt chèque) sans lien textuel.

### q358

**Question :** Quelles sont les conditions de prescription applicables aux actions portant sur l'exécution et la rupture du contrat de travail, et quelles exceptions sont prévues à ces règles ?

**Gold articles :**
- **commerce** (L124-12) → `INVALID_GOLD` : L'assemblée générale ordinaire peut, en statuant aux conditions de quorum et de majorité de l'assemblée générale extraordinaire si la coopérative est constituée sous forme de société anonyme, ou l'ass…
- **travail** (L1471-1) → `EXPLICITLY_IDENTIFIABLE` : Toute action portant sur l'exécution du contrat de travail se prescrit par deux ans à compter du jour où celui qui l'exerce a connu ou aurait dû connaître les faits lui permettant d'exercer son droit.…

1. **Ce que la question permet de déduire :** Prescription contrat de travail (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Prescription contrat de travail.
3. **Corpus gold :** travail = EXPLICITLY_IDENTIFIABLE ; commerce = INVALID_GOLD.
4. **Origine du problème :** Problème benchmark (gold invalid). Question entièrement travail ; L124-12 (coopératives) sans lien sémantique.

### q359

**Question :** Quelles structures juridiques un groupement de commerçants détaillants doit-il adopter selon le Code du commerce, et quel recours est prévu en cas de non-respect ?

**Gold articles :**
- **commerce** (L124-15) → `EXPLICITLY_IDENTIFIABLE` : Tout groupement de commerçants détaillants établi en vu de l'exercice d'une ou plusieurs activités visées aux 1°,3° et 4° de l'article L. 124-1 doit, s'il n'a pas adopté la forme de société coopérativ…
- **monétaire** (L163-9) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : A l'occasion des poursuites pénales exercées contre le tireur, le porteur qui s'est constitué partie civile est recevable à demander devant les juges de la juridiction pénale une somme égale au montan…

1. **Ce que la question permet de déduire :** Structures juridiques groupement commerçants ; Recours non-respect (2 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Structures juridiques groupement commerçants ; 2. Recours non-respect.
3. **Corpus gold :** commerce = EXPLICITLY_IDENTIFIABLE ; monétaire = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Commerce explicite ; recours L163-9 (chèque) non inferrable.

### q368

**Question :** Quels sont les mécanismes et les conditions légales pour demander et consentir à un changement de nom en France pour une personne majeure et ses enfants, en intégrant les rôles de l'officier d'état civil et du procureur de la République?

**Gold articles :**
- **pénal** (132-40) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : La juridiction qui prononce un emprisonnement peut, dans les conditions prévues ci-après, ordonner qu'il sera sursis à son exécution, la personne physique condamnée étant placée sous le régime de la p…
- **civil** (61-3-1) → `EXPLICITLY_IDENTIFIABLE` : Toute personne majeure dont l'acte de naissance est détenu par un officier de l'état civil français peut demander à l'officier de l'état civil de son lieu de résidence ou dépositaire de son acte de na…

1. **Ce que la question permet de déduire :** Changement de nom état civil (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Changement de nom état civil.
3. **Corpus gold :** civil = EXPLICITLY_IDENTIFIABLE ; pénal = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Civil explicite (procureur mentionné mais cadre état civil) ; 132-40 (sursis probatoire) sans lien.

### q369

**Question :** Dans quelle mesure un consommateur peut-il être certain que le numéro de téléphone fourni pour l'exécution d'un contrat ou le traitement d'une réclamation ne lui sera pas facturé en plus ?

**Gold articles :**
- **consommation** (L121-16) → `EXPLICITLY_IDENTIFIABLE` : Le numéro de téléphone destiné à recueillir l'appel d'un consommateur en vue d'obtenir la bonne exécution d'un contrat conclu avec un professionnel ou le traitement d'une réclamation ne peut pas être …
- **commerce** (L125-19) → `IMPLICITLY_IDENTIFIABLE` : Sauf clause contraire du contrat constitutif ou des statuts, le redressement ou la liquidation judiciaires de l'un des membres n'entraîne pas de plein droit la dissolution du groupement d'intérêt écon…

1. **Ce que la question permet de déduire :** Numéro téléphone non surtaxé consommateur (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Numéro téléphone non surtaxé consommateur.
3. **Corpus gold :** consommation = EXPLICITLY_IDENTIFIABLE ; commerce = IMPLICITLY_IDENTIFIABLE.
4. **Origine du problème :** Mix : gold partiellement implicite + router. Consommation explicite ; commerce = norme miroir GIE (L125-19) peu identifiable.

### q370

**Question :** Quels sont les impératifs légaux pour un employeur concernant la déclaration relative aux salariés partis en préretraite ou mis à la retraite, et quelles pénalités risque-t-il en cas de défaut de déclaration ?

**Gold articles :**
- **consommation** (L121-16) → `INVALID_GOLD` : Le numéro de téléphone destiné à recueillir l'appel d'un consommateur en vue d'obtenir la bonne exécution d'un contrat conclu avec un professionnel ou le traitement d'une réclamation ne peut pas être …
- **travail** (L1221-18) → `EXPLICITLY_IDENTIFIABLE` : Tout employeur de personnel salarié ou assimilé est tenu d'adresser à l'organisme chargé du recouvrement des cotisations et contributions sociales dont il relève, au plus tard le 31 janvier de chaque …

1. **Ce que la question permet de déduire :** Déclaration salariés préretraite/retraite (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Déclaration salariés préretraite/retraite.
3. **Corpus gold :** travail = EXPLICITLY_IDENTIFIABLE ; consommation = INVALID_GOLD.
4. **Origine du problème :** Problème benchmark (gold invalid). Travail seul ; L121-16 (numéro surtaxé) sans rapport.

### q387

**Question :** Quels contrôles et audits sont exigés des fournisseurs de plateformes en ligne dépassant certains seuils, notamment en matière de cybersécurité, et quelles sanctions pénales sont applicables en cas de cession illicite de stupéfiants, au regard des articles correspondants ?

**Gold articles :**
- **pénal** (222-39) → `EXPLICITLY_IDENTIFIABLE` : La cession ou l'offre illicites de stupéfiants à une personne en vue de sa consommation personnelle sont punies de cinq ans d'emprisonnement et de 75 000 euros d'amende. La peine d'emprisonnement est …
- **consommation** (L111-7-3) → `EXPLICITLY_IDENTIFIABLE` : Les fournisseurs de plateformes en ligne, de moteurs de recherche en ligne et de comparateurs en ligne et les personnes qui fournissent des services de communications interpersonnelles non fondés sur …

1. **Ce que la question permet de déduire :** Audits cybersécurité plateformes ; Sanctions stupéfiants (2 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Audits cybersécurité plateformes ; 2. Sanctions stupéfiants.
3. **Corpus gold :** consommation = EXPLICITLY_IDENTIFIABLE ; pénal = EXPLICITLY_IDENTIFIABLE.
4. **Origine du problème :** Échec router probable (gold défendable). Deux dimensions explicitement dans la question.

### q389

**Question :** Quelles conditions doivent être respectées pour pouvoir considérer qu'une vente volontaire de meubles aux enchères publiques porte sur des biens neufs en gros, et comment doit être indiquée la nature neuve d'un bien lors de la publicité ?

**Gold articles :**
- **monétaire** (L313-6) → `QUESTIONABLE_GOLD` : Les règles relatives au fichier des incidents de paiement caractérisés sont fixées par les articles L. 751-1 à L. 751-6, L. 752-1 à L. 752-3, L. 762-1 et L. 762-2 du code de la consommation.  Sous-sec…
- **commerce** (L321-1) → `EXPLICITLY_IDENTIFIABLE` : Sous réserve des dispositions de l'article L. 322-8, les ventes volontaires de meubles aux enchères publiques peuvent porter sur des biens neufs ou sur des biens d'occasion. Ces biens sont vendus au d…

1. **Ce que la question permet de déduire :** Ventes enchères biens neufs en gros (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Ventes enchères biens neufs en gros.
3. **Corpus gold :** commerce = EXPLICITLY_IDENTIFIABLE ; monétaire = QUESTIONABLE_GOLD.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Commerce explicite ; L313-6 renvoie au fichier incidents consommation, pas au CMF substantiel.

### q390

**Question :** Qui peut organiser et réaliser les ventes volontaires de meubles aux enchères publiques selon la réglementation, et dans quelles conditions spécifiques les notaires sont-ils habilités à exercer cette activité ?

**Gold articles :**
- **commerce** (L321-2) → `EXPLICITLY_IDENTIFIABLE` : Les ventes volontaires de meubles aux enchères publiques sont, sauf les cas prévus à l'article L. 321-36 organisées et réalisées dans les conditions prévues au présent chapitre par des opérateurs exer…
- **pénal** (R321-10) → `QUESTIONABLE_GOLD` : Le registre doit être coté et paraphé par le commissaire de police ou, à défaut, par le maire de la commune du lieu de la manifestation. Il est tenu à la disposition des services de police et de genda…

1. **Ce que la question permet de déduire :** Organisation ventes enchères / notaires (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Organisation ventes enchères / notaires.
3. **Corpus gold :** commerce = EXPLICITLY_IDENTIFIABLE ; pénal = QUESTIONABLE_GOLD.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Commerce explicite ; R321-10 = renvoi réglementaire miroir (override doc).

### q391

**Question :** Quels agents sont compétents pour rechercher et constater les infractions relatives à la sécurité et aux équipements de travail, et selon quelles règles peuvent-ils exercer leurs pouvoirs ?

**Gold articles :**
- **monétaire** (L315-8-1) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : L'émetteur s'assure que l'ensemble des opérations nécessaires à la gestion de la monnaie définie à l'article L. 315-1 du présent code respectent les exigences d'accessibilité prévues à l'article L. 41…
- **travail** (L4311-6) → `EXPLICITLY_IDENTIFIABLE` : Outre les agents de contrôle de l'inspection du travail mentionnés à l'article L. 8112-1, les agents des douanes, les agents de la concurrence, de la consommation et de la répression des fraudes, les …

1. **Ce que la question permet de déduire :** Agents contrôle sécurité travail (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Agents contrôle sécurité travail.
3. **Corpus gold :** travail = EXPLICITLY_IDENTIFIABLE ; monétaire = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Travail explicite ; L315-8-1 (accessibilité monnaie) lien indirect via consommation.

### q393

**Question :** Quels agents sont habilités à rechercher et constater les infractions prévues dans certains articles du code monétaire et financier, et quelles sont les modalités d'accès à ces locaux et documents professionnels ?

**Gold articles :**
- **monétaire** (L317-1) → `EXPLICITLY_IDENTIFIABLE` : Des agents de la Banque de France commissionnés par le ministre chargé de l'économie et les agents mentionnés aux articles L. 511-3 et L. 511-21 du code de la consommation sont habilités à procéder da…
- **pénal** (R624-2) → `QUESTIONABLE_GOLD` : Le fait de diffuser sur la voie publique ou dans des lieux publics des messages contraires à la décence est puni de l'amende prévue pour les contraventions de la 4e classe. Est puni de la même peine l…

1. **Ce que la question permet de déduire :** Agents infractions CMF (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Agents infractions CMF.
3. **Corpus gold :** monétaire = EXPLICITLY_IDENTIFIABLE ; pénal = QUESTIONABLE_GOLD.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). CMF explicite ; R624-2 (contravention décence) sans lien avec pouvoirs agents finance.

### q404

**Question :** Quelles sont les conditions cumulatives exigées pour qu'une société puisse faire publiquement état de sa qualité de société à mission et comment s'articule la déclaration auprès du greffier ?

**Gold articles :**
- **commerce** (L210-10) → `EXPLICITLY_IDENTIFIABLE` : Une société peut faire publiquement état de la qualité de société à mission lorsque les conditions suivantes sont respectées : 1° Ses statuts précisent une raison d'être, au sens de l'article 1835 du …
- **monétaire** (L224-3) → `QUESTIONABLE_GOLD` : Les versements dans un plan d'épargne retraite ayant donné lieu à l'ouverture d'un compte-titres sont affectés à l'acquisition de titres financiers offrant une protection suffisante de l'épargne inves…

1. **Ce que la question permet de déduire :** Société à mission / greffier (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Société à mission / greffier.
3. **Corpus gold :** commerce = EXPLICITLY_IDENTIFIABLE ; monétaire = QUESTIONABLE_GOLD.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). Commerce explicite ; L224-3 (PER) sans lien (override doc q404).

### q405

**Question :** Dans quelles conditions une petite société peut-elle substituer un référent de mission au comité de mission, et que prévoit la loi à propos du contrat de travail de ce référent ?

**Gold articles :**
- **pénal** (222-19-1) → `INVALID_GOLD` : Lorsque la maladresse, l'imprudence, l'inattention, la négligence ou le manquement à une obligation législative ou réglementaire de prudence ou de sécurité prévu par l'article 222-19 est commis par le…
- **commerce** (L210-12) → `EXPLICITLY_IDENTIFIABLE` : Une société qui emploie au cours de l'exercice moins de cinquante salariés permanents et dont les statuts remplissent les conditions définies au 1° et 2° de l'article L. 210-10 peut prévoir dans ses s…

1. **Ce que la question permet de déduire :** Référent mission petite société (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Référent mission petite société.
3. **Corpus gold :** commerce = EXPLICITLY_IDENTIFIABLE ; pénal = INVALID_GOLD.
4. **Origine du problème :** Problème benchmark (gold invalid). Commerce/travail implicite ; 222-19-1 (accident route) sans aucun lien.

### q409

**Question :** Dans quelles conditions une personne est-elle tenue de collaborer avec la justice pour manifester la vérité, et quelles sont les conséquences en cas de refus sans motif légitime, en tenant compte des protections offertes aux consommateurs par la législation ?

**Gold articles :**
- **civil** (10) → `EXPLICITLY_IDENTIFIABLE` : Chacun est tenu d'apporter son concours à la justice en vue de la manifestation de la vérité.  Celui qui, sans motif légitime, se soustrait à cette obligation lorsqu'il en a été légalement requis, peu…
- **consommation** (L112-5) → `EXPLICITLY_IDENTIFIABLE` : Tout professionnel peut demander à l'autorité administrative chargée de la concurrence et de la consommation de prendre formellement position sur la conformité aux articles L. 112-1 à L. 112-4 et aux …

1. **Ce que la question permet de déduire :** Concours à la justice ; Protections consommateurs (2 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Concours à la justice ; 2. Protections consommateurs.
3. **Corpus gold :** civil = EXPLICITLY_IDENTIFIABLE ; consommation = EXPLICITLY_IDENTIFIABLE.
4. **Origine du problème :** Échec router probable (gold défendable). Deux dimensions explicitement dans la question.

### q412

**Question :** Quelles sont les obligations relatives à l'avis de défaut de paiement d'un chèque et comment ont-elles été adaptées pour différentes juridictions territoriales françaises ?

**Gold articles :**
- **civil** (33) → `IMPLICITLY_IDENTIFIABLE` : Pour l'application du présent titre : 1° Les mots : " tribunal de grande instance " sont remplacés par les mots : " tribunal de première instance " ; 2° Aux articles 21-28 et 21-29, les mots : " dans …
- **monétaire** (L131-49) → `EXPLICITLY_IDENTIFIABLE` : Le porteur doit donner avis du défaut de paiement à son endosseur et au tireur dans les quatre jours ouvrables qui suivent le jour du protêt et, en cas de clause de retour sans frais, le jour de la pr…

1. **Ce que la question permet de déduire :** Avis défaut paiement chèque + adaptations territoriales (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Avis défaut paiement chèque + adaptations territoriales.
3. **Corpus gold :** monétaire = EXPLICITLY_IDENTIFIABLE ; civil = IMPLICITLY_IDENTIFIABLE.
4. **Origine du problème :** Mix : gold partiellement implicite + router. Chèque → CMF explicite ; art. 33 civil (adaptation outre-mer) secondaire, non nommé.

### q413

**Question :** Comment prouver des actes d'état civil en l'absence ou la perte des registres officiels, et comment l'application immédiate des lois nouvelles affecte-t-elle la validité de ces actes ?

**Gold articles :**
- **pénal** (112-4) → `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE` : L'application immédiate de la loi nouvelle est sans effet sur la validité des actes accomplis conformément à la loi ancienne. Toutefois, la peine cesse de recevoir exécution quand elle a été prononcée…
- **civil** (46) → `EXPLICITLY_IDENTIFIABLE` : Lorsqu'il n'aura pas existé de registres, ou qu'ils seront perdus, la preuve en sera reçue tant par titres que par témoins ; et, dans ces cas, les mariages, naissances et décès pourront être prouvés t…

1. **Ce que la question permet de déduire :** Preuve actes état civil registres perdus (1 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Preuve actes état civil registres perdus.
3. **Corpus gold :** civil = EXPLICITLY_IDENTIFIABLE ; pénal = LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE.
4. **Origine du problème :** Problème benchmark (gold secondaire discutable). État civil explicite ; 112-4 (application loi nouvelle) cadre transversal non suggéré.

### q423

**Question :** Quelles sont les peines maximum d'emprisonnement prévues en cas de refus de paiement d'un chèque et quelle sanction pécuniaire est applicable en droit monétaire et financier ?

**Gold articles :**
- **pénal** (131-4) → `EXPLICITLY_IDENTIFIABLE` : L'échelle des peines d'emprisonnement est la suivante : 1° Dix ans au plus ; 2° Sept ans au plus ; 3° Cinq ans au plus ; 4° Trois ans au plus ; 5° Deux ans au plus ; 6° Un an au plus ; 7° Six mois au …
- **monétaire** (L163-1) → `EXPLICITLY_IDENTIFIABLE` : Est puni d'une amende de 6 000 euros le fait, pour le tiré, de refuser le paiement d'un chèque hors les cas mentionnés au deuxième alinéa de l'article L. 131-35, au motif que le tireur y a fait opposi…

1. **Ce que la question permet de déduire :** Peines emprisonnement refus chèque ; Sanction pécuniaire CMF chèque (2 dimension(s) identifiable(s)).
2. **Dimensions réellement identifiables :** 1. Peines emprisonnement refus chèque ; 2. Sanction pécuniaire CMF chèque.
3. **Corpus gold :** pénal = EXPLICITLY_IDENTIFIABLE ; monétaire = EXPLICITLY_IDENTIFIABLE.
4. **Origine du problème :** Échec router probable (gold défendable). Deux dimensions explicitement nommées.

## 6. Proposition de correction

> Propositions uniquement — **aucune modification du dataset**.

| ID | Gold actuel | Gold potentiellement justifié | Action proposée | Confiance |
| -- | ----------- | ----------------------------- | --------------- | --------- |
| q351 | civil + consommation | code-civil seul ou REWRITE_QUESTION | REVIEW_MANUALLY | haute |
| q352 | civil + commerce | civil + commerce | KEEP | haute |
| q353 | civil + travail + monétaire | civil + travail (retirer monétaire) | REVIEW_MANUALLY | moyenne |
| q354 | civil + monétaire | civil + monétaire | KEEP | haute |
| q355 | pénal + civil | pénal + civil | KEEP | haute |
| q356 | civil + consommation | civil + consommation | KEEP | haute |
| q357 | consommation + pénal | consommation seul | REMOVE_CORPUS_FROM_GOLD | haute |
| q358 | travail + commerce | travail | RECLASSIFY_AS_SINGLE | haute |
| q359 | commerce + monétaire | commerce + monétaire | REVIEW_MANUALLY | moyenne |
| q360 | commerce + pénal | commerce + pénal | KEEP | haute |
| q361 | travail + monétaire | travail + monétaire | KEEP | moyenne |
| q362 | travail + pénal | travail + pénal | KEEP | haute |
| q363 | monétaire + pénal | monétaire + pénal | KEEP | haute |
| q364 | civil + commerce | civil + commerce | KEEP_BUT_MARK_HARD | moyenne |
| q365 | civil + monétaire | civil + monétaire | KEEP | haute |
| q366 | civil + pénal | civil + pénal | KEEP | haute |
| q367 | consommation + commerce | consommation + commerce | KEEP | haute |
| q368 | civil + pénal | civil + pénal | REVIEW_MANUALLY | moyenne |
| q369 | consommation + commerce | consommation + commerce | KEEP_BUT_MARK_HARD | moyenne |
| q370 | travail + consommation | travail | RECLASSIFY_AS_SINGLE | haute |
| q371 | consommation + travail | consommation + travail | KEEP | haute |
| q372 | consommation + monétaire | consommation + monétaire | KEEP | haute |
| q373 | consommation + pénal | consommation + pénal | KEEP | haute |
| q374 | commerce + monétaire | commerce + monétaire | KEEP | haute |
| q375 | commerce + pénal | commerce + pénal | KEEP | haute |
| q376 | travail + monétaire | travail + monétaire | KEEP | haute |
| q377 | travail + pénal | travail + pénal | KEEP | haute |
| q378 | monétaire + pénal | monétaire + pénal | KEEP | haute |
| q379 | civil + consommation | civil + consommation | KEEP | haute |
| q380 | civil + commerce | civil + commerce | KEEP | haute |
| q381 | civil + travail | civil + travail | KEEP | haute |
| q382 | civil + monétaire | civil + monétaire | KEEP | haute |
| q383 | civil + pénal | civil + pénal | KEEP | haute |
| q384 | consommation + commerce | consommation + commerce | KEEP | haute |
| q385 | consommation + travail | consommation + travail | KEEP | haute |
| q386 | consommation + monétaire | consommation + monétaire | KEEP | haute |
| q387 | consommation + pénal | consommation + pénal | KEEP | haute |
| q388 | commerce + travail | commerce + travail | KEEP | haute |
| q389 | commerce + monétaire | commerce + monétaire | REVIEW_MANUALLY | moyenne |
| q390 | commerce + pénal | commerce seul | REVIEW_MANUALLY | haute |
| q391 | travail + monétaire | travail + monétaire | REVIEW_MANUALLY | moyenne |
| q392 | travail + pénal | travail + pénal | KEEP | haute |
| q393 | monétaire + pénal | monétaire + pénal | REVIEW_MANUALLY | moyenne |
| q394 | civil + consommation | civil + consommation | KEEP | haute |
| q395 | civil + commerce | civil + commerce | KEEP | haute |
| q396 | civil + travail | civil + travail | KEEP | haute |
| q397 | civil + monétaire | civil + monétaire | KEEP | haute |
| q398 | civil + pénal | civil + pénal | KEEP | haute |
| q399 | consommation + commerce | consommation + commerce | KEEP | haute |
| q400 | consommation + travail | consommation + travail | KEEP | haute |
| q401 | consommation + monétaire | consommation + monétaire | KEEP | haute |
| q402 | consommation + pénal | consommation + pénal | KEEP | haute |
| q403 | commerce + travail | commerce + travail | KEEP | haute |
| q404 | commerce + monétaire | commerce seul | REVIEW_MANUALLY | haute |
| q405 | commerce + pénal | commerce | REMOVE_CORPUS_FROM_GOLD | haute |
| q406 | travail + monétaire | travail + monétaire | KEEP | haute |
| q407 | travail + pénal | travail + pénal | KEEP | haute |
| q408 | monétaire + pénal | monétaire + pénal | KEEP | haute |
| q409 | civil + consommation | civil + consommation | KEEP | haute |
| q410 | civil + commerce | civil + commerce | KEEP | haute |
| q411 | civil + travail | civil + travail | KEEP | haute |
| q412 | monétaire + civil | monétaire + civil | KEEP_BUT_MARK_HARD | moyenne |
| q413 | civil + pénal | civil + pénal | REVIEW_MANUALLY | moyenne |
| q414 | consommation + commerce | consommation + commerce | KEEP | haute |
| q415 | consommation + travail | consommation + travail | KEEP | haute |
| q416 | consommation + monétaire | consommation + monétaire | KEEP | haute |
| q417 | consommation + pénal | consommation + pénal | KEEP | haute |
| q418 | commerce + travail | commerce + travail | KEEP | haute |
| q419 | commerce + monétaire | commerce + monétaire | KEEP | haute |
| q420 | commerce + pénal | commerce + pénal | KEEP | haute |
| q421 | travail + monétaire | travail + monétaire | KEEP | haute |
| q422 | travail + pénal | travail + pénal | KEEP | haute |
| q423 | pénal + monétaire | pénal + monétaire | KEEP | haute |
| q424 | civil + consommation | civil + consommation | KEEP | haute |
| q425 | commerce + civil | commerce + civil | KEEP | haute |

## 7. Conclusion

### 1. Quelle proportion des 75 multi est réellement exploitable pour mesurer le routing ?

**~61/75 (81%)** sont exploitables (57 VALID_MULTI + 4 VALID_MULTI_BUT_PARTLY_IMPLICIT). Les 4 dernières restent utilisables mais avec un plafond de score attendu plus bas (second corpus implicite).

### 2. Quelle proportion contient au moins un corpus impossible à déduire depuis la question ?

**~14/75 (19%)** contiennent au moins un corpus `LEGALLY_RELEVANT_BUT_NOT_IDENTIFIABLE`, `QUESTIONABLE_GOLD` ou `INVALID_GOLD` (14 entrées corpus sur 151, soit 9%).

### 3. Le problème principal vient-il du router, du dataset, ou des deux ?

**Principalement du dataset et de la formulation des questions (q351–q370)**, avec une part router sur les multi valides explicites (q387, q423, q409).

- **Dataset (~14/75)** : golds secondaires ajoutés artificiellement, renvois/miroirs réglementaires, overrides documentés (q390, q404).
- **Formulation (~10/75)** : questions mono-dimensionnelles avec deux gold corpora (q351, q358, q370, q405).
- **Router (~5–8/75)** : échecs sur multi valides où les deux dimensions sont pourtant explicites (q387 consommation+pénal, q423 pénal+monétaire, q409 civil+consommation).

Le score multi 62,7% V1/V2 **surestime la faute du router** : une partie significative des « under-predictions » sont des prédictions dominantes correctes face à un gold secondaire non justifiable.

### 4. Un routing en deux passes basé sur des « dimensions juridiques » semble-t-il pertinent ?

**Oui, mais seulement après nettoyage du benchmark.** L'audit confirme que le modèle mental `question → dimension(s) → corpus` est le bon :
- Pour ~76% des questions (q371+), deux dimensions sont déjà explicites → une décomposition en sous-questions améliorerait le recall sans heuristique corpus-dominant.
- Pour ~16 questions mono-dimensionnelles, le routing multi est **mal posé** : une seconde passe ne peut pas deviner un corpus absent de la question.

### 5. Quels types de questions multi conserver pour tester réellement le routing ?

Conserver :
- Questions **compound explicites** (« règles X en consommation **et** sanctions Y au pénal ») — pattern q371–q425.
- Questions citant **deux codes ou deux régimes** distincts dans le texte.
- Paires **thématiquement orthogonales** (consommation+travail, civil+pénal quand les deux branches sont nommées).

Retirer ou réécrire :
- Questions **mono-dimensionnelles** avec second gold ajouté par le générateur (q351, q358, q370, q405).
- Golds **miroir/renvoi** sans ancre dans la question (q390 R321-10, q404 L224-3 PER).
- Juxtapositions **artificielles** pénal transversal (132-12, 112-4, 222-19-1) sans lien sémantique.

**Recommandation :** scinder la métrique multi-corpus en (a) **multi-explicite** (~60 questions nettoyées) et (b) **multi-implicite/hard** (~10–15 questions marquées KEEP_BUT_MARK_HARD), plutôt qu'un exact match binaire sur 75 golds hétérogènes.
