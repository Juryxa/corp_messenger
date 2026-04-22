import {ApiProperty} from '@nestjs/swagger';
import {IsString, Length} from 'class-validator';

export class LoginTotpDto {
    @ApiProperty({
        description: 'Временный токен полученный после успешного ввода пароля когда включён TOTP',
        example: 'eyJhbGciOiJFUzI1NiJ9...',
    })
    @IsString()
    tempToken: string;

    @ApiProperty({
        description: '6-значный код из приложения аутентификатора (Google Authenticator, Authy)',
        example: '123456',
    })
    @IsString()
    @Length(6, 6, { message: 'Код должен содержать ровно 6 цифр' })
    code: string;
}