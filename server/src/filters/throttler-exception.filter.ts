import {ArgumentsHost, Catch, ExceptionFilter, HttpStatus} from '@nestjs/common';
import {ThrottlerException} from '@nestjs/throttler';
import type {Response} from 'express';

@Catch(ThrottlerException)
export class ThrottlerExceptionFilter implements ExceptionFilter {
    catch(_: ThrottlerException, host: ArgumentsHost) {
        const response = host.switchToHttp().getResponse<Response>();

        response.status(HttpStatus.TOO_MANY_REQUESTS).json({
            statusCode: 429,
            message: 'Слишком много попыток. Попробуйте позже.',
        });
    }
}