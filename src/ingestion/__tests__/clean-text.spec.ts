import { describe, expect, it } from 'vitest';
import {
  cleanPageText,
  extractFooterDates,
  fixHyphenationLineBreaks,
  LEGIFRANCE_FOOTER_REGEX,
} from '../clean-text.js';

describe('fixHyphenationLineBreaks', () => {
  it('joint une vraie césure de fin de ligne (mot-\nsuite)', () => {
    const input = 'constitutionnel-\nles dispositions';
    expect(fixHyphenationLineBreaks(input)).toBe(
      'constitutionnelles dispositions',
    );
  });

  it('conserve un tiret juridique intra-ligne (Article 113-2-1)', () => {
    const input = 'Article 113-2-1\n\nLe texte continue.';
    expect(fixHyphenationLineBreaks(input)).toBe(input);
  });

  it('ne fusionne pas quand un chiffre suit le tiret (numéro d\'article)', () => {
    const input = '113-\n2';
    expect(fixHyphenationLineBreaks(input)).toBe('113-\n2');
  });

  it('ne fusionne pas un retour à la ligne sans césure (extrait PDF réel)', () => {
    const input =
      'Les juridictions pénales sont compétentes pour interpréter les actes administratifs, réglementaires ou\nindividuels';
    expect(fixHyphenationLineBreaks(input)).toBe(input);
  });

  it('ne fusionne pas une coupure de ligne après un espace', () => {
    const input =
      'Nul ne peut être puni pour un crime ou pour un délit dont les éléments ne sont pas définis par la loi, ou pour\nune contravention';
    expect(fixHyphenationLineBreaks(input)).toBe(input);
  });
});

describe('cleanPageText', () => {
  it('supprime le pied de page Légifrance', () => {
    const raw = `Article 111-5
Code pénal - Dernière modification le 26 août 2026 - Document généré le 07 septembre 2026

Les juridictions pénales`;
    const { text } = cleanPageText(raw);
    expect(text).not.toMatch(LEGIFRANCE_FOOTER_REGEX);
    expect(text).toContain('Les juridictions pénales');
  });

  it('normalise NFC et espaces insécables sans reformuler', () => {
    const raw = 'Texte\u00A0avec espace insécable.';
    const { text } = cleanPageText(raw);
    expect(text).toBe('Texte avec espace insécable.');
  });


  it('supprime intégralement le pied de page y compris la date générée (août)', () => {
    const raw = `Article 111-5
Code pénal - Dernière modification le 26 août 2026 - Document généré le 07 septembre 2026
Les juridictions pénales`;
    const { text } = cleanPageText(raw);
    expect(text).not.toContain('septembre 2026');
    expect(text).not.toContain('août 2026');
    expect(text).toContain('Les juridictions pénales');
  });

  it('extrait les dates du pied de page avec mois accentués', () => {
    const raw =
      'Code pénal - Dernière modification le 26 août 2026 - Document généré le 07 septembre 2026';
    const dates = extractFooterDates(raw);
    expect(dates.lastModified).toBe('26 août 2026');
    expect(dates.generatedAt).toBe('07 septembre 2026');
  });

  it('conserve les retours à la ligne non liés à une césure', () => {
    const raw = 'Premier alinéa.\n\nDeuxième alinéa.';
    const { text } = cleanPageText(raw);
    expect(text).toBe('Premier alinéa.\n\nDeuxième alinéa.');
  });
});
