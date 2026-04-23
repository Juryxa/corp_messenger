import {BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException} from '@nestjs/common';
import {CreateChatDto} from './dto/create-chat.dto';
import {AddMemberDto} from './dto/add-member.dto';
import {MessagesQueryDto} from './dto/messages-query.dto';
import {ChatType} from '../generated/prisma/enums'
import {PrismaService} from "../prisma/prisma.service";
import {Cache, CACHE_MANAGER} from "@nestjs/cache-manager";

@Injectable()
export class ChatService {
    constructor(
        private readonly prisma: PrismaService,
        @Inject(CACHE_MANAGER) private readonly cache: Cache,
    ) {
    }

    // Получить все чаты юзера
    async getChats(userId: string) {
        const cacheKey = `chats:${userId}`;
        const cached = await this.cache.get(cacheKey);
        if (cached) return cached;

        const chats = await this.prisma.chat.findMany({ // ← добавь await
            where: { members: { some: { userId } } },
            include: {
                members: {
                    include: {
                        user: {
                            select: {
                                id: true, name: true, surname: true,
                                employee_Id: true, publicKey: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: {
                        id: true,
                        encryptedText: true,
                        encryptedKeySender: true,
                        encryptedKeyRecipient: true,
                        senderPublicKey: true,
                        createdAt: true,
                        chatId: true,
                        groupKeys: true,
                        sender: {
                            select: { id: true, name: true, surname: true },
                        },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        await this.cache.set(cacheKey, chats, 30);
        return chats;
    }

    async invalidateChatsCache(userId: string) {
        await this.cache.del(`chats:${userId}`);
    }

    // Получить один чат
    async getChat(chatId: string, userId: string) {
        const chat = await this.prisma.chat.findUnique({
            where: {id: chatId},
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
        const {type, name, description, targetUserId, memberIds} = dto;

        if (type === ChatType.direct) {
            if (!targetUserId) {
                throw new BadRequestException('Укажите targetUserId для личного чата');
            }

            // Проверяем что такой чат уже не существует
            const existing = await this.prisma.chat.findFirst({
                where: {
                    type: ChatType.direct,
                    AND: [
                        {members: {some: {userId}}},
                        {members: {some: {userId: targetUserId}}},
                    ],
                },
            });

            if (existing) return existing;

            return this.prisma.chat.create({
                data: {
                    type,
                    members: {
                        create: [
                            {userId, role: 'member'},
                            {userId: targetUserId, role: 'member'},
                        ],
                    },
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
                                    publicKey: true, // ← добавить везде
                                },
                            },
                        },
                    },
                },
            });
        }

        // group / channel
        if (!name) {
            throw new BadRequestException('Укажите название для группы или канала');
        }

        const members = [
            {userId, role: 'owner' as const},
            ...(memberIds ?? []).map((id) => ({userId: id, role: 'member' as const})),
        ];

        return this.prisma.chat.create({
            data: {
                type,
                name,
                description,
                members: {create: members},
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
            },
        });
    }

    //создать сообщение
    async createMessage(
        chatId: string,
        senderId: string,
        encryptedText: string,
        options: {
            encryptedKeySender?: string;
            encryptedKeyRecipient?: string;
            senderPublicKey?: string;
            groupKeys?: { userId: string; encryptedKey: string }[];
        } = {},
    ) {
        // ← AWAIT — это был главный баг
        const message = await this.prisma.message.create({
            data: {
                chatId,
                senderId,
                encryptedText,
                encryptedKeySender: options.encryptedKeySender ?? null,
                encryptedKeyRecipient: options.encryptedKeyRecipient ?? null,
                senderPublicKey: options.senderPublicKey ?? null,
                ...(options.groupKeys ? {
                    groupKeys: {
                        create: options.groupKeys.map(k => ({
                            userId: k.userId,
                            encryptedKey: k.encryptedKey,
                        })),
                    },
                } : {}),
                // Сразу помечаем как прочитанное отправителем
                readBy: {
                    create: {userId: senderId},
                },
            },
            include: {
                sender: {
                    select: {id: true, name: true, surname: true, employee_Id: true},
                },
                groupKeys: true,
                readBy: {select: {userId: true}},
            },
        });

        // Инвалидируем кэш чатов для всех участников
        const chat = await this.prisma.chat.findUnique({
            where: {id: chatId},
            select: {members: {select: {userId: true}}},
        });
        await Promise.all(chat!.members.map(m => this.invalidateChatsCache(m.userId)));

        return message;
    }

// Пометить сообщения прочитанными — создаём записи для каждого сообщения
    async markAsRead(chatId: string, userId: string): Promise<void> {
        // Находим все непрочитанные сообщения в чате (не наши)
        const unread = await this.prisma.message.findMany({
            where: {
                chatId,
                senderId: {not: userId},
                readBy: {none: {userId}}, // ← нет записи о прочтении
            },
            select: {id: true},
        });

        if (unread.length === 0) return;

        // Создаём записи о прочтении
        await this.prisma.messageRead.createMany({
            data: unread.map(m => ({messageId: m.id, userId})),
            skipDuplicates: true,
        });

        await this.invalidateChatsCache(userId);
    }

// Подсчёт непрочитанных — сообщения без записи о прочтении для этого юзера
    async getUnreadCounts(userId: string): Promise<Record<string, number>> {
        // Один запрос вместо N
        const results = await this.prisma.message.groupBy({
            by: ['chatId'],
            where: {
                senderId: { not: userId },
                readBy: { none: { userId } },
                chat: { members: { some: { userId } } },
            },
            _count: { id: true },
        });

        return Object.fromEntries(
            results.map(r => [r.chatId, r._count.id])
        );
    }

// getMessages — включаем readBy
    async getMessages(chatId: string, userId: string, query: MessagesQueryDto) {
        await this.getChat(chatId, userId);

        const [messages, total] = await this.prisma.$transaction([
            this.prisma.message.findMany({
                where: {chatId},
                orderBy: {createdAt: 'desc'},
                skip: query.skip,
                take: query.take,
                include: {
                    sender: {
                        select: {id: true, name: true, surname: true, employee_Id: true},
                    },
                    groupKeys: true,
                    readBy: {select: {userId: true}},
                },
            }),
            this.prisma.message.count({where: {chatId}}),
        ]);

        return {messages: messages.reverse(), total, skip: query.skip, take: query.take};
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
            data: {chatId, userId: dto.userId, role: 'member'},
            include: {user: {select: {id: true, name: true, surname: true}}},
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
            where: {chatId, userId: targetUserId},
        });
    }

}
