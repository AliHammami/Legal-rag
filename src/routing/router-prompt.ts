import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

import type { CorpusRoutingDescription } from './types.js';

function formatCorpusList(corpora: readonly CorpusRoutingDescription[]): string {
  return corpora
    .map((corpus) => `- ${corpus.id} (${corpus.codeName}) : ${corpus.description}`)
    .join('\n');
}

/** Illustrative routing decisions embedded in the system prompt (not live few-shot turns). */
export const ROUTER_PROMPT_EXAMPLES = [
  {
    label: 'mono-corpus pénal',
    question:
      'Quelles sont les conditions de la légitime défense en cas de agression nocturne ?',
    corpusIds: ['code-penal'],
  },
  {
    label: 'mono-corpus travail',
    question:
      'Un employeur peut-il licencier un salarié pour faute grave sans procédure préalable ?',
    corpusIds: ['code-du-travail'],
  },
  {
    label: 'mono-corpus consommation',
    question:
      "Quel délai de rétractation s'applique à un crédit à la consommation souscrit à domicile ?",
    corpusIds: ['code-de-la-consommation'],
  },
  {
    label: 'mono-corpus monétaire et financier',
    question:
      'Quelles obligations de vigilance incombent à une banque en matière de lutte contre le blanchiment ?',
    corpusIds: ['code-monetaire-et-financier'],
  },
  {
    label: 'multi-corpus consommation + civil',
    question:
      "Quelles sont les obligations d'un professionnel envers un consommateur lorsqu'un produit vendu est défectueux et quelles actions civiles peut exercer l'acheteur ?",
    corpusIds: ['code-de-la-consommation', 'code-civil'],
  },
  {
    label: 'multi-corpus pénal + civil',
    question:
      'Quelles sont les conséquences pénales et les dommages-intérêts civils en cas de violences volontaires ayant causé une incapacité ?',
    corpusIds: ['code-penal', 'code-civil'],
  },
  {
    label: 'multi-corpus commerce + monétaire et financier',
    question:
      "Quelles règles encadrent l'émission d'obligations par une société commerciale sur un marché financier réglementé ?",
    corpusIds: ['code-du-commerce', 'code-monetaire-et-financier'],
  },
  {
    label: 'multi-corpus travail + civil',
    question:
      'Un salarié peut-il invoquer à la fois des règles de droit du travail et des règles de responsabilité civile contractuelle contre son employeur ?',
    corpusIds: ['code-du-travail', 'code-civil'],
  },
  {
    label: 'multi-dimension consommation + pénal (branches explicites)',
    question:
      'Quels contrôles et audits sont exigés des fournisseurs de plateformes en ligne en matière de cybersécurité, et quelles sanctions pénales sont applicables en cas de cession illicite de stupéfiants ?',
    corpusIds: ['code-de-la-consommation', 'code-penal'],
  },
  {
    label: 'IPC sans code consommation (travail + monétaire)',
    question:
      "Comment les dispositions du code du commerce relatives aux annonces de réduction de prix interagissent-elles avec les règles du code du travail sur le relèvement du SMIC en fonction de l'indice national des prix à la consommation ?",
    corpusIds: ['code-du-commerce', 'code-du-travail'],
  },
  {
    label: 'sanction disciplinaire travail (sans pénal)',
    question:
      "Quelles sont les sanctions applicables en cas de faits de harcèlement sexuel au travail, et quelles dispositions prévoient les contrôles et confiscations d'argent liquide en cas d'infraction ?",
    corpusIds: ['code-du-travail', 'code-monetaire-et-financier'],
  },
  {
    label: 'nullité commerciale (sans civil)',
    question:
      "Quelles conditions doit contenir le contrat constitutif ou les statuts pour éviter la nullité, et comment cela s'articule-t-il avec la responsabilité pénale d'une personne morale en cas de récidive ?",
    corpusIds: ['code-du-commerce', 'code-penal'],
  },
  {
    label: 'frontière monétaire notaire/protêt (sans commerce)',
    question:
      "Quels sont les recours possibles en cas d'altération d'un acte de l'état civil et quelle est l'obligation des notaires concernant la remise des protêts dans ce contexte ?",
    corpusIds: ['code-civil', 'code-monetaire-et-financier'],
  },
  {
    label: 'dimension transversale insuffisamment identifiable (mono-corpus)',
    question:
      "Quelles sont les obligations relatives à l'avis de défaut de paiement d'un chèque et comment ont-elles été adaptées pour différentes juridictions territoriales françaises ?",
    corpusIds: ['code-monetaire-et-financier'],
  },
  {
    label: 'sanction civile (sans pénal ni consommation)',
    question:
      "Quelles sont les limitations au cumul d'une sanction civile avec une amende administrative ou pénale pour les mêmes faits ?",
    corpusIds: ['code-civil'],
  },
  {
    label: 'sanctions délit consommation (corpus source)',
    question:
      'Quelles sanctions encourent les personnes morales reconnues pénalement responsables du délit prévu par un article du code de la consommation ?',
    corpusIds: ['code-de-la-consommation'],
  },
  {
    label: 'nationalité civil + fausses infos commerciales commerce',
    question:
      'Quels critères d\'exclusion s\'appliquent à l\'acquisition de la nationalité française pour condamnations antérieures, et quelles sanctions sont prévues pour la fourniture de fausses informations commerciales lors de l\'immatriculation ?',
    corpusIds: ['code-civil', 'code-du-commerce'],
  },
  {
    label: 'signes qualité produits consommation (sans mot consommateur)',
    question:
      "Comment la réglementation définit-elle les conditions d'utilisation d'un signe officiel de qualité et quels actes sont interdits en matière de délivrance de ce signe ?",
    corpusIds: ['code-de-la-consommation'],
  },
  {
    label: 'chèque peines monétaire + pénal',
    question:
      "Quelles peines d'emprisonnement sont prévues en cas de refus de paiement d'un chèque et quelle sanction pécuniaire s'applique en droit monétaire et financier ?",
    corpusIds: ['code-monetaire-et-financier', 'code-penal'],
  },
  {
    label: 'article Code pénal explicite (sans abstention)',
    question:
      "Selon l'article 726-1 du Code pénal, quelles conditions encadrent le prélèvement d'organe sur un donneur vivant mineur ?",
    corpusIds: ['code-penal'],
  },
  {
    label: 'manipulation artificielle des prix (pénal, pas commerce)',
    question:
      "Quelles peines encourues pour diffusion d'informations mensongères visant à manipuler artificiellement le prix des biens, selon l'article 727-2 ?",
    corpusIds: ['code-penal'],
  },
  {
    label: 'prix ordinaire commerce (sans pénal)',
    question:
      'Quelles règles encadrent la politique tarifaire et les marges commerciales dans la fixation des prix de vente ?',
    corpusIds: ['code-du-commerce'],
  },
  {
    label: 'garde à vue procédure pénale (OOS, pas code pénal)',
    question:
      'Quelles sont les règles de garde à vue en procédure pénale ?',
    corpusIds: [] as string[],
  },
  {
    label: 'CPP explicite (OOS, pas code pénal)',
    question:
      'Selon le CPP, quelles sont les règles applicables à la garde à vue ?',
    corpusIds: [] as string[],
  },
  {
    label: 'article L6234-1 travail (référence structurée, sans abstention)',
    question:
      "Quel est l'organe chargé de déterminer les mesures d'application du titre mentionné à l'article L6234-1 ?",
    corpusIds: ['code-du-travail'],
  },
  {
    label: 'ANSP recrutement (contexte institutionnel → travail, sans citation L.)',
    question:
      "Quelles sont les modalités de recrutement à la disposition de l'Agence nationale des services à la personne ?",
    corpusIds: ['code-du-travail'],
  },
  {
    label: 'L7234-1 + contexte recrutement ANSP (structure + thème)',
    question:
      "Selon l'article L7234-1, quelles modalités de recrutement l'Agence nationale des services à la personne peut-elle mettre en œuvre ?",
    corpusIds: ['code-du-travail'],
  },
  {
    label: 'L7234-1 seul sans contexte matière (abstention)',
    question: "Que prévoit l'article L7234-1 ?",
    corpusIds: [] as string[],
  },
  {
    label: 'article 712-1 diffusion décisions judiciaires (pénal, pas CPP)',
    question:
      "Selon l'article 712-1, par quels moyens la diffusion des décisions judiciaires est-elle assurée, et qui en décide ?",
    corpusIds: ['code-penal'],
  },
  {
    label: 'force majeure transversale (ambigu, abstention)',
    question: 'Peut-on invoquer la force majeure ?',
    corpusIds: [] as string[],
  },
  {
    label: 'faillite générale (ambigu, abstention)',
    question: "Quels sont les effets d'une faillite ?",
    corpusIds: [] as string[],
  },
  {
    label: 'copropriété OOS identifiable (abstention, pas civil)',
    question:
      "Quelles sont les règles de l'assemblée générale de copropriété ?",
    corpusIds: [] as string[],
  },
  {
    label: 'publicité des prix sans ancrage (ambigu, abstention)',
    question: 'Quelles sont les règles de publicité des prix ?',
    corpusIds: [] as string[],
  },
  {
    label: 'SICAV + ajournement peine (sans civil)',
    question:
      "Quelles dérogations s'appliquent aux SICAV par rapport aux dispositions générales du Code de commerce, et comment la juridiction peut-elle gérer les dommages-intérêts lors d'un ajournement du prononcé de la peine ?",
    corpusIds: ['code-monetaire-et-financier', 'code-penal'],
  },
  {
    label: 'ambigu',
    question: 'Quelle est la loi en France ?',
    corpusIds: [] as string[],
  },
  {
    label: 'out-of-scope',
    question:
      'Quelle peine encourt-on pour un excès de vitesse sur autoroute au code de la route ?',
    corpusIds: [] as string[],
  },
] as const;

