import {
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { MessageRole } from '../generated/prisma/client.js';
import type { Message } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export const SYSTEM_PROMPT = `Tu es un assistant de recherche juridique.
Dans cette version, tu ne disposes pas encore d'une base documentaire du Code pénal français.
Réponds de manière claire et prudente.
Ne présente pas comme certain un contenu juridique dont tu n'es pas sûr.
Tes réponses ne constituent pas un conseil juridique.`;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async createConversation(): Promise<{ id: string }> {
    const conversation = await this.prisma.conversation.create({ data: {} });
    return { id: conversation.id };
  }

  async assertConversationExists(conversationId: string): Promise<void> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException({
        error: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation introuvable.',
      });
    }
  }

  async saveUserMessage(
    conversationId: string,
    content: string,
  ): Promise<{ userMessageId: string }> {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.user,
        content,
      },
    });
    return { userMessageId: message.id };
  }

  async getConversationMessages(conversationId: string): Promise<Message[]> {
    return this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
  }

  buildOpenAIMessages(dbMessages: Message[]): ChatCompletionMessageParam[] {
    return [
      { role: 'system', content: SYSTEM_PROMPT },
      ...dbMessages.map((message) => ({
        role: message.role as 'user' | 'assistant',
        content: message.content,
      })),
    ];
  }

  async saveAssistantMessage(
    conversationId: string,
    content: string,
  ): Promise<{ assistantMessageId: string }> {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        role: MessageRole.assistant,
        content,
      },
    });

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    return { assistantMessageId: message.id };
  }

  throwMappedError(error: {
    httpStatus: number;
    code: string;
    message: string;
  }): never {
    throw new HttpException(
      { error: error.code, message: error.message },
      error.httpStatus,
    );
  }
}
