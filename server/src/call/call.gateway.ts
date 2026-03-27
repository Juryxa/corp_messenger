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
import {CallService} from './call.service';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import {Injectable, UsePipes, ValidationPipe} from '@nestjs/common';
import {StartCallDto} from './dto/start-call.dto';
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
  namespace: '/call',
})
export class CallGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  // socketId → userId
  private connectedUsers = new Map<string, string>();

  // userId → socketId (чтобы слать конкретному юзеру)
  private userSockets = new Map<string, string>();

  constructor(
      private readonly callService: CallService,
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
        algorithms: ['RS256'],
      });

      socket.data.userId = payload.id;
      this.connectedUsers.set(socket.id, payload.id);
      this.userSockets.set(payload.id, socket.id);

      console.log(`Call gateway подключён: ${payload.id}`);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    const userId = this.connectedUsers.get(socket.id);
    if (userId) {
      this.userSockets.delete(userId);
      this.connectedUsers.delete(socket.id);
    }
  }

  // ─── Начать звонок ───────────────────────────────────────────

  @SubscribeMessage('call:start')
  async handleStartCall(
      @ConnectedSocket() socket: Socket,
      @MessageBody() dto: StartCallDto,
  ) {
    const initiatorId = socket.data.userId as string;

    // Проверяем нет ли уже активного звонка в этом чате
    const existing = await this.callService.getActiveCall(dto.chatId);
    if (existing) throw new WsException('В этом чате уже идёт звонок');

    const call = await this.callService.createCall(dto.chatId, initiatorId, dto.type);

    // Уведомляем всех участников о входящем звонке
    for (const participant of call.participants) {
      if (participant.userId === initiatorId) continue;

      const targetSocketId = this.userSockets.get(participant.userId);
      if (targetSocketId) {
        this.server.to(targetSocketId).emit('call:incoming', {
          callId: call.id,
          chatId: dto.chatId,
          type: dto.type,
          initiatorId,
        });
      }
    }

    // Инициатор заходит в комнату звонка
    socket.join(call.id);

    return { callId: call.id };
  }

  // ─── Принять звонок ─────────────────────────────────────────

  @SubscribeMessage('call:accept')
  async handleAcceptCall(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string },
  ) {
    const userId = socket.data.userId as string;

    await this.callService.updateParticipantStatus(data.callId, userId, 'joined');

    const call = await this.callService.getCall(data.callId);

    // Проверяем все ли участники приняли (для direct звонка)
    const joinedCount = call.participants.filter((p) => p.status === 'joined').length;
    if (call.type === 'direct' && joinedCount >= 2) {
      await this.callService.startCall(data.callId);
      this.server.to(data.callId).emit('call:started', { callId: data.callId });
    }

    socket.join(data.callId);

    // Уведомляем остальных участников
    socket.to(data.callId).emit('call:participant_joined', {
      callId: data.callId,
      userId,
    });

    return { success: true };
  }

  // ─── Отклонить звонок ────────────────────────────────────────

  @SubscribeMessage('call:decline')
  async handleDeclineCall(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string },
  ) {
    const userId = socket.data.userId as string;

    await this.callService.updateParticipantStatus(data.callId, userId, 'declined');

    const call = await this.callService.getCall(data.callId);

    // Если все отклонили — помечаем как пропущенный
    const allDeclined = call.participants.every(
        (p) => p.status === 'declined' || p.status === 'joined',
    );
    if (allDeclined) {
      await this.callService.missCall(data.callId);
    }

    this.server.to(data.callId).emit('call:declined', { callId: data.callId, userId });

    return { success: true };
  }

  // ─── Завершить звонок ────────────────────────────────────────

  @SubscribeMessage('call:end')
  async handleEndCall(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string },
  ) {
    const userId = socket.data.userId as string;

    await this.callService.updateParticipantStatus(data.callId, userId, 'left');
    await this.callService.endCall(data.callId);

    this.server.to(data.callId).emit('call:ended', { callId: data.callId, userId });

    socket.leave(data.callId);

    return { success: true };
  }

  // ─── WebRTC сигнализация ─────────────────────────────────────
  // Сервер просто пробрасывает SDP и ICE между участниками

  @SubscribeMessage('call:offer')
  handleOffer(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string; targetUserId: string; sdp: RTCSessionDescriptionInit },
  ) {
    const fromUserId = socket.data.userId as string;
    const targetSocketId = this.userSockets.get(data.targetUserId);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call:offer', {
        callId: data.callId,
        fromUserId,
        sdp: data.sdp,
      });
    }
  }

  @SubscribeMessage('call:answer')
  handleAnswer(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string; targetUserId: string; sdp: RTCSessionDescriptionInit },
  ) {
    const fromUserId = socket.data.userId as string;
    const targetSocketId = this.userSockets.get(data.targetUserId);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call:answer', {
        callId: data.callId,
        fromUserId,
        sdp: data.sdp,
      });
    }
  }

  @SubscribeMessage('call:ice')
  handleIceCandidate(
      @ConnectedSocket() socket: Socket,
      @MessageBody() data: { callId: string; targetUserId: string; candidate: RTCIceCandidateInit },
  ) {
    const fromUserId = socket.data.userId as string;
    const targetSocketId = this.userSockets.get(data.targetUserId);

    if (targetSocketId) {
      this.server.to(targetSocketId).emit('call:ice', {
        callId: data.callId,
        fromUserId,
        candidate: data.candidate,
      });
    }
  }
}