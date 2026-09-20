export const DEFAULT_RAG_GENERATION_MODEL = 'gpt-5.6-luna';

export const RAG_GENERATION_MODEL_ENV = 'RAG_GENERATION_MODEL';

export const DEFAULT_RELATIVE_SCORE_THRESHOLD = 0.4;

export const MIN_CONTEXT_CHUNKS = 1;

export const MAX_CONTEXT_CHUNKS = 5;

export const ROUTING_ABSTENTION_ANSWER =
  'Le contexte disponible ne permet pas de répondre à cette question. La question est ambiguë, hors du périmètre des codes juridiques disponibles, ou aucun corpus pertinent n\'a pu être identifié de manière fiable. Aucune recherche juridique n\'a été effectuée.';
