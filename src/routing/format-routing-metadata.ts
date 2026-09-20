import type { RoutingMetadata } from './types.js';

export function formatRoutingMetadata(routing?: RoutingMetadata): string {
  if (!routing) {
    return 'disabled or explicit corpus override';
  }

  if (routing.decision === 'abstain') {
    return 'abstain (ambiguous or out-of-scope)';
  }

  if (routing.decision === 'global_fallback') {
    return 'global retrieval (explicit empty corpus selection)';
  }

  return routing.corpusIds.join(', ');
}
