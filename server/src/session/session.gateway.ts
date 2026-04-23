import {OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway, WebSocketServer} from '@nestjs/websockets';
import {Server, Socket} from "socket.io";
import {JwtService} from "@nestjs/jwt";
import {ConfigService} from "@nestjs/config";
import * as fs from 'fs';
import * as path from 'path';
import {Injectable, UsePipes, ValidationPipe} from "@nestjs/common";

@Injectable()
@UsePipes(new ValidationPipe())
@WebSocketGateway({
    cors: {
        origin: (process.env.CORS_ALLOWED_ORIGINS ?? '')
            .split(',')
            .map((o) => o.trim()),
        credentials: true,
        transports: ['websocket'],
    },
    namespace: '/session',
})
export class SessionGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    // socketId → userId
    private connectedUsers = new Map<string, string>();
    private readonly publicKey: string;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService
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
            socket.data.sessionId = payload.sessionId;

            // ✅ ключевой момент
            socket.join(`user:${payload.id}`);
            socket.join(`session:${payload.sessionId}`);

            this.connectedUsers.set(socket.id, payload.id);


        } catch {
            socket.disconnect();
        }
    }

    handleDisconnect(socket: Socket) {
        this.connectedUsers.delete(socket.id);
    }

    revokeSession(sessionId: string) {
        this.server.to(`session:${sessionId}`).emit('SESSION_REVOKED');
    }

    revokeAllUserSessions(userId: string) {
        this.server.to(`user:${userId}`).emit('SESSION_REVOKED');
    }
}
