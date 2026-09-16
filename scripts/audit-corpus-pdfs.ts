import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { cleanPageText, extractFooterDates, isBlankPage } from '../src/ingestion/clean-text.js';
import { extractPdfPages } from '../src/ingestion/extract-pdf.js';
import {
  ARTICLE_LINE_REGEX,
  pageLinesFromCleanedPages,
  parseStructure,
} from '../src/ingestion/parse-structure.js';

const PDFS = [
  { id: 'code-penal', name: 'Code p?nal', path: 'data/code-penal-13-09-2026.pdf' },
  { id: 'code-civil', name: 'Code civil', path: 'data/code-civil-19-06-2026.pdf' },
  { id: 'code-travail', name: 'Code du travail', path: 'data/code-du-travail-16-09-2026.pdf' },
  { id: 'code-commerce', name: 'Code de commerce', path: 'data/code-du-commerce-16-09-2026.pdf' },
  {
    id: 'code-monetaire',
    name: 'Code mon?taire et financier',
    path: 'data/code-monetaire-et-financier-16-09-2026.pdf',
  },
  {
    id: 'code-consommation',
    name: 'Code de la consommation',
    path: 'data/code-de-la-consommation-16-09-2026.pdf',
  },
];

const GENERIC_ARTICLE_REGEXES = [
  {
    name: 'penal-style',
    regex:
      /^Article ((?:[RD]?\d+(?:-\d+)+(?: [A-Z])?(?: bis| ter| quater| quinquies| sexies| septies| octies| nonies| decies)?))\s*$/i,
  },
  { name: 'simple-numeric', regex: /^Article (\d+(?:-\d+)*)\s*$/ },
  { name: 'R-prefix', regex: /^Article (R\d+(?:-\d+)+)\s*$/ },
  { name: 'D-prefix', regex: /^Article (D\d+(?:-\d+)+)\s*$/ },
  { name: 'L-prefix', regex: /^Article (L\d+(?:-\d+)+)\s*$/ },
  { name: 'A-prefix', regex: /^Article (A\d+(?:-\d+)*)\s*$/ },
  { name: 'ANNEXE', regex: /^Article (ANNEXE [IVXLC\d-]+)\s*$/i },
];

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function classifyArticleNumber(num: string): string {
  if (/^R\d/.test(num)) return 'R-prefix';
  if (/^D\d/.test(num)) return 'D-prefix';
  if (/^L\d/.test(num)) return 'L-prefix';
  if (/^A\d/.test(num)) return 'A-prefix';
  if (/ANNEXE/i.test(num)) return 'ANNEXE';
  if (/\bbis\b|\bter\b|\bquater\b/i.test(num)) return 'suffix-bis-ter';
  if (/ [A-Z]$/.test(num)) return 'suffix-alpha';
  if (/^\d+-\d+/.test(num)) return 'hyphen-numeric';
  if (/^\d+$/.test(num)) return 'simple-numeric';
  return 'other';
}

