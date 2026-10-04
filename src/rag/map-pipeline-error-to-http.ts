import { HttpException, HttpStatus } from '@nestjs/common';

import { GenerationError } from '../generation/generation.error.js';
import type { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { RetrievalError } from '../retrieval/retrieval.error.js';
import { RerankingError } from '../reranking/reranking.error.js';
import { RoutingError } from '../routing/routing.error.js';

function httpExceptionFromOpenAiCause(
  error: { code: string; message: string; cause?: unknown },
  mapper: OpenAIErrorMapper,
): HttpException | null {
  if (error.cause === undefined) {
    return null;
  }

  const mapped = mapper.map(error.cause);
  return new HttpException(
    { error: mapped.code, message: mapped.message },
    mapped.httpStatus,
  );
}

function pipelineErrorStatus(code: string): number {
  if (code === 'CONFIG_MISSING') {
    return HttpStatus.SERVICE_UNAVAILABLE;
  }

  if (
    code === 'QUESTION_INVALID' ||
    code === 'QUESTION_EMPTY' ||
    code === 'TOP_K_INVALID' ||
    code === 'TOP_K_TOO_LARGE' ||
    code === 'ROUTING_INVALID'
  ) {
    return HttpStatus.BAD_REQUEST;
  }

  return HttpStatus.BAD_GATEWAY;
}

export function mapPipelineErrorToHttpException(
  error: unknown,
  mapper: OpenAIErrorMapper,
): HttpException {
  if (error instanceof RoutingError) {
    return (
      httpExceptionFromOpenAiCause(error, mapper) ??
      new HttpException(
        { error: error.code, message: error.message },
        pipelineErrorStatus(error.code),
      )
    );
  }

  if (error instanceof GenerationError) {
    return (
      httpExceptionFromOpenAiCause(error, mapper) ??
      new HttpException(
        { error: error.code, message: error.message },
        pipelineErrorStatus(error.code),
      )
    );
  }

  if (error instanceof RetrievalError) {
    return new HttpException(
      { error: error.code, message: error.message },
      pipelineErrorStatus(error.code),
    );
  }

  if (error instanceof RerankingError) {
    return new HttpException(
      { error: error.code, message: error.message },
      pipelineErrorStatus(error.code),
    );
  }

  const mapped = mapper.map(error);
  return new HttpException(
    { error: mapped.code, message: mapped.message },
    mapped.httpStatus,
  );
}
