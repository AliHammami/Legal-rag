export interface CorpusConfig {
  corpusId: string;
  codeName: string;
  pdfPath: string;
  outputPath: string;
  chunksOutputPath: string;
  /** Utilise uniquement le regex historique du Code pénal (régression stricte). */
  usePenalArticleMatcher: boolean;
}

export const CORPUS_CONFIGS: Record<string, CorpusConfig> = {
  'code-penal': {
    corpusId: 'code-penal',
    codeName: 'Code p\u00E9nal',
    pdfPath: 'data/code-penal-13-09-2026.pdf',
    outputPath: 'data/processed/code-penal.articles.json',
    chunksOutputPath: 'data/processed/code-penal.chunks.json',
    usePenalArticleMatcher: true,
  },
  'code-civil': {
    corpusId: 'code-civil',
    codeName: 'Code civil',
    pdfPath: 'data/code-civil-19-06-2026.pdf',
    outputPath: 'data/processed/code-civil.articles.json',
    chunksOutputPath: 'data/processed/code-civil.chunks.json',
    usePenalArticleMatcher: false,
  },
  'code-du-travail': {
    corpusId: 'code-du-travail',
    codeName: 'Code du travail',
    pdfPath: 'data/code-du-travail-16-09-2026.pdf',
    outputPath: 'data/processed/code-du-travail.articles.json',
    chunksOutputPath: 'data/processed/code-du-travail.chunks.json',
    usePenalArticleMatcher: false,
  },
  'code-du-commerce': {
    corpusId: 'code-du-commerce',
    codeName: 'Code de commerce',
    pdfPath: 'data/code-du-commerce-16-09-2026.pdf',
    outputPath: 'data/processed/code-du-commerce.articles.json',
    chunksOutputPath: 'data/processed/code-du-commerce.chunks.json',
    usePenalArticleMatcher: false,
  },
  'code-monetaire-et-financier': {
    corpusId: 'code-monetaire-et-financier',
    codeName: 'Code mon\u00E9taire et financier',
    pdfPath: 'data/code-monetaire-et-financier-16-09-2026.pdf',
    outputPath: 'data/processed/code-monetaire-et-financier.articles.json',
    chunksOutputPath: 'data/processed/code-monetaire-et-financier.chunks.json',
    usePenalArticleMatcher: false,
  },
  'code-de-la-consommation': {
    corpusId: 'code-de-la-consommation',
    codeName: 'Code de la consommation',
    pdfPath: 'data/code-de-la-consommation-16-09-2026.pdf',
    outputPath: 'data/processed/code-de-la-consommation.articles.json',
    chunksOutputPath: 'data/processed/code-de-la-consommation.chunks.json',
    usePenalArticleMatcher: false,
  },
};

export const ALL_CORPUS_IDS = Object.keys(CORPUS_CONFIGS);

export function getCorpusConfig(corpusId: string): CorpusConfig {
  const config = CORPUS_CONFIGS[corpusId];
  if (!config) {
    throw new Error(`Corpus inconnu : ${corpusId}`);
  }
  return config;
}

/** Seuil au-delà duquel un article est signalé comme oversized (contenu extrêmement long). */
export const OVERSIZED_ARTICLE_THRESHOLD = 10_000;
