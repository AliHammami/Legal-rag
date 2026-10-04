import { cleanPageText } from '../src/ingestion/clean-text.js';
import { extractPdfPages } from '../src/ingestion/extract-pdf.js';

const pdfs = [
  ['code-penal', 'data/code-penal-13-09-2026.pdf', 'Code pénal'],
  ['code-civil', 'data/code-civil-19-06-2026.pdf', 'Code civil'],
  ['code-travail', 'data/code-du-travail-16-09-2026.pdf', 'Code du travail'],
  ['code-commerce', 'data/code-du-commerce-16-09-2026.pdf', 'Code de commerce'],
  ['code-monetaire', 'data/code-monetaire-et-financier-16-09-2026.pdf', 'Code monétaire et financier'],
  ['code-consommation', 'data/code-de-la-consommation-16-09-2026.pdf', 'Code de la consommation'],
];

async function main() {
  for (const [id, path, label] of pdfs) {
    const pages = await extractPdfPages(path);
    let rawFooter = 0;
    let afterCleanFooter = 0;
    for (const p of pages) {
      if (p.text.includes(`${label} - Derni`)) rawFooter++;
      const { text } = cleanPageText(p.text);
      if (text.includes(`${label} - Derni`)) afterCleanFooter++;
    }
    console.log(
      JSON.stringify({
        id,
        totalPages: pages.length,
        rawFooterPages: rawFooter,
        footerAfterPenalClean: afterCleanFooter,
        removalPct:
          rawFooter > 0
            ? `${(((rawFooter - afterCleanFooter) / rawFooter) * 100).toFixed(1)}%`
            : id === 'code-penal'
              ? '100% (regex matches)'
              : '0%',
      }),
    );
  }
}

main().catch(console.error);
