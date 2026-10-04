import { HttpException, HttpStatus } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import { GenerationError } from '../../generation/generation.error.js';
import { OpenAIErrorMapper } from '../../openai/openai-error.mapper.js';
import { RoutingError } from '../../routing/routing.error.js';
import { mapPipelineErrorToHttpException } from '../map-pipeline-error-to-http.js';

describe('mapPipelineErrorToHttpException', () => {
  const mapper = new OpenAIErrorMapper();

  it('maps config errors to 503', () => {
    const error = mapPipelineErrorToHttpException(
      new GenerationError('missing', 'CONFIG_MISSING'),
      mapper,
    );

    expect(error).toBeInstanceOf(HttpException);
    expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
  });

  it('maps routing errors to 502 by default', () => {
    const error = mapPipelineErrorToHttpException(
      new RoutingError('fail', 'ROUTING_API_ERROR'),
      mapper,
    );

    expect(error.getStatus()).toBe(HttpStatus.BAD_GATEWAY);
  });
});
