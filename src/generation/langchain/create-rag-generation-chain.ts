import type { BaseMessage } from '@langchain/core/messages';
import { RunnableLambda } from '@langchain/core/runnables';

import { extractMessageContent } from '../../langchain/extract-message-content.js';
import { GenerationError } from '../generation.error.js';
import { RAG_GENERATION_CHAT_PROMPT } from './rag-generation-chat-prompt.js';
import type { createRagChatModel } from './create-rag-chat-model.js';

function extractRagGenerationAnswer(message: BaseMessage): string {
  const content = extractMessageContent(message).trim();
  if (!content) {
    throw new GenerationError(
      'OpenAI returned an empty generation response',
      'RESPONSE_EMPTY',
    );
  }
  return content;
}

const ragGenerationAnswerExtractor = RunnableLambda.from(
  extractRagGenerationAnswer,
);

/** Prompt → ChatOpenAI → extraction texte (LCEL). */
export function createRagGenerationChain(
  chatModel: ReturnType<typeof createRagChatModel>,
) {
  return RAG_GENERATION_CHAT_PROMPT.pipe(chatModel).pipe(
    ragGenerationAnswerExtractor,
  );
}
