import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { SseReply } from '../common/streaming/sse.util.js';

interface SseRequest {
  raw: {
    on(event: 'close', listener: () => void): void;
    off(event: 'close', listener: () => void): void;
  };
}
import {
  initSseResponse,
  writeSseEvent,
} from '../common/streaming/sse.util.js';
import { OpenAIErrorMapper } from '../openai/openai-error.mapper.js';
import { OpenAIService } from '../openai/openai.service.js';
import { ChatService } from './chat.service.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@Controller('conversations')
export class ConversationsController {
  constructor(
    private readonly chatService: ChatService,
    private readonly openAIService: OpenAIService,
    private readonly openAIErrorMapper: OpenAIErrorMapper,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createConversation() {
    return this.chatService.createConversation();
  }

  @Post(':id/messages')
  async sendMessage(
    @Param('id', ParseUUIDPipe) conversationId: string,
    @Body() body: SendMessageDto,
    @Req() request: SseRequest,
    @Res() reply: SseReply,
  ): Promise<void> {
    await this.chatService.assertConversationExists(conversationId);

    const { userMessageId } = await this.chatService.saveUserMessage(
      conversationId,
      body.content,
    );

    const dbMessages =
      await this.chatService.getConversationMessages(conversationId);
    const openAIMessages = this.chatService.buildOpenAIMessages(dbMessages);

    const abortController = new AbortController();
    let streamFinishedNormally = false;

    const onClientDisconnect = () => {
      if (!streamFinishedNormally) {
        abortController.abort();
      }
    };

    request.raw.on('close', onClientDisconnect);

    let sseStarted = false;
    let assistantContent = '';

    try {
      for await (const delta of this.openAIService.streamChatCompletion(
        openAIMessages,
        abortController.signal,
      )) {
        if (abortController.signal.aborted) {
          break;
        }

        if (!sseStarted) {
          initSseResponse(reply);
          writeSseEvent(reply, 'start', { conversationId, userMessageId });
          sseStarted = true;
        }

        assistantContent += delta;
        writeSseEvent(reply, 'delta', { content: delta });
      }

      if (abortController.signal.aborted) {
        return;
      }

      if (!sseStarted) {
        initSseResponse(reply);
        writeSseEvent(reply, 'start', { conversationId, userMessageId });
        sseStarted = true;
      }

      try {
        const { assistantMessageId } =
          await this.chatService.saveAssistantMessage(
            conversationId,
            assistantContent,
          );

        writeSseEvent(reply, 'done', {
          assistantMessageId,
          content: assistantContent,
        });
      } catch {
        writeSseEvent(reply, 'error', {
          code: 'DB_SAVE_FAILED',
          message: "Impossible d'enregistrer la réponse.",
        });
      }

      streamFinishedNormally = true;
      reply.raw.end();
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const mapped = this.openAIErrorMapper.map(error);

      if (!sseStarted) {
        this.chatService.throwMappedError(mapped);
      }

      writeSseEvent(reply, 'error', {
        code: mapped.code,
        message: mapped.message,
      });
      streamFinishedNormally = true;
      reply.raw.end();
    } finally {
      request.raw.off('close', onClientDisconnect);
    }
  }
}
