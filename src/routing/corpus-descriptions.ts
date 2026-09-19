import {
  ALL_CORPUS_IDS,
  CORPUS_CONFIGS,
  type CorpusConfig,
} from '../ingestion/corpus-config.js';
import type { CorpusRoutingDescription } from './types.js';

const CORPUS_DOMAIN_DESCRIPTIONS: Record<string, string> = {
  'code-penal':
    'Droit pénal : infractions, éléments constitutifs, tentative, complicité, circonstances, peines, responsabilité pénale, légitime défense, violences, vol, escroquerie, recel, etc.',
  'code-civil':
    'Droit civil général : personnes, famille, successions, obligations, contrats (hors contrats de consommation spécifiques), responsabilité civile, dommages-intérêts, biens, prescription civile, sûretés, etc.',
  'code-du-travail':
    'Droit du travail : contrat de travail, licenciement, rémunération, durée du travail, congés, harcèlement, représentation du personnel, relations employeur/salarié, santé au travail, etc.',
  'code-du-commerce':
    'Droit commercial : commerçants, actes de commerce, fonds de commerce, sociétés commerciales, baux commerciaux, procédures collectives commerciales, registre du commerce, etc.',
  'code-monetaire-et-financier':
    'Droit monétaire et financier : monnaie, banque, crédit bancaire, établissements financiers, services de paiement, marchés financiers, instruments financiers, assurance, intermédiaires financiers, blanchiment, etc.',
  'code-de-la-consommation':
    'Droit de la consommation : relations professionnel/consommateur, contrats de consommation, crédit à la consommation, garanties légales, vices cachés, pratiques commerciales, clauses abusives, démarchage, vente à distance, etc.',
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
