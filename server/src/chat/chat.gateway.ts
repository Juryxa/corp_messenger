import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    WsException,
} from '@nestjs/websockets';
import {Server, Socket} from 'socket.io';
import {ChatService} from './chat.service';
import {SendMessageDto} from './dto/send-message.dto';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {Injectable, UsePipes, ValidationPipe} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
@UsePipes(new ValidationPipe())
@WebSocketGateway({
    cors: {
        origin: (process.env.CORS_ALLOWED_ORIGINS ?? '')
            .split(',')
            .map((o) => o.trim()),
        credentials: true,
    },
    namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // socketId → userId
    private connectedUsers = new Map<string, string>();
    private readonly publicKey: string;

    constructor(
        private readonly chatService: ChatService,
        private readonly prismaService: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,

    ) {
        this.publicKey = fs.readFileSync(
            path.resolve(this.configService.getOrThrow('PUBLIC_KEY_PATH')),
            'utf8',
        );
    }

    // ─── Подключение ────────────────────────────────────────────

    async handleConnection(socket: Socket) {
        try {
            const token = socket.handshake.auth.token as string;
            const payload = await this.jwtService.verifyAsync(token, {
                publicKey: this.publicKey,
                algorithms: ['ES256'],
            });

            socket.data.userId = payload.id;
            this.connectedUsers.set(socket.id, payload.id);


        } catch {
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        this.connectedUsers.delete(socket.id);
    }

    // ─── Проверка на флуд ────────────────────────────────────────────
    private messageRateLimiter = new Map<string, number[]>();

    private checkRateLimit(userId: string): boolean {
        const now = Date.now();
        const userMessages = this.messageRateLimiter.get(userId) ?? [];
        const recent = userMessages.filter(t => now - t < 1000); // за последнюю секунду
        if (recent.length >= 5) return false; // не более 5 сообщений в секунду
        this.messageRateLimiter.set(userId, [...recent, now]);
        return true;
    }

    // ─── Отправить сообщение ─────────────────────────────────────

    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() dto: SendMessageDto,
    ) {
        const userId = socket.data.userId as string;
        if (!this.checkRateLimit(userId)) {
            throw new WsException('Слишком частые сообщения');
        }

        const chat = await this.chatService.getChat(dto.chatId, userId).catch(() => {
            throw new WsException('Нет доступа к чату');
        });

        if (chat.type === 'channel') {
            const member = chat.members.find(m => m.userId === userId);
            if (!member || !['owner', 'admin'].includes(member.role)) {
                throw new WsException('Недостаточно прав');
            }
        }

        const message = await this.chatService.createMessage(
            dto.chatId, userId, dto.encryptedText,
            {
                encryptedKeySender: dto.encryptedKeySender,
                encryptedKeyRecipient: dto.encryptedKeyRecipient,
                senderPublicKey: dto.senderPublicKey,
                groupKeys: dto.groupKeys,
            },
        );

        this.server.to(dto.chatId).emit('newMessage', message);
        return message;
    }

    @SubscribeMessage('markRead')
    async handleMarkRead(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string },
    ) {
        const userId = socket.data.userId as string;
        await this.chatService.markAsRead(data.chatId, userId);

        // Уведомляем других участников, что сообщения прочитаны
        socket.to(data.chatId).emit('messagesRead', {
            chatId: data.chatId,
            userId,
        });

        return { success: true };
    }

    // ─── Индикатор печати ────────────────────────────────────────

    @SubscribeMessage('typing')
    handleTyping(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string; isTyping: boolean },
    ) {
        const userId = socket.data.userId as string;

        // Отправляем всем в комнате кроме отправителя
        socket.to(data.chatId).emit('userTyping', {
            userId,
            chatId: data.chatId,
            isTyping: data.isTyping,
        });
    }

    // ─── Присоединиться к комнате чата ──────────────────────────

    @SubscribeMessage('joinChat')
    async handleJoinChat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string },
    ) {
        const userId = socket.data.userId as string;

        // Проверяем, имеет ли пользователь доступ к чату
        try {
            await this.chatService.getChat(data.chatId, userId);
        } catch {
            throw new WsException('Нет доступа к чату');
        }

        socket.join(data.chatId);

        // Опционально: можно отправить историю сообщений или "joined" событие
        // const messages = await this.chatService.getMessages(data.chatId, userId, { limit: 50 });
        // socket.emit('chatHistory', messages);

        return { success: true, chatId: data.chatId };
    }

    // ─── Покинуть комнату чата ───────────────────────────────────

    @SubscribeMessage('leaveChat')
    handleLeaveChat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string },
    ) {
        socket.leave(data.chatId);
        return { success: true, chatId: data.chatId };
    }

    // ─── Публичный метод для уведомления из других сервисов ──────

    notifyChat(chatId: string, event: string, data: unknown) {
        this.server.to(chatId).emit(event, data);
    }
}