import {BadRequestException, ForbiddenException, Injectable, NotFoundException,} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {CreatePollDto} from './dto/create-poll.dto';
import {VotePollDto} from './dto/vote-poll.dto';

@Injectable()
export class PollsService {
    constructor(private readonly prisma: PrismaService) {}

    async getPolls(userId: string, filter: 'active' | 'finished' | 'all') {
        const now = new Date();

        const where =
            filter === 'active'
                ? { startsAt: { lte: now }, endsAt: { gte: now } }
                : filter === 'finished'
                    ? { endsAt: { lt: now } }
                    : {};

        const polls = await this.prisma.poll.findMany({
            where,
            include: {
                creator: { select: { id: true, name: true, surname: true } },
                options: { orderBy: { order: 'asc' } },
                votes: { select: { userId: true } },
            },
            orderBy: { createdAt: 'desc' },
        });

        return polls.map((poll) => ({
            ...poll,
            totalVoters: new Set(poll.votes.map((v) => v.userId)).size,
            hasVoted: poll.votes.some((v) => v.userId === userId),
            votes: undefined, // скрываем сырые голоса
        }));
    }

    async getPoll(pollId: string, userId: string) {
        const poll = await this.prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                creator: { select: { id: true, name: true, surname: true } },
                options: {
                    orderBy: { order: 'asc' },
                    include: { votes: true },
                },
                votes: {
                    include: {
                        user: { select: { id: true, name: true, surname: true } },
                        option: { select: { id: true, text: true } },
                    },
                },
            },
        });

        if (!poll) throw new NotFoundException('Опрос не найден');

        const hasVoted = poll.votes.some((v) => v.userId === userId);
        const totalVoters = new Set(poll.votes.map((v) => v.userId)).size;

        // Для анонимного опроса скрываем кто голосовал
        const votes = poll.isAnonymous
            ? undefined
            : poll.votes.map((v) => ({
                user: v.user,
                option: v.option,
            }));

        return {
            ...poll,
            hasVoted,
            totalVoters,
            votes,
            options: poll.options.map((opt) => ({
                ...opt,
                voteCount: opt.votes.length,
                votes: undefined,
            })),
        };
    }

    async createPoll(userId: string, dto: CreatePollDto) {
        if (dto.options.length < 2) {
            throw new BadRequestException('Опрос должен содержать минимум 2 варианта');
        }

        return this.prisma.poll.create({
            data: {
                title: dto.title,
                description: dto.description,
                type: dto.type,
                isAnonymous: dto.isAnonymous ?? false,
                startsAt: new Date(dto.startsAt),
                endsAt: new Date(dto.endsAt),
                creatorId: userId,
                options: {
                    create: dto.options.map((o) => ({
                        text: o.text,
                        order: o.order,
                    })),
                },
            },
            include: {
                options: { orderBy: { order: 'asc' } },
                creator: { select: { id: true, name: true, surname: true } },
            },
        });
    }

    async vote(pollId: string, userId: string, dto: VotePollDto) {
        const poll = await this.prisma.poll.findUnique({
            where: { id: pollId },
            include: {
                options: true,
                votes: { where: { userId } },
            },
        });

        if (!poll) throw new NotFoundException('Опрос не найден');

        const now = new Date();
        if (now < poll.startsAt || now > poll.endsAt) {
            throw new BadRequestException('Опрос не активен');
        }

        if (poll.votes.length > 0) {
            throw new BadRequestException('Вы уже проголосовали');
        }

        if (poll.type === 'single' && dto.optionIds.length !== 1) {
            throw new BadRequestException('Выберите один вариант');
        }

        const validOptionIds = poll.options.map((o) => o.id);
        const invalid = dto.optionIds.filter((id) => !validOptionIds.includes(id));
        if (invalid.length > 0) {
            throw new BadRequestException('Недопустимый вариант ответа');
        }

        await this.prisma.pollVote.createMany({
            data: dto.optionIds.map((optionId) => ({
                pollId,
                userId,
                optionId,
            })),
        });

        return this.getPoll(pollId, userId);
    }

    async deletePoll(pollId: string, userId: string, userRole: string) {
        const poll = await this.prisma.poll.findUnique({ where: { id: pollId } });
        if (!poll) throw new NotFoundException('Опрос не найден');

        if (poll.creatorId !== userId && userRole !== 'admin') {
            throw new ForbiddenException('Нет прав для удаления');
        }

        await this.prisma.poll.delete({ where: { id: pollId } });
        return true;
    }
}