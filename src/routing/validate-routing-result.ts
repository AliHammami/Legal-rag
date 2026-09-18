import { getCorpusConfig } from '../ingestion/corpus-config.js';
import { RoutingError } from './routing.error.js';
import type { RoutingRawResponse, RoutingResult } from './types.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateRoutingResult(raw: unknown): RoutingResult {
  if (!isRecord(raw)) {
    throw new RoutingError(
      'Routing response must be a JSON object',
      'ROUTING_INVALID',
    );
  }

  const allowedKeys = new Set(['corpusIds', 'reason']);
  for (const key of Object.keys(raw)) {
    if (!allowedKeys.has(key)) {
      throw new RoutingError(
        `Unexpected field in routing response: ${key}`,
        'ROUTING_INVALID',
      );
    }
  }

  if (!('corpusIds' in raw)) {
    throw new RoutingError(
      'Routing response missing corpusIds',
      'ROUTING_INVALID',
    );
  }

  if (!Array.isArray(raw.corpusIds)) {
    throw new RoutingError(
      'Routing response corpusIds must be an array',
      'ROUTING_INVALID',
    );
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const value of raw.corpusIds) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new RoutingError(
        'Routing response corpusIds must contain non-empty strings',
        'ROUTING_INVALID',
      );
    }

    try {
      getCorpusConfig(value);
    } catch {
      throw new RoutingError(
        `Unknown corpus in routing response: ${value}`,
        'ROUTING_UNKNOWN_CORPUS',
      );
    }

    if (!seen.has(value)) {
      seen.add(value);
      normalized.push(value);
    }
  }

  let reason: string | undefined;
  if ('reason' in raw && raw.reason !== undefined) {
    if (typeof raw.reason !== 'string' || raw.reason.trim().length === 0) {
      throw new RoutingError(
        'Routing response reason must be a non-empty string when provided',
        'ROUTING_INVALID',
      );
    }
    reason = raw.reason.trim();
  }

  return reason === undefined
    ? { corpusIds: normalized }
    : { corpusIds: normalized, reason };
}

export function parseRoutingRawResponse(raw: unknown): RoutingResult {
  return validateRoutingResult(raw as RoutingRawResponse);
}
