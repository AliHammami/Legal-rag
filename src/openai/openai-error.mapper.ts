import { Injectable } from '@nestjs/common';
import {
  APIConnectionError,
  APIConnectionTimeoutError,
  APIError,
  AuthenticationError,
  RateLimitError,
} from 'openai';

export interface MappedOpenAIError {
  httpStatus: number;
  code: string;
  message: string;
}

@Injectable()
export class OpenAIErrorMapper {
  map(error: unknown): MappedOpenAIError {
    if (error instanceof AuthenticationError) {
      return {
        httpStatus: 503,
        code: 'OPENAI_INVALID_API_KEY',
        message: 'Le service IA est temporairement indisponible.',
      };
    }

    if (error instanceof RateLimitError) {
      return {
        httpStatus: 429,
        code: 'OPENAI_RATE_LIMIT',
        message: 'Service temporairement surchargé. Réessayez plus tard.',
      };
    }

    if (error instanceof APIError) {
      if (error.status === 402) {
        return {
          httpStatus: 503,
          code: 'OPENAI_QUOTA_EXCEEDED',
          message: 'Le service IA a atteint sa limite d\'utilisation.',
        };
      }

      if (error.status === 404) {
        return {
          httpStatus: 503,
          code: 'OPENAI_MODEL_UNAVAILABLE',
          message: 'Modèle IA temporairement indisponible.',
        };
      }
    }

    if (
      error instanceof APIConnectionTimeoutError ||
      error instanceof APIConnectionError
    ) {
      return {
        httpStatus: 504,
        code: 'OPENAI_NETWORK_ERROR',
        message: 'Connexion au service IA interrompue.',
      };
    }

    return {
      httpStatus: 502,
      code: 'OPENAI_UNKNOWN_ERROR',
      message: 'Une erreur inattendue est survenue.',
    };
  }
}
