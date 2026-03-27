import {createParamDecorator, ExecutionContext} from '@nestjs/common';
import type {Request} from 'express';

export const CurrentUser = createParamDecorator(
    (_: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest<Request>();
        return request.user!;
    },
);