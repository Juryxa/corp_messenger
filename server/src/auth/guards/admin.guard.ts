import {CanActivate, ExecutionContext, ForbiddenException, Injectable} from '@nestjs/common';
import type {Request} from 'express';

@Injectable()
export class AdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const req = context.switchToHttp().getRequest<Request>();
        const user = req.user as unknown as { id: string; role: 'admin' | 'user' } | undefined;

        if (!user) throw new ForbiddenException('Требуется авторизация');
        if (user.role !== 'admin') throw new ForbiddenException('Недостаточно прав');

        return true;
    }
}

