import {ForbiddenException, Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {CreateTaskDto} from './dto/create-task.dto';

@Injectable()
export class TasksService {
    constructor(private readonly prisma: PrismaService) {}

    async getTasks(userId: string, from?: string, to?: string) {
        return this.prisma.task.findMany({
            where: {
                userId,
                ...(from && to ? {
                    AND: [
                        { startAt: { lte: new Date(to) } },
                        { endAt: { gte: new Date(from) } },
                    ],
                } : {}),
            },
            orderBy: { startAt: 'asc' },
        });
    }

    async getTask(taskId: string, userId: string) {
        const task = await this.prisma.task.findUnique({ where: { id: taskId } });
        if (!task) throw new NotFoundException('Задача не найдена');
        if (task.userId !== userId) throw new ForbiddenException('Нет доступа');
        return task;
    }

    async createTask(userId: string, dto: CreateTaskDto) {
        return this.prisma.task.create({
            data: {
                title: dto.title,
                description: dto.description,
                startAt: new Date(dto.startAt),
                endAt: new Date(dto.endAt),
                priority: (dto.priority as any) ?? 'medium',
                status: (dto.status as any) ?? 'pending',
                userId,
            },
        });
    }

    async updateTask(taskId: string, userId: string, dto: Partial<CreateTaskDto>) {
        await this.getTask(taskId, userId);
        return this.prisma.task.update({
            where: { id: taskId },
            data: {
                ...(dto.title && { title: dto.title }),
                ...(dto.description !== undefined && { description: dto.description }),
                ...(dto.startAt && { startAt: new Date(dto.startAt) }),
                ...(dto.endAt && { endAt: new Date(dto.endAt) }),
                ...(dto.priority && { priority: dto.priority as any }),
                ...(dto.status && { status: dto.status as any }),
            },
        });
    }

    async updateStatus(taskId: string, userId: string, status: string) {
        await this.getTask(taskId, userId);
        return this.prisma.task.update({
            where: { id: taskId },
            data: { status: status as any },
        });
    }

    async deleteTask(taskId: string, userId: string) {
        await this.getTask(taskId, userId);
        await this.prisma.task.delete({ where: { id: taskId } });
        return true;
    }
}