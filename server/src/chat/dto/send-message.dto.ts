import {IsNotEmpty, IsOptional, IsString, IsUUID} from 'class-validator';

export class SendMessageDto {
    @IsUUID()
    @IsNotEmpty()
    chatId: string;

    @IsString()
    @IsNotEmpty()
    text: string; // зашифровано для получателя

    @IsString()
    @IsOptional()
    senderText?: string; // зашифровано для отправителя
}