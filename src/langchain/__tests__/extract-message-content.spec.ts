import { AIMessage } from '@langchain/core/messages';
import { describe, expect, it } from 'vitest';

import { extractMessageContent } from '../extract-message-content.js';

describe('extractMessageContent', () => {
  it('returns string content from AIMessage', () => {
    const message = new AIMessage('Réponse du modèle.');
    expect(extractMessageContent(message)).toBe('Réponse du modèle.');
  });

  it('joins array content parts', () => {
    const message = new AIMessage([
      { type: 'text', text: 'Partie A. ' },
      { type: 'text', text: 'Partie B.' },
    ]);
    expect(extractMessageContent(message)).toBe('Partie A. Partie B.');
  });
});
