import {ApiProperty} from '@nestjs/swagger';
import {IsString, Length} from 'class-validator';

export class TotpCodeDto {
    @ApiProperty({
        description: '6-значный код из приложения аутентификатора',
        example: '123456',
    })
    @IsString()
    @Length(6, 6, { message: 'Код должен содержать ровно 6 цифр' })
    code: string;
}