import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class CallService {
    constructor(private readonly prisma: PrismaService) {}

    async createCall(chatId: string, initiatorId: string, type: 'direct' | 'group') {
        // Получаем всех участников чата
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: { members: true },
        });

        if (!chat) throw new NotFoundException('Чат не найден');

        return this.prisma.call.create({
            data: {
                chatId,
                type,
                status: 'pending',
                participants: {
                    create: chat.members.map((m) => ({
                        userId: m.userId,
                        status: m.userId === initiatorId ? 'joined' : 'invited',
                    })),
                },
            },
            include: { participants: true },
        });
    }

    async startCall(callId: string) {
        return this.prisma.call.update({
            where: { id: callId },
            data: { status: 'active', startedAt: new Date() },
        });
    }

    async endCall(callId: string) {
        return this.prisma.call.update({
            where: { id: callId },
            data: { status: 'ended', endedAt: new Date() },
        });
    }

    async missCall(callId: string) {
        return this.prisma.call.update({
            where: { id: callId },
            data: { status: 'missed', endedAt: new Date() },
        });
    }

    async updateParticipantStatus(
        callId: string,
        userId: string,
        status: 'joined' | 'declined' | 'left',
    ) {
        return this.prisma.callParticipant.updateMany({
            where: { callId, userId },
            data: {
                status,
                joinedAt: status === 'joined' ? new Date() : undefined,
            },
        });
    }

    async getCall(callId: string) {
        const call = await this.prisma.call.findUnique({
            where: { id: callId },
            include: { participants: true },
        });

        if (!call) throw new NotFoundException('Звонок не найден');
        return call;
    }

    async getActiveCall(chatId: string) {
        return this.prisma.call.findFirst({
            where: { chatId, status: { in: ['pending', 'active'] } },
            include: { participants: true },
        });
    }
}