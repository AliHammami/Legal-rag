import type { LegalMulticorpusEvaluationQuestion } from '../../multicorpus-dataset.types.js';

export const FIXTURE_MULTICORPUS_QUESTIONS: LegalMulticorpusEvaluationQuestion[] = [
  {
    id: 'q001',
    question: 'Quelles sont les conditions de la légitime défense ?',
    goldCorpusIds: ['code-penal'],
    goldArticles: [{ corpusId: 'code-penal', articleNumber: '122-5' }],
    referenceAnswer: 'La légitime défense suppose une riposte nécessaire et proportionnée.',
    difficulty: 'medium',
    questionType: 'single-corpus',
    sourceArticles: [{ corpusId: 'code-penal', articleNumber: '122-5' }],
  },
  {
    id: 'q002',
    question: 'Quelles sont les conditions de validit? d un contrat ?',
    goldCorpusIds: ['code-civil'],
    goldArticles: [{ corpusId: 'code-civil', articleNumber: '1128' }],
    referenceAnswer: 'Le contrat requiert un consentement, une capacit? et un contenu licite.',
    difficulty: 'easy',
    questionType: 'single-corpus',
    sourceArticles: [{ corpusId: 'code-civil', articleNumber: '1128' }],
  },
  {
    id: 'q003',
    question: 'Quelles conséquences civiles et pénales peuvent découler d une escroquerie commerciale ?',
    goldCorpusIds: ['code-penal', 'code-civil'],
    goldArticles: [
      { corpusId: 'code-penal', articleNumber: '313-1' },
      { corpusId: 'code-civil', articleNumber: '1240' },
    ],
    referenceAnswer: 'Réponse combinant responsabilité civile et qualification pénale.',
    difficulty: 'hard',
    questionType: 'multi-corpus',
    sourceArticles: [
      { corpusId: 'code-penal', articleNumber: '313-1' },
      { corpusId: 'code-civil', articleNumber: '1240' },
    ],
  },
  {
    id: 'q004',
    question: 'Quelles sont les règles applicables en cas de responsabilité ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: 'Question ambiguë sans corpus identifiable.',
    difficulty: 'medium',
    questionType: 'ambiguous',
  },
  {
    id: 'q005',
    question: 'Quelles sont les conditions de la naturalisation française ?',
    goldCorpusIds: [],
    goldArticles: [],
    referenceAnswer: 'Hors périmètre des corpus disponibles.',
    difficulty: 'medium',
    questionType: 'out-of-scope',
  },
];
