import { createChatOpenAI } from './create-chat-openai.js';
import { extractMessageContent } from './extract-message-content.js';
import { openAiChatMessagesToLangChain } from './openai-chat-messages-to-langchain.js';
import type { StructuredJsonChatInvokeOptions } from './types.js';

/**
 * JSON schema strict via ChatOpenAI.invoke (?quivalent ? response_format OpenAI).
 * Pas de ChatPromptTemplate / withStructuredOutput LCEL ÿ m?me contrat m?tier qu'avant.
 */
export async function invokeStructuredJsonChat<T>(
  options: StructuredJsonChatInvokeOptions,
): Promise<T> {
  const model = createChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
  });

  const invokeInput =
    options.promptValue ??
    (options.messages
      ? openAiChatMessagesToLangChain(options.messages)
      : null);
  if (!invokeInput) {
    throw new Error(
      'invokeStructuredJsonChat requires messages or promptValue',
    );
  }

  const response = await model.invoke(invokeInput, {
    signal: options.signal,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: options.schemaName,
        strict: true,
        schema: options.schema,
      },
    },
  });

  const content = extractMessageContent(response).trim();
  if (!content) {
    throw new Error('OpenAI returned empty structured response');
  }

  return JSON.parse(content) as T;
}
