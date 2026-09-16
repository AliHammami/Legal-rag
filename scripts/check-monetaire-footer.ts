import { extractPdfPages } from '../src/ingestion/extract-pdf.js';

async function main() {
  const pages = await extractPdfPages('data/code-monetaire-et-financier-16-09-2026.pdf');
  const p = pages[0]!;
  console.log(p.text.slice(-150));
  console.log('includes Derni:', p.text.includes('Derni'));
  console.log('includes modification:', p.text.includes('modification'));
}

main().catch(console.error);
