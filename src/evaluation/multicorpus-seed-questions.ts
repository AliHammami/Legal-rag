import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

function abstentionAnswer(scope: string): string {
  return `Les corpus juridiques disponibles (code p?nal, code civil, code du travail, code de commerce, code mon?taire et financier, code de la consommation) ne permettent pas de r?pondre de mani?re fiable ? cette question, qui rel?ve ${scope}. Le syst?me doit s'abstenir plut?t que d'inventer une r?gle juridique.`;
}

export const AMBIGUOUS_SEED_QUESTIONS: Omit<LegalMulticorpusEvaluationQuestion, 'id'>[] = [
  {
    question: 'Quelles sont les r?gles applicables en cas de responsabilit? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La question est trop g?n?rale : la responsabilit? peut relever du droit p?nal, civil, commercial, du travail ou de la consommation selon le contexte factuel absent ici. Sans pr?cisions, aucun corpus ne peut ?tre s?lectionn? de mani?re fiable.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les d?lais de prescription applicables ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les d?lais de prescription varient selon la nature de l action (p?nale, civile, commerciale, sociale, etc.) et ne peuvent pas ?tre d?termin?s sans identifier la mati?re et le type de droit concern?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle sanction est pr?vue pour ce type de comportement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Aucun comportement concret n est d?crit. Sans qualification juridique de l acte, il est impossible d identifier le r?gime de sanctions pertinent parmi les corpus disponibles.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles formalit?s faut-il respecter pour conclure un accord ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les formalit?s d?pendent de la nature de l accord (contrat civil, acte commercial, accord de consommation, relation de travail, etc.), non pr?cis?e dans la question.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits du demandeur dans cette proc?dure ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La proc?dure vis?e n est pas identifi?e. Les droits applicables diff?rent selon qu il s agit d une proc?dure p?nale, civile, prud homale, commerciale ou administrative.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Une entreprise peut-elle ?tre tenue responsable des actes de ses repr?sentants ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La responsabilit? d une entreprise peut relever du droit p?nal, civil, commercial ou du travail selon le contexte (infraction, dommage, relation commerciale, relation salariale). La question ne permet pas de trancher.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles conditions de validit? s appliquent ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les conditions de validit? d?pendent de l objet juridique vis? (acte p?nal, contrat, acte de consommation, d?cision d entreprise, etc.), non pr?cis? ici.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels recours existe-t-il en cas de litige ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les recours varient selon la mati?re du litige et la juridiction comp?tente. Sans indication du type de litige, aucun corpus unique ne peut ?tre s?lectionn?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la peine encourue ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L infraction ou la faute n est pas identifi?e. La peine ou la sanction d?pend du r?gime juridique applicable, ind?terminable sans contexte factuel.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles obligations incombent au professionnel ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les obligations d un professionnel varient selon qu il agit en droit commercial, de la consommation, du travail ou dans un cadre p?nal. La question est insuffisamment pr?cise.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Un contrat peut-il ?tre annul? pour vice du consentement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L annulation pour vice du consentement existe en droit civil et peut aussi se poser en droit de la consommation selon le contrat. Sans nature du contrat, le routage vers un corpus unique est incertain.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles r?gles prot?gent la partie la plus faible ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La protection de la partie faible peut relever du droit du travail, de la consommation ou du droit civil g?n?ral selon la relation juridique, non d?crite ici.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les effets d un manquement contractuel ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les effets d un manquement contractuel d?pendent du type de contrat et du r?gime applicable (civil, commercial, consommation, travail), non pr?cis?s.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Existe-t-il une obligation d information pr?alable ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'De multiples r?gimes imposent une information pr?alable (consommation, travail, services financiers, droit civil). Sans contexte, la question reste ambigu?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle juridiction est comp?tente ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La comp?tence juridictionnelle d?pend de la mati?re du litige et n est pas d?ductible de cette formulation g?n?rale.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les crit?res de loyaut? applicables ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La loyaut? peut ?tre exig?e en droit commercial, civil ou de la consommation selon la relation. La question ne permet pas d identifier un corpus unique.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on r?silier unilat?ralement la relation ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La r?siliation unilat?rale d?pend de la nature de la relation (contrat civil, commercial, consommation, emploi). Le contexte factuel fait d?faut.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles garanties l?gales s appliquent au bien achet? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les garanties l?gales peuvent relever du code civil et/ou du code de la consommation selon le statut de l acheteur et du vendeur, non pr?cis?s.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la responsabilit? du dirigeant ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La responsabilit? d un dirigeant peut ?tre p?nale, civile ou commerciale selon les faits. Sans qualification, le corpus pertinent est ind?terminable.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels documents doivent ?tre remis au client ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les documents ? remettre varient selon qu il s agit d une op?ration de consommation, d un contrat civil, d un acte bancaire ou d une relation commerciale B2B.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Un acte peut-il ?tre nul pour ill?galit? de l objet ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La nullit? pour ill?galit? de l objet se traite principalement en droit civil, mais la question peut aussi concerner d autres r?gimes selon l acte vis?, non identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les r?gles en cas de cessation d activit? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La cessation d activit? peut relever du droit commercial, du travail, de la consommation ou du droit p?nal selon les cons?quences vis?es, non pr?cis?es.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels int?r?ts sont dus en cas de retard ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les int?rts de retard d?pendent du type d obligation (civile, commerciale, bancaire, consommation). La question est trop g?n?rale pour un routage fiable.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la sanction en cas de pratique abusive ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pratiques abusives peuvent relever du droit de la consommation, du droit commercial ou du droit p?nal selon les faits, non d?crits.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les pouvoirs de l autorit? administrative ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pouvoirs de l autorit? administrative ne sont pas d?finis de mani?re transversale dans les six corpus disponibles sans pr?cision du domaine r?glement?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on invoquer la force majeure ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La force majeure est principalement trait?e en droit civil et peut aussi intervenir dans d autres relations contractuelles. Sans type de contrat, la question reste ambigu?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les r?gles de publicit? des prix ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La publicit? des prix peut concerner la consommation et/ou le commerce selon le contexte. La question ne permet pas de s?lectionner un corpus unique.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les effets d une faillite ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les effets d une proc?dure collective touchent plusieurs mati?res (commercial, civil, travail, p?nal). Sans pr?cision, le routage vers un corpus est incertain.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la r?gle applicable aux clauses limitatives de responsabilit? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les clauses limitatives de responsabilit? sont encadr?es diff?remment selon le droit civil, commercial ou de la consommation. Le contrat vis? n est pas identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits en cas de rupture brutale de relations ?tablies ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La rupture brutale peut relever du droit commercial ou civil selon la relation. Sans description de la relation, la question est ambigu?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Une personne peut-elle ?tre tenue de r?parer un pr?judice ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L obligation de r?parer un pr?judice existe en droit civil et peut aussi se poser en droit p?nal, du travail ou de la consommation selon les faits, non pr?cis?s.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les r?gles sur le cr?dit ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Le cr?dit peut relever du code mon?taire et financier, du code de la consommation ou du code civil selon l op?ration. La question est trop g?n?rale.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les crit?res de bonne foi ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La bonne foi est un principe transversal du droit civil et peut aussi s appr?cier dans d autres relations juridiques sans contexte factuel.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la sanction applicable ? une pratique anticoncurrentielle ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pratiques anticoncurrentielles peuvent relever du droit commercial, p?nal ou de la consommation selon les faits, non d?crits ici.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits attach?s ? la propri?t? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les droits de propri?t? sont principalement civils, mais la question peut aussi concerner d autres r?gimes selon le bien ou la situation, non pr?cis?s.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les r?gles applicables aux agents ?conomiques ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Le statut d agent ?conomique peut renvoyer au droit commercial, ? la consommation ou au droit p?nal selon l activit?, non identifi?e.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on exiger le respect d une obligation de s?curit? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L obligation de s?curit? existe dans plusieurs mati?res (travail, consommation, civil, p?nal). Sans contexte, aucun corpus ne peut ?tre choisi avec certitude.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les cons?quences d un d?faut de paiement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les cons?quences d un d?faut de paiement varient selon la nature de l obligation (civile, commerciale, bancaire, consommation), non pr?cis?e.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les principes applicables ? la preuve ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les r?gles de preuve rel?vent principalement du code civil, mais la question peut aussi concerner d autres mati?res selon le litige, non identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle r?gle s applique en cas de conflit d int?r?ts ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les conflits d int?r?ts peuvent ?tre encadr?s en droit commercial, financier, du travail ou p?nal selon la situation, absente de la question.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
];

export const OUT_OF_SCOPE_SEED_QUESTIONS: Omit<LegalMulticorpusEvaluationQuestion, 'id'>[] = [
  {
    question: 'Quelles sont les conditions de la naturalisation fran?aise par mariage ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la nationalit? fran?aise'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quel est le taux de l imp?t sur le revenu pour une tranche ? 30 % ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code g?n?ral des imp?ts'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de comp?tence du tribunal administratif ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de justice administrative'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d une proc?dure de divorce ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de proc?dure civile et des dispositions sp?cifiques au divorce'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les formalit?s pour d?poser un brevet d invention ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la propri?t? intellectuelle'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles d urbanisme pour construire une extension de maison ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l urbanisme'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les obligations d?claratives en mati?re de TVA ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code g?n?ral des imp?ts et du code de la TVA'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de garde ? vue en proc?dure p?nale ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de proc?dure p?nale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ?ligibilit? ? l AAH ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la s?curit? sociale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de classement des ?tablissements scolaires ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l ?ducation'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d attribution d une parcelle en SAFER ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code rural et de la p?che maritime'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de d?ontologie des avocats ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du r?glement int?rieur national de la profession d avocat'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d une officine de pharmacie ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la sant? publique'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de permis de construire en zone N ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l urbanisme'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de l adoption pl?ni?re ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l action sociale et des familles'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de d?tention provisoire ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de proc?dure p?nale'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les obligations environnementales en cas de ICPE ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l environnement'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de copropri?t? pour les travaux dans les parties communes ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('de la loi du 10 juillet 1965 et du code de la construction'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d acc?s au barreau ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du d?cret relatif ? la profession d avocat'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de prescription en droit administratif ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de justice administrative'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de l expropriation pour cause d utilit? publique ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l expropriation pour cause d utilit? publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de l ?lection pr?sidentielle ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code ?lectoral'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d une cr?che ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l action sociale et des familles'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de la responsabilit? m?dicale devant la ONIAM ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la sant? publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de d?livrance d un permis de conduire ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la route'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de la commande publique pour un march? de travaux ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la commande publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de la tutelle d un majeur prot?g? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code civil dans ses dispositions sp?cifiques aux majeurs prot?g?s et du code de l action sociale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de l assembl?e g?n?rale de copropri?t? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('de la loi sur la copropri?t?'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d un ?tablissement d enseignement priv? hors contrat ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l ?ducation'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de la protection des donn?es personnelles au RGPD ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du RGPD et de la loi informatique et libert?s'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de la retraite pour inaptitude ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la s?curit? sociale et des r?gimes de retraite'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de la saisie immobili?re ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code des proc?dures civiles d ex?cution'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d agr?ment d une association ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code g?n?ral des collectivit?s territoriales ou de lois sp?ciales selon le type d agr?ment'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les r?gles de la chasse en p?riode de nidification ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l environnement et du code rural'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d inscription au tableau de l ordre des m?decins ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de d?ontologie m?dicale et du code de la sant? publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
];

export function buildSeedQuestions(
  startId: number,
  seeds: Omit<LegalMulticorpusEvaluationQuestion, 'id'>[],
): LegalMulticorpusEvaluationQuestion[] {
  return seeds.map((seed, index) => ({
    id: `q${String(startId + index).padStart(3, '0')}`,
    ...seed,
  }));
}