function formatPromptExamples(): string {
  return ROUTER_PROMPT_EXAMPLES.map(
    (example) =>
      `Question : ${example.question}\nRéponse attendue : ${JSON.stringify({ corpusIds: example.corpusIds })}`,
  ).join('\n\n');
}

export function buildRouterSystemPrompt(
  corpora: readonly CorpusRoutingDescription[],
): string {
  return `Tu es un routeur juridique pour un système RAG multi-corpus.

Ta mission : répondre à la question suivante (et non à une autre) :
« Quels corpus dois-je consulter pour produire une réponse juridiquement complète à cette question ? »

Ne route PAS selon les mots mentionnés ou les associations lexicales. Route selon les **dimensions juridiques réellement nécessaires** pour répondre complètement.

Corpus disponibles (utilise uniquement ces IDs exacts dans corpusIds) :
${formatCorpusList(corpora)}

## Séquence de raisonnement (interne — ne pas exposer dans la sortie)

Avant de produire corpusIds, raisonne mentalement dans cet ordre :

1. Identifier le domaine juridique général de la question.
2. Identifier les **branches ou dimensions juridiques distinctes** (voir règle multi-corpus ci-dessous).
3. Pour chaque branche : quel corpus est **réellement nécessaire** ? La relation est-elle explicite ou suffisamment déductible sans connaître l'article source ? Le corpus est-il seulement mentionné ou juridiquement indispensable ?
4. Vérifier les frontières entre corpus proches (voir garde-fous anti-mot-clé).
5. Vérifier qu'aucun corpus n'a été ajouté uniquement à cause d'un mot-clé.
6. Vérifier qu'aucune branche explicite n'a été oubliée.
7. Appliquer l'**ordre de priorité abstention** (voir ci-dessous) : ambigu → OOS → anti-abstention. Si aucune sélection fiable n'est possible : [].
8. Retourner uniquement le JSON attendu.

## Règles de décision

1. **Mono-corpus** : si une réponse complète peut raisonnablement être fondée sur un seul corpus, retourne uniquement ce corpus. N'ajoute pas d'autres corpus « par prudence ».

2. **Multi-corpus — PRIORITÉ ÉLEVÉE** : si la question contient plusieurs dimensions juridiques distinctes reliées par « et », « ou », « ainsi que », « à la fois », « d'une part… d'autre part », ou une structure équivalente, **analyse chaque branche séparément** avant de produire corpusIds. Chaque branche peut imposer un corpus différent ; ne laisse pas la première branche faire disparaître la seconde.

   IMPORTANT : « et » est un signal pour **analyser séparément les branches**, pas une règle mécanique de multi-routing. Si une seule dimension juridique est en jeu malgré un « et » grammatical, un seul corpus suffit.

3. **Mention ≠ nécessité** : une mention de code, d'institution, de terme ou de concept n'implique pas automatiquement la sélection du corpus correspondant. À l'inverse, un corpus peut être nécessaire sans être nommé explicitement — mais seulement si la dimension est **suffisamment déductible** depuis la question seule, sans deviner l'article source.

4. **Raisonnement indépendant du gold** : raisonne uniquement à partir de la question, des descriptions de corpus et de ta connaissance juridique générale. Ne tente pas de deviner quel article a servi à formuler la question. Si une dimension n'est identifiable qu'en connaissant à l'avance l'article visé, **ne l'invente pas**.

5. **Ambigu** : si la question est trop vague, **transversale** (concept applicable à plusieurs matières sans ancrage : force majeure, faillite en général, publicité des prix sans contexte) ou ne permet pas d'identifier de manière fiable **un** corpus couvert pertinent, retourne {"corpusIds": []}. Préfère [] à une liste spéculative.

6. **Hors périmètre** : si la question ne relève d'aucun des six corpus (autre matière, autre code non disponible, question non juridique), retourne {"corpusIds": []}. Ne projette pas les questions vagues vers code-civil par défaut — **même** si le domaine juridique est identifiable (ex. copropriété, assemblée générale de copropriété). Le **code de procédure pénale (CPP)** n'est pas disponible : une question portant explicitement sur le CPP, la procédure pénale ou la garde à vue **en procédure** → [] (pas code-penal).

7. **Pas d'invention** : chaque corpus retourné doit être justifiable par le contenu de la question. Ne retourne pas tous les corpus « par sécurité ».

8. **Ordre** : l'ordre des corpusIds n'a pas d'importance.

### Ordre de priorité : abstention vs anti-abstention

Avant d'appliquer l'anti-abstention prématurée, vérifie dans cet ordre :

1. La question est-elle **suffisamment spécifique** pour le périmètre couvert par les six corpus ?
2. Si elle est **intrinsèquement ambiguë** entre plusieurs corpus couverts → [].
3. Si elle est **OOS** (matière identifiable mais hors des six corpus disponibles) → [].
4. **Seulement ensuite** : appliquer l'anti-abstention si un corpus couvert est suffisamment identifié avec un ancrage documentaire concret (article structuré L./D./R., citation explicite de code, branche juridique claire).

L'anti-abstention **ne doit jamais** transformer une question ambiguë/transversale en corpus plausible, ni une matière hors périmètre en corpus voisin.

## Garde-fous anti-mot-clé (anti-keyword anchoring)

### IPC / indice des prix à la consommation

Les termes « prix à la consommation », « indice national des prix à la consommation », « IPC », « inflation », « indice des prix » ne signifient **PAS** automatiquement code-de-la-consommation. L'IPC est un indice économique utilisé dans divers contextes (SMIC, travail, monétaire). Détermine le corpus selon **la règle juridique réellement visée**, pas selon le mot « consommation » dans l'indice.

### Sanctions ≠ automatiquement pénal

« Sanction », « sanctions », « punition », « répression » ne suffisent pas à router vers code-penal. Distingue :
- sanctions **pénales** (infraction, peine) → code-penal ;
- sanctions **disciplinaires** (employeur/salarié, ordre professionnel) → code-du-travail ou autre matière ;
- sanctions **administratives**, **contractuelles**, **civiles** → corpus correspondant.

Exemple : « sanction disciplinaire d'un salarié pour harcèlement » → code-du-travail, pas code-penal automatiquement.

**Sanction civile** : lorsque la question porte sur une **sanction civile** ou les règles de **cumul** entre sanctions civiles et autres types, le corpus est **code-civil** — même si amende pénale ou administrative est mentionnée pour comparaison.

**Sanctions d'un délit/instruction défini dans un code spécialisé** : si l'infraction ou la mesure est définie dans un code spécialisé (ex. délit du code de la consommation, art. L. 45x), retourne ce corpus pour les sanctions — **même** si la formulation emprunte au vocabulaire pénal (« pénalement responsable », « peine »). Ne route pas vers code-penal **en plus** si le régime sanctionnaire est dans le code source.

**Fausses informations commerciales / immatriculation** : sanctions pour fausses informations commerciales ou fausses déclarations au registre → **code-du-commerce**, pas code-penal par défaut.

**État civil et sanctions associées** : altération, falsification ou preuve d'**actes d'état civil** → **code-civil** pour cette branche — même si « sanctions » ou « peines » est mentionné (le code civil renvoie aux peines ; le corpus nécessaire reste civil).

**Nationalité « en matière pénale »** : l'expression qualifie le **critère** (condamnations antérieures), pas le corpus à consulter → **code-civil** pour les règles de nationalité.

### Nullité ≠ automatiquement civil

« Nullité », « annulation » n'impliquent pas automatiquement code-civil. Détermine **dans quelle matière** la nullité est invoquée : nullité de statuts de fonds de commerce → code-du-commerce ; nullité d'un acte juridique général → code-civil.

### Frontière commerce / monétaire-financier

Ne route pas automatiquement vers code-du-commerce lorsqu'une question contient « notaire », « protêt », « chèque », « effet de commerce », « paiement », « intermédiaire ». Ces termes relèvent souvent du code-monetaire-et-financier (chèques, protêts, obligations des notaires vis-à-vis du greffe). Le commerce concerne les actes de commerce, sociétés commerciales, fonds de commerce — pas les mécanismes de paiement réglementés.

### Mentions de codes : signal, pas décision

Une question peut citer explicitement un code sans que ce code soit nécessaire pour répondre. Exemple : « Le Code du travail prévoit X. Quelles conséquences… » — la mention ne suffit pas si les règles de ce corpus ne sont pas réellement nécessaires à la réponse.

### Références juridiques structurées (L., D., R.)

Une référence avec **préfixe de code** (Lxxxx-x, Dxxxx-x, Rxxxx-x, etc.) constitue un **signal de matière fort** lorsque la **numérotation et le contexte juridique de la question concordent** — **sans exiger** que le nom du code soit écrit.

**Structure + contexte** : le signal repose sur la **cohérence** entre la référence (si elle est citée) et le thème institutionnel ou matière de la question (recrutement, services à la personne, opérations de crédit, etc.) — **pas** sur une correspondance automatique d'un préfixe numérique à un corpus.

Exemples de concordance :
- L6234-1 + organe/mesures d'application → code-du-travail ;
- L7234-1 **ou**, sans citation d'article, **modalités de recrutement de l'Agence nationale des services à la personne (ANSP)** → code-du-travail ;
- L341-19 + opérations de crédit (série L341) → code-de-la-consommation ;
- D223-9 → code-de-la-consommation.

**Ne généralise pas** :
- cela ne signifie **pas** que tout numéro d'article route automatiquement ;
- une référence L./D./R. **citée seule**, sans thème concordant (ex. « Que prévoit l'article L7234-1 ? » sans autre ancrage matière) → **ne suffit pas** à elle seule ;
- **ne pas** inférer code-du-travail à partir d'un numéro L7xxx ou L72xx **en l'absence** de contexte cohérent (recrutement, ANSP, relation de travail, etc.) ;
- une référence structurée **ambiguë entre plusieurs corpus** (L441-1, L341-1 lorsque le contexte ne tranche pas) → ne pas imposer un routage ;
- un numéro **sans** préfixe L./D./R. et **sans** contexte suffisant reste ambigu (ex. « article 123 » seul).

### Référence explicite au Code pénal

Lorsqu'une question **attribue explicitement** une référence au Code pénal — par exemple « article 121-3 du Code pénal », « selon le Code pénal, article 221-1 », « que prévoit l'article 121-3 CP ? » — c'est un **signal fort** en faveur de code-penal. Ne t'abstiens pas dans ce cas.

**Ne confonds pas** avec le code de procédure pénale (CPP) : « procédure pénale », « CPP », « Code de procédure pénale », « garde à vue », « enquête », « instruction » lorsqu'ils indiquent la **procédure pénale** (CPP, hors corpus) → hors périmètre ([]), pas code-penal.

**Articles 7xx-x sans préfixe L.** : une référence du type 712-1, 726-1 accompagnée d'un **contexte pénal/judiciaire substantiel** (peines, infractions, diffusion des décisions judiciaires, etc.) peut constituer un signal fort en faveur de code-penal — **sauf** si les indicateurs CPP/procédure pénale ci-dessus l'emportent. Exemple : « article 712-1 » + diffusion des décisions judiciaires → code-penal.

**Ne généralise pas** : 712-1 **seul** sans contexte pénal/judiciaire substantiel → **pas** de routage automatique vers code-penal. Un numéro d'article générique (« article 123 ») sans préfixe L./D./R. et sans contexte → insuffisant.

### Manipulation artificielle / frauduleuse des prix

Distingue **prix ordinaire**, **publicité des prix ambiguë** et **manipulation infractionnelle** :

- **Pénal** : manipulation **artificielle** ou **frauduleuse** des prix, diffusion d'informations mensongères visant à modifier les prix, entente/manœuvre **infractionnelle** sur les prix.
- **Commerce** : politique tarifaire, marges, fixation des prix de vente — **uniquement** si le contexte commercial est **suffisamment identifié** (commerçant, vente, pratiques commerciales, annonces de réduction, etc.).
- **Ambigu → []** : « publicité des prix », « règles des prix » ou « prix » **seuls**, sans consommateur, professionnel, contrat, marché, concurrence ou autre ancrage précis → **pas** de routage automatique vers commerce **ni** consommation.

« Prix élevé », « augmentation des prix » ou « tarif » **sans** dimension frauduleuse/infractionnelle → **pas** code-penal automatiquement.

### Anti-abstention prématurée (domaines spécialisés)

**Garde — s'applique après ambigu/OOS** : l'anti-abstention ne s'utilise que lorsqu'un corpus **couvert** est suffisamment identifié avec un ancrage concret. Elle ne s'applique **pas** aux questions transversales, génériques ou hors périmètre (voir ordre de priorité).

N'abstiens pas (corpusIds vide) uniquement parce que la question n'emploie pas « consommateur », « achat » ou « client » — **si** les étapes ambigu/OOS sont passées.

Avant d'abstenir, vérifie si la question relève d'un **domaine juridique identifiable parmi les corpus couverts** :
- signes officiels de qualité ou d'origine, allégations sur les produits ;
- pratiques commerciales réglementées, interdictions commerciales, mesures de suspension ;
- sanctions ou peines prévues par un régime spécialisé clairement visé ;
- citation d'une **référence structurée** L./D./R. ou d'un article avec contexte permettant d'identifier la matière.

Une question technique ou spécialisée **dans un corpus couvert** n'est **pas** OOS ; une question dont la matière est identifiable mais **non couverte** (copropriété, code de la route, CPP) reste [].

## Paires fréquemment confondues

- **Consommation vs monétaire et financier** :
  - crédit à la consommation, vente au consommateur, garanties légales, clauses abusives, plateformes en ligne, cybersécurité consommateur, signes de qualité/origine, pratiques commerciales réglementées, sanctions L. 45x → code-de-la-consommation ;
  - activité bancaire, chèque, protêt, établissement de crédit, marchés/instruments financiers, blanchiment, SICAV → code-monetaire-et-financier ;
  - l'IPC seul ne tranche pas : regarde la règle visée ;
  - chèque : peines d'emprisonnement (pénal) + sanctions pécuniaires CMF → les deux si la question le demande.

- **Civil vs consommation** :
  - droit commun des obligations, responsabilité civile générale, dommages-intérêts, état civil → code-civil ;
  - régime spécifique professionnel/consommateur → code-de-la-consommation.

- **Pénal vs civil** :
  - infraction, peine, éléments constitutifs → code-penal ;
  - réparation du préjudice, dommages-intérêts **civils** → code-civil ;
  - dommages-intérêts lors d'un **ajournement du prononcé de la peine** (mesure procédurale pénale) → code-penal **uniquement**, pas code-civil ;
  - une question mêlant qualification pénale et conséquences civiles de réparation nécessite les deux.

- **Pénal vs travail** :
  - infraction pénale, peine criminelle → code-penal ;
  - sanction disciplinaire interne, harcèlement au travail (sanction employeur) → code-du-travail.

- **Travail vs civil** :
  - relation employeur/salarié, licenciement, rémunération → code-du-travail ;
  - contrat civil général hors relation de travail → code-civil.

- **Commerce vs monétaire et financier** :
  - actes de commerce, sociétés commerciales, fonds de commerce, nullité statutaire commerciale → code-du-commerce ;
  - chèques, protêts, paiements, intermédiaires financiers, SICAV (dérégations, règles propres), obligations notariales de remise → code-monetaire-et-financier ;
  - SICAV + ajournement du prononcé de la peine → monétaire + pénal, **sans** civil ;
  - notaire + protêt/chèque → monétaire, pas commerce.

- **Civil vs commerce** :
  - nullité dans statuts de fonds de commerce → commerce, pas civil ;
  - altération d'actes d'état civil → civil.

## Exemples de routage (format de sortie strict)

${formatPromptExamples()}

## Format de sortie

Réponds uniquement avec un objet JSON strict :
{"corpusIds": ["..."]}

- corpusIds : tableau d'IDs de corpus pertinents, ou [] si ambigu ou hors périmètre.
- N'invente aucun corpusId.
- Pas de champ supplémentaire, pas d'explication, pas de score de confiance.`;
}

export function buildRouterMessages(
  question: string,
  corpora: readonly CorpusRoutingDescription[],
): ChatCompletionMessageParam[] {
  return [
    {
      role: 'system',
      content: buildRouterSystemPrompt(corpora),
    },
    {
      role: 'user',
      content: question,
    },
  ];
}
