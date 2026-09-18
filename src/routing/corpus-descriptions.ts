import {
  ALL_CORPUS_IDS,
  CORPUS_CONFIGS,
  type CorpusConfig,
} from '../ingestion/corpus-config.js';
import type { CorpusRoutingDescription } from './types.js';

const CORPUS_DOMAIN_DESCRIPTIONS: Record<string, string> = {
  'code-penal':
    'Infractions, responsabilit? p?nale, peines et r?gles g?n?rales du droit p?nal.',
  'code-civil':
    'Contrats, responsabilit? civile, obligations, propri?t?, famille et droit civil g?n?ral.',
  'code-du-travail':
    'Relations de travail, contrat de travail, licenciement, conditions de travail et droit du travail.',
  'code-du-commerce':
    'Actes de commerce, soci?t?s commerciales, faillite et droit commercial.',
  'code-monetaire-et-financier':
    'Banque, assurance, march?s financiers, monnaie et r?gulation financi?re.',
  'code-de-la-consommation':
    'Protection des consommateurs, cr?dit ? la consommation, ventes et pratiques commerciales.',
};

function toRoutingDescription(config: CorpusConfig): CorpusRoutingDescription {
  return {
    id: config.corpusId,
    codeName: config.codeName,
    description: CORPUS_DOMAIN_DESCRIPTIONS[config.corpusId] ?? config.codeName,
  };
}

export const CORPUS_ROUTING_DESCRIPTIONS: CorpusRoutingDescription[] =
  ALL_CORPUS_IDS.map((corpusId) => toRoutingDescription(CORPUS_CONFIGS[corpusId]!));

export function getCorpusRoutingDescription(
  corpusId: string,
): CorpusRoutingDescription | undefined {
  const config = CORPUS_CONFIGS[corpusId];
  return config ? toRoutingDescription(config) : undefined;
}
