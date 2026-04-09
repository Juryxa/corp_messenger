import {IsOptional, IsString, IsUUID} from 'class-validator';

export class SendMessageDto {
    @IsUUID()
    chatId: string;

    @IsString()
    encryptedText: string;        // AES зашифрованный текст

    @IsString()
    encryptedKeySender: string;   // AES ключ зашифрованный своим RSA

    @IsString()
    @IsOptional()
    encryptedKeyRecipient?: string; // AES ключ зашифрованный RSA получателя (для direct)
}