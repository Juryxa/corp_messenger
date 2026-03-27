import {ApiProperty} from '@nestjs/swagger';
import {IsNotEmpty, IsString} from 'class-validator';

export class SaveKeysDto {
    @ApiProperty({ description: 'Публичный ключ в base64' })
    @IsString()
    @IsNotEmpty()
    publicKey: string;

    @ApiProperty({ description: 'Приватный ключ зашифрованный паролем в base64' })
    @IsString()
    @IsNotEmpty()
    encryptedPrivateKey: string;

    @ApiProperty({ description: 'Уникальная соль в base64' })
    @IsString()
    @IsNotEmpty()
    cryptoSalt: string;
}