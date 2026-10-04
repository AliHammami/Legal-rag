import { describe, expect, it } from 'vitest';
import {
  buildLegifranceFooterRegex,
  cleanPageText,
  containsFooterPollution,
} from '../clean-text.js';
import { ALL_CORPUS_IDS, getCorpusConfig } from '../corpus-config.js';

describe('footer Légifrance par corpus', () => {
  for (const corpusId of ALL_CORPUS_IDS) {
    const config = getCorpusConfig(corpusId);

    it(`supprime le footer ${config.codeName}`, () => {
      const raw = `Article test
${config.codeName} - Derni\u00E8re modification le 01 septembre 2026 - Document g\u00E9n\u00E9r\u00E9 le 15 septembre 2026
Contenu juridique.`;
      const footerRegex = buildLegifranceFooterRegex(config.codeName);
      const { text } = cleanPageText(raw, { footerRegex });
      expect(text).toContain('Contenu juridique');
      expect(text).not.toContain('Derni\u00E8re modification');
      expect(containsFooterPollution(text, config.codeName)).toBe(false);
    });
  }
});
