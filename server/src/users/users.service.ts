import {Injectable, NotFoundException} from '@nestjs/common';
import {PrismaService} from '../prisma/prisma.service';
import {SaveKeysDto} from './dto/save-keys.dto';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) {}

    async saveKeys(userId: string, dto: SaveKeysDto) {
        return this.prisma.user.update({
            where: { id: userId },
            data: {
                publicKey: dto.publicKey,
                encryptedPrivateKey: dto.encryptedPrivateKey,
                cryptoSalt: dto.cryptoSalt,
            },
            select: { id: true },
        });
    }
    async getPublicKey(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { publicKey: true },
        });

        if (!user) throw new NotFoundException('Пользователь не найден');
        if (!user.publicKey) throw new NotFoundException('Ключ не найден');

        return { publicKey: user.publicKey };
    }

    async getEncryptedPrivateKey(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { encryptedPrivateKey: true },
        });

        if (!user) throw new NotFoundException('Пользователь не найден');
        if (!user.encryptedPrivateKey) throw new NotFoundException('Ключ не найден');

        return { encryptedPrivateKey: user.encryptedPrivateKey };
    }

    async getCryptoSalt(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { cryptoSalt: true },
        });

        if (!user?.cryptoSalt) throw new NotFoundException('Соль не найдена');
        return { cryptoSalt: user.cryptoSalt };
    }

    async getUser(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                employee_Id: true,
                role: true,
                publicKey: true,
            },
        });

        if (!user) throw new NotFoundException('Пользователь не найден');
        return user;
    }

    async searchUsers(query: string) {
        return this.prisma.user.findMany({
            where: {
                OR: [
                    { name: { contains: query, mode: 'insensitive' } },
                    { surname: { contains: query, mode: 'insensitive' } },
                    { email: { contains: query, mode: 'insensitive' } },
                ],
            },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                employee_Id: true,
                publicKey: true,
            },
        });
    }

    async getContacts(userId: string) {
        const chats = await this.prisma.chat.findMany({
            where: {
                type: 'direct',
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
                                email: true,
                                employee_Id: true,
                                publicKey: true,
                            },
                        },
                    },
                },
            },
        });

        // Возвращаем только собеседников (не себя)
        return chats
            .map((chat) => chat.members.find((m) => m.userId !== userId)?.user)
            .filter(Boolean);
    }

    async lookupUser(params: { email?: string; employeeId?: number }) {
        const user = await this.prisma.user.findFirst({
            where: {
                OR: [
                    ...(params.email ? [{ email: params.email }] : []),
                    ...(typeof params.employeeId === 'number' ? [{ employee_Id: params.employeeId }] : []),
                ],
            },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                employee_Id: true,
                role: true,
                publicKey: true,
            },
        });

        if (!user) throw new NotFoundException('Пользователь не найден');
        return user;
    }

    async setRole(userId: string, role: 'admin' | 'user') {
        const user = await this.prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                name: true,
                surname: true,
                email: true,
                employee_Id: true,
                role: true,
                publicKey: true,
            },
        });

        return user;
    }
}