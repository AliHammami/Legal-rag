export interface SseReply {
  raw: {
    writeHead(statusCode: number, headers: Record<string, string>): void;
    write(chunk: string): boolean;
    end(): void;
  };
}

export function writeSseEvent(
  reply: SseReply,
  event: string,
  data: unknown,
): void {
  reply.raw.write(`event: ${event}\n`);
  reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function initSseResponse(reply: SseReply): void {
  reply.raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
}
