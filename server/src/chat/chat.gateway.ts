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

    constructor(
        private readonly chatService: ChatService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    // ─── Подключение ────────────────────────────────────────────

    async handleConnection(socket: Socket) {
        try {
            const token = socket.handshake.auth.token as string;

            const publicKey = fs.readFileSync(
                path.resolve(this.configService.getOrThrow('PUBLIC_KEY_PATH')),
                'utf8',
            );

            const payload = await this.jwtService.verifyAsync(token, {
                publicKey,
                algorithms: ['ES256'],
            });

            socket.data.userId = payload.id;
            this.connectedUsers.set(socket.id, payload.id);

            // Подключаем юзера ко всем его чатам автоматически
            const chats = await this.chatService.getChats(payload.id);
            for (const chat of chats) {
                socket.join(chat.id);
            }

            console.log(`Подключён: ${payload.id}`);
        } catch {
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        this.connectedUsers.delete(socket.id);
        console.log(`Отключён: ${socket.id}`);
    }

    // ─── Отправить сообщение ─────────────────────────────────────

    @SubscribeMessage('sendMessage')
    async handleSendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() dto: SendMessageDto,
    ) {
        const userId = socket.data.userId as string;

        const chat = await this.chatService.getChat(dto.chatId, userId).catch(() => {
            throw new WsException('Нет доступа к чату');
        });

        if (chat.type === 'channel') {
            const member = chat.members.find((m) => m.userId === userId);
            if (!member || !['owner', 'admin'].includes(member.role)) {
                throw new WsException('Недостаточно прав для отправки сообщений');
            }
        }

        const message = await this.chatService.createMessage(
            dto.chatId,
            userId,
            dto.encryptedText,
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
    handleJoinChat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string },
    ) {
        socket.join(data.chatId);
        return { success: true };
    }

    // ─── Покинуть комнату чата ───────────────────────────────────

    @SubscribeMessage('leaveChat')
    handleLeaveChat(
        @ConnectedSocket() socket: Socket,
        @MessageBody() data: { chatId: string },
    ) {
        socket.leave(data.chatId);
        return { success: true };
    }

    // ─── Публичный метод для уведомления из других сервисов ──────

    notifyChat(chatId: string, event: string, data: unknown) {
        this.server.to(chatId).emit(event, data);
    }
}