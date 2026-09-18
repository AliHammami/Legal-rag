import type { RoutingMetadata } from './types.js';

export function formatRoutingMetadata(routing?: RoutingMetadata): string {
  if (!routing) {
    return 'disabled or explicit corpus override';
  }

  if (routing.fallbackToGlobal) {
    return 'ambiguous ? global retrieval';
  }

  return routing.corpusIds.join(', ');
}
