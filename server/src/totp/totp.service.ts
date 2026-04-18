import {Injectable, UnauthorizedException} from '@nestjs/common';
import * as qrcode from 'qrcode';
import {generate, generateSecret, generateURI, verify} from "otplib";
import {PrismaService} from '../prisma/prisma.service';

@Injectable()
export class TotpService {
    constructor(private readonly prisma: PrismaService) {}

    // Генерируем secret и QR-код для настройки
    async generateSetup(userId: string, userEmail: string) {
        const secret = generateSecret();

        const token = await generate({ secret });

        const otpauthUrl = generateURI({
            issuer: "Корпоративный мессенджер",
            label: userEmail,
            secret,
        });

        const qrCodeDataUrl = await qrcode.toDataURL(otpauthUrl);

        // Сохраняем secret (но ещё не включаем 2FA — только после подтверждения)
        await this.prisma.user.update({
            where: { id: userId },
            data: { totpSecret: secret, totpEnabled: false },
        });

        return { secret, qrCodeDataUrl };
    }

    // Подтверждение — пользователь вводит код из приложения
    async confirmSetup(userId: string, code: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { totpSecret: true },
        });

        if (!user?.totpSecret) {
            throw new UnauthorizedException('TOTP не настроен');
        }

        const isValid = await verify({
            token: code,
            secret: user.totpSecret,
        });

        if (!isValid.valid) {
            throw new UnauthorizedException('Неверный код');
        }

        await this.prisma.user.update({
            where: { id: userId },
            data: { totpEnabled: true },
        });

        return true;
    }

    // Отключение 2FA
    async disable(userId: string, code: string) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { totpSecret: true, totpEnabled: true },
        });

        if (!user?.totpEnabled) throw new UnauthorizedException('2FA не включена');

        const isValid = await verify({
            token: code,
            secret: user.totpSecret!,
        });

        if (!isValid.valid) throw new UnauthorizedException('Неверный код');

        await this.prisma.user.update({
            where: { id: userId },
            data: { totpSecret: null, totpEnabled: false },
        });

        return true;
    }

    // Проверка кода при входе
    async verify(secret: string, code: string): Promise<boolean> {
        return (await verify({token: code, secret})).valid;
    }
}