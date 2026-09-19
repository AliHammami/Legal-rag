import {
  ALL_CORPUS_IDS,
  CORPUS_CONFIGS,
  type CorpusConfig,
} from '../ingestion/corpus-config.js';
import type { CorpusRoutingDescription } from './types.js';

const CORPUS_DOMAIN_DESCRIPTIONS: Record<string, string> = {
  'code-penal':
    'Droit pénal (substantiel) : infractions, éléments constitutifs, tentative, complicité, circonstances, peines, responsabilité pénale, légitime défense, violences, vol, escroquerie, recel, manipulation artificielle ou frauduleuse des prix lorsqu\'elle constitue une infraction, etc. Ne couvre pas le code de procédure pénale (CPP), les sanctions disciplinaires internes (employeur/salarié) ni les sanctions administratives ou contractuelles.',
  'code-civil':
    'Droit civil général : personnes, famille, successions, obligations, contrats (hors contrats de consommation spécifiques), responsabilité civile, dommages-intérêts, biens, prescription civile, sûretés, état civil (actes, registres, altération), nationalité, sanctions civiles et règles de cumul des sanctions, etc. La nullité y est régie lorsqu\'elle relève du droit commun — pas lorsqu\'elle est spécifique au droit des sociétés commerciales.',
  'code-du-travail':
    'Droit du travail : contrat de travail, licenciement, rémunération, durée du travail, congés, harcèlement, représentation du personnel, relations employeur/salarié, santé au travail, sanctions disciplinaires internes, SMIC, etc.',
  'code-du-commerce':
    'Droit commercial : commerçants, actes de commerce, fonds de commerce, sociétés commerciales, baux commerciaux, procédures collectives commerciales, registre du commerce, immatriculation, prix et politique tarifaire commerciale ordinaire, fausses informations commerciales et sanctions associées, nullité statutaire commerciale, etc. Ne couvre pas la manipulation artificielle ou frauduleuse des prix lorsqu\'elle constitue une infraction pénale, les chèques, protêts, paiements réglementés ni les obligations notariales de remise au greffe (monétaire-financier).',
  'code-monetaire-et-financier':
    'Droit monétaire et financier : monnaie, banque, crédit bancaire, chèques, protêts, défaut de paiement, établissements financiers, services de paiement, marchés financiers, instruments financiers, SICAV, assurance, intermédiaires financiers, blanchiment, obligations des notaires/huissiers en matière de protêts, etc. Distinct du code du commerce (actes de commerce) et du code de la consommation (IPC n\'est pas un signal automatique).',
  'code-de-la-consommation':
    'Droit de la consommation : relations professionnel/consommateur, contrats de consommation, crédit à la consommation, garanties légales, vices cachés, pratiques commerciales, clauses abusives, démarchage, vente à distance, plateformes en ligne, cybersécurité des fournisseurs, signes officiels de qualité et d\'origine des produits, allégations et présentations commerciales, mesures administratives et suspensions, sanctions et peines prévues par le code de la consommation pour les infractions qu\'il définit (y compris la responsabilité pénale des personnes morales), etc. Ne couvre pas l\'indice des prix à la consommation (IPC) utilisé comme référence économique dans d\'autres matières.',
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
