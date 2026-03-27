import {BadRequestException, ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {CreateChatDto} from './dto/create-chat.dto';
import {AddMemberDto} from './dto/add-member.dto';
import {MessagesQueryDto} from './dto/messages-query.dto';
import {ChatType} from '../generated/prisma/enums'
import {PrismaService} from "../prisma/prisma.service";

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService
    ){}

    // Получить все чаты юзера
    async getChats(userId: string) {
        return this.prisma.chat.findMany({
            where: {
                members: { some: { userId } },
            },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                employee_Id: true,
                                publicKey: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1, // последнее сообщение для превью
                    include: {
                        sender: {
                            select: { id: true, name: true, surname: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // Получить один чат
    async getChat(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: { id: chatId },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                surname: true,
                                employee_Id: true,
                                publicKey: true,
                            },
                        },
                    },
                },
            },
        });

        if (!chat) throw new NotFoundException('Чат не найден');

        const isMember = chat.members.some((m) => m.userId === userId);
        if (!isMember) throw new ForbiddenException('Нет доступа к чату');

        return chat;
    }

    // Создать чат
    async createChat(userId: string, dto: CreateChatDto) {
        const { type, name, description, targetUserId, memberIds } = dto;

        if (type === ChatType.direct) {
            if (!targetUserId) {
                throw new BadRequestException('Укажите targetUserId для личного чата');
            }

            // Проверяем что такой чат уже не существует
            const existing = await this.prisma.chat.findFirst({
                where: {
                    type: ChatType.direct,
                    AND: [
                        { members: { some: { userId } } },
                        { members: { some: { userId: targetUserId } } },
                    ],
                },
            });

            if (existing) return existing;

            return this.prisma.chat.create({
                data: {
                    type,
                    members: {
                        create: [
                            { userId, role: 'member' },
                            { userId: targetUserId, role: 'member' },
                        ],
                    },
                },
                include: { members: true },
            });
        }

        // group / channel
        if (!name) {
            throw new BadRequestException('Укажите название для группы или канала');
        }

        const members = [
            { userId, role: 'owner' as const },
            ...(memberIds ?? []).map((id) => ({ userId: id, role: 'member' as const })),
        ];

        return this.prisma.chat.create({
            data: {
                type,
                name,
                description,
                members: { create: members },
            },
            include: { members: true },
        });
    }

    //создать сообщение
    async createMessage(chatId: string, senderId: string, text: string, senderText?: string) {
        return this.prisma.message.create({
            data: { chatId, senderId, text, senderText },
            include: {
                sender: {
                    select: {
                        id: true,
                        name: true,
                        surname: true,
                        employee_Id: true,
                    },
                },
            },
        });
    }

    // История сообщений
    async getMessages(chatId: string, userId: string, query: MessagesQueryDto) {
        await this.getChat(chatId, userId); // проверка доступа

        const [messages, total] = await this.prisma.$transaction([
            this.prisma.message.findMany({
                where: { chatId },
                orderBy: { createdAt: 'desc' },
                skip: query.skip,
                take: query.take,
                include: {
                    sender: {
                        select: {
                            id: true,
                            name: true,
                            surname: true,
                            employee_Id: true,
                        },
                    },
                },
            }),
            this.prisma.message.count({ where: { chatId } }),
        ]);

        return {
            messages: messages.reverse(), // хронологический порядок
            total,
            skip: query.skip,
            take: query.take,
        };
    }

    // Добавить участника
    async addMember(chatId: string, requesterId: string, dto: AddMemberDto) {
        const chat = await this.getChat(chatId, requesterId);

        if (chat.type === ChatType.direct) {
            throw new BadRequestException('Нельзя добавить участника в личный чат');
        }

        const requester = chat.members.find((m) => m.userId === requesterId);
        if (!['owner', 'admin'].includes(requester!.role)) {
            throw new ForbiddenException('Недостаточно прав');
        }

        const alreadyMember = chat.members.some((m) => m.userId === dto.userId);
        if (alreadyMember) {
            throw new BadRequestException('Пользователь уже в чате');
        }

        return this.prisma.chatMember.create({
            data: { chatId, userId: dto.userId, role: 'member' },
            include: { user: { select: { id: true, name: true, surname: true } } },
        });

    }

    // Удалить участника
    async removeMember(chatId: string, requesterId: string, targetUserId: string) {
        const chat = await this.getChat(chatId, requesterId);

        if (chat.type === ChatType.direct) {
            throw new BadRequestException('Нельзя удалить участника из личного чата');
        }

        const requester = chat.members.find((m) => m.userId === requesterId);
        const isOwnerOrAdmin = ['owner', 'admin'].includes(requester!.role);
        const isSelf = requesterId === targetUserId;

        if (!isOwnerOrAdmin && !isSelf) {
            throw new ForbiddenException('Недостаточно прав');
        }

        return this.prisma.chatMember.deleteMany({
            where: { chatId, userId: targetUserId },
        });
    }

}