function detectArticlesGeneric(
  pageLines: Array<{ line: string; pageNumber: number }>,
) {
  const articles: Array<{
    articleNumber: string;
    content: string;
    pageStart: number;
    pageEnd: number;
    pattern: string;
  }> = [];
  let current: {
    articleNumber: string;
    lines: string[];
    pageStart: number;
    pageEnd: number;
    pattern: string;
  } | null = null;

  for (const { line, pageNumber } of pageLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (current) current.lines.push('');
      continue;
    }

    let matched = false;
    for (const { name, regex } of GENERIC_ARTICLE_REGEXES) {
      const m = trimmed.match(regex);
      if (m) {
        if (current) {
          articles.push({
            articleNumber: current.articleNumber,
            content: current.lines.join('\n').trim(),
            pageStart: current.pageStart,
            pageEnd: current.pageEnd,
            pattern: current.pattern,
          });
        }
        current = {
          articleNumber: m[1]!,
          lines: [],
          pageStart: pageNumber,
          pageEnd: pageNumber,
          pattern: name,
        };
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if (current) {
      current.lines.push(trimmed);
      current.pageEnd = pageNumber;
    }
  }

  if (current) {
    articles.push({
      articleNumber: current.articleNumber,
      content: current.lines.join('\n').trim(),
      pageStart: current.pageStart,
      pageEnd: current.pageEnd,
      pattern: current.pattern,
    });
  }

  return articles;
}

function sampleLines(
  pages: Array<{ pageNumber: number; text: string }>,
  pageNums: number[],
): string[] {
  const samples: string[] = [];
  for (const pn of pageNums) {
    const page = pages.find((p) => p.pageNumber === pn);
    if (page) {
      samples.push(`--- PAGE ${pn} ---\n${page.text.slice(0, 1500)}`);
    }
  }
  return samples;
}

async function analyzePdf(entry: (typeof PDFS)[number]) {
  const pdfPath = resolve(entry.path);
  const rawPages = await extractPdfPages(pdfPath);
  const cleanedPages: Array<{ pageNumber: number; text: string }> = [];
  const warnings: string[] = [];
  let skippedPages = 0;

  for (const page of rawPages) {
    const { text, warnings: pw } = cleanPageText(page.text);
    warnings.push(...pw);
    if (isBlankPage(text)) {
      skippedPages++;
      continue;
    }
    cleanedPages.push({ pageNumber: page.pageNumber, text });
  }

  const pageLines = pageLinesFromCleanedPages(cleanedPages);
  const penalParsed = parseStructure(pageLines, { sourceFile: entry.path });
  const genericParsed = detectArticlesGeneric(pageLines);

  const lens = genericParsed.map((a) => a.content.length);
  lens.sort((a, b) => a - b);

  const idFormats: Record<string, number> = {};
  for (const a of genericParsed) {
    const cls = classifyArticleNumber(a.articleNumber);
    idFormats[cls] = (idFormats[cls] ?? 0) + 1;
  }

  const patternCounts: Record<string, number> = {};
  for (const a of genericParsed) {
    patternCounts[a.pattern] = (patternCounts[a.pattern] ?? 0) + 1;
  }

  const gt1500 = genericParsed.filter((a) => a.content.length > 1500);
  const gt2000 = genericParsed.filter((a) => a.content.length > 2000);

  const anomalies: Array<{ articleNumber: string; type: string; excerpt: string }> = [];
  for (const a of genericParsed) {
    if (/abrog[?e]/i.test(a.content)) {
      anomalies.push({ articleNumber: a.articleNumber, type: 'abroge', excerpt: a.content.slice(0, 120) });
    }
    if (/supprim[?e]/i.test(a.content)) {
      anomalies.push({ articleNumber: a.articleNumber, type: 'supprime', excerpt: a.content.slice(0, 120) });
    }
    if (/\bbis\b|\bter\b|\bquater\b/i.test(a.articleNumber)) {
      anomalies.push({ articleNumber: a.articleNumber, type: 'bis_ter_id', excerpt: a.content.slice(0, 80) });
    }
    if (a.pageEnd - a.pageStart > 3) {
      anomalies.push({
        articleNumber: a.articleNumber,
        type: 'multi_page',
        excerpt: `pages ${a.pageStart}-${a.pageEnd}, len=${a.content.length}`,
      });
    }
  }

  const structuralLines = {
    partie: 0,
    livre: 0,
    titre: 0,
    chapitre: 0,
    section: 0,
    articlePenalRegex: 0,
    articleLineAny: 0,
  };
  for (const { line } of pageLines) {
    const t = line.trim();
    if (/^Partie (?:l?gislative|r?glementaire)/.test(t)) structuralLines.partie++;
    if (/^Livre /.test(t)) structuralLines.livre++;
    if (/^Titre /.test(t)) structuralLines.titre++;
    if (/^Chapitre /.test(t)) structuralLines.chapitre++;
    if (/^Section \d+/.test(t)) structuralLines.section++;
    if (ARTICLE_LINE_REGEX.test(t)) structuralLines.articlePenalRegex++;
    if (/^Article /.test(t)) structuralLines.articleLineAny++;
  }

  const unmatchedArticleLines: string[] = [];
  for (const { line } of pageLines) {
    const t = line.trim();
    if (!/^Article /.test(t)) continue;
    const matched = GENERIC_ARTICLE_REGEXES.some((r) => r.regex.test(t));
    if (!matched && unmatchedArticleLines.length < 20) {
      unmatchedArticleLines.push(t);
    }
  }

  const samplePageNums = [
    1,
    Math.floor(rawPages.length * 0.25),
    Math.floor(rawPages.length * 0.5),
    Math.floor(rawPages.length * 0.75),
    rawPages.length,
  ].filter((n, i, arr) => n >= 1 && arr.indexOf(n) === i);

  const articleLineSamples: string[] = [];
  for (const { line } of pageLines) {
    const t = line.trim();
    if (/^Article /.test(t) && articleLineSamples.length < 20) {
      articleLineSamples.push(t);
    }
  }

  const footerDates = extractFooterDates(rawPages[0]?.text ?? '');

  const footerInCleaned = cleanedPages
    .slice(0, 10)
    .some((p) => /Derni?re modification/.test(p.text));

  return {
    id: entry.id,
    name: entry.name,
    path: entry.path,
    pageCount: rawPages.length,
    skippedPages,
    footerDates,
    footerStillPresentAfterClean: footerInCleaned,
    structuralLines,
    penalParserArticleCount: penalParsed.length,
    genericArticleCount: genericParsed.length,
    uniqueArticleNumbers: new Set(genericParsed.map((a) => a.articleNumber)).size,
    stats: lens.length
      ? {
          min: lens[0],
          max: lens[lens.length - 1],
          avg: Number((lens.reduce((s, v) => s + v, 0) / lens.length).toFixed(1)),
          median: median(lens),
          gt1500: gt1500.length,
          gt2000: gt2000.length,
          needsMultiChunk: gt2000.length,
        }
      : null,
    idFormats,
    patternCounts,
    longestArticles: [...genericParsed]
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, 8)
      .map((a) => ({
        articleNumber: a.articleNumber,
        length: a.content.length,
        pages: `${a.pageStart}-${a.pageEnd}`,
        excerpt: a.content.slice(0, 100),
      })),
    shortestArticles: [...genericParsed]
      .filter((a) => a.content.length > 0)
      .sort((a, b) => a.content.length - b.content.length)
      .slice(0, 8)
      .map((a) => ({
        articleNumber: a.articleNumber,
        length: a.content.length,
        excerpt: a.content.slice(0, 100),
      })),
    anomalySamples: anomalies.slice(0, 25),
    anomalyCount: anomalies.length,
    articleLineSamples,
    unmatchedArticleLines,
    textSamples: sampleLines(cleanedPages, samplePageNums),
    warnings: [...new Set(warnings)],
  };
}

async function main() {
  const results = [];
  for (const pdf of PDFS) {
    console.error(`Analyzing ${pdf.name}...`);
    results.push(await analyzePdf(pdf));
  }
  const outPath = resolve('data/evaluation/corpus-audit-report.json');
  await writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));
  console.log(`Report written to ${outPath}`);
}

main().catch(console.error);
