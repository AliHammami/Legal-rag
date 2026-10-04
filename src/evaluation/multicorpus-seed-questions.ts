import type { LegalMulticorpusEvaluationQuestion } from './multicorpus-dataset.types.js';

function abstentionAnswer(scope: string): string {
  return `Les corpus juridiques disponibles (code pénal, code civil, code du travail, code de commerce, code monétaire et financier, code de la consommation) ne permettent pas de répondre de manière fiable ? cette question, qui relève ${scope}. Le système doit s'abstenir plutôt que d'inventer une règle juridique.`;
}

export const AMBIGUOUS_SEED_QUESTIONS: Omit<LegalMulticorpusEvaluationQuestion, 'id'>[] = [
  {
    question: 'Quelles sont les règles applicables en cas de responsabilité ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La question est trop générale : la responsabilité peut relever du droit pénal, civil, commercial, du travail ou de la consommation selon le contexte factuel absent ici. Sans précisions, aucun corpus ne peut être sélectionné de manière fiable.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les délais de prescription applicables ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les délais de prescription varient selon la nature de l action (pénale, civile, commerciale, sociale, etc.) et ne peuvent pas être déterminés sans identifier la matière et le type de droit concern?.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle sanction est prévue pour ce type de comportement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Aucun comportement concret n est décrit. Sans qualification juridique de l acte, il est impossible d identifier le régime de sanctions pertinent parmi les corpus disponibles.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles formalités faut-il respecter pour conclure un accord ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les formalités dépendent de la nature de l accord (contrat civil, acte commercial, accord de consommation, relation de travail, etc.), non précisée dans la question.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits du demandeur dans cette procédure ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La procédure visée n est pas identifiée. Les droits applicables différent selon qu il s agit d une procédure pénale, civile, prud homale, commerciale ou administrative.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Une entreprise peut-elle être tenue responsable des actes de ses représentants ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La responsabilité d une entreprise peut relever du droit pénal, civil, commercial ou du travail selon le contexte (infraction, dommage, relation commerciale, relation salariale). La question ne permet pas de trancher.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles conditions de validit? s appliquent ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les conditions de validit? dépendent de l objet juridique vis? (acte pénal, contrat, acte de consommation, décision d entreprise, etc.), non précisés ici.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels recours existe-t-il en cas de litige ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les recours varient selon la matière du litige et la juridiction compétente. Sans indication du type de litige, aucun corpus unique ne peut être sélectionné.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la peine encourue ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L infraction ou la faute n est pas identifiée. La peine ou la sanction dépend du régime juridique applicable, indéterminable sans contexte factuel.',
    difficulty: 'easy',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles obligations incombent au professionnel ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les obligations d un professionnel varient selon qu il agit en droit commercial, de la consommation, du travail ou dans un cadre pénal. La question est insuffisamment précise.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Un contrat peut-il être annulé pour vice du consentement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L annulation pour vice du consentement existe en droit civil et peut aussi se poser en droit de la consommation selon le contrat. Sans nature du contrat, le routage vers un corpus unique est incertain.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles règles protègent la partie la plus faible ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La protection de la partie faible peut relever du droit du travail, de la consommation ou du droit civil général selon la relation juridique, non décrite ici.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les effets d un manquement contractuel ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les effets d un manquement contractuel dépendent du type de contrat et du régime applicable (civil, commercial, consommation, travail), non précisés.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Existe-t-il une obligation d information préalable ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'De multiples régimes imposent une information préalable (consommation, travail, services financiers, droit civil). Sans contexte, la question reste ambiguë.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle juridiction est compétente ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La compétence juridictionnelle dépend de la matière du litige et n est pas déductible de cette formulation générale.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les critères de loyaut? applicables ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La loyaut? peut être exigée en droit commercial, civil ou de la consommation selon la relation. La question ne permet pas d identifier un corpus unique.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on résilier unilatéralement la relation ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La résiliation unilatérale dépend de la nature de la relation (contrat civil, commercial, consommation, emploi). Le contexte factuel fait défaut.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles garanties légales s appliquent au bien acheté ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les garanties légales peuvent relever du code civil et/ou du code de la consommation selon le statut de l acheteur et du vendeur, non précisés.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la responsabilité du dirigeant ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La responsabilité d un dirigeant peut être pénale, civile ou commerciale selon les faits. Sans qualification, le corpus pertinent est indéterminable.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels documents doivent être remis au client ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les documents ? remettre varient selon qu il s agit d une opération de consommation, d un contrat civil, d un acte bancaire ou d une relation commerciale B2B.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Un acte peut-il être nul pour illégalité de l objet ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La nullit? pour illégalité de l objet se traite principalement en droit civil, mais la question peut aussi concerner d autres régimes selon l acte vis?, non identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les règles en cas de cessation d activit? ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La cessation d activit? peut relever du droit commercial, du travail, de la consommation ou du droit pénal selon les conséquences visées, non précisées.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels intérêts sont dus en cas de retard ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les intérts de retard dépendent du type d obligation (civile, commerciale, bancaire, consommation). La question est trop générale pour un routage fiable.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la sanction en cas de pratique abusive ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pratiques abusives peuvent relever du droit de la consommation, du droit commercial ou du droit pénal selon les faits, non décrits.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les pouvoirs de l autorit? administrative ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pouvoirs de l autorit? administrative ne sont pas définis de manière transversale dans les six corpus disponibles sans précision du domaine règlementé.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on invoquer la force majeure ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La force majeure est principalement traitée en droit civil et peut aussi intervenir dans d autres relations contractuelles. Sans type de contrat, la question reste ambiguë.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les règles de publicité des prix ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La publicité des prix peut concerner la consommation et/ou le commerce selon le contexte. La question ne permet pas de sélectionner un corpus unique.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les effets d une faillite ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les effets d une procédure collective touchent plusieurs matières (commercial, civil, travail, pénal). Sans précision, le routage vers un corpus est incertain.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la règle applicable aux clauses limitatives de responsabilité ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les clauses limitatives de responsabilité sont encadrées différemment selon le droit civil, commercial ou de la consommation. Le contrat vis? n est pas identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits en cas de rupture brutale de relations établies ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La rupture brutale peut relever du droit commercial ou civil selon la relation. Sans description de la relation, la question est ambiguë.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Une personne peut-elle être tenue de réparer un préjudice ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L obligation de réparer un préjudice existe en droit civil et peut aussi se poser en droit pénal, du travail ou de la consommation selon les faits, non précisés.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les règles sur le crédit ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Le crédit peut relever du code monétaire et financier, du code de la consommation ou du code civil selon l opération. La question est trop générale.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les critères de bonne foi ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'La bonne foi est un principe transversal du droit civil et peut aussi s apprécier dans d autres relations juridiques sans contexte factuel.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle est la sanction applicable ? une pratique anticoncurrentielle ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les pratiques anticoncurrentielles peuvent relever du droit commercial, pénal ou de la consommation selon les faits, non décrits ici.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les droits attachés ? la propriété ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les droits de propriété sont principalement civils, mais la question peut aussi concerner d autres régimes selon le bien ou la situation, non précisés.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les règles applicables aux agents ?conomiques ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Le statut d agent ?conomique peut renvoyer au droit commercial, ? la consommation ou au droit pénal selon l activit?, non identifiée.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Peut-on exiger le respect d une obligation de sécurité ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'L obligation de sécurité existe dans plusieurs matières (travail, consommation, civil, pénal). Sans contexte, aucun corpus ne peut être choisi avec certitude.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelles sont les conséquences d un défaut de paiement ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les conséquences d un défaut de paiement varient selon la nature de l obligation (civile, commerciale, bancaire, consommation), non précisée.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    question: 'Quels sont les principes applicables à la preuve ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les règles de preuve relèvent principalement du code civil, mais la question peut aussi concerner d autres matières selon le litige, non identifi?.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
  {
    question: 'Quelle règle s applique en cas de conflit d intérêts ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer:
      'Les conflits d intérêts peuvent être encadrés en droit commercial, financier, du travail ou pénal selon la situation, absente de la question.',
    difficulty: 'hard',
    questionType: 'ambiguous',
  },
];

export const OUT_OF_SCOPE_SEED_QUESTIONS: Omit<LegalMulticorpusEvaluationQuestion, 'id'>[] = [
  {
    question: 'Quelles sont les conditions de la naturalisation française par mariage ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la nationalit? française'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quel est le taux de l impôt sur le revenu pour une tranche ? 30 % ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code général des impôts'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de compétence du tribunal administratif ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de justice administrative'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d une procédure de divorce ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de procédure civile et des dispositions spécifiques au divorce'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les formalités pour déposer un brevet d invention ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la propriété intellectuelle'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles d urbanisme pour construire une extension de maison ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l urbanisme'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les obligations déclaratives en matière de TVA ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code général des impôts et du code de la TVA'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de garde ? vue en procédure pénale ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de procédure pénale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d éligibilité ? l AAH ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la sécurité sociale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de classement des ?tablissements scolaires ?',
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
    referenceAnswer: abstentionAnswer('du code rural et de la pêche maritime'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de déontologie des avocats ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du règlement intérieur national de la profession d avocat'),
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
    question: 'Quelles sont les règles de permis de construire en zone N ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l urbanisme'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de l adoption plénière ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l action sociale et des familles'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de détention provisoire ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de procédure pénale'),
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
    question: 'Quelles sont les règles de copropriété pour les travaux dans les parties communes ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('de la loi du 10 juillet 1965 et du code de la construction'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d accès au barreau ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du décret relatif ? la profession d avocat'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de prescription en droit administratif ?',
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
    question: 'Quelles sont les règles de l ?lection présidentielle ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code ?lectoral'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d ouverture d une crèche ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l action sociale et des familles'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de la responsabilité médicale devant la ONIAM ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la sant? publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de délivrance d un permis de conduire ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la route'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de la commande publique pour un marché de travaux ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la commande publique'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de la tutelle d un majeur protégé ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code civil dans ses dispositions spécifiques aux majeurs protégés et du code de l action sociale'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de l assemblée générale de copropriété ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('de la loi sur la copropriété'),
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
    question: 'Quelles sont les règles de la protection des données personnelles au RGPD ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du RGPD et de la loi informatique et libertés'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions de la retraite pour inaptitude ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de la sécurité sociale et des régimes de retraite'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de la saisie immobilière ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code des procédures civiles d exécution'),
    difficulty: 'hard',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d agrément d une association ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code général des collectivités territoriales ou de lois spéciales selon le type d agrément'),
    difficulty: 'easy',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les règles de la chasse en période de nidification ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de l environnement et du code rural'),
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
  {
    question: 'Quelles sont les conditions d inscription au tableau de l ordre des médecins ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: abstentionAnswer('du code de déontologie médicale et du code de la sant? publique'),
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
