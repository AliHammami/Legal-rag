import type { BaseMessage } from '@langchain/core/messages';

export function extractMessageContent(message: BaseMessage): string {
  const { content } = message;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (part && typeof part === 'object' && 'text' in part) {
          return String(part.text);
        }
        return '';
      })
      .join('');
  }
  return content == null ? '' : String(content);
}
